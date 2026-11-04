'use strict';
(()=>{
 const launcher=document.createElement('button');launcher.type='button';launcher.className='support-launcher btn';launcher.textContent='Chat với ADMIN';launcher.setAttribute('aria-expanded','false');launcher.setAttribute('aria-controls','supportPanel');
 const panel=document.createElement('section');panel.id='supportPanel';panel.className='support-panel';panel.hidden=true;panel.setAttribute('aria-label','Chat với ADMIN');
 document.body.append(launcher,panel);
 let timer,busy=false,sending=false;
 function close(){panel.hidden=true;launcher.setAttribute('aria-expanded','false');clearInterval(timer);launcher.focus()}
 async function refresh(){
  if(busy||panel.hidden||document.hidden||sending)return;busy=true;
  try{
   const state=await api('/api/state');
   if(!state.profile){clearInterval(timer);panel.innerHTML='<div class="support-heading"><strong>Chat với ADMIN</strong><button type="button" data-support-close>Đóng</button></div><p>Đăng nhập để gửi tin nhắn và xem lịch sử hỗ trợ.</p><button class="btn" type="button" data-support-login>Đăng nhập</button>';return}
   if(state.profile.role==='admin'){clearInterval(timer);panel.innerHTML='<div class="support-heading"><strong>Hộp thư ADMIN</strong><button type="button" data-support-close>Đóng</button></div><p>Xem các cuộc trò chuyện của khách hàng trong trang quản trị.</p><button class="btn" type="button" data-support-inbox>Mở hộp thư</button>';return}
   const box=panel.querySelector('.support-messages');
   if(!box)return;
   const atBottom=box.scrollHeight-box.scrollTop-box.clientHeight<60;
   const markup=messagesView(state.mine?.messages||[]);
   if(box.innerHTML!==markup){box.innerHTML=markup;if(atBottom)box.scrollTop=box.scrollHeight}
   panel.querySelector('[role=status]').textContent='ADMIN sẽ trả lời khi có thể. Tin nhắn được lưu trong tài khoản.';
  }catch{const status=panel.querySelector('[role=status]');if(status)status.textContent='Chưa tải được tin nhắn. Hệ thống sẽ thử lại.'}
  finally{busy=false}
 }
 launcher.addEventListener('click',()=>{
  if(!panel.hidden){close();return}
  panel.hidden=false;launcher.setAttribute('aria-expanded','true');
  panel.innerHTML='<div class="support-heading"><div><strong>Chat với ADMIN</strong><small>Hỗ trợ tài khoản và đơn hàng</small></div><button type="button" data-support-close>Đóng</button></div><div class="support-messages" aria-live="polite"></div><p class="small muted" role="status">Đang tải tin nhắn…</p><form class="support-form"><label for="supportText">Tin nhắn của bạn</label><textarea id="supportText" class="input" maxlength="1500" required placeholder="Bạn cần hỗ trợ điều gì?"></textarea><button class="btn" type="submit">Gửi tin nhắn</button></form>';
  refresh();clearInterval(timer);timer=setInterval(refresh,15000);panel.querySelector('[data-support-close]').focus();
 });
 panel.addEventListener('click',e=>{
  if(e.target.closest('[data-support-close]'))close();
  if(e.target.closest('[data-support-login]')){close();navigate('login')}
  if(e.target.closest('[data-support-inbox]')){close();adminTab='messages';navigate('admin')}
 });
 panel.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 panel.addEventListener('submit',async e=>{
  e.preventDefault();if(sending)return;
  const input=panel.querySelector('textarea'),button=panel.querySelector('[type=submit]'),text=input.value.trim();if(!text)return;
  sending=true;button.disabled=true;
  try{await post('/api/chat',{text});input.value='';sending=false;await refresh();const box=panel.querySelector('.support-messages');if(box)box.scrollTop=box.scrollHeight}
  catch(err){const status=panel.querySelector('[role=status]');if(status)status.textContent=err.message}
  finally{sending=false;button.disabled=false}
 });
 window.addEventListener('bach:preferences',e=>{if(!e.detail.floatingChat&&!panel.hidden)close();resetTilt()});
 const hero=document.querySelector('.hero'),card=document.querySelector('.premium-pass');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function resetTilt(){if(card)card.style.transform=''}
 if(hero&&card){
  hero.addEventListener('pointermove',e=>{
   const pref=window.BPSettings.get();
   if(!pref.tilt||pref.motion==='reduced'||reduced.matches||e.pointerType!=='mouse')return resetTilt();
   const rect=hero.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width-.5,y=(e.clientY-rect.top)/rect.height-.5;
   card.style.transform='rotateX('+(-y*14)+'deg) rotateY('+(x*18)+'deg) rotateZ(-7deg)';
  });
  hero.addEventListener('pointerleave',resetTilt);reduced.addEventListener('change',resetTilt);
 }
})();
