// The same controls run on static pages and inside the standalone HTML export.
const carousel=document.querySelector('.hero-visual[aria-roledescription="carousel"]');
if(carousel){
 const slides=[...carousel.querySelectorAll('.hero-slide')],dots=[...carousel.querySelectorAll('.hero-dot')];
 const play=carousel.querySelector('.hero-play'),doc=carousel.ownerDocument;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 let current=0,wanted=0,request=0,paused=reduced.matches,touch=null;
 function setPaused(value){
  paused=value;
  play.setAttribute('aria-label',carousel.querySelector(value?'.hero-play-label':'.hero-pause-label').textContent);
  play.querySelector('.hero-pause-icon').hidden=value;
  play.querySelector('.hero-play-icon').hidden=!value;
  carousel.dataset.paused=String(value);
 }
 async function show(index,manual=false){
  wanted=(index+slides.length)%slides.length;
  const selected=wanted,token=++request,img=slides[selected].querySelector('img');
  if(manual)setPaused(true);
  try{if(!img.complete||!img.naturalWidth)await img.decode();}catch{return;}
  if(token!==request||!carousel.isConnected)return;
  current=selected;
  slides.forEach((slide,i)=>{slide.classList.toggle('is-active',i===current);slide.setAttribute('aria-hidden',String(i!==current));});
  dots.forEach((dot,i)=>dot.setAttribute('aria-pressed',String(i===current)));
  if(manual)carousel.querySelector('.hero-slide-status').textContent=`${current+1} / ${slides.length}`;
 }
 function bindControl(button,action){
  let press=null,lastTouch=-Infinity;
  button.addEventListener('pointerdown',e=>{press=e.pointerType==='touch'?{x:e.clientX,y:e.clientY}:null;});
  button.addEventListener('pointercancel',()=>{press=null;});
  button.addEventListener('pointerup',e=>{
   if(!press)return;
   const tap=Math.hypot(e.clientX-press.x,e.clientY-press.y)<12;press=null;
   if(tap){e.preventDefault();lastTouch=Date.now();action();}
  });
  // A browser may suppress the synthetic click following a swipe, or emit one after pointerup.
  button.addEventListener('click',e=>{if(e.detail!==0&&Date.now()-lastTouch<700)return;action();});
 }
 bindControl(carousel.querySelector('.hero-prev'),()=>show(wanted-1,true));
 bindControl(carousel.querySelector('.hero-next'),()=>show(wanted+1,true));
 dots.forEach((dot,i)=>bindControl(dot,()=>show(i,true)));
 bindControl(play,()=>setPaused(!paused));
 carousel.addEventListener('focusin',e=>{if(e.target.matches(':focus-visible'))setPaused(true);});
 carousel.addEventListener('keydown',e=>{
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();show(wanted+(e.key==='ArrowRight'?1:-1),true);}
 });
 carousel.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&!e.target.closest('button'))touch={x:e.clientX,y:e.clientY};});
 carousel.addEventListener('pointercancel',()=>{touch=null;});
 carousel.addEventListener('pointerup',e=>{
  if(!touch)return;
  const dx=e.clientX-touch.x,dy=e.clientY-touch.y;touch=null;
  if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.5)show(wanted+(dx<0?1:-1),true);
 });
 reduced.addEventListener('change',e=>{if(e.matches)setPaused(true);});
 setPaused(paused);
 carousel.querySelector('.hero-controls').hidden=false;
 const rotation=window.setInterval(()=>{
  if(!carousel.isConnected){window.clearInterval(rotation);return;}
  const bounds=carousel.getBoundingClientRect();
  if(!paused&&!doc.hidden&&!carousel.matches(':hover')&&bounds.bottom>0&&bounds.top<doc.documentElement.clientHeight)show(current+1);
 },6000);
}
