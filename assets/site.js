/* Add verified business contacts here. Empty values never create dummy links. */
const LUMINA_CONTACT={email:'',phone:'',phoneLabel:''};
const menu=document.querySelector('.menu-toggle'),nav=document.querySelector('.navigation');
function closeMenu(focus=false){nav.classList.remove('is-open');menu.setAttribute('aria-expanded','false');if(focus)menu.focus();}
menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('is-open',open);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.getAttribute('aria-expanded')==='true')closeMenu(true);});
document.addEventListener('click',e=>{if(!e.target.closest('.site-header'))closeMenu();});
matchMedia('(max-width:700px)').addEventListener('change',()=>closeMenu());
function revealHash(){const id=decodeURIComponent(location.hash.slice(1));const node=document.getElementById(id);if(node?.matches('details'))node.open=true;}
document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{closeMenu();const node=document.getElementById(a.hash.slice(1));if(node?.matches('details'))node.open=true;}));
addEventListener('hashchange',revealHash);revealHash();
const contact=document.getElementById('contact-links'),items=[];
if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(LUMINA_CONTACT.email)){const a=document.createElement('a');a.href='mailto:'+LUMINA_CONTACT.email;a.textContent=LUMINA_CONTACT.email;items.push(a);}
if(/^\+?[\d ()-]{6,}$/.test(LUMINA_CONTACT.phone)){const a=document.createElement('a');a.href='tel:'+LUMINA_CONTACT.phone.replace(/[^\d+]/g,'');a.textContent=LUMINA_CONTACT.phoneLabel||LUMINA_CONTACT.phone;items.push(a);}
if(items.length)contact.replaceChildren(...items);
document.getElementById('year').textContent=new Date().getFullYear();
