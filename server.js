'use strict';
// BACH PREMIUM - Node.js 20+ / JSONBin backend, no npm dependencies.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const ROOT = __dirname;
function loadEnv(){ const file=path.join(ROOT,'.env');if(!fs.existsSync(file))return;for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){const match=line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);if(match&&!process.env[match[1]])process.env[match[1]]=match[2].replace(/^['"]|['"]$/g,'');}}
loadEnv();
const PORT=Number(process.env.PORT||3000);
const SECRET=process.env.SESSION_SECRET||'';
const ADMIN_USER=(process.env.ADMIN_USER||'').trim();
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'';
const BIN=process.env.JSONBIN_BIN_ID||'';
const KEY=process.env.JSONBIN_API_KEY||'';
// Access Keys have limited Read/Update permissions; prefer these over Master Keys.
// Set JSONBIN_KEY_TYPE=master only if using a Core Master Key.
const KEY_TYPE=(process.env.JSONBIN_KEY_TYPE||'access').trim().toLowerCase();
const ready=SECRET.length>=32&&ADMIN_USER.length>=3&&ADMIN_PASSWORD.length>=12&&BIN&&KEY&&['access','master'].includes(KEY_TYPE)&&!['NHAP_','CHUOI_','MAT_KHAU_'].some(prefix=>[SECRET,ADMIN_USER,ADMIN_PASSWORD,BIN,KEY].some(v=>v.startsWith(prefix)));
if(!ready){console.error('Thiếu cấu hình .env: SESSION_SECRET (>=32), ADMIN_USER, ADMIN_PASSWORD (>=12), JSONBIN_BIN_ID, JSONBIN_API_KEY.');process.exit(1);}
const jsonHeaders={ [KEY_TYPE==='master'?'X-Master-Key':'X-Access-Key']: KEY, 'Content-Type':'application/json' };
console.log('JSONBin: dang dung '+(KEY_TYPE==='access'?'Access Key (Read + Update)':'Master Key')+'; khong in khoa ra man hinh.');
const empty=()=>({users:[],accs:[],orders:[],messages:[],wallet:[],notifs:[],logs:[],discounts:[],ratings:[],freebies:[]});
let db=null;let serialize=Promise.resolve();
const rate=new Map();
const id=()=>crypto.randomUUID();
const clean=(s,max=200)=>String(s??'').trim().slice(0,max);
const now=()=>Date.now();
const amount=(n)=>Number.isSafeInteger(Number(n))&&Number(n)>=0&&Number(n)<=1000000000?Number(n):NaN;
const percent=(n)=>Number.isInteger(Number(n))&&Number(n)>=0&&Number(n)<=100?Number(n):NaN;
const validateUrl=(s)=>{try{const u=new URL(s);if(!['https:','http:'].includes(u.protocol))return null;return u.toString()}catch{return null}};
function hashPass(password){const salt=crypto.randomBytes(16).toString('hex');return salt+':'+crypto.scryptSync(password,salt,64).toString('hex');}
function verifyPass(p,stored){if(typeof stored!=='string')return false;const [salt,hash]=stored.split(':');if(!salt||!hash||hash.length!==128)return false;const actual=crypto.scryptSync(p,salt,64);return crypto.timingSafeEqual(actual,Buffer.from(hash,'hex'));}
const adminHash=hashPass(ADMIN_PASSWORD);
function signedToken(user,role){const payload=Buffer.from(JSON.stringify({u:user,r:role,exp:now()+7*86400000})).toString('base64url');const sig=crypto.createHmac('sha256',SECRET).update(payload).digest('base64url');return payload+'.'+sig;}
function checkToken(raw){try{const [payload,sig]=raw.split('.');const expect=crypto.createHmac('sha256',SECRET).update(payload).digest('base64url');if(!sig||sig.length!==expect.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expect)))return null;const t=JSON.parse(Buffer.from(payload,'base64url').toString());if(t.exp<now()||!['admin','user'].includes(t.r))return null;if(t.r==='admin'&&t.u!==ADMIN_USER)return null;if(t.r==='user'&&!db.users.some(u=>u.username===t.u))return null;return {username:t.u,role:t.r};}catch{return null}}
function auth(req){const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('bp_session='));return cookie?checkToken(cookie.slice(11)):null}
function cookieHeader(token,req){const isHttps=process.env.NODE_ENV==='production'||req.headers['x-forwarded-proto']==='https';return 'bp_session='+token+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+ (token?604800:0) + (isHttps?'; Secure':'');}
function respond(res,status,data,extra={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra});res.end(JSON.stringify(data));}
const fail=(res,status,msg)=>respond(res,status,{error:msg});
async function fetchDB(){const r=await fetch('https://api.jsonbin.io/v3/b/'+encodeURIComponent(BIN)+'/latest',{headers:jsonHeaders,signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error('JSONBin GET '+r.status+' (kiem tra Bin ID va quyen Read cua Access Key)');const j=await r.json();if(!j.record||typeof j.record!=='object')throw new Error('JSONBin record rỗng');const d={...empty(),...j.record};for(const k of Object.keys(empty()))if(!Array.isArray(d[k]))d[k]=[];let migrated=false;for(const u of d.users){if(!u.passwordHash&&typeof u.password==='string'){u.passwordHash=hashPass(u.password);migrated=true;}if('password' in u){delete u.password;migrated=true;}if(!Number.isSafeInteger(u.balance)){u.balance=0;migrated=true;}}return {data:d,migrated};}
async function pushDB(next){const r=await fetch('https://api.jsonbin.io/v3/b/'+encodeURIComponent(BIN),{method:'PUT',headers:jsonHeaders,body:JSON.stringify(next),signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('JSONBin PUT '+r.status+' (kiem tra quyen Update cua Access Key)');}
async function bootstrap(){const {data,migrated}=await fetchDB();if(migrated){await pushDB(data);console.log('Đã chuyển mật khẩu khách cũ thành hash trong JSONBin.');}db=data;}
function mutate(fn){const task=serialize.then(async()=>{const updated=structuredClone(db);const result=await fn(updated);if(result&&result.error)return result;await pushDB(updated);db=updated;return result;});serialize=task.catch(e=>{console.error('DB write error',e.message)});return task;}
const pubAcc=a=>({id:a.id,title:a.title,info:a.info||'',price:Number(a.price)||0,discount:Number(a.discount)||0,type:a.type==='vip'?'vip':'normal',created_at:a.created_at,sold:db.orders.some(o=>String(o.acc_id)===String(a.id)&&['pending','approved','sold'].includes(o.status))});
const pubFree=f=>({id:f.id,title:f.title,description:f.description||'',created_at:f.created_at});
const pubNotice=n=>({id:n.id,title:n.title,content:n.content,at:n.at});
const pubUser=u=>({username:u.username,balance:u.balance||0,created_at:u.created_at||0,vip:!!u.vip});
function profile(s){return s?.role==='admin'?{username:ADMIN_USER,role:'admin',balance:0}:s?.role==='user'?{...pubUser(db.users.find(u=>u.username===s.username)),role:'user'}:null;}
function publicData(){return {accs:db.accs.map(pubAcc),freebies:db.freebies.map(pubFree),notifs:db.notifs.slice(-30).map(pubNotice).reverse(),top:db.users.map(u=>({username:u.username,count:db.orders.filter(o=>o.username===u.username&&o.status==='approved').length})).sort((a,b)=>b.count-a.count).slice(0,10)}};
function privateData(s){if(!s)return {};if(s.role==='admin')return {admin:{users:db.users.map(pubUser),accounts:db.accs.map(a=>({...pubAcc(a),link:a.link||''})),freebies:db.freebies,orders:db.orders,messages:db.messages,wallet:db.wallet,discounts:db.discounts,logs:db.logs.slice(-100).reverse(),ratings:db.ratings,notifs:db.notifs}};
const orders=db.orders.filter(o=>o.username===s.username).map(o=>({...o,delivery:o.status==='approved'?(validateUrl(db.accs.find(a=>String(a.id)===String(o.acc_id))?.link||'')||''):''}));return {mine:{orders,wallet:db.wallet.filter(w=>w.username===s.username).slice(-100).reverse(),messages:db.messages.filter(m=>m.username===s.username).slice(-150),ratings:db.ratings.filter(r=>r.username===s.username)}};}
function bodyJSON(req){return new Promise((resolve,reject)=>{let text='';req.on('data',chunk=>{text+=chunk;if(text.length>65536){reject(new Error('Dữ liệu quá lớn'));req.destroy()}});req.on('end',()=>{try{resolve(JSON.parse(text||'{}'))}catch{reject(new Error('JSON không hợp lệ'))}});req.on('error',reject)});}
function rateLimit(req,key,limit,windowMs){const ip=(req.socket.remoteAddress||'unknown');const k=ip+':'+key;const existing=rate.get(k)||[];const v=existing.filter(t=>t>now()-windowMs);v.push(now());rate.set(k,v);return v.length<=limit;}
function requireRole(res,s,role){if(!s){fail(res,401,'Bạn cần đăng nhập');return false}if(role&&s.role!==role){fail(res,403,'Không có quyền quản trị');return false}return true}
async function route(req,res){const url=new URL(req.url,'http://localhost');const pathname=url.pathname;const method=req.method;
if(pathname==='/api/health'&&method==='GET')return respond(res,200,{ok:true,storage:'JSONBin'});
if(pathname==='/api/state'&&method==='GET'){const s=auth(req);return respond(res,200,{profile:profile(s),...publicData(),...privateData(s)});}
if(!pathname.startsWith('/api/'))return staticFile(pathname,res);
if(!['POST','GET'].includes(method))return fail(res,405,'Phương thức không hợp lệ');
if(method==='POST'){
 const origin=req.headers.origin;const host=req.headers.host;if(origin){let o;try{o=new URL(origin)}catch{return fail(res,403,'Origin không hợp lệ')}if(o.host!==host)return fail(res,403,'Yêu cầu khác nguồn bị chặn');}
 if(!(req.headers['content-type']||'').startsWith('application/json'))return fail(res,415,'Yêu cầu JSON');
}
const b=method==='POST'?await bodyJSON(req):{};const s=auth(req);
if(pathname==='/api/register'&&method==='POST'){
 if(!rateLimit(req,'register',8,3600000))return fail(res,429,'Thử lại sau');const username=clean(b.username,40),p=String(b.password||'');
 if(!/^[\p{L}\p{N}_]{3,30}$/u.test(username)||p.length<8||p.length>128)return fail(res,400,'Tên 3–30 ký tự (chữ, số, _) và mật khẩu tối thiểu 8 ký tự');
 if(username.toLowerCase()===ADMIN_USER.toLowerCase())return fail(res,400,'Tên đăng nhập không hợp lệ');
 const out=await mutate(d=>{if(d.users.some(u=>u.username.toLowerCase()===username.toLowerCase()))return {error:'Tên đã tồn tại'};d.users.push({username,passwordHash:hashPass(p),balance:0,created_at:now()});return {ok:true}});
 return out.error?fail(res,409,out.error):respond(res,200,{ok:true});
}
if(pathname==='/api/login'&&method==='POST'){
 if(!rateLimit(req,'login',15,15*60000))return fail(res,429,'Bạn thử đăng nhập quá nhiều lần, vui lòng thử lại sau');const username=clean(b.username,40),p=String(b.password||'');let role='user';
 if(p.length>128||!username)return fail(res,400,'Thông tin đăng nhập không hợp lệ');if(b.admin===true){role='admin';if(username!==ADMIN_USER||!verifyPass(p,adminHash))return fail(res,401,'Sai tài khoản hoặc mật khẩu');await mutate(d=>{d.logs.push({id:id(),at:now(),action:'Đăng nhập ADMIN'});return {ok:true}});}else{const u=db.users.find(x=>x.username.toLowerCase()===username.toLowerCase());if(!u||!verifyPass(p,u.passwordHash))return fail(res,401,'Sai tài khoản hoặc mật khẩu');}
 return respond(res,200,{ok:true},{'Set-Cookie':cookieHeader(signedToken(role==='admin'?ADMIN_USER:db.users.find(u=>u.username.toLowerCase()===username.toLowerCase()).username,role),req)});
}
if(pathname==='/api/logout'&&method==='POST')return respond(res,200,{ok:true},{'Set-Cookie':cookieHeader('',req)});
if(pathname.startsWith('/api/free/')&&method==='GET'){
 if(!requireRole(res,s))return;const f=db.freebies.find(x=>String(x.id)===decodeURIComponent(pathname.slice(10)));if(!f)return fail(res,404,'Không tìm thấy link');return respond(res,200,{title:f.title,url:f.url});
}
if(pathname==='/api/coupon/check'&&method==='POST'){
 if(!requireRole(res,s))return;const c=db.discounts.find(x=>x.code===clean(b.code,32).toUpperCase()&&x.qty>0);return c?respond(res,200,{percent:c.percent,valid:true}):fail(res,404,'Mã giảm giá không hợp lệ hoặc đã hết');
}
if(pathname==='/api/order'&&method==='POST'){
 if(!requireRole(res,s,'user'))return;const out=await mutate(d=>{const a=d.accs.find(x=>String(x.id)===String(b.accId));const u=d.users.find(x=>x.username===s.username);if(!a||!u)return {error:'Không tìm thấy sản phẩm'};if(d.orders.some(o=>String(o.acc_id)===String(a.id)&&['pending','approved','sold'].includes(o.status)))return {error:'Sản phẩm đã được đặt'};
 let price=amount(a.price),disc=percent(a.discount||0);if(!Number.isFinite(price)||!Number.isFinite(disc))return {error:'Giá sản phẩm không hợp lệ'};price=Math.floor(price*(100-disc)/100);const code=clean(b.code,32).toUpperCase();if(code){const c=d.discounts.find(x=>x.code===code&&x.qty>0);if(!c)return {error:'Mã giảm giá không hợp lệ'};price=Math.floor(price*(100-c.percent)/100);c.qty-=1;}if(u.balance<price)return {error:'Số dư chưa đủ. Hãy nhắn ADMIN để nạp tiền'};u.balance-=price;const oid=id();d.orders.push({id:oid,acc_id:a.id,acc_title:a.title,username:u.username,status:'pending',price_paid:price,discount:disc,created_at:now()});d.wallet.push({id:id(),username:u.username,amount:-price,note:'Mua '+a.title,at:now()});return {ok:true,orderId:oid}});return out.error?fail(res,400,out.error):respond(res,200,out);
}
if(pathname==='/api/chat'&&method==='POST'){
 if(!requireRole(res,s,'user'))return;const content=clean(b.text,1500);if(!content)return fail(res,400,'Tin nhắn trống');if(!rateLimit(req,'chat',30,60000))return fail(res,429,'Bạn gửi quá nhiều tin nhắn');await mutate(d=>{d.messages.push({id:id(),username:s.username,from:'user',text:content,at:now()});return {ok:true}});return respond(res,200,{ok:true});
}
if(pathname==='/api/rating'&&method==='POST'){
 if(!requireRole(res,s,'user'))return;const value=Number(b.value);if(!Number.isInteger(value)||value<1||value>5)return fail(res,400,'Đánh giá từ 1 đến 5');await mutate(d=>{d.ratings=d.ratings.filter(r=>r.username!==s.username);d.ratings.push({id:id(),username:s.username,value,comment:clean(b.comment,300),at:now()});return {ok:true}});return respond(res,200,{ok:true});
}
if(pathname.startsWith('/api/admin/')&&method==='POST'){
 if(!requireRole(res,s,'admin'))return;const action=pathname.slice('/api/admin/'.length);
 const result=await mutate(d=>{
 const findOrder=()=>d.orders.find(x=>String(x.id)===String(b.id));
 switch(action){
 case 'account/add': {const title=clean(b.title,100),info=clean(b.info,500),link=b.link?validateUrl(b.link):'';const price=amount(b.price),discount=percent(b.discount||0);if(!title||!Number.isFinite(price)||!Number.isFinite(discount)||(b.link&&!link))return {error:'Kiểm tra tên, giá, giảm giá (0–100), link hợp lệ'};d.accs.unshift({id:id(),title,info,link,price,discount,type:b.type==='vip'?'vip':'normal',created_at:now()});break;}
 case 'account/delete':{if(d.orders.some(o=>String(o.acc_id)===String(b.id)&&['pending','approved'].includes(o.status)))return {error:'Sản phẩm còn đơn hàng đang xử lý'};d.accs=d.accs.filter(x=>String(x.id)!==String(b.id));break;}
 case 'free/add':{const title=clean(b.title,100),url=validateUrl(b.url);if(!title||!url)return {error:'Nhập tên và link http/https hợp lệ'};d.freebies.unshift({id:id(),title,url,description:clean(b.description,300),created_at:now()});break;}
 case 'free/delete':d.freebies=d.freebies.filter(x=>String(x.id)!==String(b.id));break;
 case 'order/approve':{const o=findOrder();if(!o||o.status!=='pending')return {error:'Đơn không ở trạng thái chờ duyệt'};o.status='approved';break;}
 case 'order/reject':{const o=findOrder();if(!o||o.status!=='pending')return {error:'Đơn không ở trạng thái chờ duyệt'};o.status='rejected';const u=d.users.find(x=>x.username===o.username);if(u){u.balance+=Number(o.price_paid)||0;d.wallet.push({id:id(),username:u.username,amount:Number(o.price_paid)||0,note:'Hoàn tiền đơn '+o.id,at:now()});}break;}
 case 'wallet/credit':{const u=d.users.find(x=>x.username===clean(b.username,40));const x=amount(b.amount);if(!u||!Number.isFinite(x)||x===0)return {error:'Khách hoặc số tiền không hợp lệ'};u.balance+=x;d.wallet.push({id:id(),username:u.username,amount:x,note:clean(b.note,150)||'ADMIN nạp tiền',at:now()});break;}
 case 'coupon/add':{const code=clean(b.code,32).toUpperCase(),p=Number(b.percent),q=Number(b.qty);if(!/^[A-Z0-9_-]{3,32}$/.test(code)||!Number.isInteger(p)||p<1||p>100||!Number.isSafeInteger(q)||q<1||q>100000)return {error:'Mã 3–32 ký tự, giảm 1–100%, số lượng từ 1'};if(d.discounts.some(x=>x.code===code))return {error:'Mã đã tồn tại'};d.discounts.push({id:id(),code,percent:p,qty:q,at:now()});break;}
 case 'coupon/delete':d.discounts=d.discounts.filter(x=>x.code!==String(b.code));break;
 case 'notice/add':{const title=clean(b.title,120),content=clean(b.content,1000);if(!title||!content)return {error:'Vui lòng nhập thông báo'};d.notifs.push({id:id(),title,content,at:now()});break;}
 case 'notice/delete':d.notifs=d.notifs.filter(x=>String(x.id)!==String(b.id));break;
 case 'chat/reply':{const username=clean(b.username,40),text=clean(b.text,1500);if(!d.users.some(x=>x.username===username)||!text)return {error:'Tin nhắn hoặc khách không hợp lệ'};d.messages.push({id:id(),username,from:'admin',text,at:now()});break;}
 case 'vip/gift':{const u=d.users.find(x=>x.username===clean(b.username,40));if(!u)return {error:'Không tìm thấy khách'};u.vip=true;break;}
 default:return {error:'Chức năng không tồn tại'};
 }
 d.logs.push({id:id(),at:now(),action,by:ADMIN_USER});return {ok:true};
 });return result.error?fail(res,400,result.error):respond(res,200,result);
}
return fail(res,404,'API không tồn tại');}
function staticFile(p,res){if(p==='/'||p==='/index.html')p='/index.html';else return fail(res,404,'Không tìm thấy');let data;try{data=fs.readFileSync(path.join(ROOT,'public','index.html'))}catch{return fail(res,500,'Thiếu file HTML')}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});res.end(data);}
const server=http.createServer(async(req,res)=>{try{await route(req,res)}catch(e){console.error(e.stack||e);if(!res.headersSent)fail(res,503,'Máy chủ hoặc JSONBin đang gặp lỗi. Hãy thử lại.') }});
bootstrap().then(()=>server.listen(PORT,'0.0.0.0',()=>console.log(`BÁCH PREMIUM: http://localhost:${PORT}`))).catch(e=>{console.error('Không kết nối được JSONBin:',e.message);process.exit(1)});
