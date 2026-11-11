export const minerSchema=[
`CREATE TABLE IF NOT EXISTS miner_ads (id TEXT PRIMARY KEY,ad_id TEXT NOT NULL,country TEXT NOT NULL,name TEXT NOT NULL,page_name TEXT NOT NULL,landing_url TEXT NOT NULL,offer_key TEXT NOT NULL,body TEXT NOT NULL,format TEXT NOT NULL,niche TEXT NOT NULL,start_date TEXT NOT NULL,status TEXT NOT NULL,verified_at INTEGER NOT NULL,first_seen INTEGER NOT NULL,source TEXT NOT NULL,UNIQUE(ad_id,country))`,
`CREATE TABLE IF NOT EXISTS miner_observations (id INTEGER PRIMARY KEY AUTOINCREMENT,ad_id TEXT NOT NULL,country TEXT NOT NULL,status TEXT NOT NULL,observed_at INTEGER NOT NULL,source TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS miner_boards (offer_key TEXT PRIMARY KEY,favorite INTEGER NOT NULL DEFAULT 0,board TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '')`];
const ready=new WeakMap();export async function ensureMiner(db){if(!ready.has(db))ready.set(db,db.batch(minerSchema.map(s=>db.prepare(s))).catch(e=>{ready.delete(db);throw e}));await ready.get(db)}
const str=(v,n=500)=>String(v||'').trim().slice(0,n);
export function normalizeAd(input,now=Math.floor(Date.now()/1000)){
 const ad_id=str(input.ad_id,40);if(!/^\d{5,40}$/.test(ad_id))throw Error('Informe o ID numérico do anúncio na Biblioteca.');
 const country=str(input.country);if(!['BR','US'].includes(country))throw Error('Selecione BR ou US.');
 let landing;try{landing=new URL(input.landing_url);if(landing.protocol!=='https:'||landing.username||landing.password)throw Error()}catch{throw Error('A página de vendas precisa ser uma URL HTTPS válida.');}
 // Remove tracking only. Preserve offer identifiers and checkout product query parameters.
 for(const k of [...landing.searchParams.keys()])if(/^utm_|^(fbclid|gclid|src|sck)$/i.test(k))landing.searchParams.delete(k);
 landing.hash='';landing.searchParams.sort();landing.hostname=landing.hostname.replace(/^www\./,'');
 const start_date=str(input.start_date,10);const started=Date.parse(start_date+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(start_date)||!Number.isFinite(started)||new Date(started).toISOString().slice(0,10)!==start_date||started>now*1000||started<Date.parse('2000-01-01'))throw Error('Informe uma data de início válida, sem data futura.');
 const status=str(input.status);if(!['active','inactive','unknown'].includes(status))throw Error('Status inválido.');
 const verified_at=Number(input.verified_at)||now;if(!Number.isInteger(verified_at)||verified_at>now+60||verified_at<started/1000)throw Error('Data de verificação inválida.');
 const name=str(input.name,150),page_name=str(input.page_name,150);if(!name||!page_name)throw Error('Informe o nome da oferta e do anunciante.');
 return {id:ad_id+':'+country,ad_id,country,name,page_name,landing_url:landing.href,offer_key:landing.href,body:str(input.body,4000),format:['image','video','carousel'].includes(input.format)?input.format:'unknown',niche:str(input.niche,100),start_date,status,verified_at,first_seen:now,source:'manual'};
}
export function groupOffers(ads,boards=[],now=Math.floor(Date.now()/1000)){
 const saved=new Map(boards.map(b=>[b.offer_key,b])),groups=new Map();
 for(const a of ads){const stale=now-a.verified_at>7*86400;const item={...a,current_status:stale?'unknown':a.status,stale,days_since_start:Math.max(0,Math.floor(now/86400)-Math.floor(Date.parse(a.start_date+'T00:00:00Z')/86400000)),library_url:'https://www.facebook.com/ads/library/?id='+a.ad_id};if(!groups.has(a.offer_key))groups.set(a.offer_key,{offer_key:a.offer_key,name:a.name,page_name:a.page_name,landing_url:a.landing_url,ads:[],...saved.get(a.offer_key)});groups.get(a.offer_key).ads.push(item);}
 return [...groups.values()].map(g=>{const active=g.ads.filter(a=>a.current_status==='active');return {...g,countries:[...new Set(g.ads.map(a=>a.country))],active_ads:new Set(active.map(a=>a.ad_id)).size,total_ads:new Set(g.ads.map(a=>a.ad_id)).size,oldest_active_days:active.length?Math.max(...active.map(a=>a.days_since_start)):null,first_seen:Math.min(...g.ads.map(a=>a.first_seen)),last_verified:Math.max(...g.ads.map(a=>a.verified_at))}});
}
