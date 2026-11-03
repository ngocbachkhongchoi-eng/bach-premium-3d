const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createGoogleAuth}=require('../google-auth');
const env={GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret',GOOGLE_REDIRECT_URI:'https://example.com/api/auth/google/callback',NODE_ENV:'production'};
test('Google code flow binds state and PKCE; rejects tampering, expiry and unverified identities',async()=>{
 let time=1000,calls=0,verified=true,params;
 const auth=createGoogleAuth({env,secret:'unit-test',clock:()=>time,request:async(url,options)=>{
  calls++;
  if(url.includes('/token')){params=options.body;return {ok:true,json:async()=>({access_token:'test-token'})}}
  assert.equal(options.headers.Authorization,'Bearer test-token');
  return {ok:true,json:async()=>({sub:'google-subject',email:'person@gmail.com',name:'Test Person',email_verified:verified})};
 }});
 assert.equal(auth.enabled,true);
 const renderAuth=createGoogleAuth({env:{...env,GOOGLE_REDIRECT_URI:'',RENDER_EXTERNAL_URL:'https://bach-premium-3d.onrender.com'},secret:'test'});
 assert.equal(renderAuth.enabled,true);
 assert.equal(new URL(renderAuth.begin().url).searchParams.get('redirect_uri'),'https://bach-premium-3d.onrender.com/api/auth/google/callback');
 assert.equal(createGoogleAuth({env:{...env,GOOGLE_REDIRECT_URI:'http://untrusted.example/api/auth/google/callback'},secret:'test'}).enabled,false);
 const start=auth.begin(),location=new URL(start.url),query=new URLSearchParams({state:location.searchParams.get('state'),code:'code'});
 assert.match(start.cookie,/HttpOnly; SameSite=Lax/);assert.match(start.cookie,/Secure/);
 assert.equal(location.searchParams.get('code_challenge_method'),'S256');
 assert.deepEqual(await auth.finish(query,start.cookie),{sub:'google-subject',email:'person@gmail.com',name:'Test Person'});
 assert.equal(crypto.createHash('sha256').update(params.get('code_verifier')).digest('base64url'),location.searchParams.get('code_challenge'));
 const before=calls;
 await assert.rejects(auth.finish(new URLSearchParams({state:'attacker',code:'code'}),start.cookie));
 await assert.rejects(auth.finish(query,start.cookie.replace('bp_google=','bp_google=broken')));
 assert.equal(calls,before);
 time=601001;await assert.rejects(auth.finish(query,start.cookie));assert.equal(calls,before);
 time=1000;verified=false;await assert.rejects(auth.finish(query,start.cookie));
 assert.equal(createGoogleAuth({env:{},secret:'test'}).enabled,false);
});
test('delivery secrets are authenticated encrypted data',()=>{
 const vault=require('../delivery')('secret'),value={username:'demo',password:'secret-password'},sealed=vault.seal(value);
 assert.ok(!sealed.includes(value.password));assert.deepEqual(vault.open(sealed),value);
 assert.throws(()=>require('../delivery')('other').open(sealed));
});
