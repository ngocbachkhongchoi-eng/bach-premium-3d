const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const messages=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://bach.test/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/chat'){messages.push({from:'user',text:route.request().postDataJSON().text,at:Date.now()});return route.fulfill({json:{ok:true}})}
  if(path==='/api/state')return route.fulfill({json:{mine:{messages},accs:[],freebies:[],top:[],notifs:[],googleEnabled:false,profile:{role:'user',username:'gg_random',email:'myname@gmail.com',balance:0}}});
  return route.fulfill({body:fs.readFileSync(require('node:path').join(__dirname,'..','public',path==='/'?'index.html':path.slice(1))),contentType:path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':'text/html'});
 });
 await page.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:'<html>Music preview</html>'}));
 await page.route('https://www.youtube.com/iframe_api',route=>route.fulfill({contentType:'application/javascript',body:"window.musicLog=[];window.YT={PlayerState:{PLAYING:1},Player:function(id,opts){this.setVolume=v=>musicLog.push(['volume',v]);this.mute=()=>musicLog.push(['mute']);this.unMute=()=>musicLog.push(['unmute']);this.pauseVideo=()=>musicLog.push(['pause']);this.playVideo=()=>musicLog.push(['play']);setTimeout(()=>opts.events.onReady(),0)}};onYouTubeIframeAPIReady();"}));
 await page.goto('http://bach.test/');
 await page.locator('#who').filter({hasText:'myname@gmail.com'}).waitFor();
 assert.ok(!(await page.locator('#who').textContent()).includes('gg_random'));
 await page.locator('.support-launcher').click();
 await page.locator('#supportText').fill('Xin hỗ trợ đơn hàng');
 await page.locator('.support-form [type=submit]').click();
 await page.locator('.support-messages').getByText('Xin hỗ trợ đơn hàng',{exact:false}).waitFor();
 assert.equal(messages.at(-1).text,'Xin hỗ trợ đơn hàng');
 await page.locator('[data-support-close]').click();
 await page.locator('#openSettings').click();
 await page.locator('#settingsDialog[open]').waitFor();
 for(const theme of ['ocean','rose','sunset','light','aurora','emerald','ruby','graphite','lavender','bronze']){
  await page.locator('[name=theme]').selectOption(theme);
  assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
 }
 for(const name of ['hero','ranking','images','descriptions','shadows','sticky','tilt','spotlight','glass','rounded','borders','stats']){
  await page.locator('[name='+name+']').uncheck();
  assert.equal(await page.locator('html').getAttribute('data-'+name),'false');
 }
 for(const name of ['wide','contrast']){
  await page.locator('[name='+name+']').check();
  assert.equal(await page.locator('html').getAttribute('data-'+name),'true');
 }
 await page.locator('[name=theme]').selectOption('light');
 await page.locator('[name=volume]').fill('22');
 await page.locator('[name=muted]').check();
 await page.locator('[name=autoplay]').uncheck();
 await page.locator('[name=text]').selectOption('largest');
 await page.locator('[name=motion]').selectOption('reduced');
 await page.locator('[name=compact]').check();
 await page.locator('[name=toasts]').uncheck();
 for(const [code,title] of [['fr','Paramètres'],['es','Ajustes'],['ja','設定']]){
  await page.locator('[name=language]').selectOption(code);assert.equal(await page.locator('#settingsTitle').textContent(),title);
 }
 await page.locator('[name=language]').selectOption('en');
 assert.equal(await page.locator('#settingsTitle').textContent(),'Settings');
 assert.equal(await page.locator('html').getAttribute('lang'),'en');
 assert.ok(await page.evaluate(()=>musicLog.some(([k,v])=>k==='volume'&&v===22)));
 assert.ok(await page.evaluate(()=>musicLog.some(([k])=>k==='pause')));
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#settingsDialog').evaluate(d=>d.open),false);
 await page.reload();await page.locator('#who').filter({hasText:'myname@gmail.com'}).waitFor();
 assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 await page.waitForFunction(()=>window.musicLog?.some(([k])=>k==='pause'));
 assert.ok(await page.evaluate(()=>!musicLog.some(([k])=>k==='play')));
 await page.setViewportSize({width:390,height:844});
 await page.locator('#openSettings').click();
 assert.equal(await page.locator('[name=volume]').inputValue(),'22');
 assert.equal(await page.locator('[name=autoplay]').isChecked(),false);
 assert.equal(await page.locator('[name=muted]').isChecked(),true);
 assert.ok(await page.locator('#settingsDialog').evaluate(d=>d.scrollWidth<=d.clientWidth));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('[data-settings-reset]').click();
 assert.equal(await page.locator('[name=theme]').inputValue(),'aurora');
 assert.equal(await page.locator('[name=volume]').inputValue(),'65');
 assert.equal(await page.locator('html').getAttribute('lang'),'vi');
 assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('bach.preferences.v1')).autoplay));
 await page.locator('[data-settings-close]').click();
 await page.evaluate(()=>navigate('register'));
 assert.equal(await page.locator('#recoveryCode').getAttribute('pattern'),'[0-9]{6}');
 await page.locator('#recoveryCode').fill('123');
 assert.equal(await page.locator('#recoveryCode').evaluate(el=>el.checkValidity()),false);
 await page.evaluate(()=>navigate('login'));
 await page.getByRole('button',{name:'Bạn đã quên mật khẩu?'}).click();
 await page.locator('#lookupPasswordForm').waitFor();
 assert.ok(await page.locator('.recovery-panel').isVisible());
 assert.deepEqual(errors,[]);
 console.log('PASS settings: five themes, Gmail display, volume/mute/autoplay, language, text/motion/layout, persistence, reset, keyboard close, mobile overflow');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
