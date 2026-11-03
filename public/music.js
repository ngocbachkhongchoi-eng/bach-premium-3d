'use strict';
(()=>{
 const frame=document.getElementById('musicPlayer');
 if(!frame)return;
 const url=new URL(frame.src);url.searchParams.set('origin',location.origin);frame.src=url.href;
 let player,started=false,ready=false;
 const start=()=>{if(ready&&!started){player.unMute();player.playVideo()}};
 const cleanup=()=>{document.removeEventListener('pointerdown',start);document.removeEventListener('keydown',start)};
 document.addEventListener('pointerdown',start);
 document.addEventListener('keydown',start);
 window.onYouTubeIframeAPIReady=()=>{
  player=new YT.Player('musicPlayer',{events:{
   onReady:()=>{ready=true;start()},
   onStateChange:e=>{if(e.data===YT.PlayerState.PLAYING){started=true;cleanup()}},
   onError:()=>{cleanup()}
  }});
 };
 const script=document.createElement('script');
 script.src='https://www.youtube.com/iframe_api';script.onerror=cleanup;
 document.head.appendChild(script);
})();
