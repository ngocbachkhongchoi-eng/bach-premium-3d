const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://bach.test/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/state')return route.fulfill({json:{accs:[],freebies:[],top:[],notifs:[],googleEnabled:false,profile:{role:'user',username:'gg_random',email:'myname@gmail.com',balance:0}}});
  return route.fulfill({body:fs.readFileSync(require('node:path').join(__dirname,'..','public',path==='/'?'index.html':path.slice(1))),contentType:path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':'text/html'});
 });
 await page.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:'<html>Music preview</html>'}));
 await page.route('https://www.youtube.com/iframe_api',route=>route.fulfill({contentType:'application/javascript',body:"window.musicLog=[];window.YT={PlayerState:{PLAYING:1},Player:function(id,opts){this.setVolume=v=>musicLog.push(['volume',v]);this.mute=()=>musicLog.push(['mute']);this.unMute=()=>musicLog.push(['unmute']);this.pauseVideo=()=>musicLog.push(['pause']);this.playVideo=()=>musicLog.push(['play']);setTimeout(()=>opts.events.onReady(),0)}};onYouTubeIframeAPIReady();"}));
 await page.goto('http://bach.test/');
 await page.locator('#who').filter({hasText:'myname@gmail.com'}).waitFor();
 assert.ok(!(await page.locator('#who').textContent()).includes('gg_random'));
 await page.locator('#openSettings').click();
 await page.locator('#settingsDialog[open]').waitFor();
 for(const theme of ['ocean','rose','sunset','light','aurora']){
  await page.locator('[name=theme]').selectOption(theme);
  assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
 }
 await page.locator('[name=theme]').selectOption('light');
 await page.locator('[name=volume]').fill('22');
 await page.locator('[name=muted]').check();
 await page.locator('[name=autoplay]').uncheck();
 await page.locator('[name=text]').selectOption('largest');
 await page.locator('[name=motion]').selectOption('reduced');
 await page.locator('[name=compact]').check();
 await page.locator('[name=toasts]').uncheck();
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
 assert.deepEqual(errors,[]);
 console.log('PASS settings: five themes, Gmail display, volume/mute/autoplay, language, text/motion/layout, persistence, reset, keyboard close, mobile overflow');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
