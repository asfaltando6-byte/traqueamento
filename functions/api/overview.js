const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}});
export async function onRequestGet({request, env}) {
  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) return json({error:'Unauthorized'},401);
  const days = Math.max(1,Math.min(90,parseInt(url.searchParams.get('days'),10)||30));
  const today = new Date(Date.now()-3*3600000).toISOString().slice(0,10);
  const midnight = Date.parse(today+'T00:00:00-03:00');
  const since = Math.floor(midnight/1000)-(days-1)*86400;
  const date = new Date(since*1000-3*3600000).toISOString().slice(0,10);
  try {
    const result = await env.DB.batch([
      env.DB.prepare("SELECT COUNT(*) sales, COALESCE(SUM(value),0) revenue, COALESCE(AVG(value),0) aov FROM purchase_log WHERE created_at>=? AND currency='BRL'").bind(since),
      env.DB.prepare("SELECT COALESCE(SUM(spend_cents),0)/100.0 spend, COALESCE(SUM(clicks),0) clicks, COALESCE(SUM(impressions),0) impressions FROM ad_spend WHERE date>=? AND date<=? AND currency='BRL'").bind(date,today),
      env.DB.prepare("SELECT MAX(run_at) synced FROM sync_log WHERE status='ok' AND platform='meta'"),
      env.DB.prepare("SELECT date(created_at,'unixepoch','-3 hours') day, SUM(value) revenue, COUNT(*) sales FROM purchase_log WHERE created_at>=? AND currency='BRL' GROUP BY day ORDER BY day").bind(since),
      env.DB.prepare("SELECT utm_campaign campaign, utm_source source, COUNT(*) sales, SUM(value) revenue FROM purchase_log WHERE created_at>=? AND currency='BRL' GROUP BY utm_campaign,utm_source ORDER BY revenue DESC LIMIT 100").bind(since),
      env.DB.prepare("SELECT product_name name, product_id, COUNT(*) sales, SUM(value) revenue FROM purchase_log WHERE created_at>=? AND currency='BRL' GROUP BY product_id,product_name ORDER BY revenue DESC LIMIT 10").bind(since),
      env.DB.prepare("SELECT created_at,product_name,value,currency,utm_source,utm_campaign,transaction_id FROM purchase_log WHERE created_at>=? ORDER BY created_at DESC LIMIT 50").bind(since),
      env.DB.prepare("SELECT campaign_id,MAX(campaign_name) name,SUM(spend_cents)/100.0 spend FROM ad_spend WHERE date>=? AND date<=? AND currency='BRL' GROUP BY campaign_id ORDER BY spend DESC").bind(date,today),
      env.DB.prepare("SELECT COUNT(*) count FROM purchase_log WHERE created_at>=? AND currency!='BRL'").bind(since)
    ]);
    const [totals,ads,sync] = result.slice(0,3).map(r=>r.results[0]||{});
    return json({days,totals,ads,spend_available:Boolean(sync.synced),last_synced_at:sync.synced||null,series:result[3].results,campaigns:result[4].results,products:result[5].results,purchases:result[6].results,ad_campaigns:result[7].results,other_currencies:result[8].results[0]?.count||0,integrations:{cakto_configured:Boolean(env.CAKTO_WEBHOOK_SECRET),meta_configured:Boolean(env.META_PIXEL_ID&&env.META_ACCESS_TOKEN),ads_configured:Boolean(env.META_ADS_ACCESS_TOKEN&&env.META_ADS_ACCOUNT_ID&&env.SYNC_SECRET)}});
  } catch (err) {console.error('Overview query failed',err.message);return json({error:'Não foi possível consultar o banco. Confira a associação DB e as tabelas.'},500);}
}
