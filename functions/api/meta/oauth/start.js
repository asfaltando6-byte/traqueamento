import {authorized,configuredEnv,ensureWorkspace,json} from '../../../_shared/workspace.js';
export async function onRequestPost({request,env}){
 if(!authorized(request,env))return json({error:'Unauthorized'},401);
 try{await ensureWorkspace(env.DB);const config=await configuredEnv(env);if(!config.META_APP_ID||!config.META_APP_SECRET)return json({error:'Configure seu aplicativo Meta na seção Configurar login do Facebook. O login requer um aplicativo autorizado pela Meta.'},409);
 const state=crypto.randomUUID()+crypto.randomUUID();const browser=crypto.randomUUID();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(browser))),b=>b.toString(16).padStart(2,'0')).join('');await env.DB.prepare('INSERT INTO oauth_states(state,browser_hash,expires_at) VALUES(?,?,?)').bind(state,hash,Math.floor(Date.now()/1000)+600).run();
 const callback=new URL('/api/meta/oauth/callback',request.url).href;const url=new URL('https://www.facebook.com/v25.0/dialog/oauth');url.searchParams.set('client_id',config.META_APP_ID);url.searchParams.set('redirect_uri',callback);url.searchParams.set('response_type','code');url.searchParams.set('state',state);if(config.META_LOGIN_CONFIG_ID)url.searchParams.set('config_id',config.META_LOGIN_CONFIG_ID);else url.searchParams.set('scope','ads_read');
 const response=json({url:url.href});response.headers.set('Set-Cookie','meta_oauth_browser='+browser+'; HttpOnly; Secure; SameSite=Lax; Path=/api/meta/oauth; Max-Age=600');return response;
 }catch{return json({error:'Não foi possível iniciar a conexão Meta.'},500)}
}
