(() => {
  'use strict';
  const variant=document.body.dataset.variant;
  if(!variant)return;
  const mainPage=document.body.hasAttribute('data-main-page');
  const benefitsSection=mainPage?'why':'growth';
  const variants=['objects','drawers','notebook','explorer'];
  const names=['Object notes','Sliding drawers','Open notebook','Interactive explorer'];
  const index=variants.indexOf(variant);
  const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
  const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
  const plus='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const element=(tag,cls,html='')=>{const el=document.createElement(tag);el.className=cls;el.innerHTML=html;return el;};
  const button=(text,cls,action)=>{const el=element('button',cls,text);el.type='button';if(action)el.addEventListener('click',action);return el;};
  const animate=el=>{
    if(!matchMedia('(prefers-reduced-motion:reduce)').matches)el.animate([{opacity:.25,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:260,easing:'cubic-bezier(.16,1,.3,1)'});
  };
  const services=all('.service').map(el=>({id:el.id,title:el.querySelector('h3').textContent,body:el.querySelector('.service-content').innerHTML,section:'services'}));
  const outcomes=all('.outcomes>div').map((el,i)=>({id:'outcome-'+i,title:el.querySelector('dt').textContent,body:'<p>'+esc(el.querySelector('dd').textContent)+'</p>',section:benefitsSection}));
  const care=all('.care-grid>li').map((el,i)=>({id:'care-'+i,title:el.querySelector('h3').textContent,body:'<p>'+esc(el.querySelector('p').textContent)+'</p>',section:'process'}));
  const industries=all('.industry-list>li').map((el,i)=>({id:'industry-'+i,title:el.firstChild.textContent.trim(),summary:el.querySelector('span').textContent,body:el.querySelector('.industry-content')?.innerHTML||'<p>'+esc(el.querySelector('span').textContent)+'</p>',section:'businesses'}));
  const projects=all('.project-list>li').map((el,i)=>{
    const title=el.querySelector('h3').textContent,preview=(window.LUMINA_PROJECTS||[]).find(p=>p.name===title);
    return {id:'project-'+i,title,body:el.querySelector('.project-content')?.innerHTML||'<p>'+esc(el.querySelector('p').textContent)+'</p>',section:'projects',live:!!preview,projectId:preview?.id,liveUrl:preview?.liveUrl};
  });
  let selectProjectTab;
  const headingText=el=>el.innerText.replace(/\s+/g,' ').trim();
  const contact={id:'contact-note',title:headingText($('#contact-title')),body:[...$('#contact .chapter-content').querySelectorAll('p')].map(p=>p.outerHTML).join(''),section:'contact'};
  const branding={id:'branding',title:'Брандинг',body:'<p>Дизайн с характер. Ясно съдържание.</p>'+outcomes[1].body,section:'services'};
  const books=[services[0],branding,services[5],{id:'growth-note',title:mainPage?'Защо сайт':'Растеж',body:outcomes.map(o=>'<h3>'+esc(o.title)+'</h3>'+o.body).join(''),section:benefitsSection}];
  const narrative=all('.chapter:not(#contact)').map(section=>({id:section.id+'-intro',title:headingText(section.querySelector('h2')),body:[...section.querySelectorAll('.chapter-content>.lead,.chapter-content>.body-copy')].map(p=>p.outerHTML).join(''),section:section.id}));
  narrative.unshift({id:'home-intro',title:headingText($('#hero-title')),body:$('.landing-description').outerHTML,section:'home'});
  const records=[...services,...outcomes,...care,...industries,...projects,contact,branding,...narrative];
  const textOnly=html=>{const e=document.createElement('div');e.innerHTML=html;return e.textContent;};
  const allCopy=records.map(r=>({...r,text:textOnly(r.body)}));
  if(!mainPage){
  const nav=element('nav','lv-switcher');nav.setAttribute('aria-label','Compare interaction versions');
  nav.innerHTML=`<a class="lv-compare" href="variations.html">Compare</a><span class="lv-version-name">${names[index]}</span><div>${variants.map((v,i)=>`<a href="version-${i+1}.html" data-version="${i+1}" aria-label="Version ${i+1}: ${names[i]}" ${i===index?'aria-current="page"':''}>${i+1}</a>`).join('')}</div>`;
  document.body.append(nav);
  const sectionObserver=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting)nav.querySelectorAll('[data-version]').forEach(a=>a.href=`version-${a.dataset.version}.html#${entry.target.id}`);}},{rootMargin:'-20% 0px -50% 0px'});
  all('main>section').forEach(s=>sectionObserver.observe(s));
  }

  const dialog=element('dialog','lv-dialog');dialog.setAttribute('aria-labelledby','lv-dialog-title');
  dialog.innerHTML=`<div class="lv-dialog-head"><span class="lv-dialog-context">LUMINA</span><button type="button" class="lv-dialog-close" aria-label="Затвори"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div><div class="lv-dialog-layout"><div class="lv-dialog-cover"><span class="lv-cover-mark">L</span><p>Един партньор.<br>Всичко онлайн.</p></div><div class="lv-dialog-page"><h2 id="lv-dialog-title"></h2><div class="lv-dialog-copy"></div><div class="lv-dialog-actions"></div></div></div>`;
  document.body.append(dialog);
  let opener,dialogRecord;
  const closeDialog=()=>{if(dialog.open){dialog.close();opener?.focus({preventScroll:true});}};
  dialog.querySelector('.lv-dialog-close').addEventListener('click',closeDialog);
  dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closeDialog();}});
  const liveAction=(r,host)=>{
    if(r.live)host.append(button('Разгледай сайта '+arrow,'lv-action',()=>{closeDialog();window.LuminaPreview.open(r.projectId);}));
    if(r.liveUrl){const link=element('a','lv-action lv-project-external','Отвори сайта '+arrow);link.href=r.liveUrl;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label',`Отвори ${r.title} в нов раздел`);host.append(link);}
  };
  function show(r,anchor,kind) {
    opener=anchor||document.activeElement;dialogRecord=r;
    const type=kind||({objects:'note',drawers:'drawer',notebook:'spread',explorer:'drawer'}[variant]);
    dialog.dataset.kind=type;dialog.style.removeProperty('left');dialog.style.removeProperty('top');
    dialog.querySelector('h2').textContent=r.title;
    dialog.querySelector('.lv-dialog-copy').innerHTML=r.body;
    const actions=dialog.querySelector('.lv-dialog-actions');actions.replaceChildren();
    liveAction(r,actions);
    if(!r.live&&r.section!=='contact')actions.append(button('Към раздела '+arrow,'lv-action',()=>{closeDialog();go(r,false);}));
    if(type==='spread'){
      const pos=records.findIndex(x=>x.id===r.id);
      if(pos>=0){const pager=element('div','lv-pager');pager.append(button('Предишна','lv-quiet',()=>show(records[(pos+records.length-1)%records.length],opener,'spread')),element('span','',`${pos+1} / ${records.length}`),button('Следваща','lv-quiet',()=>show(records[(pos+1)%records.length],opener,'spread')));actions.append(pager);}
    }
    if(type==='note'&&innerWidth>700&&anchor){const b=anchor.getBoundingClientRect();dialog.style.left=Math.max(18,Math.min(innerWidth-438,b.left-390))+'px';dialog.style.top=Math.max(18,Math.min(innerHeight-450,b.bottom+14))+'px';}
    if(!dialog.open)dialog.showModal();
    if(type==='note'&&innerWidth>700){dialog.style.top=Math.max(18,Math.min(parseFloat(dialog.style.top)||18,innerHeight-dialog.offsetHeight-18))+'px';}
    dialog.querySelector('.lv-dialog-page').scrollTop=0;animate(dialog.querySelector('.lv-dialog-layout'));
  }
  const controllers=new Map();
  function go(r,activate=true){
    if(activate)controllers.get(r.id)?.();
    const section=document.getElementById(r.section);
    section?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});
  }
  function topic(r,anchor){if(variant==='explorer')go(r);else show(r,anchor);}

  // Version 4 keeps photographed objects decorative. Its separate topic
  // links remain available below the introduction.
  if(variant!=='explorer')all('.scene-book').forEach((old,i)=>{
    const b=button(esc(old.textContent)+arrow,'scene-label sans scene-book lv-book',()=>topic(books[i],b));
    b.setAttribute('style',old.getAttribute('style'));b.setAttribute('aria-label',books[i].title+' — разгледай');old.replaceWith(b);
  });
  const shortcuts=element('div','lv-topic-links');shortcuts.setAttribute('aria-label','Разгледай темите');
  books.forEach(r=>{const b=button(esc(r.title)+arrow,'',()=>topic(r,b));shortcuts.append(b);});
  $('.landing-copy').append(shortcuts);
  const sentence=$('.landing-description');
  [['да бъде открит',0],['да вдъхва доверие',1],['да върви напред',2]].forEach(([phrase,i])=>{sentence.innerHTML=sentence.innerHTML.replace(phrase,`<button class="lv-word-link" data-outcome="${i}">${phrase}</button>`);});
  sentence.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>topic(outcomes[Number(b.dataset.outcome)],b)));
  if(variant!=='explorer')all('.prop-note').forEach((note,i)=>{
    const section=note.closest('section');const r=records.find(r=>r.section===section?.id);
    if(!r)return;note.removeAttribute('aria-hidden');const b=button(note.innerHTML,'lv-object-note',()=>topic(r,b));note.replaceChildren(b);
  });
  // Preserve paragraph wording while varying its reading surface.
  if(!mainPage)all('.chapter-content').forEach(content=>{
    const prose=[...content.children].filter(n=>n.matches('.lead,.body-copy'));
    const block=element('div','lv-prose');if(prose.length){prose[0].before(block);prose.forEach(p=>block.append(p));}
  });

  function accordion(data,kind='fold'){
    const host=element('div','lv-accordions lv-accordions--'+kind);
    data.forEach((r,i)=>{
      const d=element('details','lv-fold',`<summary><span>${esc(r.title)}</span>${plus}</summary><div class="lv-fold-content">${r.body}</div>`);d.id=r.id;
      d.addEventListener('toggle',()=>{if(d.open)animate(d.querySelector('.lv-fold-content'));});
      liveAction(r,d.querySelector('.lv-fold-content'));host.append(d);
      controllers.set(r.id,()=>{d.open=true;});
    });return host;
  }
  function noteRows(data,kind='note'){
    const host=element('div','lv-note-rows');
    data.forEach(r=>{const b=button(`<span>${esc(r.title)}</span>${arrow}`,'lv-note-row',()=>show(r,b,kind));b.id=r.id;host.append(b);controllers.set(r.id,()=>show(r,b,kind));});return host;
  }
  function tabs(data,kind='paper'){
    const host=element('div','lv-tabs lv-tabs--'+kind),bar=element('div','lv-tab-bar'),panel=element('div','lv-tab-panel');
    bar.setAttribute('role','tablist');bar.setAttribute('aria-label','Избери тема');
    panel.setAttribute('role','tabpanel');panel.tabIndex=0;
    const buttons=[];panel.id='panel-'+data[0].id;
    function select(i,focus=false,fromRotation=false){buttons.forEach((b,k)=>{b.setAttribute('aria-selected',String(i===k));b.tabIndex=i===k?0:-1;});panel.innerHTML=`<h3>${esc(data[i].title)}</h3>${data[i].body}`;panel.setAttribute('aria-labelledby',data[i].id);liveAction(data[i],panel);if(focus)buttons[i].focus();animate(panel);
      if(data===projects&&!fromRotation){window.LuminaPreview?.hold('project-tab',!data[i].projectId);if(data[i].projectId&&window.LuminaPreview?.active!==data[i].projectId)window.LuminaPreview?.select(data[i].projectId);}
    }
    data.forEach((r,i)=>{const b=button(esc(r.title),'lv-tab',()=>select(i));b.id=r.id;b.setAttribute('role','tab');b.setAttribute('aria-controls',panel.id);b.addEventListener('keydown',e=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?data.length-1:(i+(e.key==='ArrowRight'?1:data.length-1))%data.length;select(n,true);}});buttons.push(b);bar.append(b);controllers.set(r.id,()=>select(i));});
    host.append(bar,panel);select(0,false,true);
    if(data===projects)selectProjectTab=id=>{const i=data.findIndex(r=>r.projectId===id);if(i>=0)select(i,false,true);};
    return host;
  }
  function pager(data,kind='pages'){
    const host=element('div','lv-pages lv-pages--'+kind),panel=element('div','lv-page-content'),controls=element('div','lv-pager');let current=0;
    const previous=button('Назад','lv-quiet',()=>select(current-1)),next=button('Напред '+arrow,'lv-quiet',()=>select(current+1)),count=element('span','lv-page-count');
    const rail=element('div','lv-page-rail');
    const dots=data.map((r,i)=>{const b=button(`<span>${i+1}</span> ${esc(r.title)}`,'',()=>select(i));b.id=r.id;controllers.set(r.id,()=>select(i));rail.append(b);return b;});
    function select(n){current=Math.max(0,Math.min(data.length-1,n));const r=data[current];panel.innerHTML=`<h3>${esc(r.title)}</h3>${r.body}`;liveAction(r,panel);count.textContent=`${current+1} / ${data.length}`;previous.disabled=current===0;next.disabled=current===data.length-1;dots.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===current)));animate(panel);}
    controls.append(previous,count,next);host.append(rail,panel,controls);select(0);return host;
  }
  function inlineNotes(data){
    const host=element('div','lv-inline-notes');data.forEach(r=>{const row=element('div','lv-inline-note');const b=button(esc(r.title)+plus,'',()=>{const open=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(open));p.hidden=!open;if(open)animate(p);});b.id=r.id;b.setAttribute('aria-expanded','false');const p=element('div','lv-margin-copy',r.body);p.id='note-'+r.id;p.hidden=true;b.setAttribute('aria-controls',p.id);row.append(b,p);host.append(row);controllers.set(r.id,()=>{b.setAttribute('aria-expanded','true');p.hidden=false;});});return host;
  }
  function industryList(data){
    const host=element('ul','lv-industry-list');
    data.forEach(r=>{const item=element('li','lv-industry',`<h3>${esc(r.title)}</h3>${r.body}`);item.id=r.id;host.append(item);});
    return host;
  }
  function visibleCopy(data,kind){
    const host=element('div','lm-copy-list lm-copy-list--'+kind);
    data.forEach(r=>{const item=element('div','lm-copy-item',`<h3>${esc(r.title)}</h3>${r.body}`);item.id=r.id;host.append(item);});
    return host;
  }
  function businessExamples(data){
    const host=element('div','lm-business-list');
    const reducedMotion=matchMedia('(prefers-reduced-motion:reduce)');
    data.forEach(r=>{
      const item=element('details','lm-business',`<summary><span><strong>${esc(r.title)}</strong><span>${esc(r.summary)}</span></span>${plus}</summary><div class="lm-business-panel"><div class="lm-business-content">${r.body}</div></div>`);item.id=r.id;
      const summary=item.querySelector('summary'),panel=item.querySelector('.lm-business-panel'),content=panel.firstElementChild;
      let expanded=false,animation=null;
      const reflect=()=>{item.dataset.expanded=String(expanded);summary.setAttribute('aria-expanded',String(expanded));panel.inert=!expanded;};
      function settle(){
        animation?.cancel();animation=null;item.open=expanded;
        panel.style.removeProperty('height');panel.style.removeProperty('opacity');reflect();
      }
      function expand(next){
        if(next===expanded&&!animation&&item.open===next)return;
        // Measure the current frame before cancelling so rapid reversals do not
        // jump. Keep native details open until its closing movement finishes.
        const from=item.open?panel.getBoundingClientRect().height:0;
        const opacity=item.open?getComputedStyle(panel).opacity:'0';
        animation?.cancel();animation=null;expanded=next;reflect();
        if(reducedMotion.matches){settle();return;}
        panel.style.height=from+'px';panel.style.opacity=opacity;item.open=true;
        const to=expanded?content.getBoundingClientRect().height:0;
        const distance=Math.abs(to-from);
        if(distance<1){settle();return;}
        const current=panel.animate([{height:from+'px',opacity},{height:to+'px',opacity:expanded?1:0}],{
          duration:Math.min(expanded?400:300,180+distance*.8),easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'
        });
        animation=current;current.onfinish=()=>{if(animation===current)settle();};
      }
      summary.addEventListener('click',event=>{event.preventDefault();expand(!expanded);});
      item.addEventListener('toggle',()=>{if(!animation){expanded=item.open;reflect();}});
      // Content can reflow while a phone rotates or a font finishes loading.
      new ResizeObserver(()=>{if(animation)expand(expanded);}).observe(content);
      reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches&&animation)settle();});
      reflect();controllers.set(r.id,()=>expand(true));host.append(item);
    });return host;
  }
  function replace(selector,newNode){const old=$(selector);old.replaceWith(newNode);}
  const surfaces={
    objects:()=>{replace('.service-list',tabs(services,'paper'));replace('.outcomes',inlineNotes(outcomes));replace('.care-grid',accordion(care,'letters'));replace('.industry-list',noteRows(industries));replace('.project-list',noteRows(projects));},
    drawers:()=>{replace('.service-list',noteRows(services,'drawer'));replace('.outcomes',tabs(outcomes,'switch'));replace('.care-grid',pager(care,'rail'));replace('.industry-list',accordion(industries,'compact'));replace('.project-list',noteRows(projects,'drawer'));},
    notebook:()=>{replace('.service-list',pager(services,'book'));replace('.outcomes',tabs(outcomes,'margin'));replace('.care-grid',accordion(care,'timeline'));replace('.industry-list',inlineNotes(industries));replace('.project-list',accordion(projects,'folio'));},
    explorer:()=>{replace('.service-list',tabs(services,'chips'));replace('.outcomes',pager(outcomes,'compare'));replace('.care-grid',tabs(care,'steps'));replace('.industry-list',industryList(industries));replace('.project-list',tabs(projects,'spotlight'));}
  };
  if(mainPage){
    replace('.service-list',tabs(services,'chips'));
    replace('.outcomes',visibleCopy(outcomes,'benefits'));
    replace('.care-grid',visibleCopy(care,'care'));
    replace('.industry-list',businessExamples(industries));
    replace('.project-list',tabs(projects,'spotlight'));
  }else surfaces[variant]();
  addEventListener('lumina:projectchange',event=>selectProjectTab?.(event.detail.id));
  selectProjectTab?.(window.LuminaPreview?.active);
  if(variant==='explorer')controllers.set(branding.id,()=>show(branding,document.activeElement,'drawer'));
  const contactContent=$('#contact .chapter-content');
  if(!mainPage){
  const contactRest=[...contactContent.children].filter(n=>!n.matches('h2'));
  contactRest.forEach(n=>n.remove());
  if(variant==='objects'){
    const note=element('details','lv-contact-letter',`<summary>Имате идея. Имате бизнес. ${plus}</summary><div>${contact.body}</div>`);contactContent.append(note);
  }else if(variant==='drawers'||variant==='notebook'){
    contactContent.append(element('p','body-copy','Имате идея. Имате бизнес.'));
    const b=button('Нека направим следващата стъпка '+arrow,'lv-contact-open',()=>show(contact,b,variant==='drawers'?'sheet':'spread'));contactContent.append(b);
  }else{
    contactContent.append(element('div','lv-contact-copy',contact.body));
  }
  // The original startup script still owns verified contacts and the year.
  // Keep its target present even when contact information lives in a panel.
  if(!$('#contact-links')){const slot=element('div','');slot.id='contact-links';slot.hidden=true;contactContent.append(slot);}
  }

  if(variant==='explorer'){
    const search=button('Намери в сайта '+arrow,'lv-search-open',openSearch);$('.landing-copy').append(search);
    function openSearch(){
      show({title:'Какво търсите?',body:'',section:'search'},search,'search');
      const target=dialog.querySelector('.lv-dialog-copy'),label=element('label','lv-search-label','Търсене в услугите и информацията'),input=document.createElement('input');input.type='search';input.placeholder='Сайт, SEO, поддръжка…';label.append(input);
      const results=element('div','lv-search-results');target.append(label,results);dialog.querySelector('.lv-dialog-actions').replaceChildren();
      function render(){const q=input.value.trim().toLocaleLowerCase('bg');const found=allCopy.filter(r=>(r.title+' '+r.text).toLocaleLowerCase('bg').includes(q));results.replaceChildren();found.forEach(r=>results.append(button(`<strong>${esc(r.title)}</strong><span>${esc(r.text.slice(0,100))}${r.text.length>100?'…':''}</span>${arrow}`,'lv-search-result',()=>{closeDialog();go(r);})));if(!found.length)results.append(element('p','lv-empty','Няма резултати. Опитайте с „сайт“, „SEO“ или „поддръжка“.'));}
      input.addEventListener('input',render);render();input.focus();
    }
    document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!$('.lp-viewer[open]')){e.preventDefault();openSearch();}});
  }
  function followHash(){const id=decodeURIComponent(location.hash.slice(1));if(controllers.has(id))controllers.get(id)();}
  document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(a&&controllers.has(a.hash.slice(1))){e.preventDefault();const r=records.find(r=>r.id===a.hash.slice(1));if(r)go(r);}});
  addEventListener('hashchange',followHash);followHash();
  document.body.classList.add('lv-ready');
})();
