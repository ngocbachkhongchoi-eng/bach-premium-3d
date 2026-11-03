'use strict';
// BACH PREMIUM - Node.js 20+ / JSONBin backend, no npm dependencies.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const net = require('node:net');
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
const TRUST_RENDER_PROXY = process.env.TRUST_RENDER_PROXY === 'true';
const ADMIN_TOTP_SECRET = (process.env.ADMIN_TOTP_SECRET || '').replace(/\s+/g,'').toUpperCase();
const BAN_MS = 30*60*1000, FAIL_WINDOW_MS=30*60*1000, FAIL_LIMIT=3;
const MAX_IP_ENTRIES=4000;
const ready=SECRET.length>=32&&ADMIN_USER.length>=3&&ADMIN_PASSWORD.length>=12&&BIN&&KEY&&['access','master'].includes(KEY_TYPE)&&!['NHAP_','CHUOI_','MAT_KHAU_'].some(prefix=>[SECRET,ADMIN_USER,ADMIN_PASSWORD,BIN,KEY].some(v=>v.startsWith(prefix)));
if(ADMIN_TOTP_SECRET && !/^[A-Z2-7]{16,}$/i.test(ADMIN_TOTP_SECRET)){console.error('ADMIN_TOTP_SECRET phải là Base32 (ít nhất 16 ký tự).');process.exit(1)}
if(!ready){console.error('Thiếu cấu hình .env: SESSION_SECRET (>=32), ADMIN_USER, ADMIN_PASSWORD (>=12), JSONBIN_BIN_ID, JSONBIN_API_KEY.');process.exit(1);}
const jsonHeaders={ [KEY_TYPE==='master'?'X-Master-Key':'X-Access-Key']: KEY, 'Content-Type':'application/json' };
console.log('JSONBin: dang dung '+(KEY_TYPE==='access'?'Access Key (Read + Update)':'Master Key')+'; khong in khoa ra man hinh.');
const empty=()=>({users:[],accs:[],orders:[],messages:[],wallet:[],notifs:[],logs:[],discounts:[],ratings:[],freebies:[],security:{loginIps:{},revoked:[]}});
let db=null;let serialize=Promise.resolve();
const rate=new Map();
const id=()=>crypto.randomUUID();
const clean=(s,max=200)=>String(s??'').trim().slice(0,max);
const now=()=>Date.now();
// Old versions may store VNĐ as "50.000", "50,000 đ" or numeric strings.
// Invalid or missing prices MUST NOT silently become zero-priced items.
function parseMoney(raw){
 if(typeof raw==='number')return Number.isSafeInteger(raw)&&raw>=0&&raw<=1000000000?raw:null;
 if(typeof raw!=='string'||!raw.trim())return null;
 let v=raw.trim().replace(/(?:\s|đ|₫|vnd)/gi,'');
 if(/^\d{1,3}(?:[.,]\d{3})+$/.test(v))v=v.replace(/[.,]/g,'');
 if(!/^\d+$/.test(v))return null;
 const n=Number(v);return Number.isSafeInteger(n)&&n>=0&&n<=1000000000?n:null;
}
const amount=n=>parseMoney(n)??NaN;
const accountPrice=a=>parseMoney(a.price);
const balanceOf=u=>!u?null:(u.balance===undefined||u.balance===null?0:parseMoney(u.balance));

const percent=(n)=>Number.isInteger(Number(n))&&Number(n)>=0&&Number(n)<=100?Number(n):NaN;
const validateUrl=(s)=>{try{const u=new URL(s);if(!['https:','http:'].includes(u.protocol))return null;return u.toString()}catch{return null}};
function hashPass(password){const salt=crypto.randomBytes(16).toString('hex');return salt+':'+crypto.scryptSync(password,salt,64).toString('hex');}
function verifyPass(p,stored){if(typeof stored!=='string')return false;const [salt,hash]=stored.split(':');if(!salt||!hash||!/^[a-f0-9]{128}$/i.test(hash))return false;const actual=crypto.scryptSync(p,salt,64);return crypto.timingSafeEqual(actual,Buffer.from(hash,'hex'));}
const adminHash=hashPass(ADMIN_PASSWORD);
function signedToken(user,role){const payload=Buffer.from(JSON.stringify({u:user,r:role,j:crypto.randomUUID(),exp:now()+(role==='admin'?4:24)*3600000})).toString('base64url');const sig=crypto.createHmac('sha256',SECRET).update(payload).digest('base64url');return payload+'.'+sig;}
function checkToken(raw){try{const [payload,sig]=raw.split('.');const expect=crypto.createHmac('sha256',SECRET).update(payload).digest('base64url');if(!sig||sig.length!==expect.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expect)))return null;const t=JSON.parse(Buffer.from(payload,'base64url').toString());if(t.exp<now()||!['admin','user'].includes(t.r))return null;const digest=crypto.createHash('sha256').update(raw).digest('hex');if((db.security?.revoked||[]).some(x=>x.digest===digest&&x.exp>now()))return null;if(t.r==='admin'&&t.u!==ADMIN_USER)return null;if(t.r==='user'&&!db.users.some(u=>u.username===t.u))return null;return {username:t.u,role:t.r};}catch{return null}}
function auth(req){const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('bp_session='));return cookie?checkToken(cookie.slice(11)):null}
function cookieHeader(token,req){const isHttps=process.env.NODE_ENV==='production';return 'bp_session='+token+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+ (token?86400:0) + (isHttps?'; Secure':'');}
function respond(res,status,data,extra={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer',...securityHeaders(),...extra});res.end(JSON.stringify(data));}
const fail=(res,status,msg)=>respond(res,status,{error:msg});
const BIN_URL=(process.env.NODE_ENV==='test' && process.env.TEST_JSONBIN_URL)?process.env.TEST_JSONBIN_URL:'https://api.jsonbin.io/v3/b/'+encodeURIComponent(BIN);
async function fetchDB(){const r=await fetch(BIN_URL+'/latest',{headers:jsonHeaders,signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error('JSONBin GET '+r.status+' (kiem tra Bin ID va quyen Read cua Access Key)');const j=await r.json();if(!j.record||typeof j.record!=='object')throw new Error('JSONBin record rỗng');const d={...empty(),...j.record};for(const k of Object.keys(empty()))if(k!=='security'&&!Array.isArray(d[k]))d[k]=[];if(!d.security||typeof d.security!=='object'||Array.isArray(d.security))d.security={loginIps:{},revoked:[]};if(!d.security.loginIps||typeof d.security.loginIps!=='object'||Array.isArray(d.security.loginIps))d.security.loginIps={};if(!Array.isArray(d.security.revoked))d.security.revoked=[];let migrated=false;for(const u of d.users){if(!u.passwordHash&&typeof u.password==='string'){u.passwordHash=hashPass(u.password);migrated=true;}if('password' in u){delete u.password;migrated=true;}const balance=balanceOf(u);if(balance!==null&&u.balance!==balance){u.balance=balance;migrated=true;}else if(balance===null)console.warn('Khách '+clean(u.username,40)+' có số dư không hợp lệ; cần ADMIN kiểm tra, KHÔNG tự đặt thành 0.');}return {data:d,migrated};}
async function pushDB(next){const r=await fetch(BIN_URL,{method:'PUT',headers:jsonHeaders,body:JSON.stringify(next),signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('JSONBin PUT '+r.status+' (kiem tra quyen Update cua Access Key)');}
async function bootstrap(){const {data,migrated}=await fetchDB();if(migrated){await pushDB(data);console.log('Đã chuẩn hóa mật khẩu/số dư hợp lệ từ dữ liệu cũ.');}db=data;const missing=data.accs.filter(a=>(accountPrice(a)??0)<=0);if(missing.length)console.warn('CẢNH BÁO: '+missing.length+' sản phẩm chưa có giá bán hợp lệ. ADMIN cần vào Sản phẩm → Sửa sản phẩm để điền lại giá. Không tự đoán giá cũ.');}
function mutate(fn){const task=serialize.then(async()=>{const updated=structuredClone(db);const result=await fn(updated);if(result&&(result.error||result._skipSave))return result;await pushDB(updated);db=updated;return result;});serialize=task.catch(e=>{console.error('DB write error',e.message)});return task;}
function productAvailability(a,source=db){
 const order=source.orders.find(o=>String(o.acc_id)===String(a.id)&&['pending','approved','sold'].includes(o.status));
 if(!order)return 'available';return order.status==='pending'?'pending':'sold';
}
const pubAcc=a=>{
 const price=accountPrice(a),discount=percent(a.discount??0),availability=productAvailability(a);
 return {id:a.id,title:a.title,info:a.info||'',price,discount:Number.isFinite(discount)?discount:0,
  priceReady:price!==null&&price>0&&Number.isFinite(discount),availability,sold:availability!=='available',
  type:a.type==='vip'?'vip':'normal',created_at:a.created_at};
};
const pubFree=f=>({id:f.id,title:f.title,description:f.description||'',created_at:f.created_at});
const pubNotice=n=>({id:n.id,title:n.title,content:n.content,at:n.at});
const pubUser=u=>({username:u.username,balance:balanceOf(u),created_at:u.created_at||0,vip:!!u.vip});
function profile(s){return s?.role==='admin'?{username:ADMIN_USER,role:'admin',balance:0}:s?.role==='user'?{...pubUser(db.users.find(u=>u.username===s.username)),role:'user'}:null;}
function publicData(){return {accs:db.accs.map(pubAcc),freebies:db.freebies.map(pubFree),notifs:db.notifs.slice(-30).map(pubNotice).reverse(),top:db.users.map(u=>({username:u.username,count:db.orders.filter(o=>o.username===u.username&&o.status==='approved').length})).sort((a,b)=>b.count-a.count).slice(0,10)}};
function privateData(s){if(!s)return {};if(s.role==='admin')return {admin:{users:db.users.map(pubUser),accounts:db.accs.map(a=>({...pubAcc(a),link:a.link||''})),freebies:db.freebies,orders:db.orders,messages:db.messages,wallet:db.wallet,discounts:db.discounts,logs:db.logs.slice(-100).reverse(),ratings:db.ratings,notifs:db.notifs}};
const orders=db.orders.filter(o=>o.username===s.username).map(o=>({...o,delivery:o.status==='approved'?(validateUrl(db.accs.find(a=>String(a.id)===String(o.acc_id))?.link||'')||''):''}));return {mine:{orders,wallet:db.wallet.filter(w=>w.username===s.username).slice(-100).reverse(),messages:db.messages.filter(m=>m.username===s.username).slice(-150),ratings:db.ratings.filter(r=>r.username===s.username)}};}
function bodyJSON(req){return new Promise((resolve,reject)=>{let text='';req.on('data',chunk=>{text+=chunk;if(text.length>65536){reject(new Error('Dữ liệu quá lớn'));req.destroy()}});req.on('end',()=>{try{resolve(JSON.parse(text||'{}'))}catch{reject(new Error('JSON không hợp lệ'))}});req.on('error',reject)});}

// Render Edge forwards real client IP. Do NOT trust browser-supplied XFF
// on localhost/direct hosting; turn on only when behind Render's proxy.
function clientIp(req) {
  if (TRUST_RENDER_PROXY) {
    const raw=String(req.headers['x-forwarded-for']||'');
    const first=raw.split(',')[0].trim();
    if (first.length<=64 && net.isIP(first)) return first;
  }
  const peer=req.socket.remoteAddress||'unknown';
  return peer.startsWith('::ffff:')?peer.slice(7):peer;
}
function ipKey(req){return crypto.createHmac('sha256',SECRET).update('login-ip:'+clientIp(req)).digest('hex');}
function bannedUntil(req){return Math.max(0,Number(db.security?.loginIps?.[ipKey(req)]?.until||0));}
function isIpBanned(req){return bannedUntil(req)>now();}
function banReply(res,until){
  const secs=Math.ceil((until-now())/1000);
  return respond(res,429,{error:'IP đã bị tạm khóa sau 3 lần đăng nhập sai. Vui lòng thử lại sau 30 phút.',retryAfterSeconds:Math.max(1,secs)}, {'Retry-After':String(Math.max(60,Math.ceil(secs/60)*60))});
}
function cleanupSecurity(d){
 const sec=d.security,ts=now();
 for(const [k,v] of Object.entries(sec.loginIps))if(!v||Math.max(Number(v.until||0),Number(v.start||0)+FAIL_WINDOW_MS)<ts)delete sec.loginIps[k];
 const pairs=Object.entries(sec.loginIps);
 if(pairs.length>MAX_IP_ENTRIES){pairs.sort((a,b)=>Number(a[1].start||0)-Number(b[1].start||0));for(const [k] of pairs.slice(0,pairs.length-MAX_IP_ENTRIES))delete sec.loginIps[k];}
 sec.revoked=sec.revoked.filter(x=>x&&x.exp>ts).slice(-2000);
}
// Persist lockout inside JSONBin to survive free-plan idle/restart.
// serialize/mutate ensures atomicity only in a SINGLE running instance.
async function evaluateLogin(req, username, password, isAdmin, otp){
 const key=ipKey(req);
 return mutate(d=>{
  cleanupSecurity(d);
  const old=d.security.loginIps[key];
  if(old?.until>now())return {_skipSave:true,ok:false,banned:true,until:old.until};
  const user=isAdmin?null:d.users.find(x=>x.username.toLowerCase()===username.toLowerCase());
  const passOk=isAdmin?(username===ADMIN_USER&&verifyPass(password,adminHash)):(user&&verifyPass(password,user.passwordHash));
  const otpStep=isAdmin&&ADMIN_TOTP_SECRET?verifyTotp(String(otp||''),ADMIN_TOTP_SECRET):null;
  const otpOk=!isAdmin||!ADMIN_TOTP_SECRET||(otpStep!==null&&otpStep>Number(d.security.lastTotpStep??-1));
  if(!passOk||!otpOk){
   const t=now(),fresh=!old||t-Number(old.start||0)>FAIL_WINDOW_MS;
   const entry=fresh?{start:t,count:1,until:0}:{start:old.start,count:Number(old.count||0)+1,until:0};
   if(entry.count>=FAIL_LIMIT)entry.until=t+BAN_MS;
   d.security.loginIps[key]=entry;
   return {ok:false,banned:entry.until>t,until:entry.until};
  }
  delete d.security.loginIps[key];
  if(isAdmin&&ADMIN_TOTP_SECRET)d.security.lastTotpStep=otpStep;
  if(isAdmin)d.logs.push({id:id(),at:now(),action:'Đăng nhập ADMIN (thành công)'});
  return {ok:true,username:isAdmin?ADMIN_USER:user.username,role:isAdmin?'admin':'user'};
 });
}
function verifyTotp(code,secret){
 if(!/^\d{6}$/.test(code)||!/^[A-Z2-7]+=*$/.test(secret))return null;
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,val=0,out=[];
 for(const ch of secret.replace(/=+$/,'')){val=(val<<5)|alphabet.indexOf(ch);bits+=5;if(bits>=8){bits-=8;out.push((val>>bits)&255);}}
 const key=Buffer.from(out);
 if(key.length<10)return null;
 const step=Math.floor(now()/30000);
 for(const n of [step-1,step,step+1]){
  const buf=Buffer.alloc(8);buf.writeBigUInt64BE(BigInt(n));
  const mac=crypto.createHmac('sha1',key).update(buf).digest();const off=mac.at(-1)&15;
  const pin=(mac.readUInt32BE(off)&0x7fffffff)%1000000;
  const expected=String(pin).padStart(6,'0');
  if(crypto.timingSafeEqual(Buffer.from(code),Buffer.from(expected)))return n;
 }
 return null;
}

function rateLimit(req,key,limit,windowMs){const ip=ipKey(req);const k=ip+':'+key;if(rate.size>10000){for(const [rid,times] of rate)if(!times.some(t=>t>now()-3600000))rate.delete(rid);if(rate.size>12000)rate.clear();}const existing=rate.get(k)||[];const v=existing.filter(t=>t>now()-windowMs);v.push(now());rate.set(k,v);return v.length<=limit;}
function requireRole(res,s,role){if(!s){fail(res,401,'Bạn cần đăng nhập');return false}if(role&&s.role!==role){fail(res,403,'Không có quyền quản trị');return false}return true}
async function route(req,res){const url=new URL(req.url,'http://localhost');const pathname=url.pathname;const method=req.method;
if(pathname==='/api/health'&&method==='GET')return respond(res,200,{ok:true,storage:'JSONBin'});
if(pathname.startsWith('/api/')&&isIpBanned(req))return banReply(res,bannedUntil(req));
if(pathname==='/api/state'&&method==='GET'){const s=auth(req);return respond(res,200,{profile:profile(s),...publicData(),...privateData(s)});}
if(!pathname.startsWith('/api/'))return staticFile(pathname,res);
if(!['POST','GET'].includes(method))return fail(res,405,'Phương thức không hợp lệ');
if(method==='POST'){
 const origin=req.headers.origin;const host=req.headers.host;if(origin){let o;try{o=new URL(origin)}catch{return fail(res,403,'Origin không hợp lệ')}if(o.host!==host)return fail(res,403,'Yêu cầu khác nguồn bị chặn');}
 if(!(req.headers['content-type']||'').startsWith('application/json'))return fail(res,415,'Yêu cầu JSON');
 if(req.headers['x-bp-request']!=='1')return fail(res,403,'Thiếu xác thực yêu cầu');
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
 if(!rateLimit(req,'login',20,15*60000))return fail(res,429,'Quá nhiều yêu cầu đăng nhập, thử lại sau');
 const username=clean(b.username,40),p=String(b.password||'');
 if(!username||p.length<1||p.length>128)return fail(res,400,'Thông tin đăng nhập không hợp lệ');
 const result=await evaluateLogin(req,username,p,b.admin===true,b.otp);
 if(!result.ok)return result.banned?banReply(res,result.until):fail(res,401,'Sai tài khoản hoặc mật khẩu');
 return respond(res,200,{ok:true},{'Set-Cookie':cookieHeader(signedToken(result.username,result.role),req)});
}
if(pathname==='/api/logout'&&method==='POST'){
 const c=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('bp_session='));
 if(c&&s){const raw=c.slice('bp_session='.length);await mutate(d=>{cleanupSecurity(d);d.security.revoked.push({digest:crypto.createHash('sha256').update(raw).digest('hex'),exp:now()+24*3600000});return {ok:true};});}
 return respond(res,200,{ok:true},{'Set-Cookie':cookieHeader('',req)});
}
if(pathname.startsWith('/api/free/')&&method==='GET'){
 if(!requireRole(res,s))return;const f=db.freebies.find(x=>String(x.id)===decodeURIComponent(pathname.slice(10)));if(!f)return fail(res,404,'Không tìm thấy link');return respond(res,200,{title:f.title,url:f.url});
}
if(pathname==='/api/coupon/check'&&method==='POST'){
 if(!requireRole(res,s))return;const c=db.discounts.find(x=>x.code===clean(b.code,32).toUpperCase()&&x.qty>0);return c?respond(res,200,{percent:c.percent,valid:true}):fail(res,404,'Mã giảm giá không hợp lệ hoặc đã hết');
}
if(pathname==='/api/order'&&method==='POST'){
 if(!requireRole(res,s,'user'))return;const out=await mutate(d=>{const a=d.accs.find(x=>String(x.id)===String(b.accId));const u=d.users.find(x=>x.username===s.username);if(!a||!u)return {error:'Không tìm thấy sản phẩm'};if(d.orders.some(o=>String(o.acc_id)===String(a.id)&&['pending','approved','sold'].includes(o.status)))return {error:'Sản phẩm đã được đặt'};
 let price=accountPrice(a),disc=percent(a.discount??0);if(price===null||price<=0||!Number.isFinite(disc))return {error:'Sản phẩm chưa có giá bán hợp lệ. Vui lòng liên hệ ADMIN'};price=Math.floor(price*(100-disc)/100);const code=clean(b.code,32).toUpperCase();if(code){const c=d.discounts.find(x=>x.code===code&&x.qty>0);if(!c)return {error:'Mã giảm giá không hợp lệ'};price=Math.floor(price*(100-c.percent)/100);c.qty-=1;}const currentBalance=balanceOf(u);if(currentBalance===null)return {error:'Số dư của bạn cần được ADMIN kiểm tra'};if(currentBalance<price)return {error:'Số dư chưa đủ. Hãy nhắn ADMIN để nạp tiền'};u.balance=currentBalance-price;const oid=id();d.orders.push({id:oid,acc_id:a.id,acc_title:a.title,username:u.username,status:'pending',price_paid:price,discount:disc,created_at:now()});d.wallet.push({id:id(),username:u.username,amount:-price,note:'Mua '+a.title,at:now()});return {ok:true,orderId:oid,status:'pending',message:'Đặt hàng thành công. Đơn đang chờ ADMIN duyệt, dự kiến trong vòng 24 giờ.'}});return out.error?fail(res,400,out.error):respond(res,200,out);
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
 case 'account/add': {
  const title=clean(b.title,100),info=clean(b.info,500),link=b.link?validateUrl(b.link):'';
  const price=amount(b.price),discount=percent(b.discount??0);
  if(!title||!Number.isFinite(price)||price<=0||!Number.isFinite(discount)||(b.link&&!link))return {error:'Nhập giá bán lớn hơn 0 đ, giảm 0–100%, và link hợp lệ'};
  d.accs.unshift({id:id(),title,info,link,price,discount,type:b.type==='vip'?'vip':'normal',created_at:now()});break;
 }
 case 'account/update': {
  const a=d.accs.find(x=>String(x.id)===String(b.id));if(!a)return {error:'Không tìm thấy sản phẩm'};
  const title=clean(b.title,100),info=clean(b.info,500),link=b.link?validateUrl(b.link):'';
  const price=amount(b.price),discount=percent(b.discount??0);
  if(!title||!Number.isFinite(price)||price<=0||!Number.isFinite(discount)||(b.link&&!link))return {error:'Vui lòng nhập giá bán lớn hơn 0 đ và thông tin hợp lệ'};
  if(d.orders.some(o=>String(o.acc_id)===String(a.id)&&['pending','approved','sold'].includes(o.status)))return {error:'Sản phẩm có đơn chờ duyệt/đã bán; không thể sửa giá hoặc thông tin bàn giao'};
  Object.assign(a,{title,info,link,price,discount,type:b.type==='vip'?'vip':'normal',updated_at:now()});break;
 }
 case 'account/delivery':{
  const a=d.accs.find(x=>String(x.id)===String(b.id));if(!a)return {error:'Không tìm thấy sản phẩm'};
  if(productAvailability(a,d)!=='pending')return {error:'Chỉ cập nhật link cho sản phẩm đang chờ duyệt'};
  const link=validateUrl(b.link);if(!link)return {error:'Vui lòng nhập link bàn giao hợp lệ (https://...)'};
  a.link=link;a.updated_at=now();break;
 }
 case 'account/delete':{if(d.orders.some(o=>String(o.acc_id)===String(b.id)&&['pending','approved','sold'].includes(o.status)))return {error:'Sản phẩm còn đơn hàng đang xử lý'};d.accs=d.accs.filter(x=>String(x.id)!==String(b.id));break;}
 case 'free/add':{const title=clean(b.title,100),url=validateUrl(b.url);if(!title||!url)return {error:'Nhập tên và link http/https hợp lệ'};d.freebies.unshift({id:id(),title,url,description:clean(b.description,300),created_at:now()});break;}
 case 'free/delete':d.freebies=d.freebies.filter(x=>String(x.id)!==String(b.id));break;
 case 'order/approve':{const o=findOrder();if(!o||o.status!=='pending')return {error:'Đơn không ở trạng thái chờ duyệt'};const acc=d.accs.find(x=>String(x.id)===String(o.acc_id));if(!validateUrl(acc?.link||''))return {error:'Hãy cập nhật link bàn giao hợp lệ trước khi duyệt đơn'};o.status='approved';o.reviewed_at=now();break;}
 case 'order/reject':{const o=findOrder();if(!o||o.status!=='pending')return {error:'Đơn không ở trạng thái chờ duyệt'};const u=d.users.find(x=>x.username===o.username);const paid=parseMoney(o.price_paid),bal=balanceOf(u);if(!u||paid===null||bal===null)return {error:'Không thể tính số tiền hoàn; liên hệ quản trị để kiểm tra dữ liệu'};o.status='rejected';o.reviewed_at=now();u.balance=bal+paid;d.wallet.push({id:id(),username:u.username,amount:paid,note:'Hoàn tiền đơn '+o.id,at:now()});break;}
 case 'wallet/credit':{const u=d.users.find(x=>x.username===clean(b.username,40));const x=amount(b.amount);const bal=balanceOf(u);if(!u||!Number.isFinite(x)||x===0||bal===null||bal+x>1000000000)return {error:'Khách hoặc số tiền/số dư không hợp lệ'};u.balance=bal+x;d.wallet.push({id:id(),username:u.username,amount:x,note:clean(b.note,150)||'ADMIN nạp tiền',at:now()});break;}
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
function staticFile(p,res){
 const files={'/':'index.html','/index.html':'index.html','/styles.css':'styles.css','/app.js':'app.js'};
 const filename=files[p];
 if(!filename)return fail(res,404,'Không tìm thấy');
 let data;try{data=fs.readFileSync(path.join(ROOT,'public',filename));}catch{return fail(res,500,'Thiếu file giao diện');}
 const type=filename.endsWith('.css')?'text/css; charset=utf-8':filename.endsWith('.js')?'application/javascript; charset=utf-8':'text/html; charset=utf-8';
 res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store',...securityHeaders()});
 res.end(data);
}
function securityHeaders(){
 const h={
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  'X-Frame-Options':'DENY',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy':'same-origin',
  'Cross-Origin-Resource-Policy':'same-origin',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
 };
 if(process.env.NODE_ENV==='production')h['Strict-Transport-Security']='max-age=31536000; includeSubDomains';
 return h;
}
const server=http.createServer(async(req,res)=>{try{await route(req,res)}catch(e){console.error(e.stack||e);if(!res.headersSent)fail(res,503,'Máy chủ hoặc JSONBin đang gặp lỗi. Hãy thử lại.') }});
server.requestTimeout=15000;server.headersTimeout=12000;server.keepAliveTimeout=5000;
bootstrap().then(()=>server.listen(PORT,'0.0.0.0',()=>console.log(`BÁCH PREMIUM: http://localhost:${PORT}`))).catch(e=>{console.error('Không kết nối được JSONBin:',e.message);process.exit(1)});
