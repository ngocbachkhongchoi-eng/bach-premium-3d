'use strict';
(()=>{
 const frame=document.getElementById('musicPlayer');
 if(!frame)return;
 const getPrefs=()=>window.BPSettings?.get()||{volume:65,muted:false,autoplay:true};
 let prefs=getPrefs();
 const url=new URL(frame.dataset.src);url.searchParams.set('origin',location.origin);url.searchParams.set('autoplay',prefs.autoplay?'1':'0');url.searchParams.set('mute',prefs.muted?'1':'0');frame.src=url.href;
 let player,started=false,ready=false;
 function applyVolume(){player.setVolume(prefs.volume);if(prefs.muted)player.mute();else player.unMute()}
 const start=()=>{if(ready&&!started&&prefs.autoplay){applyVolume();player.playVideo()}};
 const cleanup=()=>{document.removeEventListener('pointerdown',start);document.removeEventListener('keydown',start)};
 function arm(){cleanup();document.addEventListener('pointerdown',start);document.addEventListener('keydown',start)}
 arm();
 window.addEventListener('bach:preferences',e=>{
  const previous=prefs;prefs=e.detail;
  if(!ready)return;
  if(previous.volume!==prefs.volume||previous.muted!==prefs.muted)applyVolume();
  if(previous.autoplay!==prefs.autoplay){
   if(!prefs.autoplay){player.pauseVideo();cleanup()}
   else{started=false;arm();start()}
  }
 });
 window.onYouTubeIframeAPIReady=()=>{
  player=new YT.Player('musicPlayer',{events:{
   onReady:()=>{ready=true;prefs=getPrefs();applyVolume();if(prefs.autoplay)start();else player.pauseVideo()},
   onStateChange:e=>{if(e.data===YT.PlayerState.PLAYING){started=true;cleanup()}},
   onError:()=>{cleanup()}
  }});
 };
 const script=document.createElement('script');
 script.src='https://www.youtube.com/iframe_api';script.onerror=cleanup;
 document.head.appendChild(script);
})();
