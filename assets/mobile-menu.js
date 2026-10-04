(() => {
  const trigger = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.site-header .navigation');
  if (!trigger || !navigation) return;

  const mobile = matchMedia('(max-width:900px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)');
  const dialog = document.createElement('dialog');
  dialog.id = 'mobile-menu';
  dialog.className = 'lm-menu';
  dialog.setAttribute('aria-label', 'Меню');
  dialog.innerHTML = `<div class="lm-menu-panel">
    <div class="lm-menu-header"><button class="lm-menu-close" type="button" aria-label="Затвори менюто"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
    <div class="lm-menu-contact"><a href="tel:+359877776563">+359 87 777 6563</a><a href="mailto:contact@lumina.com">contact@lumina.com</a></div>
  </div>`;

  const header = dialog.querySelector('.lm-menu-header');
  const closeButton = dialog.querySelector('.lm-menu-close');
  header.prepend(document.querySelector('.site-header > .logo').cloneNode(true));
  const links = navigation.cloneNode(true);
  links.id = 'mobile-navigation';
  links.className = 'lm-menu-links';
  header.after(links);
  document.body.append(dialog);
  trigger.setAttribute('aria-controls', dialog.id);
  trigger.setAttribute('aria-haspopup', 'dialog');

  function openMenu() {
    if (!mobile.matches || dialog.open) return;
    document.documentElement.classList.add('lm-menu-open');
    trigger.setAttribute('aria-expanded', 'true');
    dialog.showModal();
    closeButton.focus({preventScroll: true});
  }

  function closeMenu({hash = ''} = {}) {
    if (!dialog.open) return;
    dialog.close();
    document.documentElement.classList.remove('lm-menu-open');
    trigger.setAttribute('aria-expanded', 'false');
    if (mobile.matches) trigger.focus({preventScroll: true});
    if (hash) {
      if (location.hash !== hash) location.hash = hash;
      else document.getElementById(hash.slice(1))?.scrollIntoView({behavior: reducedMotion.matches ? 'instant' : 'smooth'});
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus({preventScroll: true});
        target.addEventListener('blur', () => target.removeAttribute('tabindex'), {once: true});
      }
    }
  }

  trigger.addEventListener('click', openMenu);
  closeButton.addEventListener('click', () => closeMenu());
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeMenu(); });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) closeMenu();
    const link = event.target.closest('a[href^="#"]');
    if (link && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      closeMenu({hash: link.hash});
    }
  });
  mobile.addEventListener('change', () => closeMenu());
})();
