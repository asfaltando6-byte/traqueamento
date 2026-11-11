import {ensureMetricsSchema} from '../../_shared/metrics-schema.js';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function onRequestPost({request,env}){
 const cron=env.SYNC_SECRET&&request.headers.get('x-sync-secret')===env.SYNC_SECRET;
 const dashboard=env.DASH_KEY&&request.headers.get('x-dashboard-key')===env.DASH_KEY;
 if(!cron&&!dashboard)return json({error:'Unauthorized'},401);
 if(!env.META_ADS_ACCESS_TOKEN||!env.META_ADS_ACCOUNT_ID)return json({error:'Configure META_ADS_ACCESS_TOKEN e META_ADS_ACCOUNT_ID na Cloudflare.'},409);
 let body={};try{body=await request.json()}catch{}
 const today=new Date(Date.now()-3*3600000).toISOString().slice(0,10);
 const days=Math.max(1,Math.min(90,parseInt(body.days,10)||7));
 const fallback=new Date(Date.parse(today+'T12:00:00Z')-(days-1)*86400000).toISOString().slice(0,10);
 const valid=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
 if((body.date_from&&!valid(body.date_from))||(body.date_to&&!valid(body.date_to)))return json({error:'Período inválido'},422);
 const from=body.date_from||fallback,to=body.date_to||today;
 if(from>to||to>today||Date.parse(to)-Date.parse(from)>89*86400000)return json({error:'Escolha um período de até 90 dias, sem datas futuras.'},422);
 const started=Date.now(),snapshot=crypto.randomUUID(),now=Math.floor(Date.now()/1000);let count=0;
 try{
  const account=String(env.META_ADS_ACCOUNT_ID).replace(/^act_/,'');if(!/^\d+$/.test(account))throw Error('ID da conta Meta inválido');
  const version=/^v\d+\.\d+$/.test(env.META_GRAPH_VERSION||'')?env.META_GRAPH_VERSION:'v25.0';
  const base='https://graph.facebook.com/'+version+'/act_'+account;
  const inventoryUrl=new URL(base+'/ads');inventoryUrl.searchParams.set('fields','id,name,effective_status,campaign{id,name},adset{id,name},creative{thumbnail_url}');inventoryUrl.searchParams.set('limit','250');
  const insightsUrl=new URL(base+'/insights');insightsUrl.searchParams.set('fields','ad_id,ad_name,campaign_id,campaign_name,spend,impressions,inline_link_clicks,account_currency,date_start');insightsUrl.searchParams.set('level','ad');insightsUrl.searchParams.set('time_increment','1');insightsUrl.searchParams.set('time_range',JSON.stringify({since:from,until:to}));insightsUrl.searchParams.set('limit','500');
  const [inventory,insights]=await Promise.all([fetchPages(inventoryUrl,env.META_ADS_ACCESS_TOKEN),fetchPages(insightsUrl,env.META_ADS_ACCESS_TOKEN)]);
  const ads=inventory.map(r=>({ad_id:String(r.id),name:r.name||'',campaign_id:String(r.campaign?.id||''),campaign_name:r.campaign?.name||'',adset_id:String(r.adset?.id||''),adset_name:r.adset?.name||'',effective_status:r.effective_status||'UNKNOWN',thumbnail_url:cleanThumbnail(r.creative?.thumbnail_url)}));
  const rows=insights.map(r=>({date:r.date_start,ad_id:String(r.ad_id||''),campaign_id:String(r.campaign_id||''),campaign_name:r.campaign_name||'',ad_name:r.ad_name||'',currency:r.account_currency||'BRL',spend_cents:Math.round(Number(r.spend||0)*100),impressions:Number(r.impressions||0),link_clicks:Number(r.inline_link_clicks||0)}));
  if(rows.some(r=>!r.ad_id||!valid(r.date)||r.date<from||r.date>to||!Number.isFinite(r.spend_cents)))throw Error('A Meta retornou dados fora do período esperado');
  await ensureMetricsSchema(env.DB);
  const dates=[];for(let d=Date.parse(from+'T12:00:00Z');d<=Date.parse(to+'T12:00:00Z');d+=86400000)dates.push(new Date(d).toISOString().slice(0,10));
  // Publish inventory, daily insights and legacy totals atomically. JSON inserts keep query count low.
  await env.DB.batch([
   env.DB.prepare(`INSERT INTO meta_ads SELECT ?,json_extract(value,'$.ad_id'),json_extract(value,'$.name'),json_extract(value,'$.campaign_id'),json_extract(value,'$.campaign_name'),json_extract(value,'$.adset_id'),json_extract(value,'$.adset_name'),json_extract(value,'$.effective_status'),json_extract(value,'$.thumbnail_url'),? FROM json_each(?)`).bind(snapshot,now,JSON.stringify(ads)),
   env.DB.prepare(`INSERT INTO meta_ad_daily SELECT ?,json_extract(value,'$.date'),json_extract(value,'$.ad_id'),json_extract(value,'$.campaign_id'),json_extract(value,'$.campaign_name'),json_extract(value,'$.ad_name'),json_extract(value,'$.currency'),json_extract(value,'$.spend_cents'),json_extract(value,'$.impressions'),json_extract(value,'$.link_clicks'),? FROM json_each(?)`).bind(snapshot,now,JSON.stringify(rows)),
   env.DB.prepare(`INSERT INTO meta_day_snapshots(date,snapshot_id) SELECT value,? FROM json_each(?) WHERE true ON CONFLICT(date) DO UPDATE SET snapshot_id=excluded.snapshot_id`).bind(snapshot,JSON.stringify(dates)),
   env.DB.prepare(`INSERT INTO metrics_state(key,value,updated_at) VALUES('meta_inventory',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`).bind(snapshot,now),
   env.DB.prepare("DELETE FROM ad_spend WHERE platform='meta' AND date>=? AND date<=?").bind(from,to),
   env.DB.prepare("INSERT INTO ad_spend(platform,date,campaign_id,campaign_name,ad_id,ad_name,spend_cents,currency,impressions,clicks,synced_at) SELECT 'meta',date,campaign_id,campaign_name,ad_id,ad_name,spend_cents,currency,impressions,link_clicks,synced_at FROM meta_ad_daily WHERE snapshot_id=?").bind(snapshot),
   env.DB.prepare("INSERT INTO metrics_state(key,value,updated_at) VALUES('meta_link_clicks_ready','1',?) ON CONFLICT(key) DO UPDATE SET updated_at=excluded.updated_at").bind(now),
   env.DB.prepare("INSERT INTO sync_log(platform,status,rows_upserted,date_from,date_to,duration_ms,run_at) VALUES('meta','ok',?,?,?,?,?)").bind(rows.length,from,to,Date.now()-started,now),
   env.DB.prepare("DELETE FROM meta_ads WHERE synced_at<? AND snapshot_id!=(SELECT value FROM metrics_state WHERE key='meta_inventory')").bind(now-3600),
   env.DB.prepare("DELETE FROM meta_ad_daily WHERE synced_at<? AND snapshot_id NOT IN (SELECT snapshot_id FROM meta_day_snapshots)").bind(now-3600)
  ]);
  count=rows.length;return json({ok:true,rows_upserted:count,ads_synced:ads.length,active_ads:ads.filter(a=>a.effective_status==='ACTIVE').length,date_from:from,date_to:to});
 }catch(err){
  console.error('Meta synchronization failed',err.message);
  try{await env.DB.prepare("INSERT INTO sync_log(platform,status,error_message,run_at) VALUES('meta','error',?,?)").bind(String(err.message).slice(0,250),now).run()}catch{}
  return json({error:err.message||'Falha ao sincronizar Meta',rows_upserted:count},502);
 }
}
async function fetchPages(first,token){
 let next=String(first),rows=[];for(let page=0;next&&page<30;page++){
 const url=new URL(next);if(url.hostname!=='graph.facebook.com'||url.protocol!=='https:')throw Error('Paginação Meta inválida');url.searchParams.delete('access_token');
 const response=await fetch(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});const data=await response.json();
 if(!response.ok||data.error)throw Error('Meta API: confira o token, a permissão ads_read e o acesso à conta (código '+(data.error?.code||response.status)+').');
 if(!Array.isArray(data.data))throw Error('Resposta Meta inválida');rows.push(...data.data);next=data.paging?.next||'';
 }if(next)throw Error('Volume acima do limite de paginação. Reduza o período.');return rows;
}
function cleanThumbnail(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:''}catch{return ''}}
