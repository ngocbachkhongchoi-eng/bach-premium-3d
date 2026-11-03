'use strict';
const crypto=require('node:crypto');
function createGoogleAuth({env=process.env,secret,request=fetch,clock=Date.now}){
 const client=env.GOOGLE_CLIENT_ID,clientSecret=env.GOOGLE_CLIENT_SECRET;
 let redirect=env.GOOGLE_REDIRECT_URI;
 if(!redirect&&env.RENDER_EXTERNAL_URL){try{redirect=new URL('/api/auth/google/callback',env.RENDER_EXTERNAL_URL).href}catch{}}
 let valid=false;
 try{const u=new URL(redirect);valid=u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/api/auth/google/callback'&&!u.search&&!u.hash}catch{}
 const enabled=Boolean(client&&clientSecret&&valid);
 const mac=s=>crypto.createHmac('sha256',secret).update('google-oauth:'+s).digest('base64url');
 const cookie=(value,age=600)=>'bp_google='+value+'; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age='+age+(env.NODE_ENV==='production'?'; Secure':'');
 function begin(){
  if(!enabled)throw Error('Google is not configured');
  const state=crypto.randomBytes(32).toString('base64url'),verifier=crypto.randomBytes(32).toString('base64url');
  const payload=Buffer.from(JSON.stringify({state,verifier,exp:clock()+600000})).toString('base64url');
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search=new URLSearchParams({client_id:client,redirect_uri:redirect,response_type:'code',scope:'openid email profile',state,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'}).toString();
  return {url:url.href,cookie:cookie(payload+'.'+mac(payload))};
 }
 async function finish(query,cookies=''){
  if(!enabled)throw Error('Google is not configured');
  const raw=cookies.split(';').map(x=>x.trim()).find(x=>x.startsWith('bp_google='))?.slice(10)||'';
  const [payload,sig]=raw.split('.'),expected=mac(payload||'');
  if(!sig||sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))throw Error('Invalid OAuth state');
  const flow=JSON.parse(Buffer.from(payload,'base64url').toString());
  if(flow.exp<=clock()||query.get('state')!==flow.state||query.has('error')||!query.get('code'))throw Error('Invalid OAuth callback');
  const tokenResponse=await request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:client,client_secret:clientSecret,code:query.get('code'),code_verifier:flow.verifier,grant_type:'authorization_code',redirect_uri:redirect}),signal:AbortSignal.timeout(12000)});
  if(!tokenResponse.ok)throw Error('Token exchange failed');
  const token=await tokenResponse.json();
  if(typeof token.access_token!=='string'||!token.access_token)throw Error('Missing access token');
  const response=await request('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('Google identity unavailable');
  const user=await response.json();
  if(typeof user.sub!=='string'||!user.sub||user.sub.length>255||user.email_verified!==true)throw Error('Unverified Google identity');
  if(typeof user.email!=='string'||user.email.length>254||!user.email.includes('@'))throw Error('Missing verified email');
  return {sub:user.sub,email:user.email,name:typeof user.name==='string'?user.name.slice(0,100):user.email.split('@')[0]};
 }
 return {enabled,begin,finish,clearCookie:()=>cookie('',0)};
}
module.exports={createGoogleAuth};
