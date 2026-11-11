import {ensureWorkspace} from '../_shared/workspace.js';
import {ensureMetricsSchema} from '../_shared/metrics-schema.js';
const defaults=['https://licores-por-encomenda.ivan-fts007.chatgpt.site'];
function headers(origin){return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','Cache-Control':'no-store'};}
async function allowed(request,env){const origin=request.headers.get('Origin')||'';const own=new URL(request.url).origin;const configured=String(env.TRACKING_ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);try{await ensureWorkspace(env.DB);const site=await env.DB.prepare('SELECT enabled FROM tracking_sites WHERE origin=?').bind(origin).first();if(site)return site.enabled?origin:null}catch{}return [own,...defaults,...configured].includes(origin)?origin:null}
export async function onRequestOptions({request,env}){const origin=await allowed(request,env);return new Response(null,{status:origin?204:403,headers:origin?headers(origin):{}});}
export async function onRequestPost({request,env}){
 const origin=await allowed(request,env);if(!origin)return new Response(null,{status:403});
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers(origin),'Content-Type':'application/json'}});
 if(/bot|crawler|spider|headless|preview|facebookexternalhit/i.test(request.headers.get('User-Agent')||''))return reply({ok:true,skipped:'bot'});
 let body;try{const raw=await request.text();if(raw.length>8000)return reply({error:'Payload too large'},413);body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
 if(!['page_view','checkout_click'].includes(body.event_type)||!/^[-a-zA-Z0-9]{12,80}$/.test(body.visit_id||''))return reply({error:'Invalid event'},422);
 const trim=v=>String(v||'').slice(0,500);const now=Math.floor(Date.now()/1000);
 try{
 await ensureMetricsSchema(env.DB);
 await env.DB.batch([
 env.DB.prepare('INSERT OR IGNORE INTO tracking_events(event_id,visit_id,event_type,origin,path,utm_source,utm_campaign,utm_content,utm_term,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(origin+':'+body.visit_id+':'+body.event_type,body.visit_id,body.event_type,origin,trim(body.path).split('?')[0],trim(body.utm_source),trim(body.utm_campaign),trim(body.utm_content),trim(body.utm_term),now),
 env.DB.prepare("INSERT OR IGNORE INTO metrics_state(key,value,updated_at) VALUES('collection_started',?,?)").bind(String(now),now)
 ]);return reply({ok:true});
 }catch{ return reply({error:'Collection unavailable'},503)}
}
