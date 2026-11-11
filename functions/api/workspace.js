import {ensureMetricsSchema} from '../_shared/metrics-schema.js';
import {ensureWorkspace,authorized,json,configuredEnv,readSetting,writeSetting,encrypt,metaAccounts,httpsOrigin} from '../_shared/workspace.js';
export async function onRequestGet({request,env}){
 if(!authorized(request,env))return json({error:'Unauthorized'},401);
 try{await ensureWorkspace(env.DB);await ensureMetricsSchema(env.DB);const settings=await configuredEnv(env);const [sites,connections,products]=await env.DB.batch([
 env.DB.prepare('SELECT s.*,(SELECT MAX(created_at) FROM tracking_events e WHERE e.origin=s.origin) last_event FROM tracking_sites s ORDER BY created_at DESC'),
 env.DB.prepare('SELECT id,name,platform,enabled,created_at FROM payment_connections ORDER BY created_at DESC'),
 env.DB.prepare("SELECT product_id,MAX(product_name) name,COUNT(*) sales,SUM(CASE WHEN currency='BRL' THEN value ELSE 0 END) revenue FROM purchase_log GROUP BY product_id ORDER BY revenue DESC")]);
 let accounts=[];try{accounts=JSON.parse(await readSetting(env,'META_ACCOUNTS')||'[]')}catch{}
 return json({sites:sites.results,connections:connections.results,products:products.results,meta:{connected:Boolean(settings.META_ADS_ACCESS_TOKEN),account_id:settings.META_ADS_ACCOUNT_ID||'',accounts,oauth_ready:Boolean(settings.META_APP_ID&&settings.META_APP_SECRET),app_id:settings.META_APP_ID||'',config_id:settings.META_LOGIN_CONFIG_ID||'',redirect_uri:new URL('/api/meta/oauth/callback',request.url).href},utm:'utm_source={{site_source_name}}&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}'});
 }catch{ return json({error:'Não foi possível ler as configurações. Confira o banco e a chave de criptografia.'},500)}
}
export async function onRequestPost({request,env}){
 if(!authorized(request,env))return json({error:'Unauthorized'},401);
 try{await ensureWorkspace(env.DB);const b=await request.json();const now=Math.floor(Date.now()/1000);
 switch(b.action){
 case 'save_site':{const name=String(b.name||'').trim().slice(0,100);if(!name)throw Error('Informe o nome do site.');const origin=httpsOrigin(b.origin);let hosts=String(b.checkout_hosts||'pay.cakto.com.br,pay.kiwify.com.br,pay.hotmart.com').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);if(hosts.length>20||hosts.some(h=>!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(h)))throw Error('Use domínios de checkout separados por vírgula, sem https://.');const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO tracking_sites(id,name,origin,checkout_hosts,created_at) VALUES(?,?,?,?,?) ON CONFLICT(origin) DO UPDATE SET name=excluded.name,checkout_hosts=excluded.checkout_hosts,enabled=1').bind(id,name,origin,JSON.stringify(hosts),now).run();return json({ok:true});}
 case 'site_enabled':{await env.DB.prepare('UPDATE tracking_sites SET enabled=? WHERE id=?').bind(b.enabled?1:0,String(b.id||'')).run();return json({ok:true});}
 case 'save_payment':{if(b.platform!=='cakto')throw Error('Este formulário conecta Cakto. Outras plataformas exigem seus adaptadores específicos.');const name=String(b.name||'').trim().slice(0,100);if(!name||typeof b.secret!=='string'||b.secret.length<8)throw Error('Informe nome e chave secreta da Cakto (mínimo de 8 caracteres).');const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO payment_connections(id,name,platform,secret_encrypted,created_at) VALUES(?,?,?,?,?)').bind(id,name,'cakto',await encrypt(env,b.secret),now).run();return json({ok:true,id});}
 case 'payment_enabled':{await env.DB.prepare('UPDATE payment_connections SET enabled=? WHERE id=?').bind(b.enabled?1:0,String(b.id||'')).run();return json({ok:true});}
 case 'connect_meta_token':{if(typeof b.token!=='string'||b.token.length<20||b.token.length>10000)throw Error('Informe o token de acesso da Meta.');const accounts=await metaAccounts(b.token);if(!accounts.length)throw Error('Nenhuma conta de anúncios acessível. Confira a permissão ads_read.');const selected=b.account_id?accounts.find(a=>a.id===String(b.account_id).replace(/^act_/,'')):accounts[0];if(!selected)throw Error('A conta selecionada não pertence a esta autorização.');await writeSetting(env,'META_ADS_ACCESS_TOKEN',await encrypt(env,b.token));await writeSetting(env,'META_ADS_ACCOUNT_ID',selected.id);await writeSetting(env,'META_ACCOUNTS',JSON.stringify(accounts));return json({ok:true,accounts});}
 case 'select_account':{const conf=await configuredEnv(env);if(!conf.META_ADS_ACCESS_TOKEN)throw Error('Conecte a Meta primeiro.');const accounts=await metaAccounts(conf.META_ADS_ACCESS_TOKEN);const selected=accounts.find(a=>a.id===String(b.account_id));if(!selected)throw Error('Conta não autorizada.');await writeSetting(env,'META_ADS_ACCOUNT_ID',selected.id);await writeSetting(env,'META_ACCOUNTS',JSON.stringify(accounts));return json({ok:true});}
 case 'save_meta_app':{if(!/^\d+$/.test(String(b.app_id||''))||typeof b.app_secret!=='string'||b.app_secret.length<16)throw Error('Informe App ID e App Secret válidos.');if(b.config_id&&!/^\d+$/.test(String(b.config_id)))throw Error('Config ID inválido.');await writeSetting(env,'META_APP_ID',b.app_id);await writeSetting(env,'META_APP_SECRET',await encrypt(env,b.app_secret));await writeSetting(env,'META_LOGIN_CONFIG_ID',b.config_id||'');return json({ok:true});}
 default:throw Error('Ação não reconhecida.');
 }
 }catch(e){return json({error:e.message||'Não foi possível salvar.'},400)}
}
