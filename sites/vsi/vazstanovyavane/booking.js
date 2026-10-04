/* Normatec booking — Спортен комплекс ВСИ
 * Vanilla JS, no dependencies. (Designer's booking.js + a choice of procedure.)
 *
 * Every booking takes one whole 30-minute slot (17:00, 17:30 … 19:30), whichever procedure is chosen:
 *   "15"       Процедура Normatec, 15 минути
 *   "30"       Процедура Normatec, 30 минути
 *   "training" Тренировка + дренаж (the 15 minutes of Normatec in the pool package; ръце or крака only)
 *
 * Availability source:
 *  - data-api="" (default)  → demo mode: bookings are kept in this browser's localStorage.
 *  - data-api="…/wp-json/vsic/v1/normatec" → shared mode (plugin: normatec-bookings.php), so a booked slot is taken for everyone:
 *      GET  {api}/availability?from=YYYY-MM-DD&to=YYYY-MM-DD  → { "taken": ["2026-09-30 18:00", ...] }  (slot start times)
 *      POST {api}/bookings  { date, time, end, service, minutes, sleeve, name, phone, email, website }
 *           → 201 created · 409 if the slot was taken meanwhile · 400 { field, message } · 429 too many tries
 *    The server enforces "one booking per slot", rejects past slots and sends the two emails.
 *    "website" is a hidden field people leave empty; robots fill it in.
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-nm-booking]');
  if (!root) return;

  const CONFIG = {
    weekdays: [1, 3, 5],                  // Mon, Wed, Fri
    rangeDays: 21,                        // next 3 weeks
    slots: ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30'],
    slotMinutes: 30,
    api: (root.dataset.api || '').replace(/\/$/, ''),
  };
  // Procedures: label for summaries, Normatec minutes, and which cuffs are allowed.
  const SERVICE = {
    15: { label: 'Normatec 15 мин', minutes: 15, sleeves: ['arms', 'hips', 'legs'] },
    30: { label: 'Normatec 30 мин', minutes: 30, sleeves: ['arms', 'hips', 'legs'] },
    training: { label: 'Плуване + Normatec', minutes: 15, sleeves: ['arms', 'legs'] },
  };

  const WEEKDAY = ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота'];
  const MONTH = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември'];
  const MONTH_SHORT = ['яну', 'фев', 'мар', 'апр', 'май', 'юни', 'юли', 'авг', 'сеп', 'окт', 'ное', 'дек'];
  const SLEEVE = { arms: 'Ръце', hips: 'Таз', legs: 'Крака' };
  const MSG = {
    day: 'Изберете ден.',
    slot: 'Изберете свободен час.',
    sleeve: 'Изберете ръце, таз или крака.',
    sleeveTraining: 'Изберете ръце или крака.',
    name: 'Въведете име.',
    phone: 'Въведете телефонен номер.',
    email: 'Въведете имейл адрес.',
    emailBad: 'Въведете валиден имейл адрес, например ime@primer.bg.',
    mailSent: (email) => `Изпратихме потвърждение на ${email}.`,
    slotGone: 'Този час току-що беше зает. Изберете друг свободен час.',
    loadFail: 'Онлайн записването в момента не работи. Моля, обадете се по телефона.',
    saveFail: 'Часът не беше запазен. Опитайте отново или се обадете по телефона.',
    saving: 'Запазване…',
  };

  const q = (sel, el = root) => el.querySelector(sel);
  const form = q('[data-nm-form]');
  const daysEl = q('[data-nm-days]');
  const slotsEl = q('[data-nm-slots]');
  const summaryWrap = q('[data-nm-summary-wrap]');
  const summaryEl = q('[data-nm-summary]');
  const statusEl = q('[data-nm-status]');
  const doneEl = q('[data-nm-done]');
  const trainingHint = q('[data-nm-training-hint]');
  const submitBtn = form.querySelector('[type="submit"]');

  /* ---------- helpers ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const toTime = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
  const addMinutes = (t, min) => toTime(toMin(t) + min);
  const slotOf = (t) => toTime(Math.floor(toMin(t) / 30) * 30);   // bookings saved at :15/:45 by an older version
  const longDate = (d) => `${WEEKDAY[d.getDay()]}, ${d.getDate()} ${MONTH[d.getMonth()]}`;
  const freeLabel = (n) => (n === 0 ? 'Няма места' : n === 1 ? '1 свободен' : `${n} свободни`);
  const keyOf = (date, time) => `${date} ${time}`;
  const mondayOf = (d) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x; };
  const slotStart = (day, t) => { const d = new Date(day); d.setHours(0, toMin(t), 0, 0); return d; };

  /* ---------- storage ---------- */
  const LS_KEY = 'nm-normatec-bookings';
  const localStore = {
    read() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch (e) { return []; } },
    write(list) { try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch (e) { /* private mode */ } },
    async taken() { return this.read().map((b) => keyOf(b.date, slotOf(b.time))); },
    async book(b) {
      const list = this.read();
      if (list.some((x) => x.date === b.date && slotOf(x.time) === b.time)) return { ok: false, taken: true };
      list.push(b);
      this.write(list);
      return { ok: true };
    },
  };
  const remoteStore = {
    async taken(from, to) {
      // The time stamp keeps page caches from answering with an old list of taken slots.
      const res = await fetch(`${CONFIG.api}/availability?from=${from}&to=${to}&_=${Date.now()}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!res.ok) throw new Error(`availability ${res.status}`);
      const data = await res.json();
      return Array.isArray(data.taken) ? data.taken : [];
    },
    async book(b) {
      const res = await fetch(`${CONFIG.api}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(b),
      });
      if (res.status === 409) return { ok: false, taken: true };
      if (res.status === 400 || res.status === 429) {
        const data = await res.json().catch(() => ({}));
        if (data.message) return { ok: false, field: data.field || '', message: data.message };
      }
      if (!res.ok) throw new Error(`booking ${res.status}`);
      return { ok: true };
    },
  };
  const store = CONFIG.api ? remoteStore : localStore;

  /* ---------- state ---------- */
  const state = { days: [], taken: new Set(), day: null, slot: null, service: '30' };
  const checkedService = form.querySelector('input[name="service"]:checked');
  if (checkedService) state.service = checkedService.value;

  function buildDays(now) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const out = [];
    for (let i = 0; i < CONFIG.rangeDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (!CONFIG.weekdays.includes(d.getDay())) continue;
      // Drop today once its last slot has started.
      if (i === 0 && slotStart(d, CONFIG.slots[CONFIG.slots.length - 1]) <= now) continue;
      out.push(d);
    }
    return out;
  }

  function slotStatus(day, t, now = new Date()) {
    if (slotStart(day, t) <= now) return 'past';
    if (state.taken.has(keyOf(iso(day), t))) return 'taken';
    return 'free';
  }

  const freeCount = (day, now = new Date()) => CONFIG.slots.filter((t) => slotStatus(day, t, now) === 'free').length;

  /* ---------- rendering ---------- */
  function renderDays() {
    daysEl.textContent = '';
    if (!state.days.length) return;
    const now = new Date();
    const firstMonday = mondayOf(state.days[0]);
    const column = { 1: 0, 3: 1, 5: 2 };
    const cells = [];
    state.days.forEach((d) => {
      const row = Math.round((mondayOf(d) - firstMonday) / 6048e5);
      cells[row * 3 + column[d.getDay()]] = d;
    });

    for (let i = 0; i < cells.length; i++) {
      const d = cells[i];
      if (!d) {
        const gap = document.createElement('span');
        gap.className = 'nm-empty';
        gap.setAttribute('aria-hidden', 'true');
        daysEl.append(gap);
        continue;
      }
      const value = iso(d);
      const n = freeCount(d, now);
      const label = document.createElement('label');
      label.className = 'nm-opt';
      label.innerHTML =
        `<input type="radio" name="day" value="${value}"${n ? '' : ' disabled'}${state.day === value ? ' checked' : ''}>` +
        '<span class="nm-opt-body">' +
          `<span class="nm-opt-main" aria-hidden="true">${d.getDate()} ${MONTH_SHORT[d.getMonth()]}</span>` +
          `<span class="nm-sr">${longDate(d)},</span>` +
          `<span class="nm-opt-note">${freeLabel(n)}</span>` +
        '</span>';
      daysEl.append(label);
    }
  }

  function renderSlots() {
    slotsEl.textContent = '';
    if (!state.day) return;
    const day = fromIso(state.day);
    const now = new Date();
    CONFIG.slots.forEach((t) => {
      const st = slotStatus(day, t, now);
      const note = st === 'taken' ? 'Заето' : st === 'past' ? 'Отминал' : '';
      const label = document.createElement('label');
      label.className = `nm-opt${st === 'free' ? '' : ` nm-opt--${st}`}`;
      label.innerHTML =
        `<input type="radio" name="slot" value="${t}"${st === 'free' ? '' : ' disabled'}${state.slot === t ? ' checked' : ''}>` +
        '<span class="nm-opt-body">' +
          `<span class="nm-opt-main">${t}</span>` +
          (note ? `<span class="nm-opt-note">${note}</span>` : '') +
        '</span>';
      slotsEl.append(label);
    });
  }

  // „Тренировка + дренаж“ is for the limbs only, so the hip cuff is switched off while it is chosen.
  function applySleeveRules() {
    const allowed = SERVICE[state.service].sleeves;
    form.querySelectorAll('input[name="sleeve"]').forEach((input) => {
      const ok = allowed.includes(input.value);
      input.disabled = !ok;
      if (!ok && input.checked) input.checked = false;
    });
    if (trainingHint) trainingHint.hidden = state.service !== 'training';
  }

  function updateSummary() {
    if (!state.day || !state.slot) { summaryWrap.hidden = true; return; }
    const parts = [longDate(fromIso(state.day)), state.slot, SERVICE[state.service].label];
    const sleeve = form.elements.sleeve.value;
    if (sleeve) parts.push(SLEEVE[sleeve]);
    summaryEl.textContent = parts.join(' · ');
    summaryWrap.hidden = false;
  }

  function showStatus(msg) {
    statusEl.textContent = msg;
    statusEl.hidden = !msg;
  }

  /* ---------- errors ---------- */
  function setError(field, msg) {
    const el = q(`[data-nm-error="${field}"]`);
    if (!el) return;
    el.textContent = msg || '';
    el.hidden = !msg;
    const input = TEXT_FIELDS.includes(field) ? form.elements[field] : null;
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  const TEXT_FIELDS = ['name', 'phone', 'email'];
  const clearErrors = () => ['day', 'slot', 'sleeve', ...TEXT_FIELDS].forEach((f) => setError(f, ''));

  function focusField(field) {
    const pick = {
      day: () => daysEl.querySelector('input:checked:not(:disabled)') || daysEl.querySelector('input:not(:disabled)'),
      slot: () => slotsEl.querySelector('input:not(:disabled)'),
      sleeve: () => form.querySelector('input[name="sleeve"]:not(:disabled)'),
      name: () => form.elements.name,
      phone: () => form.elements.phone,
      email: () => form.elements.email,
    }[field];
    const target = pick && pick();
    if (!target) return;
    // Scroll ourselves: the choice buttons hide their real radio input, which some phones won't scroll to,
    // and the sticky site header would cover the step. Show the whole step (or field) with its red message.
    scrollToBox(target.closest('.nm-field') || target.closest('.nm-step') || target);
    target.focus({ preventScroll: true });
  }

  function scrollToBox(el) {
    const header = document.querySelector('.site-header');
    const covered = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
    const top = el.getBoundingClientRect().top + window.scrollY - covered - 12;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
  }

  /* ---------- data ---------- */
  async function refresh() {
    root.setAttribute('aria-busy', 'true');
    state.days = buildDays(new Date());
    let failed = false;
    try {
      const from = iso(state.days[0]);
      const to = iso(state.days[state.days.length - 1]);
      state.taken = new Set(await store.taken(from, to));
      showStatus('');
    } catch (e) {
      failed = true;
      showStatus(MSG.loadFail);
    } finally {
      root.removeAttribute('aria-busy');
    }
    form.hidden = failed || !doneEl.hidden;

    // Keep the current choice if it is still bookable; otherwise preselect the first day with room.
    const now = new Date();
    if (state.day && !state.days.some((d) => iso(d) === state.day && freeCount(d, now))) state.day = null;
    if (!state.day) {
      const first = state.days.find((d) => freeCount(d, now));
      state.day = first ? iso(first) : null;
    }
    if (state.slot && (!state.day || slotStatus(fromIso(state.day), state.slot, now) !== 'free')) state.slot = null;

    applySleeveRules();
    renderDays();
    renderSlots();
    updateSummary();
  }

  /* ---------- events ---------- */
  form.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'day') {
      state.day = t.value;
      state.slot = null;
      setError('day', '');
      renderSlots();
    } else if (t.name === 'service') {
      state.service = t.value;
      applySleeveRules();
    } else if (t.name === 'slot') {
      state.slot = t.value;
      setError('slot', '');
    } else if (t.name === 'sleeve') {
      setError('sleeve', '');
    }
    updateSummary();
  });

  form.addEventListener('input', (e) => {
    const name = e.target.name;
    if (TEXT_FIELDS.includes(name) && e.target.getAttribute('aria-invalid') === 'true') setError(name, '');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    showStatus('');

    const name = form.elements.name.value.trim();
    const phone = form.elements.phone.value.trim();
    const email = form.elements.email.value.trim();
    const sleeve = form.elements.sleeve.value;
    const errors = [];

    if (!state.day) errors.push(['day', MSG.day]);
    else if (!state.slot || slotStatus(fromIso(state.day), state.slot) !== 'free') errors.push(['slot', MSG.slot]);
    if (!sleeve) errors.push(['sleeve', state.service === 'training' ? MSG.sleeveTraining : MSG.sleeve]);
    if (name.length < 2) errors.push(['name', MSG.name]);
    if (phone.replace(/\D/g, '').length < 8) errors.push(['phone', MSG.phone]);
    if (!email) errors.push(['email', MSG.email]);
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push(['email', MSG.emailBad]);

    if (errors.length) {
      errors.forEach(([f, m]) => setError(f, m));
      focusField(errors[0][0]);
      return;
    }

    const booking = {
      date: state.day,
      time: state.slot,
      end: addMinutes(state.slot, CONFIG.slotMinutes),
      service: state.service,
      minutes: SERVICE[state.service].minutes,
      sleeve,
      name,
      phone,
      email,
      website: form.elements.website ? form.elements.website.value : '',
    };

    const label = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = MSG.saving;
    try {
      const res = await store.book(booking);
      if (!res.ok && res.message) {
        // The server found a problem the browser check missed: show it next to the field, or above the form.
        if (res.field && q(`[data-nm-error="${res.field}"]`)) { setError(res.field, res.message); focusField(res.field); }
        else showStatus(res.message);
        return;
      }
      if (!res.ok) {
        state.slot = null;
        await refresh();
        setError('slot', MSG.slotGone);
        focusField('slot');
        return;
      }
      showDone(booking);
    } catch (err) {
      showStatus(MSG.saveFail);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = label;
    }
  });

  function showDone(b) {
    state.taken.add(keyOf(b.date, b.time));
    state.slot = null;
    q('[data-nm-done-when]').textContent = `${longDate(fromIso(b.date))} · ${b.time} · ${SERVICE[b.service].label} · ${SLEEVE[b.sleeve]}`;
    q('[data-nm-done-who]').textContent = `${b.name} · ${b.phone} · ${b.email}`;
    // Only the server sends email; the demo (no data-api) keeps quiet about it.
    const mail = q('[data-nm-done-mail]');
    if (mail) { mail.textContent = CONFIG.api ? MSG.mailSent(b.email) : ''; mail.hidden = !CONFIG.api; }
    form.hidden = true;
    doneEl.hidden = false;
    q('[data-nm-done-title]').focus();
  }

  q('[data-nm-again]').addEventListener('click', async () => {
    form.querySelectorAll('input[name="sleeve"]').forEach((i) => { i.checked = false; });
    doneEl.hidden = true;
    await refresh();
    q('#nm-booking-title').focus();
  });

  // Pick up bookings made by others when the visitor comes back to the tab.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && doneEl.hidden) refresh();
  });

  refresh();

  /* ---------- mobile booking bar ---------- */
  const bar = document.querySelector('[data-nm-bar]');
  const watched = [document.querySelector('[data-nm-actions]'), root, document.getElementById('nm-phones')].filter(Boolean);
  if (bar && watched.length && 'IntersectionObserver' in window) {
    const visible = new Map();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => visible.set(en.target, en.isIntersecting));
      const anyInView = [...visible.values()].some(Boolean);
      bar.classList.toggle('is-visible', !anyInView);
    });
    watched.forEach((el) => io.observe(el));
  }
})();
