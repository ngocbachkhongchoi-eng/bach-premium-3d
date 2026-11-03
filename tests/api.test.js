const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
test('price updates preserve orders, enforce admin access and persist across restart',async()=>{
 let record={accs:[{id:'a',title:'Demo',price:50000,discount:0,link:'https://example.com',type:'normal'}],orders:[{id:'o',acc_id:'a',status:'pending',username:'buyer',price_paid:50000}],users:[]};
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
  assert.equal((await post('/api/register',{username:'customer',password:'customer-password'})).status,200);
  const customer=await post('/api/login',{username:'customer',password:'customer-password',admin:true});
  cookie=customer.headers.get('set-cookie').split(';')[0];
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
  for(const path of ['/','/app.js','/styles.css']){const r=await fetch('http://127.0.0.1:'+port+path);assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.match(r.headers.get('content-security-policy'),/frame-src https:\/\/www.youtube.com/)}
  await post('/api/logout',{});
  assert.equal((await post('/api/admin/account/price',{id:'a',price:1})).status,401);
 }finally{await stop();await new Promise(r=>bin.close(r))}
});
