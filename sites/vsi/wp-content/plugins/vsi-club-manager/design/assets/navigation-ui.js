const menu = document.querySelector('.menu');
const navigation = document.querySelector('#navigation');
const mobileNav = window.matchMedia('(max-width: 1000px)');
function fitMenu() {
  if (!menu || !navigation || menu.getAttribute('aria-expanded') !== 'true') return;
  const viewportHeight = navigation.ownerDocument.documentElement.clientHeight;
  const available = viewportHeight - navigation.getBoundingClientRect().top - 12;
  navigation.style.maxHeight = Math.max(0, available) + 'px';
}
function setMenu(open, returnFocus = false) {
  if (!menu || !navigation) return;
  menu.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('open', open);
  document.body.classList.toggle('mobile-menu-open', open);
  if (open) fitMenu();
  else navigation.style.removeProperty('max-height');
  if (returnFocus) menu.focus();
}
menu?.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
navigation?.addEventListener('click', event => {
  if (event.target.closest('a')) setMenu(false);
});
document.addEventListener('pointerdown', event => {
  if (menu?.getAttribute('aria-expanded') === 'true' && !menu.contains(event.target) && !navigation.contains(event.target)) setMenu(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') setMenu(false, true);
});
document.addEventListener('focusin', event => {
  if (menu?.getAttribute('aria-expanded') === 'true' && !menu.contains(event.target) && !navigation.contains(event.target)) setMenu(false);
});
mobileNav.addEventListener('change', () => setMenu(false));
window.addEventListener('resize', fitMenu);
window.addEventListener('scroll', fitMenu, { passive: true });
