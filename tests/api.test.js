const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
test('price updates preserve orders, enforce admin access and persist across restart',async()=>{
 let record={accs:[{id:'a',title:'Demo',price:50000,discount:0,link:'https://example.com',type:'normal'}],orders:[{id:'o',acc_id:'a',status:'pending',username:'buyer',price_paid:50000}],users:[{username:'gg_fixture',googleSub:'sub-fixture',googleEmail:'verified@gmail.com',displayName:'Google Person',balance:0}]};
 const bin=http.createServer(async(req,res)=>{
  if(req.method==='PUT'){let body='';for await(const chunk of req)body+=chunk;record=JSON.parse(body)}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({record}));
 });
 bin.listen(0,'127.0.0.1');await once(bin,'listening');
 const port=32000+Math.floor(Math.random()*10000);
 let app;
 const start=async()=>{
  app=spawn(process.execPath,['server.js'],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,NODE_ENV:'test',PORT:String(port),ADMIN_USER:'testadmin',ADMIN_PASSWORD:'test-password-only',SESSION_SECRET:'test-session-only-'.repeat(4),JSONBIN_BIN_ID:'test',JSONBIN_API_KEY:'test',TEST_JSONBIN_URL:'http://127.0.0.1:'+bin.address().port}});
  let logs='';app.stderr.on('data',x=>logs+=x);
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:'+port+'/api/health')).ok)return}catch{}await new Promise(r=>setTimeout(r,30))}
  throw Error('Startup failed: '+logs);
 };
 const stop=async()=>{if(app&&app.exitCode===null){app.kill();await once(app,'exit')}};
 let cookie='';
 const post=async(path,body,headers={})=>fetch('http://127.0.0.1:'+port+path,{method:'POST',headers:{'Content-Type':'application/json','X-BP-Request':'1',Cookie:cookie,...headers},body:JSON.stringify(body)});
 try{
  await start();
  assert.equal((await post('/api/admin/account/price',{id:'a',price:75000})).status,401);
  const crypto=require('node:crypto');
  const payload=Buffer.from(JSON.stringify({u:'gg_fixture',r:'user',j:'test',exp:Date.now()+60000})).toString('base64url');
  const signature=crypto.createHmac('sha256','test-session-only-'.repeat(4)).update(payload).digest('base64url');
  const googleProfile=await (await fetch('http://127.0.0.1:'+port+'/api/state',{headers:{Cookie:'bp_session='+payload+'.'+signature}})).json();
  assert.equal(googleProfile.profile.email,'verified@gmail.com');
  assert.equal(googleProfile.profile.displayName,'Google Person');
  const publicPayload=await (await fetch('http://127.0.0.1:'+port+'/api/state')).text();
  assert.ok(!publicPayload.includes('verified@gmail.com'));

  assert.equal((await post('/api/register',{username:'customer',password:'customer-password',recoveryCode:'012345'})).status,200);
  const customer=await post('/api/login',{username:'customer',password:'customer-password',admin:true});
  cookie=customer.headers.get('set-cookie').split(';')[0];
  const customerCookie=cookie;
  assert.equal((await post('/api/admin/account/price',{id:'a',price:1})).status,403);
  cookie='';
  const login=await post('/api/login',{username:'testadmin',password:'test-password-only'});
  assert.equal(login.status,200);assert.equal((await login.json()).role,'admin');cookie=login.headers.get('set-cookie').split(';')[0];
  assert.match(login.headers.get('set-cookie'),/HttpOnly/);
  assert.equal((await post('/api/admin/account/price',{id:'a',price:'75.000 đ'})).status,200);
  assert.equal(record.accs[0].price,75000);assert.equal(record.orders[0].price_paid,50000);
  for(const price of [0,-1,'1.5','invalid',1000000001]){
   assert.equal((await post('/api/admin/account/price',{id:'a',price})).status,400);
   assert.equal(record.accs[0].price,75000);
  }
  assert.equal((await post('/api/admin/account/price',{id:'a',price:1},{Origin:'https://evil.example'})).status,403);
  assert.equal((await post('/api/admin/account/price',{id:'a',price:1},{'X-BP-Request':''})).status,403);
  assert.equal((await post('/api/admin/account/update',{id:'a',title:'Changed',price:1})).status,400);
  await stop();await start();
  const state=await (await fetch('http://127.0.0.1:'+port+'/api/state',{headers:{Cookie:cookie}})).json();
  assert.equal(state.admin.accounts[0].price,75000);assert.equal(state.admin.orders[0].price_paid,50000);
  for(const path of ['/','/app.js','/styles.css','/settings.js','/music.js']){const r=await fetch('http://127.0.0.1:'+port+path);assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.match(r.headers.get('content-security-policy'),/frame-src https:\/\/www.youtube.com/)}
  assert.equal((await post('/api/admin/order/approve',{id:'o'})).status,200);
  const publicState=await (await fetch('http://127.0.0.1:'+port+'/api/state')).json();
  assert.equal(publicState.accs.some(a=>a.id==='a'),false);
  assert.equal(record.orders[0].price_paid,50000);
  const adminCookie=cookie;
  assert.equal((await post('/api/admin/account/add',{title:'Private acc',price:100,accountUsername:'game-user',accountPassword:'game-password'})).status,200);
  const product=record.accs[0];
  assert.ok(product.credentials);assert.ok(!JSON.stringify(product).includes('game-password'));
  assert.equal((await post('/api/admin/wallet/credit',{username:'customer',amount:100})).status,200);
  const anonymous=await (await fetch('http://127.0.0.1:'+port+'/api/state')).text();
  assert.ok(!anonymous.includes('game-user'));assert.ok(!anonymous.includes('game-password'));
  cookie=customerCookie;
  const purchase=await (await post('/api/order',{accId:product.id})).json();
  const getState=async()=> (await fetch('http://127.0.0.1:'+port+'/api/state',{headers:{Cookie:cookie}})).json();
  assert.equal((await getState()).mine.orders[0].credentials,null);
  cookie=adminCookie;
  assert.equal((await post('/api/admin/order/approve',{id:purchase.orderId})).status,200);
  cookie=customerCookie;
  assert.deepEqual((await getState()).mine.orders[0].credentials,{username:'game-user',password:'game-password'});
  cookie=adminCookie;
  assert.equal((await post('/api/admin/account/update',{id:product.id,title:'Changed',price:100,accountUsername:'bad',accountPassword:'bad'})).status,400);
  assert.equal((await fetch('http://127.0.0.1:'+port+'/api/auth/google',{redirect:'manual'})).status,503);
  const attachment={name:'readme.txt',data:Buffer.from('download test').toString('base64')};
  assert.equal((await post('/api/admin/notice/add',{title:'File',content:'Public',attachment})).status,200);
  const note=record.notifs.at(-1);
  const download=await fetch('http://127.0.0.1:'+port+'/api/attachment/notice/'+note.id);
  assert.equal(download.status,200);assert.equal(await download.text(),'download test');
  assert.match(download.headers.get('content-disposition'),/^attachment/);
  assert.equal((await post('/api/admin/notice/add',{title:'Bad',content:'Bad',attachment:{name:'large',data:Buffer.alloc(32769).toString('base64')}})).status,400);
  assert.equal((await post('/api/admin/notice/add',{title:'Bad',content:'Bad',attachment:{name:'invalid',data:'@@@'}})).status,400);
  assert.equal((await post('/api/admin/free/add',{title:'Download',attachment})).status,200);
  const free=record.freebies[0];
  assert.equal((await fetch('http://127.0.0.1:'+port+'/api/attachment/free/'+free.id)).status,401);
  const freeDownload=await fetch('http://127.0.0.1:'+port+'/api/attachment/free/'+free.id,{headers:{Cookie:cookie}});
  assert.equal(await freeDownload.text(),'download test');
  const freeInfo=await (await fetch('http://127.0.0.1:'+port+'/api/free/'+free.id,{headers:{Cookie:cookie}})).json();
  assert.equal(freeInfo.url,'/api/attachment/free/'+free.id);
  assert.equal((await post('/api/admin/free/add',{title:'Image preview',url:'https://example.com/download',attachment:{name:'cover.png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII='}})).status,200);
  const cover=record.freebies[0];
  const preview=await fetch('http://127.0.0.1:'+port+'/api/attachment/free/'+cover.id);
  assert.equal(preview.status,200);assert.equal(preview.headers.get('content-type'),'image/png');
  assert.equal((await fetch('http://127.0.0.1:'+port+'/api/free/'+cover.id)).status,401);

  await stop();await start();
  assert.equal((await fetch('http://127.0.0.1:'+port+'/api/attachment/notice/'+note.id)).status,200);

  const oldHash=record.users.find(u=>u.username==='customer').passwordHash;
  const reset={username:'customer',newPassword:'changed-password',recoveryCode:'012345'};
  assert.equal((await post('/api/password/check',{username:'missing'})).status,404);
  assert.equal((await post('/api/password/check',{username:'gg_fixture'})).status,400);
  assert.equal((await post('/api/password/check',{username:'customer'})).status,200);
  assert.equal((await post('/api/password/reset',{...reset,recoveryCode:'999999'})).status,400);
  assert.equal((await post('/api/password/reset',{...reset,recoveryCode:'123'})).status,400);
  assert.equal(record.users.find(u=>u.username==='customer').passwordHash,oldHash);
  assert.equal((await post('/api/password/reset',reset)).status,200);
  const expired=await (await fetch('http://127.0.0.1:'+port+'/api/state',{headers:{Cookie:customerCookie}})).json();
  assert.equal(expired.profile,null);
  assert.equal((await post('/api/login',{username:'customer',password:'changed-password'})).status,200);
  assert.equal((await post('/api/login',{username:'customer',password:'customer-password'})).status,401);
  for(let i=0;i<5;i++)assert.equal((await post('/api/password/reset',{...reset,recoveryCode:'999999'})).status,i===4?429:400);
  const lockedHash=record.users.find(u=>u.username==='customer').passwordHash;
  await stop();await start();
  assert.equal((await post('/api/password/reset',reset)).status,429);
  assert.equal(record.users.find(u=>u.username==='customer').passwordHash,lockedHash);
  assert.ok(!JSON.stringify(record).includes('012345'));
  await post('/api/logout',{});
  assert.equal((await post('/api/admin/account/price',{id:'a',price:1})).status,401);
 }finally{await stop();await new Promise(r=>bin.close(r))}
});
