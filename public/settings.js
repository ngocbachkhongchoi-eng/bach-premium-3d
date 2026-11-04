'use strict';
(()=>{
 const key='bach.preferences.v1';
 const defaults={theme:'aurora',volume:65,muted:false,autoplay:true,text:'normal',motion:'auto',compact:false,toasts:true,language:'vi',hero:true,ranking:true,images:true,descriptions:true,shadows:true,sticky:true,wide:false,contrast:false,floatingChat:true,tilt:true,spotlight:true,glass:true,rounded:true,borders:true,gradientText:true,stats:true,underlinedLinks:false,strongFocus:false};
 function normalize(raw){
  const p={...defaults};
  if(!raw||typeof raw!=='object')return p;
  for(const [k,choices] of Object.entries({theme:['aurora','ocean','rose','sunset','light'],text:['normal','large','largest'],motion:['auto','reduced'],language:['vi','en']}))if(choices.includes(raw[k]))p[k]=raw[k];
  for(const k of ['muted','autoplay','compact','toasts','hero','ranking','images','descriptions','shadows','sticky','wide','contrast','floatingChat','tilt','spotlight','glass','rounded','borders','gradientText','stats','underlinedLinks','strongFocus'])if(typeof raw[k]==='boolean')p[k]=raw[k];
  if(typeof raw.volume==='number'&&Number.isFinite(raw.volume))p.volume=Math.min(100,Math.max(0,Math.round(raw.volume)));
  return p;
 }
 let prefs;try{prefs=normalize(JSON.parse(localStorage.getItem(key)))}catch{prefs={...defaults}}
 const translations={'Nút chat ở góc màn hình':'Floating support chat','Nghiêng thẻ theo con trỏ':'Pointer tilt','Ánh sáng nền sân khấu':'Ambient lighting','Hiệu ứng kính':'Glass surfaces','Bo tròn các khối':'Rounded panels','Viền nổi bật':'Panel borders','Chữ chuyển sắc':'Gradient headings','Hiện thống kê cửa hàng':'Store statistics','Gạch chân đường dẫn':'Underline links','Viền bàn phím rõ hơn':'Stronger keyboard focus','Hiện khu giới thiệu':'Show introduction','Hiện bảng xếp hạng':'Show leaderboard','Hiện ảnh sản phẩm':'Show product images','Hiện mô tả sản phẩm':'Show product descriptions','Bóng đổ 3D':'3D shadows','Thanh đầu trang cố định':'Sticky header','Bố cục rộng':'Wide layout','Tăng tương phản':'Higher contrast',
 'Cài đặt':'Settings','Cài đặt':'Settings','Cá nhân hóa không gian của bạn':'Make this space yours','Giao diện':'Appearance','Màu giao diện':'Color theme','Cực quang tím':'Violet aurora','Đại dương xanh':'Blue ocean','Hồng pha lê':'Crystal rose','Cam hoàng hôn':'Sunset orange','Trắng ngọc trai':'Pearl white','Âm thanh':'Audio','Âm lượng nhạc':'Music volume','Tắt tiếng':'Mute','Tự phát nhạc khi vào web':'Autoplay music on arrival','Khả năng đọc':'Readability','Cỡ chữ':'Text size','Tiêu chuẩn':'Standard','Lớn':'Large','Rất lớn':'Extra large','Hiệu ứng chuyển động':'Motion effects','Theo thiết bị':'Follow device','Giảm chuyển động':'Reduce motion','Bố cục gọn':'Compact layout','Thông báo thao tác':'Action notifications','Ngôn ngữ giao diện':'Interface language','Tiếng Việt':'Vietnamese','Tiếng Anh':'English','Khôi phục mặc định':'Restore defaults','Đóng':'Close','Đã lưu trên thiết bị này':'Saved on this device','Không thể lưu trên trình duyệt này; cài đặt chỉ áp dụng trong lần mở này.':'Your browser cannot save preferences; changes apply to this visit only.','Lựa chọn được lưu riêng trên trình duyệt này.':'Preferences are saved in this browser.','Trình duyệt có thể yêu cầu chạm trước khi phát có tiếng.':'Your browser may require a tap before playing sound.','Nội dung do cửa hàng đăng giữ nguyên ngôn ngữ gốc.':'Store content stays in its original language.',
 'Trang chủ':'Home','Miễn phí':'Free downloads','Đơn hàng':'Orders','Lịch sử':'History','Ví tiền':'Wallet','Chat hỗ trợ':'Support chat','Thành viên VIP':'VIP members','Đăng nhập':'Sign in','Đăng ký':'Register','Quản trị ADMIN':'Admin panel','Làm mới dữ liệu':'Refresh data','ĐIỀU HƯỚNG':'NAVIGATION','Thông báo':'Notifications','Đăng xuất':'Sign out','Hỗ trợ 24/7':'24/7 support','Không gian số của bạn':'Your digital space','Xem sản phẩm':'Browse products','Khám phá miễn phí':'Explore free content','Nâng tầm trải nghiệm.':'Elevate your experience.','Mở khóa chất riêng.':'Unlock your own style.',
 'Danh sách tài khoản':'Accounts for sale','Top 10 nạp tiền':'Top 10 deposits','SẢN PHẨM':'PRODUCTS','LINK MIỄN PHÍ':'FREE DOWNLOADS','ĐANG CÓ SẴN':'AVAILABLE','Xem link miễn phí':'View free downloads','Sản phẩm':'Product','Sản phẩm VIP':'VIP product','Xem và đặt mua':'View and buy','Chưa cập nhật giá':'Price not set','Đã bán':'Sold','Đang chờ ADMIN duyệt':'Awaiting admin approval',
 'Tên đăng nhập':'Username','Mật khẩu':'Password','Nhập lại mật khẩu':'Confirm password','Tạo tài khoản':'Create an account','Đăng ký tài khoản':'Create account','Đăng nhập ngay':'Sign in now','Tiếp tục với Google':'Continue with Google','hoặc dùng tài khoản':'or use your account','Đăng ký tài khoản mới':'Create a new account','Đã có tài khoản':'Already have an account','Chào mừng trở lại. Đăng nhập để sử dụng đầy đủ chức năng.':'Welcome back. Sign in to access all features.','Đăng ký để mua sản phẩm, xem link miễn phí và liên hệ ADMIN.':'Register to buy products, access free downloads and contact support.','Đăng nhập Google đang chờ cửa hàng kích hoạt.':'Google sign-in is awaiting store activation.','Mã xác thực hai bước (nếu đã bật)':'Two-step verification (if enabled)','Mã xác thực 2 bước (nếu đã bật)':'Verification code (if enabled)',
 'Trung tâm quản trị':'Admin center','Đăng acc / Sản phẩm':'Publish / Products','Đăng acc mới':'Publish an account','Đăng acc':'Publish account','Khách hàng':'Customers','Nạp tiền':'Add funds','Mã giảm giá':'Coupons','Hộp thư':'Inbox','Nhật ký':'Activity log','Làm mới':'Refresh','Sửa giá':'Edit price','Sửa sản phẩm / Giá':'Edit product / Price','Xóa sản phẩm':'Delete product','Tên sản phẩm':'Product name','Mô tả công khai':'Public description','Giá bán (VNĐ, lớn hơn 0)':'Price (VND, greater than 0)','Giảm sẵn (%)':'Discount (%)','Phân loại':'Category','Thường':'Standard','Ảnh & tệp đính kèm':'Photos & attachments','Chọn tệp':'Choose file','Chụp ảnh':'Take photo','Thư viện ảnh':'Photo library','Bỏ tệp':'Remove file','Thông tin acc bàn giao riêng':'Private account delivery','Tài khoản acc':'Account username','Mật khẩu acc':'Account password','Link bàn giao (không bắt buộc)':'Delivery link (optional)','Chưa chọn tệp':'No file selected',
 'Lưu giá mới':'Save new price','Giá bán (VNĐ)':'Price (VND)','Cập nhật giá niêm yết':'Update listing price','Lưu sản phẩm':'Save product','Hủy':'Cancel','Xác nhận':'Confirm','Gửi trả lời':'Send reply','Gửi':'Send','Nhận thông tin':'View delivery','Duyệt đơn':'Approve order','Từ chối và hoàn tiền':'Reject and refund','Tải link miễn phí':'Download free content','Khu tải link miễn phí':'Free downloads','Bật nhạc. Chạm cảm hứng.':'Press play. Find inspiration.'
 };
 const originals=new WeakMap();
 const t=s=>prefs.language==='en'?(translations[s]||s):s;
 function localize(root=document.body){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode())){
   if(node.parentElement?.closest('script,style,textarea,input,#who,.product h3,.product p,.info-item strong,.info-item p,.attachment-view,td,#dialogBody strong'))continue;
   const old=originals.get(node);
   if(old){node.nodeValue=old.replace(old.trim(),t(old.trim()));continue}
   const value=node.nodeValue,trimmed=value.trim();
   if(Object.hasOwn(translations,trimmed)){originals.set(node,value);node.nodeValue=value.replace(trimmed,t(trimmed))}
  }
 }
 let saveOK=true;
 function apply(emit=true){
  const root=document.documentElement;
  root.dataset.theme=prefs.theme;root.dataset.text=prefs.text;root.dataset.motion=prefs.motion;root.dataset.compact=String(prefs.compact);root.lang=prefs.language;for(const k of ['hero','ranking','images','descriptions','shadows','sticky','wide','contrast','floatingChat','tilt','spotlight','glass','rounded','borders','gradientText','stats','underlinedLinks','strongFocus'])root.dataset[k]=String(prefs[k]);
  localize();
  if(emit)window.dispatchEvent(new CustomEvent('bach:preferences',{detail:{...prefs}}));
 }
 function save(){
  try{localStorage.setItem(key,JSON.stringify(prefs));saveOK=true}catch{saveOK=false}
  apply();
 }
 window.BPSettings={get:()=>({...prefs}),t,localize};
 apply(false);
 const dialog=document.getElementById('settingsDialog');
 const select=(name,label,choices)=>'<label class="field">'+t(label)+'<select class="input" name="'+name+'">'+choices.map(([value,label])=>'<option value="'+value+'"'+(prefs[name]===value?' selected':'')+'>'+t(label)+'</option>').join('')+'</select></label>';
 const toggle=(name,label)=>'<label class="settings-toggle"><span>'+t(label)+'</span><input type="checkbox" name="'+name+'"'+(prefs[name]?' checked':'')+'></label>';
 function render(){
  dialog.innerHTML='<div class="panel-header"><div><div class="eyebrow">BÁCH PREMIUM</div><h2 id="settingsTitle">'+t('Cài đặt')+'</h2></div><button type="button" class="btn light tiny" data-settings-close>'+t('Đóng')+'</button></div><p class="muted">'+t('Cá nhân hóa không gian của bạn')+'</p><form id="preferencesForm"><fieldset><legend>'+t('Giao diện')+'</legend>'+select('theme','Màu giao diện',[['aurora','Cực quang tím'],['ocean','Đại dương xanh'],['rose','Hồng pha lê'],['sunset','Cam hoàng hôn'],['light','Trắng ngọc trai']])+select('language','Ngôn ngữ giao diện',[['vi','Tiếng Việt'],['en','Tiếng Anh']])+'<p class="small muted">'+t('Nội dung do cửa hàng đăng giữ nguyên ngôn ngữ gốc.')+'</p></fieldset><fieldset><legend>'+t('Âm thanh')+'</legend><label class="field">'+t('Âm lượng nhạc')+' <output id="volumeValue">'+prefs.volume+'%</output><input type="range" name="volume" min="0" max="100" step="1" value="'+prefs.volume+'"></label>'+toggle('muted','Tắt tiếng')+toggle('autoplay','Tự phát nhạc khi vào web')+'<p class="small muted">'+t('Trình duyệt có thể yêu cầu chạm trước khi phát có tiếng.')+'</p></fieldset><fieldset><legend>'+t('Khả năng đọc')+'</legend>'+select('text','Cỡ chữ',[['normal','Tiêu chuẩn'],['large','Lớn'],['largest','Rất lớn']])+select('motion','Hiệu ứng chuyển động',[['auto','Theo thiết bị'],['reduced','Giảm chuyển động']])+toggle('compact','Bố cục gọn')+toggle('toasts','Thông báo thao tác')+toggle('hero','Hiện khu giới thiệu')+toggle('ranking','Hiện bảng xếp hạng')+toggle('images','Hiện ảnh sản phẩm')+toggle('descriptions','Hiện mô tả sản phẩm')+toggle('shadows','Bóng đổ 3D')+toggle('sticky','Thanh đầu trang cố định')+toggle('wide','Bố cục rộng')+toggle('contrast','Tăng tương phản')+toggle('floatingChat','Nút chat ở góc màn hình')+toggle('tilt','Nghiêng thẻ theo con trỏ')+toggle('spotlight','Ánh sáng nền sân khấu')+toggle('glass','Hiệu ứng kính')+toggle('rounded','Bo tròn các khối')+toggle('borders','Viền nổi bật')+toggle('gradientText','Chữ chuyển sắc')+toggle('stats','Hiện thống kê cửa hàng')+toggle('underlinedLinks','Gạch chân đường dẫn')+toggle('strongFocus','Viền bàn phím rõ hơn')+'</fieldset></form><p id="settingsSaved" class="small muted" role="status">'+t(saveOK?'Lựa chọn được lưu riêng trên trình duyệt này.':'Không thể lưu trên trình duyệt này; cài đặt chỉ áp dụng trong lần mở này.')+'</p><button type="button" class="btn light full" data-settings-reset>'+t('Khôi phục mặc định')+'</button>';
 }
 document.getElementById('openSettings').addEventListener('click',()=>{render();dialog.showModal()});
 dialog.addEventListener('click',e=>{
  if(e.target.closest('[data-settings-close]'))dialog.close();
  if(e.target.closest('[data-settings-reset]')){prefs={...defaults};save();render()}
 });
 dialog.addEventListener('submit',e=>e.preventDefault());
 dialog.addEventListener('input',e=>{
  const el=e.target,name=el.name;if(!Object.hasOwn(defaults,name))return;
  prefs=normalize({...prefs,[name]:el.type==='checkbox'?el.checked:name==='volume'?Number(el.value):el.value});
  save();
  if(name==='language'){render();dialog.querySelector('[name=language]').focus()}
  else{dialog.querySelector('#volumeValue').textContent=prefs.volume+'%';dialog.querySelector('#settingsSaved').textContent=t(saveOK?'Đã lưu trên thiết bị này':'Không thể lưu trên trình duyệt này; cài đặt chỉ áp dụng trong lần mở này.')}
 });
 window.addEventListener('storage',e=>{if(e.key!==key)return;try{prefs=normalize(JSON.parse(e.newValue));apply();if(dialog.open)render()}catch{}});
})();
