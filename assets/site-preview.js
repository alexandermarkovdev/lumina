(() => {
  'use strict';
  const MODES = ['desktop', 'tablet', 'mobile'];
  const LABELS = {desktop:'Компютър', tablet:'Таблет', mobile:'Телефон'};
  const EASE = 'cubic-bezier(.22,.8,.22,1)';
  const HARDWARE = {
    desktop:{bezel:20,top:0,bottom:0,chin:60,stand:120,radius:18},
    tablet:{bezel:28,top:24,bottom:24,chin:0,stand:0,radius:40},
    mobile:{bezel:14,top:62,bottom:34,chin:0,stand:0,radius:64}
  };
  const signals='<svg viewBox="0 0 66 16" aria-hidden="true"><path d="M2 13V10M7 13V7M12 13V4M17 13V1" stroke="currentColor" stroke-width="3"/><path d="M25 5q8-7 16 0M28 8q5-4 10 0M31 11q2-2 4 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="47" y="2" width="16" height="11" rx="3" fill="none" stroke="currentColor"/><rect x="49" y="4" width="12" height="7" rx="1" fill="currentColor"/><path d="M65 6v3" stroke="currentColor" stroke-width="2"/></svg>';
  const registry = new Map(), screens = new Map(), devices = [];
  const motion = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Keep only the current project alive; all three viewport tours stay synchronized.
  const compactPreview = () => innerWidth <= 1000 || matchMedia('(pointer: coarse)').matches;
  const autoMode = () => innerWidth <= 600 ? 'mobile' : innerWidth <= 1000 ? 'tablet' : 'desktop';
  const arrow = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M4 12L12 4M5 4h7v7"/></svg>';
  let active, heroButton, resizeQueued = false, returnTimer = 0;
  const rotation={frame:0,paused:!motion(),holds:new Set(),controls:[],interval:15000,elapsed:0,last:0,started:false,keepView:false,resuming:false,focusBypass:null,project:null};
  const state = {project:null, mode:'desktop', opener:null, screen:null, source:null, closing:false, seq:0, saved:null};
  function register(project) {
    if (!project?.id || !project.name || !project.url) throw new Error('A preview needs id, name and url.');
    const url = new URL(project.url, document.baseURI);
    if (url.origin !== location.origin || !['http:','https:','file:'].includes(url.protocol)) throw new Error('Import the site build before registering it.');
    if(project.liveUrl&&!['http:','https:'].includes(new URL(project.liveUrl).protocol))throw new Error('A live-site link must use HTTP or HTTPS.');
    for (const mode of MODES) {
      const v = project.modes?.[mode];
      if (!v || !Number.isFinite(v.width) || v.width < 240 || !Number.isFinite(v.height) || v.height < 240 || !v.poster) throw new Error(`Missing viewport or poster for ${mode}.`);
    }
    registry.set(project.id, project);
    return project;
  }
  (window.LUMINA_PROJECTS || []).forEach(register);
  if (!registry.size) return;
  active = registry.keys().next().value;

  // These browsing contexts never move or reload when a preview opens. A closed
  // dialog is a non-interactive presentation layer anchored to the device slots;
  // showModal() promotes the same DOM to the top layer. Only CSS scale changes.
  const dialog = document.createElement('dialog');
  dialog.className = 'lp-viewer';dialog.setAttribute('aria-labelledby','lp-title');
  dialog.setAttribute('aria-hidden','true');dialog.inert = true;
  dialog.innerHTML = `<div class="lp-backdrop"></div><div class="lp-stage" data-mode="desktop">
    <h2 id="lp-title" class="lp-sr"></h2><div class="lp-toolbar">
    <div class="lp-segment" role="group" aria-label="Изглед на сайта"><span class="lp-thumb" aria-hidden="true"></span>
    ${MODES.map(mode=>`<button type="button" data-mode="${mode}" aria-pressed="false">${LABELS[mode]}</button>`).join('')}</div>
    <button class="lp-close" type="button" aria-label="Затвори прегледа" autofocus><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg></button></div>
    <div class="lp-port"><div class="lp-loading" role="status">Зареждане на сайта…</div>
    <div class="lp-failure" hidden><p>Сайтът не се зареди. Опитайте отново или го отворете отделно.</p><a target="_blank" rel="noopener">Отвори сайта</a><button type="button">Опитай отново</button></div></div>
    <a class="lp-live-link" target="_blank" rel="noopener noreferrer">Отвори сайта ${arrow}</a></div>`;
  document.body.append(dialog);
  const V = Object.fromEntries(['backdrop','stage','toolbar','segment','thumb','close','port','loading','failure','live-link'].map(k=>[k,dialog.querySelector(`.lp-${k}`)]));
  const rect = el => {
    const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};
  };
  const visible = r => r && r.width>0 && r.height>0 && r.bottom>0 && r.top<innerHeight && r.right>0 && r.left<innerWidth;
  const deviceFor = screen => {
    if(screen.project.id!==active)return null;
    if(dialog.open&&state.source?.mode===screen.mode)return state.source;
    const candidates=devices.filter(d=>d.mode===screen.mode&&!d.box.hidden);
    return candidates.find(d=>visible(rect(d.box)))||candidates.find(d=>!d.scene)||null;
  };
  function updateStatus() {
    if (!state.screen) return;
    V.loading.hidden=state.screen.ready || state.screen.failed;
    V.failure.hidden=!state.screen.failed;
    V.port.classList.toggle('is-loaded',state.screen.ready);
    V.port.setAttribute('aria-busy',String(!state.screen.ready&&!state.screen.failed));
    V.failure.querySelector('a').href=state.project.liveUrl||state.project.url;
    V['live-link'].hidden=!state.project.liveUrl;
    if(state.project.liveUrl){V['live-link'].href=liveUrlFor(state.screen);V['live-link'].setAttribute('aria-label',`Отвори ${state.project.name} в нов раздел`);}
  }
  function liveUrlFor(screen){
    const live=new URL(screen.project.liveUrl||screen.project.url,document.baseURI);
    try{
      const localRoot=new URL('.',new URL(screen.project.url,document.baseURI)),current=new URL(screen.frame.contentWindow.location.href);
      if(current.origin===localRoot.origin&&current.pathname.startsWith(localRoot.pathname)){
        const relative=current.pathname.slice(localRoot.pathname.length).replace(/index\.html$/,'');
        return new URL(relative+current.hash,live).href;
      }
    }catch{}
    return live.href;
  }
  function setThumbnail(screen,passive){
    try{screen.frame.contentDocument?.documentElement.toggleAttribute('data-lumina-thumbnail',passive);}catch{}
  }
  function prepareDocument(screen,doc){
    // Shared adapters live here; site-specific preview fixes stay in the imported copy.
    setThumbnail(screen,!dialog.open||state.screen!==screen);
    if(!doc.getElementById('lumina-tour-style')){
      const style=doc.createElement('style');style.id='lumina-tour-style';
      style.textContent='html[data-lumina-thumbnail],html[data-lumina-thumbnail] *{scroll-behavior:auto!important}';doc.head.append(style);
    }
    screen.presentation?.stop();
    screen.presentation=createPresentation(screen,doc);
    if(screen.project.hideInThumbnail&&!doc.getElementById('lumina-preview-adapter')){
      const style=doc.createElement('style');style.id='lumina-preview-adapter';
      style.textContent=`html[data-lumina-thumbnail] ${screen.project.hideInThumbnail}{visibility:hidden!important;pointer-events:none!important}`;doc.head.append(style);
    }
    const booking=screen.project.bookingSelector&&doc.querySelector(screen.project.bookingSelector);
    if(booking&&!booking.dataset.luminaBooking){
      booking.dataset.luminaBooking='live-site';
      const note=doc.createElement('p');note.className='nm-hint';note.textContent='Това е преглед на сайта. За актуални свободни часове и записване отворете сайта на ВСИ.';
      booking.querySelector('h2')?.after(note);
      const submit=booking.querySelector('[type=submit]');if(submit)submit.textContent='Запази час в сайта на ВСИ';
      booking.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();screen.frame.contentWindow.open(liveUrlFor(screen),'_blank','noopener,noreferrer');},{capture:true});
    }
  }
  function createPresentation(screen,doc){
    if(screen.project.presentation!=='jtn-doors')return null;
    const hero=doc.querySelector('#home.hero'),wall=hero?.querySelector('.door-wall'),roof=hero?.querySelector('.door-roof');
    if(!hero||!wall||!roof)return null;
    let timers=[],animations=[],nodes=[],paused=false;
    if(!doc.getElementById('lumina-demo-style')){
      const style=doc.createElement('style');style.id='lumina-demo-style';
      style.textContent=`
        .lp-demo-curtain{position:absolute;top:0;bottom:0;width:50.5%;z-index:4;background:var(--ink);pointer-events:none}
        .lp-demo-curtain.l{left:0;border-right:6px solid var(--red)}
        .lp-demo-curtain.r{right:0;border-left:6px solid var(--red)}
        #home[data-lumina-side=wall]{--t:62%;--b:48%}
        #home[data-lumina-side=roof]{--t:52%;--b:38%}
        #home[data-lumina-side=wall] .door-wall .tlink .ic,#home[data-lumina-side=roof] .door-roof .tlink .ic{transform:translateX(4px)}
        .lp-demo-cursor{position:absolute;left:0;top:0;width:36px;height:44px;z-index:5;pointer-events:none;filter:drop-shadow(0 2px 3px #0007)}
      `;doc.head.append(style);
    }
    function stop(){
      timers.forEach(t=>clearTimeout(t.id));timers=[];animations.forEach(a=>a.cancel());animations=[];nodes.forEach(n=>n.remove());nodes=[];paused=false;hero.removeAttribute('data-lumina-side');
      screen.el.removeAttribute('data-demo');
    }
    function arm(task){task.at=performance.now();task.id=setTimeout(()=>{timers=timers.filter(t=>t!==task);task.fn();},task.remaining);}
    function after(ms,fn){const task={remaining:ms,fn};timers.push(task);arm(task);}
    function pause(){if(paused)return;paused=true;timers.forEach(t=>{clearTimeout(t.id);t.remaining=Math.max(0,t.remaining-(performance.now()-t.at));});animations.forEach(a=>{if(a.playState==='running')a.pause();});}
    function resume(){if(!paused)return;paused=false;timers.forEach(arm);animations.forEach(a=>{if(a.playState==='paused')a.play();});}
    function run({cursor=true}={}){
      stop();if(!motion()||document.hidden)return;
      screen.el.dataset.demo='curtain';
      ['l','r'].forEach(side=>{
        const panel=doc.createElement('div');panel.className='lp-demo-curtain '+side;panel.setAttribute('aria-hidden','true');hero.append(panel);nodes.push(panel);
        animations.push(panel.animate([{transform:'none'},{transform:`translateX(${side==='l'?'-':''}101%)`}],{duration:1100,delay:350,easing:'cubic-bezier(.77,0,.18,1)',fill:'both'}));
        after(1500,()=>panel.remove());
      });
      if(!cursor){after(1500,()=>screen.el.removeAttribute('data-demo'));return;}
      const pointer=doc.createElement('span');pointer.className='lp-demo-cursor';pointer.setAttribute('aria-hidden','true');
      pointer.innerHTML='<svg viewBox="0 0 28 36" aria-hidden="true"><path d="M3 2v26l7-7 6 12 5-3-6-11h11Z" fill="white" stroke="#15202b" stroke-width="1.5" stroke-linejoin="round"/></svg>';
      const heroRect=hero.getBoundingClientRect();
      const point=el=>{const r=el.getBoundingClientRect();return{x:r.left-heroRect.left+r.width*.5,y:r.top-heroRect.top+Math.min(50,r.height*.45)};};
      const left=point(wall),right=point(roof),start={x:heroRect.width*.52,y:Math.max(40,left.y-100)};
      const transform=p=>`translate(${p.x}px,${p.y}px)`;
      after(1600,()=>{
        if(dialog.open||screen.project.id!==active)return;
        hero.append(pointer);nodes.push(pointer);screen.el.dataset.demo='wall';
        animations.push(pointer.animate([{transform:transform(start),opacity:0},{transform:transform(left),opacity:1}],{duration:350,easing:EASE,fill:'forwards'}));
      });
      after(1950,()=>hero.dataset.luminaSide='wall');
      after(2800,()=>{
        screen.el.dataset.demo='roof';
        animations.push(pointer.animate([{transform:transform(left)},{transform:transform(right)}],{duration:500,easing:EASE,fill:'forwards'}));
      });
      after(3300,()=>hero.dataset.luminaSide='roof');
      after(4550,()=>{
        hero.removeAttribute('data-lumina-side');
        animations.push(pointer.animate({opacity:[1,0]},{duration:200,fill:'forwards'}));
      });
      after(4800,stop);
    }
    ['pointermove','pointerdown','keydown','wheel'].forEach(type=>doc.addEventListener(type,()=>{if(dialog.open&&state.screen===screen)stop();},{passive:true,signal:screen.inside.signal}));
    return {run,stop,pause,resume};
  }
  function attachEscape(screen, doc) {
    screen.inside?.abort();screen.inside=new AbortController();
    doc.addEventListener('keydown',e=>{
      if(e.key!=='Escape'||!dialog.open||state.screen!==screen)return;
      const owns=doc.querySelector('dialog[open]') || [...doc.querySelectorAll('[role="dialog"][aria-modal="true"]')].some(el=>!el.hidden&&el.getClientRects().length>0) || [...doc.querySelectorAll('[aria-expanded="true"][aria-controls]')].some(b=>doc.getElementById(b.getAttribute('aria-controls'))?.matches('nav,[role="menu"],[role="dialog"]'));
      if(!owns){e.preventDefault();e.stopPropagation();close();}
    },{capture:true,signal:screen.inside.signal});
  }
  async function reveal(screen, version) {
    const doc=screen.frame.contentDocument;
    if(!doc||doc.URL==='about:blank'||(screen.project.readySelector&&!doc.querySelector(screen.project.readySelector)))throw new Error('Unexpected site document.');
    const images=[...doc.images].filter(img=>img.loading!=='lazy'&&img.getBoundingClientRect().top<screen.view.height);
    // Never hold the live page behind its screenshot until animations finish.
    // Hidden browsing contexts may defer lazy images and remote fonts. Those
    // resources must not hold an otherwise usable preview or stop rotation.
    let assetTimer;
    await Promise.race([Promise.all([doc.fonts?.ready,...images.map(img=>img.decode().catch(()=>{}))]),new Promise(resolve=>{assetTimer=setTimeout(resolve,1500);})]);
    clearTimeout(assetTimer);
    if(version!==screen.version)return;
    const restoreSaved=(rotation.keepView&&screen.project.id===active)||(dialog.open&&state.screen===screen)||screen.view.preserveViewOnClose,savedScroll=screen.scroll;
    clearTimeout(screen.timer);clearInterval(screen.poll);
    screen.ready=true;screen.failed=false;screen.el.classList.add('is-live');
    screen.el.dataset.readyAt=Math.round(performance.now());
    attachEscape(screen,doc);prepareDocument(screen,doc);deviceFor(screen)?.box.classList.add('is-live');
    if(state.screen===screen)updateStatus();
    scheduleRotation();
    if(restoreSaved){
      // A hidden iframe has no scrollable layout. Place it before restoring.
      if(dialog.open)layoutViewer();else layoutThumbnails();
      screen.scroll=savedScroll;
      restoreScroll(screen);
      requestAnimationFrame(()=>{if(version===screen.version&&!rotation.started)restoreScroll(screen);});
    }
    if(dialog.open&&state.screen===screen)screen.presentation?.run({cursor:false});
  }
  function loadScreen(screen) {
    const version=++screen.version;
    clearInterval(screen.poll);clearTimeout(screen.timer);screen.presentation?.stop();screen.inside?.abort();screen.frame?.remove();
    screen.ready=false;screen.failed=false;screen.el.classList.remove('is-live');
    const frame=document.createElement('iframe');screen.frame=frame;
    frame.title=`${screen.project.name} — ${LABELS[screen.mode]}`;frame.allow='clipboard-write';
    frame.width=screen.view.width;frame.height=screen.view.height;
    Object.assign(frame.style,{width:screen.view.width+'px',height:screen.view.height+'px'});
    const interactive=dialog.open&&state.screen===screen;
    frame.tabIndex=interactive?0:-1;frame.inert=!interactive;frame.setAttribute('aria-hidden',String(!interactive));
    frame.style.colorScheme=screen.project.colorScheme||'dark';
    let checking=false;
    const fail=()=>{if(version!==screen.version)return;clearInterval(screen.poll);screen.failed=true;if(state.screen===screen)updateStatus();scheduleRotation();};
    const check=()=>{
      if(checking||version!==screen.version)return;
      try{
        const doc=frame.contentDocument;
        if(!doc||doc.URL==='about:blank'||doc.readyState==='loading')return;
        checking=true;reveal(screen,version).catch(fail);
      }catch{fail();}
    };
    frame.addEventListener('load',()=>{screen.resettingHome=false;screen.el.dataset.loads=String(Number(screen.el.dataset.loads||0)+1);checking=false;check();});
    frame.addEventListener('error',fail);
    const url=new URL(screen.project.url,document.baseURI);
    url.searchParams.set('lumina-revision',url.pathname.includes('/razor/')?'razor-smooth-10':'launch-3');
    if(screen.project.smoothTour&&!interactive)url.searchParams.set('lumina-thumbnail','1');
    if(screen.project.previewParam)url.searchParams.set(screen.project.previewParam,'1');
    frame.src=url.href;screen.display.append(frame);
    screen.poll=setInterval(check,30);screen.timer=setTimeout(fail,15000);
  }
  function getScreen(project,mode) {
    const key=project.id+'/'+mode;
    if(screens.has(key))return screens.get(key);
    const el=document.createElement('div');el.className='lp-surface';el.dataset.project=project.id;el.dataset.mode=mode;el.hidden=true;
    el.style.setProperty('--lp-site-bg',project.background||'#fff');
    el.style.setProperty('--lp-site-ink',project.ink||'#fff');
    const view=project.modes[mode],hardware=HARDWARE[mode];
    const size={width:view.width+hardware.bezel*2,height:view.height+hardware.bezel*2+hardware.top+hardware.bottom+hardware.chin+hardware.stand};
    const shell=document.createElement('div');shell.className='lp-hardware';
    Object.entries({width:size.width,height:size.height-hardware.stand,bezel:hardware.bezel,top:hardware.top,bottom:hardware.bottom,radius:hardware.radius,screenWidth:view.width,screenHeight:view.height+hardware.top+hardware.bottom}).forEach(([k,v])=>shell.style.setProperty('--device-'+k,v+'px'));
    shell.innerHTML=`<div class="lp-glass"><div class="lp-status" aria-hidden="true"><span>9:41</span>${signals}</div><div class="lp-display"></div><span class="lp-island" aria-hidden="true"></span><button class="lp-home" type="button" aria-label="Затвори прегледа"><span></span></button></div><span class="lp-camera" aria-hidden="true"></span><span class="lp-side lp-side--left" aria-hidden="true"></span><span class="lp-side lp-side--right" aria-hidden="true"></span><span class="lp-stand" aria-hidden="true"></span>`;
    const display=shell.querySelector('.lp-display');
    Object.assign(display.style,{width:view.width+'px',height:view.height+'px'});
    const poster=document.createElement('img');poster.className='lp-poster';poster.src=view.poster;poster.alt='';display.append(poster);el.append(shell);dialog.append(el);
    shell.querySelector('.lp-home').addEventListener('click',close);
    const screen={el,shell,display,poster,project,mode,view,size,frame:null,version:0,ready:false,failed:false,timer:0,poll:0,inside:null,scroll:{x:0,y:0}};
    screens.set(key,screen);return screen;
  }
  function releaseScreen(screen) {
    if(!screen.frame)return;
    rememberScroll(screen);++screen.version;
    clearInterval(screen.poll);clearTimeout(screen.timer);
    screen.presentation?.stop();screen.presentation=null;screen.inside?.abort();
    screen.frame.remove();screen.frame=null;screen.ready=false;screen.failed=false;screen.resettingHome=false;
    screen.el.classList.remove('is-live');
  }
  function syncScreens() {
    const show=dialog.open||(!document.hidden&&!rotation.holds.has('offscreen')&&!rotation.holds.has('viewer-return'));
    const wanted=new Set();
    if(show){
      const modes=dialog.open?[state.mode]:MODES;
      modes.forEach(mode=>wanted.add(getScreen(registry.get(active),mode)));
    }
    const changed=[...screens.values()].some(s=>!!s.frame!==wanted.has(s));
    if(changed&&!dialog.open){
      // Keep the tour's position while its frames are released or re-created.
      if(rotation.started){rotation.keepView=true;rotation.resuming=true;}
      stopTour();rotation.started=false;
    }
    // Release first, then load: switching never temporarily doubles memory.
    screens.forEach(s=>{if(!wanted.has(s))releaseScreen(s);});
    if(compactPreview()){
      // Decode one document at a time to avoid three simultaneous GPU/image allocations.
      const waiting=[...wanted].some(s=>s.frame&&!s.ready&&!s.failed);
      if(!waiting){const next=[...wanted].find(s=>!s.frame);if(next)loadScreen(next);}
    }else wanted.forEach(s=>{if(!s.frame)loadScreen(s);});
    devices.forEach(d=>d.box.classList.toggle('is-live',!!screens.get(active+'/'+d.mode)?.ready));
  }
  function place(screen, box, clip='none') {
    screen.el.classList.remove('is-scene-screen');screen.el.dataset.anchor='home';
    if(screen.foreground)screen.foreground.hidden=true;
    const origin=rect(dialog), scale=box.width/screen.size.width;
    Object.assign(screen.el.style,{left:box.left-origin.left+'px',top:box.top-origin.top+'px',width:box.width+'px',height:screen.size.height*scale+'px',clipPath:clip});
    screen.shell.style.transform=`scale(${scale})`;
  }
  function placeThumbnail(screen) {
    rememberScroll(screen);
    const device=deviceFor(screen);
    if(!device){screen.el.hidden=true;return;}
    const box=rect(device.box),boundary=rect(device.box.closest('.landing-art,.scene-art'));
    const inset=[Math.max(0,boundary.top-box.top),Math.max(0,box.right-boundary.right),Math.max(0,box.bottom-boundary.bottom),Math.max(0,boundary.left-box.left)];
    place(screen,box,`inset(${inset.map(n=>n+'px').join(' ')})`);
    if(device.scene){
      const scale=device.scene.clientWidth/1672;
      screen.el.classList.add('is-scene-screen');screen.el.dataset.anchor='projects';
      screen.el.style.height=523*scale+'px';
      screen.shell.style.transform=sceneTransform(screen.view,scale);
      if(!screen.foreground){screen.foreground=sceneForeground();screen.el.append(screen.foreground);}
      placeForeground(screen.foreground,scale);screen.foreground.hidden=false;
    }
    screen.el.hidden=false;
  }
  // Map the real desktop viewport onto the photographed screen's four corners.
  // The small perspective correction changes presentation only, never iframe size.
  function sceneTransform(view,scale){
    const perspective=-26/523;
    return `matrix3d(${849*(1+perspective)*scale/view.width},${-17*scale/view.width},0,${perspective/view.width},0,${497*scale/view.height},0,0,0,0,1,0,0,${17*scale},0,1)`;
  }
  function sceneForeground(){
    const img=document.createElement('img');img.className='lp-scene-foreground';img.src='assets/images/projects-sphere.png';img.alt='';img.setAttribute('aria-hidden','true');return img;
  }
  function placeForeground(img,scale){
    Object.assign(img.style,{left:-745*scale+'px',top:-194*scale+'px',width:1672*scale+'px',height:941*scale+'px'});
  }
  function layoutThumbnails() {
    devices.forEach(d=>{
      if(d.scene){
        const selected=d.scene.closest('section').querySelector('[role=tab][aria-selected=true]');
        d.box.hidden=!!selected&&selected.textContent.trim()!==registry.get(active).name;
        const scale=d.scene.clientWidth/1672;
        if(d.miniature)d.miniature.style.transform=sceneTransform(registry.get(active).modes.desktop,scale);
        if(d.foreground)placeForeground(d.foreground,scale);
      }else if(d.miniature){const screen=getScreen(registry.get(active),d.mode);d.miniature.style.transform=`scale(${d.box.clientWidth/screen.size.width})`;}
    });
    if(!dialog.open)screens.forEach(placeThumbnail);
  }
  function createDevice(mode,scene,photographic=false) {
    const box=document.createElement('div');box.className=`lp-device lp-device--${mode}${photographic?' lp-device--scene':''}`;box.dataset.mode=mode;
    const poster=document.createElement('img');poster.alt='';poster.draggable=false;
    const button=document.createElement('button');button.type='button';button.setAttribute('aria-haspopup','dialog');
    box.append(poster,button);scene.append(box);devices.push({box,poster,button,mode,scene:photographic?scene:null});
    button.addEventListener('click',()=>open(active,mode,button));new ResizeObserver(queueLayout).observe(box);
  }
  const projectScene=document.querySelector('[data-main-page] #projects .scene-canvas');
  if(projectScene){
    projectScene.closest('.scene-art').removeAttribute('aria-hidden');
    createDevice('desktop',projectScene,true);
    MODES.forEach(mode=>{createDevice(mode,projectScene);devices[devices.length-1].box.classList.add('lp-mobile-project-device');});
    new MutationObserver(queueLayout).observe(projectScene.closest('section'),{subtree:true,attributes:true,attributeFilter:['aria-selected']});
  }
  const scene=document.querySelector('.landing .scene');
  if(scene){
    ['.scene-wordmark','.scene-nav','.scene-monitor-title','.scene-link','.scene-tablet-title','.scene-phone-mark','.scene-phone-title','.scene-menu'].forEach(selector=>scene.querySelectorAll(selector).forEach(el=>el.remove()));
    scene.querySelectorAll('.scene-label').forEach(el=>{
      const x=parseFloat(el.style.getPropertyValue('--x')),y=parseFloat(el.style.getPropertyValue('--y'));
      if((x>53&&x<77&&y>40&&y<65)||(x>44&&x<52&&y>60&&y<84))el.remove();
    });
    [...scene.children].forEach(el=>el.setAttribute('aria-hidden','true'));
    scene.closest('.landing-art').removeAttribute('aria-hidden');MODES.forEach(mode=>createDevice(mode,scene));
    heroButton=document.createElement('button');heroButton.type='button';heroButton.className='lp-hero-link';heroButton.setAttribute('aria-haspopup','dialog');heroButton.innerHTML=`<span></span>${arrow}`;
    document.querySelector('.landing-actions').after(heroButton);heroButton.addEventListener('click',()=>open(active,autoMode(),heroButton));
    const actions=document.createElement('div');actions.className='lp-showcase-actions';
    heroButton.before(actions);actions.append(heroButton,createRotationControls());
  }
  if(projectScene)document.querySelector('#projects .chapter-content').append(createRotationControls());
  document.querySelectorAll('.project-list li').forEach(li=>{
    const project=[...registry.values()].find(p=>p.name===li.querySelector('h3')?.textContent.trim());if(!project)return;
    const button=document.createElement('button');button.type='button';button.className='lp-project-link';button.setAttribute('aria-haspopup','dialog');
    const text=document.createElement('span');while(li.firstChild)text.append(li.firstChild);
    const hint=document.createElement('small');hint.textContent='Разгледай на живо';text.append(hint);button.append(text);button.insertAdjacentHTML('beforeend',arrow);li.append(button);
    button.addEventListener('click',()=>open(project.id,autoMode(),button));
  });
  function select(id,{automatic=false}={}) {
    const project=registry.get(id);if(!project)throw new Error(`Unknown project: ${id}`);
    if(dialog.open)return;
    const changed=active!==id;
    active=id;
    document.body.dataset.previewProject=id;
    devices.forEach(device=>{
      device.poster.src=project.modes[device.mode].poster;device.box.style.setProperty('--lp-site-bg',project.background||'#fff');
      device.box.style.setProperty('--lp-site-ink',project.ink||'#fff');
      device.button.setAttribute('aria-label',device.scene?`${project.name} — отвори сайта от екрана`:`${project.name} — ${LABELS[device.mode]}, отвори преглед`);
      const screen=getScreen(project,device.mode);
      device.box.style.aspectRatio=device.scene?'849/523':screen.size.width+'/'+screen.size.height;
      device.box.querySelector('.lp-miniature')?.remove();
      device.foreground?.remove();
      const rest=document.createElement('div');rest.className='lp-miniature';rest.dataset.mode=device.mode;rest.setAttribute('aria-hidden','true');rest.inert=true;
      const shell=device.scene?document.createElement('div'):screen.shell.cloneNode(true);shell.querySelectorAll('iframe').forEach(f=>f.remove());
      if(device.scene){
        shell.className='lp-scene-plane';Object.assign(shell.style,{width:screen.view.width+'px',height:screen.view.height+'px'});shell.append(screen.poster.cloneNode(true));
        device.foreground=sceneForeground();device.box.append(device.foreground);
      }
      shell.style.transform='none';rest.append(shell);device.box.prepend(rest);device.miniature=shell;
      device.box.classList.toggle('is-live',screen.ready);
    });
    if(heroButton){heroButton.querySelector('span').textContent='Натиснете екран за преглед';heroButton.setAttribute('aria-label',`${project.name} — отвори преглед`);}
    if(changed||rotation.project===null){restartTour();MODES.forEach(mode=>{const s=getScreen(project,mode);if(s.ready)resetPreview(s,true);});}
    layoutThumbnails();dispatchEvent(new CustomEvent('lumina:projectchange',{detail:{id,automatic}}));
    if(changed&&motion())MODES.forEach(mode=>{const s=getScreen(project,mode);if(!s.el.hidden)s.el.animate({opacity:[.35,1]},{duration:220});});
    scheduleRotation();
  }
  function createRotationControls(){
    const group=document.createElement('div');group.className='lp-rotation-controls';group.setAttribute('role','group');group.setAttribute('aria-label','Смяна на проектите');
    group.innerHTML='<button type="button" data-step="-1" aria-label="Предишен проект"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 5-5 5 5 5"/></svg></button><span class="lp-project-position" aria-live="off"></span><button type="button" class="lp-rotation-toggle"></button><button type="button" data-step="1" aria-label="Следващ проект"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5"/></svg></button>';
    group.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>advance(Number(b.dataset.step))));
    group.querySelector('.lp-rotation-toggle').addEventListener('click',()=>{rotation.paused=!rotation.paused;scheduleRotation();});
    rotation.controls.push(group);return group;
  }
  function holdRotation(reason,held){held?rotation.holds.add(reason):rotation.holds.delete(reason);scheduleRotation();}
  function stopTour(){
    cancelAnimationFrame(rotation.frame);rotation.frame=0;rotation.last=0;rotation.painted=0;
    screens.forEach(s=>s.presentation?.pause());
  }
  function restartTour({keepView=false}={}){
    stopTour();screens.forEach(s=>s.presentation?.stop());
    rotation.project=active;rotation.elapsed=0;rotation.started=false;rotation.keepView=keepView;rotation.resuming=false;
    document.body.dataset.previewTour='loading';
  }
  function canTour(){return registry.size>1&&!rotation.paused&&!rotation.holds.size&&!dialog.open&&!document.hidden;}
  function beginTour(){
    const current=MODES.map(mode=>getScreen(registry.get(active),mode));
    if(current.some(s=>!s.frame))return false;
    if(!current.every(s=>(s.ready||s.failed)&&!s.resettingHome))return false;
    if(!rotation.keepView)current.forEach(s=>resetPreview(s,true));
    if(current.some(s=>s.resettingHome))return false;
    current.forEach(s=>{
      try{
        const win=s.frame.contentWindow;if(!rotation.resuming)s.tourStart=win.scrollY;
        // Decode the rest of this page during its opening hold, before the tour
        // reaches it. Inactive projects retain their own lazy-loading behavior.
        if(!compactPreview())win.document.querySelectorAll('img[loading=lazy]').forEach(img=>{img.loading='eager';});
      }catch{s.tourStart=0;}
      if(!rotation.keepView)s.presentation?.run();
    });
    rotation.started=true;rotation.resuming=false;return true;
  }
  function tourFrame(now){
    rotation.frame=0;
    if(!canTour()){stopTour();return;}
    if(!rotation.started&&!beginTour()){document.body.dataset.previewTour='loading';return;}
    if(rotation.last)rotation.elapsed+=now-rotation.last;
    rotation.last=now;
    // Razor's long page needs smaller scroll steps. Its lightweight thumbnail
    // assets allow 60fps; retain the existing 30fps limit for other mobile tours.
    const minFrame=registry.get(active).smoothTour?16:compactPreview()?32:0;
    if(rotation.painted&&now-rotation.painted<minFrame){rotation.frame=requestAnimationFrame(tourFrame);return;}
    rotation.painted=now;
    const hold=registry.get(active).presentation==='jtn-doors'?4800:1800;
    const progress=Math.max(0,Math.min(1,(rotation.elapsed-hold)/(rotation.interval-hold-1000)));
    // A short acceleration/deceleration around an otherwise steady pan.
    const ramp=.06,p=progress<ramp?progress*progress/(2*ramp*(1-ramp)):progress>1-ramp?1-(1-progress)**2/(2*ramp*(1-ramp)):(progress-ramp/2)/(1-ramp);
    const phase=rotation.elapsed<hold?'intro':progress<1?'scrolling':'footer';
    if(document.body.dataset.previewTour!==phase)document.body.dataset.previewTour=phase;
    const scrolls=[];
    screens.forEach(s=>{
      if(s.project.id!==active||!s.ready)return;
      try{
        const win=s.frame.contentWindow,root=win.document.scrollingElement;
        const end=Math.max(0,root.scrollHeight-win.innerHeight),start=Math.min(s.tourStart||0,end);
        scrolls.push({win,top:start+(end-start)*p});
      }catch{}
    });
    // Finish layout reads in every document before moving any viewport.
    scrolls.forEach(({win,top})=>win.scrollTo({left:0,top,behavior:'instant'}));
    if(rotation.elapsed>=rotation.interval){advance(1,true);return;}
    rotation.frame=requestAnimationFrame(tourFrame);
  }
  function scheduleRotation(){
    const ids=[...registry.keys()],index=ids.indexOf(active);
    rotation.controls.forEach(group=>{
      group.hidden=ids.length<2;group.querySelector('.lp-project-position').textContent=`${index+1} / ${ids.length}`;
      const toggle=group.querySelector('.lp-rotation-toggle');toggle.setAttribute('aria-pressed',String(rotation.paused));toggle.setAttribute('aria-label',rotation.paused?'Пусни автоматичната смяна':'Спри автоматичната смяна');toggle.title=rotation.paused?'Пусни 15-секундния преглед':'Спри 15-секундния преглед';
      if(toggle.dataset.paused!==String(rotation.paused)){
        toggle.dataset.paused=String(rotation.paused);
        toggle.innerHTML=rotation.paused?'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 9 6-9 6Z"/></svg>':'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4v12M13 4v12"/></svg>';
      }
    });
    syncScreens();
    const running=canTour();
    document.body.dataset.previewRotation=running?'running':'paused';
    if(!running){stopTour();return;}
    screens.forEach(s=>{if(s.project.id===active)s.presentation?.resume();});
    if(!rotation.frame)rotation.frame=requestAnimationFrame(tourFrame);
  }
  function advance(step=1,automatic=false){
    if(dialog.open)return;
    const ids=[...registry.keys()],id=ids[(ids.indexOf(active)+step+ids.length)%ids.length],project=registry.get(id);
    rotation.holds.delete('project-tab');select(id,{automatic});
  }
  function layoutViewer() {
    V.stage.dataset.mode=state.mode;
    const view=state.screen.size,narrow=innerWidth<=650,W=V.stage.clientWidth,H=V.stage.clientHeight;
    const inset=narrow?8:12,top=narrow?68:78,bottom=state.project.liveUrl?48:inset;
    const scale=Math.min(1,(W-inset*2)/view.width,(H-top-bottom)/view.height);
    const width=view.width*scale,height=view.height*scale;
    Object.assign(V.port.style,{left:(W-width)/2+'px',top:top+(H-top-bottom-height)/2+'px',width:width+'px',height:height+'px'});
    V.segment.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));
    const selected=V.segment.querySelector('[aria-pressed=true]');V.thumb.style.width=selected.offsetWidth+'px';V.thumb.style.transform=`translateX(${selected.offsetLeft}px)`;
    screens.forEach(s=>{
      const selected=s===state.screen;s.el.hidden=!selected;s.el.classList.toggle('is-selected',selected);
      if(s.frame){s.frame.inert=!selected;s.frame.tabIndex=selected?0:-1;s.frame.setAttribute('aria-hidden',String(!selected));}
      setThumbnail(s,!selected);
    });
    place(state.screen,rect(V.port));updateStatus();
  }
  function cancelAnimations() {
    [V.toolbar,V.backdrop,V.port,...[...screens.values()].map(s=>s.el)].forEach(el=>el.getAnimations().forEach(a=>a.cancel()));
  }
  function animateFrom(screen,from,to,duration) {
    const scale=from.width/to.width;
    return screen.el.animate([
      {transformOrigin:'0 0',transform:`translate(${from.left-to.left}px,${from.top-to.top}px) scale(${scale})`},
      {transformOrigin:'0 0',transform:'none'}
    ],{duration,easing:EASE});
  }
  function rememberScroll(screen) {
    // display:none browsing contexts report zero, not their last real position.
    if(!screen.ready||!screen.frame?.getClientRects().length)return;
    try{const win=screen.frame.contentWindow;screen.scroll={x:win.scrollX,y:win.scrollY};}catch{}
  }
  function restoreScroll(screen) {
    try{const win=screen.frame.contentWindow;if(win.scrollX!==screen.scroll.x||win.scrollY!==screen.scroll.y)win.scrollTo({left:screen.scroll.x,top:screen.scroll.y,behavior:'instant'});}catch{}
  }
  function resetPreview(screen,forceTop=false) {
    // Preserve a captured view unless a fresh project tour explicitly resets it.
    // Restore the captured position after native dialog focus restoration.
    if(screen.view.preserveViewOnClose&&!forceTop){restoreScroll(screen);return;}
    screen.scroll={x:0,y:0};
    try {
      const win=screen.frame.contentWindow;
      const home=new URL(screen.project.url,document.baseURI);
      if(win.location.pathname!==home.pathname){if(!screen.resettingHome){screen.resettingHome=true;if(screen.project.previewParam)home.searchParams.set(screen.project.previewParam,'1');win.location.replace(home.href);}return;}
      win.dispatchEvent(new win.CustomEvent('lumina:reset'));
      if(screen.project.resetSelector){
        const doc=win.document,filtered=doc.querySelector('input[type=search]')?.value||doc.querySelector('[data-filter][aria-pressed=true]:not([data-filter=all])');
        if(filtered)doc.querySelector(screen.project.resetSelector)?.click();
      }
      const menu=win.document.querySelector('.menu[aria-expanded=true],.burger[aria-expanded=true],.nav-toggle[aria-expanded=true]');if(menu)menu.click();
      const lightbox=win.document.querySelector('.lb:not([hidden]) #lb-close');if(lightbox)lightbox.click();
      win.scrollTo({left:0,top:0,behavior:'instant'});
      // Clearing a hash is optional; it must never prevent the scroll reset.
      try{win.history.replaceState(null,'',win.location.pathname+win.location.search);}catch{}
    } catch {}
  }
  function open(id=active,mode=autoMode(),opener=document.activeElement) {
    if(dialog.open||!registry.has(id))return;
    clearTimeout(returnTimer);rotation.holds.delete('viewer-return');
    if(id!==active)select(id);
    stopTour();document.body.dataset.previewRotation='paused';
    state.project=registry.get(id);state.mode=MODES.includes(mode)?mode:autoMode();state.screen=getScreen(state.project,state.mode);state.opener=opener;state.closing=false;++state.seq;
    state.source=devices.find(d=>d.button===opener)||deviceFor(state.screen);
    const source=state.source,from=source?rect(source.box):null;
    cancelAnimations();screens.forEach(s=>{s.presentation?.stop();rememberScroll(s);});
    state.saved={overflow:document.documentElement.style.overflow,x:scrollX,y:scrollY,hash:location.hash};
    document.documentElement.style.overflow='hidden';
    dialog.querySelector('#lp-title').textContent=state.project.name+' — преглед на сайта';
    dialog.inert=false;dialog.removeAttribute('aria-hidden');dialog.showModal();syncScreens();layoutViewer();V.close.focus({preventScroll:true});screens.forEach(restoreScroll);
    state.screen.presentation?.run({cursor:false});
    if(!compactPreview()&&motion()&&visible(from))animateFrom(state.screen,from,rect(state.screen.el),600);
    else state.screen.el.animate({opacity:[0,1]},{duration:150});
    V.backdrop.animate({opacity:[0,1]},{duration:motion()?420:150});
    V.toolbar.animate({opacity:[0,1],transform:motion()?['translateY(-6px)','none']:['none','none']},{duration:220,easing:EASE});
  }
  function cleanup() {
    if(dialog.open||!state.project)return;
    const compact=compactPreview();
    if(compact)rotation.holds.add('viewer-return');
    ++state.seq;cancelAnimations();screens.forEach(s=>s.presentation?.stop());
    document.documentElement.style.overflow=state.saved.overflow;
    const saved=state.saved,returnPosition={left:saved.x,top:saved.y};
    window.scrollTo({...returnPosition,behavior:'instant'});
    dialog.inert=true;dialog.setAttribute('aria-hidden','true');
    screens.forEach(s=>{s.el.classList.remove('is-selected');if(s.frame){s.frame.inert=true;s.frame.tabIndex=-1;s.frame.setAttribute('aria-hidden','true');}setThumbnail(s,true);});
    const opener=state.opener;state.project=null;state.screen=null;state.source=null;state.opener=null;state.closing=false;
    rotation.focusBypass=opener;
    opener?.focus({preventScroll:true});
    rotation.holds.delete('focus');rotation.holds.delete('project-tab');
    const closedVersion=state.seq;
    const resetLanding=()=>{
      if(dialog.open||state.seq!==closedVersion)return;
      screens.forEach(restoreScroll);window.scrollTo({...returnPosition,behavior:'instant'});layoutThumbnails();
    };
    history.replaceState(history.state,'',location.pathname+location.search+saved.hash);
    if(compact){
      // Retire the expanded iframe before re-creating the three small views.
      // Avoid overlapping live iframe scale animations and decoded page layers.
      restartTour({keepView:true});scheduleRotation();
      window.scrollTo({...returnPosition,behavior:'instant'});layoutThumbnails();
      clearTimeout(returnTimer);
      returnTimer=setTimeout(()=>{
        if(dialog.open||state.seq!==closedVersion)return;
        rotation.holds.delete('viewer-return');scheduleRotation();queueLayout();
      },250);
      return;
    }
    resetLanding();
    // Native dialog focus restoration and scroll anchoring finish after close.
    requestAnimationFrame(()=>{resetLanding();requestAnimationFrame(()=>{if(dialog.open||state.seq!==closedVersion)return;resetLanding();restartTour({keepView:true});scheduleRotation();});});
  }
  async function close() {
    if(!dialog.open||state.closing)return;
    state.closing=true;const seq=++state.seq,screen=state.screen,from=rect(screen.el);
    cancelAnimations();rememberScroll(screen);if(screen.frame)screen.frame.inert=true;
    const device=deviceFor(screen),target=device?rect(device.box):null;
    let animation;
    if(!compactPreview()&&motion()&&visible(target)){
      place(screen,target);animation=animateFrom(screen,from,target,380);
    }else animation=screen.el.animate({opacity:[1,0]},{duration:150,fill:'forwards'});
    V.toolbar.animate({opacity:[1,0]},{duration:150,fill:'forwards'});V.backdrop.animate({opacity:[1,0]},{duration:!compactPreview()&&motion()?380:150,fill:'forwards'});
    await Promise.race([animation.finished.catch(()=>{}),new Promise(r=>setTimeout(r,500))]);
    if(seq===state.seq){dialog.close();cleanup();}
  }
  function switchMode(mode) {
    if(!MODES.includes(mode)||mode===state.mode||!dialog.open||state.closing)return;
    const before=rect(state.screen.el);cancelAnimations();state.screen.presentation?.stop();rememberScroll(state.screen);
    state.mode=mode;state.screen=getScreen(state.project,mode);syncScreens();layoutViewer();restoreScroll(state.screen);
    state.screen.presentation?.run({cursor:false});
    if(motion()){
      const after=rect(state.screen.el),scale=Math.min(before.width/after.width,before.height/after.height);
      state.screen.el.animate([{opacity:.2,transform:`translate(${(before.width-after.width)/2}px,0) scale(${scale})`},{opacity:1,transform:'none'}],{duration:280,easing:EASE});
    }else state.screen.el.animate({opacity:[0,1]},{duration:120});
  }
  function queueLayout() {
    if(resizeQueued)return;resizeQueued=true;
    requestAnimationFrame(()=>{resizeQueued=false;if(dialog.open){if(!state.closing){cancelAnimations();layoutViewer();}}else layoutThumbnails();});
  }
  V.segment.addEventListener('click',e=>{const b=e.target.closest('button[data-mode]');if(b)switchMode(b.dataset.mode);});
  V.close.addEventListener('click',close);V.backdrop.addEventListener('click',close);
  V.failure.querySelector('button').addEventListener('click',()=>{if(!state.closing){loadScreen(state.screen);layoutViewer();}});
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',cleanup);
  addEventListener('resize',()=>{syncScreens();queueLayout();scheduleRotation();});addEventListener('scroll',()=>{if(!dialog.open)queueLayout();},{passive:true});addEventListener('load',queueLayout);document.fonts?.ready.then(queueLayout);
  // Content changes can move a device without resizing the device itself.
  const pageContent=document.querySelector('main');
  if(pageContent)new ResizeObserver(queueLayout).observe(pageContent);
  let parentScrollTimer;
  addEventListener('scroll',()=>{
    if(dialog.open||!compactPreview())return;
    if(!rotation.holds.has('parent-scroll'))holdRotation('parent-scroll',true);
    clearTimeout(parentScrollTimer);parentScrollTimer=setTimeout(()=>holdRotation('parent-scroll',false),180);
  },{passive:true});
  document.addEventListener('visibilitychange',scheduleRotation);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{if(e.matches){rotation.paused=true;scheduleRotation();}});
  const rotationRegions=[document.querySelector('.landing-art'),document.querySelector('#projects .scene-art')].filter(Boolean);
  const visibleRegions=new Set();rotation.holds.add('offscreen');
  const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{entry.isIntersecting?visibleRegions.add(entry.target):visibleRegions.delete(entry.target);});holdRotation('offscreen',!visibleRegions.size);},{threshold:.05});rotationRegions.forEach(region=>observer.observe(region));
  function updateFocusHold(){
    const el=document.activeElement;
    if(el!==rotation.focusBypass)rotation.focusBypass=null;
    holdRotation('focus',el!==rotation.focusBypass&&!!el?.matches(':focus-visible')&&!!el.closest('.landing,#projects')&&!el.closest('.lp-rotation-controls'));
  }
  document.addEventListener('focusin',updateFocusHold);
  document.addEventListener('focusout',()=>queueMicrotask(updateFocusHold));
  window.LuminaPreview=Object.freeze({register,select,open,close,setMode:switchMode,hold:holdRotation,next(){advance();},get active(){return active;},get projects(){return [...registry.keys()];}});
  select(active);
  // Other projects are loaded only when selected, never all twelve at startup.
})();
