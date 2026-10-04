// Cookie consent for Google Analytics. Nothing is loaded or sent to Google until the visitor taps „Приемам“.
// The choice is kept for 180 days; the „Бисквитки“ link in the footer reopens the bar. No floating icon.
(() => {
  const config = window.vsiAnalytics || {};
  // The bar shows even before a measurement ID exists (club decision); the tag itself loads only when an ID is set.
  const KEY = 'vsi_consent', DAYS = 180;
  const read = () => {
    try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && v.choice && Date.now() - v.at < DAYS * 864e5 ? v.choice : null; } catch (e) { return null; }
  };
  const save = choice => { try { localStorage.setItem(KEY, JSON.stringify({ choice, at: Date.now() })); } catch (e) { /* storage blocked: the bar simply shows again next time */ } };
  const forgetGoogleCookies = () => {
    document.cookie.split(';').forEach(c => {
      const name = c.split('=')[0].trim();
      if (name === '_ga' || name.indexOf('_ga_') === 0 || name === '_gid') document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' + location.hostname.replace(/^www\./, '.');
    });
  };
  let loaded = false;
  function loadAnalytics() {
    if (loaded || !config.id) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
    window.gtag('js', new Date());
    window.gtag('config', config.id, { anonymize_ip: true });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(config.id);
    document.head.appendChild(script);
  }
  let bar = null;
  function show() {
    if (bar) { bar.hidden = false; bar.querySelector('button').focus(); return; }
    bar = document.createElement('div');
    bar.className = 'consent-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Бисквитки');
    const text = document.createElement('p');
    text.textContent = 'Използваме бисквитки за правилната работа на сайта и за анонимна статистика на посещенията (Google Analytics). Може да промените избора си по всяко време от „Бисквитки“ в долния край на страницата.';
    if (config.policy) { const more = document.createElement('a'); more.href = config.policy; more.textContent = 'Повече'; text.appendChild(document.createTextNode(' ')); text.appendChild(more); }
    const actions = document.createElement('div');
    actions.className = 'consent-actions';
    actions.innerHTML = '<button type="button" class="consent-accept" data-consent="granted">Приемам</button><button type="button" class="consent-decline" data-consent="denied">Отказвам</button>';
    bar.appendChild(text); bar.appendChild(actions);
    document.body.appendChild(bar);
    bar.addEventListener('click', event => {
      const button = event.target.closest('[data-consent]');
      if (!button) return;
      const choice = button.dataset.consent;
      save(choice);
      bar.hidden = true;
      if (choice === 'granted') loadAnalytics(); else forgetGoogleCookies();
    });
    bar.querySelector('button').focus();
  }
  const choice = read();
  if (choice === 'granted') loadAnalytics();
  else if (!choice) show();
  document.addEventListener('click', event => {
    if (event.target.closest('[data-consent-open]')) { event.preventDefault(); show(); }
  });
})();
