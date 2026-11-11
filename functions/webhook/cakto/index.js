// Official Cakto V1/V2 contract: https://docs.cakto.com.br/conceitos/webhooks
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
async function sameSecret(a,b){
  const encode=new TextEncoder();
  const [x,y]=await Promise.all([crypto.subtle.digest('SHA-256',encode.encode(a)),crypto.subtle.digest('SHA-256',encode.encode(b))]);
  const left=new Uint8Array(x),right=new Uint8Array(y);let diff=0;for(let i=0;i<left.length;i++)diff|=left[i]^right[i];return diff===0;
}
export async function onRequestPost({request,env}){
  if(!env.CAKTO_WEBHOOK_SECRET)return json({error:'Webhook não configurado'},503);
  let raw;let payload;
  try {raw=await request.text();if(raw.length>500000)return json({error:'Payload muito grande'},413);payload=JSON.parse(raw);} catch{return json({error:'JSON inválido'},400);}
  const signature=request.headers.get('X-Cakto-Signature');
  if(signature){
    const timestamp=request.headers.get('X-Cakto-Timestamp');
    if(!timestamp||!Number.isFinite(Number(timestamp))||Math.abs(Date.now()/1000-Number(timestamp))>300)return json({error:'Unauthorized'},401);
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.CAKTO_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+raw));
    const expected='v1='+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
    if(!await sameSecret(signature,expected))return json({error:'Unauthorized'},401);
  }else if(typeof payload.secret!=='string'||!await sameSecret(payload.secret,env.CAKTO_WEBHOOK_SECRET))return json({error:'Unauthorized'},401);
  if(payload.event!=='purchase_approved')return json({ok:true,skipped:'Somente compras aprovadas são importadas'});
  const orders=Array.isArray(payload.data)?payload.data:[payload.data];
  if(!orders.length||orders.length>100)return json({error:'Lote inválido'},400);
  for(const order of orders){
    if(!order||order.status!=='paid'||typeof order.id!=='string'||typeof order.amount!=='number'||!Number.isFinite(order.amount)||order.amount<0||!/^[A-Z]{3}$/.test(order.currency||''))return json({error:'Pedido inválido: confira id, status, amount e currency'},422);
  }
  try{
    const statements=[];
    for(const order of orders){
      const time=Number.isFinite(Date.parse(order.paidAt))?Math.floor(Date.parse(order.paidAt)/1000):Math.floor(Date.now()/1000);
      const id='cakto:'+order.id;const product=String(order.product?.id||order.offer?.id||'cakto');
      const name=String(order.product?.name||order.offer?.name||'Licores por Encomenda');
      statements.push(env.DB.prepare(`INSERT INTO purchase_log (trk,event_id,event_time,raw_email,raw_name,raw_phone,value,currency,transaction_id,product_id,product_name,utm_source,utm_medium,utm_campaign,utm_content,utm_term,fbp,fbc,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(transaction_id) DO NOTHING`).bind(String(order.sck||''),id,time,String(order.customer?.email||''),String(order.customer?.name||''),String(order.customer?.phone||''),order.amount,order.currency,id,product,name,String(order.utm_source||''),String(order.utm_medium||''),String(order.utm_campaign||''),String(order.utm_content||''),String(order.utm_term||''),String(order.fbp||''),String(order.fbc||''),time));
      statements.push(env.DB.prepare(`INSERT INTO purchase_items (purchase_id,transaction_id,product_id,product_name,value,currency,created_at,utm_source,utm_campaign,utm_medium,utm_content,utm_term) SELECT id,transaction_id,product_id,product_name,value,currency,created_at,utm_source,utm_campaign,utm_medium,utm_content,utm_term FROM purchase_log WHERE transaction_id=? AND NOT EXISTS (SELECT 1 FROM purchase_items WHERE transaction_id=?)`).bind(id,id));
    }
    await env.DB.batch(statements);
    return json({ok:true,processed:orders.length});
  }catch(err){console.error('Cakto persistence failed',err.message);return json({error:'Falha ao salvar. Reenvie o evento pelo histórico da Cakto.'},500);}
}
