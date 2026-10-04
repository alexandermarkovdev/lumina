
// A shared viewer for the photo gallery; thumbnails remain ordinary links without JS.
(() => {
 const viewer = document.querySelector('.gallery-viewer');
 const items = [...document.querySelectorAll('.gallery-item')];
 if (!viewer || !items.length) return;
 const image = viewer.querySelector('.gallery-viewer-image');
 const counter = viewer.querySelector('.gallery-position');
 const stage = viewer.querySelector('.gallery-stage');
 const close = viewer.querySelector('.gallery-viewer-close');
 let current = 0;
 let trigger = null;
 let touch = null;

 function show(index) {
  current = (index + items.length) % items.length;
  const item = items[current];
  image.alt = item.querySelector('img').alt;
  image.src = item.href;
  counter.textContent = `${current + 1} / ${items.length}`;
 }
 function open(index, item) {
  trigger = item;
  show(index);
  viewer.showModal();
  document.body.classList.add('gallery-open');
 }
 function finish() {
  document.body.classList.remove('gallery-open');
  touch = null;
  if (trigger?.isConnected) trigger.focus({preventScroll:true});
 }
 items.forEach((item,index) => item.addEventListener('click', event => {
  if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  open(index,item);
 }));
 // Handle taps directly too: mobile browsers may suppress the click after a swipe.
 function bindControl(button, action) {
  let press = null, lastTouch = -Infinity;
  button.addEventListener('pointerdown', event => {
   press = event.pointerType === 'touch' ? {x:event.clientX,y:event.clientY} : null;
  });
  button.addEventListener('pointercancel', () => {press=null;});
  button.addEventListener('pointerup', event => {
   if (!press) return;
   const tap = Math.hypot(event.clientX-press.x,event.clientY-press.y)<12;
   press = null;
   if (tap) {event.preventDefault();lastTouch=Date.now();action();}
  });
  button.addEventListener('click', event => {
   if (event.detail !== 0 && Date.now()-lastTouch<700) return;
   action();
  });
 }
 bindControl(close, () => viewer.close());
 viewer.addEventListener('close', finish);
 bindControl(viewer.querySelector('.gallery-prev'), () => show(current - 1));
 bindControl(viewer.querySelector('.gallery-next'), () => show(current + 1));
 viewer.addEventListener('click', event => {
  if (event.target === viewer || event.target === stage) viewer.close();
 });
 viewer.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
   event.preventDefault();
   show(current + (event.key === 'ArrowLeft' ? -1 : 1));
  }
 });
 stage.addEventListener('touchstart', event => {
  touch = event.touches.length === 1 ? {x:event.touches[0].clientX,y:event.touches[0].clientY} : null;
 }, {passive:true});
 stage.addEventListener('touchmove', event => {
  if (event.touches.length !== 1) touch = null;
 }, {passive:true});
 stage.addEventListener('touchend', event => {
  if (!touch || event.touches.length) return;
  const end = event.changedTouches[0];
  const dx = end.clientX-touch.x, dy = end.clientY-touch.y;
  if (Math.abs(dx)>50 && Math.abs(dx)>Math.abs(dy)*1.5) show(current+(dx<0?1:-1));
  touch = null;
 }, {passive:true});
 stage.addEventListener('touchcancel', () => {touch=null;}, {passive:true});
})();
