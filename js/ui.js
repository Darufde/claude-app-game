/* ═══════════════════════════════════════════════════════════════
   ui — screens, toasts, modals, ticker tape, sparklines
   ═══════════════════════════════════════════════════════════════ */

import { $, $$, el, wait, nextFrame, clamp, tween, easeOutCubic } from './util.js';
import { prefs } from './state.js';
import { sfx } from './audio.js';
import { haptic } from './haptics.js';

/* ═══ screens ═════════════════════════════════════════════════ */
let current = 'boot';
const stack = [];

export function showScreen(id, { push = false } = {}) {
  const next = document.getElementById('screen-' + id);
  if (!next) return;
  if (push && current !== id) stack.push(current);
  for (const s of $$('.screen[data-active]')) if (s !== next) s.removeAttribute('data-active');
  next.setAttribute('data-active', '');
  // restart entrance animations
  for (const r of $$('.reveal', next)) { r.style.animation = 'none'; void r.offsetWidth; r.style.animation = ''; }
  current = id;
  return next;
}
export const currentScreen = () => current;
export function popScreen() {
  const prev = stack.pop() || 'menu';
  showScreen(prev);
  return prev;
}
/** Sheets sit on top of the game screen — close without unmounting it. */
export function closeSheet() {
  const sheet = $(`.screen.sheet[data-active]`);
  if (sheet) sheet.removeAttribute('data-active');
  const back = stack.pop() || 'menu';
  const node = document.getElementById('screen-' + back);
  if (node) node.setAttribute('data-active', '');
  current = back;
}
export function openSheet(id) {
  if (current !== id) stack.push(current);
  const node = document.getElementById('screen-' + id);
  if (node) node.setAttribute('data-active', '');
  current = id;
  return node;
}

/* ═══ toasts ══════════════════════════════════════════════════ */
const toastRoot = () => document.getElementById('toast-root');
export function toast(text, tone = 'neu') {
  const root = toastRoot();
  if (!root) return;
  // One at a time — stacked toasts bury the card they are commenting on.
  while (root.children.length >= 1) root.firstChild.remove();
  const node = el('div', { class: `toast ${tone}` }, el('span', { class: 'dot' }), el('span', { text }));
  root.appendChild(node);
  setTimeout(() => node.remove(), 2900);
}

/* ═══ screen flash ════════════════════════════════════════════ */
export function flash(color = 'rgba(255,77,94,.55)') {
  const f = document.getElementById('flash');
  if (!f || !prefs.motion) return;
  f.style.background = `radial-gradient(120% 90% at 50% 50%, ${color}, transparent 72%)`;
  f.classList.remove('fire'); void f.offsetWidth; f.classList.add('fire');
}

export function shakeScreen(strength = 1) {
  if (!prefs.motion) return;
  const app = document.getElementById('app');
  const t0 = performance.now(), dur = 480;
  const step = (now) => {
    const t = (now - t0) / dur;
    if (t >= 1) { app.style.transform = ''; return; }
    const decay = (1 - t) ** 2;
    const x = Math.sin(t * 58) * 9 * strength * decay;
    const y = Math.cos(t * 47) * 5 * strength * decay;
    app.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ═══ modal ═══════════════════════════════════════════════════ */
let modalOpen = false;
export const isModalOpen = () => modalOpen;

/**
 * @param {object} cfg
 *  kicker, title, body(html), tone: good|bad|neu,
 *  stats: [[label, value], ...],
 *  ledger: [{label, value, tone, big}],
 *  actions: [{ label, meta, kind: primary|ghost|danger, value }]
 * @returns {Promise<string>} resolved action value
 */
export function modal(cfg) {
  return new Promise(async (resolve) => {
    modalOpen = true;
    const root = document.getElementById('modal-root');
    const scrim = el('div', { class: 'modal-scrim' });
    const card = el('div', { class: 'modal-card' });

    if (cfg.kicker) card.append(el('div', { class: `modal-kicker ${cfg.tone === 'good' ? 'good' : cfg.tone === 'bad' ? 'bad' : ''}`, text: cfg.kicker }));
    if (cfg.title) card.append(el('div', { class: 'modal-title' + (cfg.titleClass ? ' ' + cfg.titleClass : ''), html: cfg.title }));
    if (cfg.body) card.append(el('div', { class: 'modal-body', html: cfg.body }));

    if (cfg.stats?.length) {
      const wrap = el('div', { class: 'modal-ledger' });
      cfg.stats.forEach(([k, v], i) => wrap.append(
        el('div', { class: 'ledger-row', style: { animationDelay: `${120 + i * 70}ms` } },
          el('span', { text: k }), el('b', { text: String(v) }))
      ));
      card.append(wrap);
    }

    if (cfg.ledger?.length) {
      const wrap = el('div', { class: 'modal-ledger' });
      cfg.ledger.forEach((row, i) => wrap.append(
        el('div', { class: 'ledger-row' + (row.big ? ' total' : ''), style: { animationDelay: `${140 + i * 80}ms` } },
          el('span', { text: row.label }),
          el('b', { class: row.tone || '', text: String(row.value) }))
      ));
      card.append(wrap);
    }

    const actions = cfg.actions?.length ? cfg.actions : [{ label: 'Continue', kind: 'primary', value: 'ok' }];
    const actWrap = el('div', { class: 'modal-actions' });
    for (const a of actions) {
      const b = el('button', { class: `btn btn-${a.kind || 'ghost'}` },
        el('span', { class: 'btn-label', text: a.label }),
        a.meta ? el('span', { class: 'btn-meta', text: a.meta }) : null);
      b.addEventListener('click', () => { sfx.tap(); haptic.light(); close(a.value ?? a.label); });
      actWrap.append(b);
    }
    card.append(actWrap);

    root.append(scrim, card);
    root.style.pointerEvents = 'auto';
    await nextFrame();
    scrim.classList.add('in'); card.classList.add('in');

    if (cfg.dismissible !== false) scrim.addEventListener('click', () => close('dismiss'));

    async function close(value) {
      if (!modalOpen) return;
      modalOpen = false;
      scrim.classList.remove('in'); card.classList.remove('in');
      await wait(340);
      scrim.remove(); card.remove();
      root.style.pointerEvents = 'none';
      resolve(value);
    }
  });
}

/* ═══ ticker tape ═════════════════════════════════════════════ */
export function makeTape(container, items) {
  if (!container) return { update: () => {}, destroy: () => {} };
  let offset = 0, raf = 0, speed = 0.32, width = 0;

  function build(list) {
    container.innerHTML = '';
    const render = (it) => el('span', { class: 'tape-item' },
      el('b', { text: it.ticker }),
      el('i', { text: it.price }),
      el('u', { class: it.dir > 0 ? 'up' : it.dir < 0 ? 'dn' : '', text: it.change }));
    const src = list.length ? list : [{ ticker: '——', price: 'no listings', change: '', dir: 0 }];
    // Duplicate until it comfortably overflows, so the loop is seamless.
    let pass = 0;
    do {
      for (const it of src) container.append(render(it));
      pass++;
    } while (container.scrollWidth < container.parentElement.clientWidth * 2.2 && pass < 12);
    width = container.scrollWidth / 2;
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    offset -= speed;
    if (width > 0 && -offset >= width) offset += width;
    container.style.transform = `translate3d(${offset}px,0,0)`;
  }

  build(items);
  loop();

  return {
    update(list) { const keep = offset; build(list); offset = keep; },
    setSpeed(v) { speed = v; },
    destroy() { cancelAnimationFrame(raf); },
  };
}

/* ═══ sparkline ═══════════════════════════════════════════════ */
export function sparkline(values, { w = 54, h = 26, up = null, animate = false } = {}) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('class', 'lspark');
  if (!values || values.length < 2) return svg;

  const data = values.length > 40 ? values.slice(-40) : values;
  let lo = Infinity, hi = -Infinity;
  for (const v of data) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = (hi - lo) || 1;
  const pad = 2.5;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * (w - 1) + 0.5,
    h - pad - ((v - lo) / span) * (h - pad * 2),
  ]);

  const rising = up ?? (data[data.length - 1] >= data[0]);
  const color = rising ? '#2fd48a' : '#ff4d5e';
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

  const area = document.createElementNS(ns, 'path');
  area.setAttribute('d', `${d} L${w},${h} L0,${h} Z`);
  area.setAttribute('fill', color);
  area.setAttribute('opacity', '0.11');
  svg.append(area);

  const line = document.createElementNS(ns, 'path');
  line.setAttribute('d', d);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', '1.6');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');
  svg.append(line);

  if (animate && prefs.motion) {
    const len = line.getTotalLength?.() || 100;
    line.style.strokeDasharray = len;
    line.style.strokeDashoffset = len;
    line.style.transition = 'stroke-dashoffset .9s cubic-bezier(.16,1,.3,1)';
    requestAnimationFrame(() => { line.style.strokeDashoffset = '0'; });
  }

  const dot = document.createElementNS(ns, 'circle');
  dot.setAttribute('cx', pts[pts.length - 1][0]);
  dot.setAttribute('cy', pts[pts.length - 1][1]);
  dot.setAttribute('r', '1.9');
  dot.setAttribute('fill', color);
  svg.append(dot);

  return svg;
}

/* ═══ animated stat cell ══════════════════════════════════════ */
export function bumpStat(node, dir) {
  if (!node || !prefs.motion) return;
  node.classList.remove('bump', 'glow-up', 'glow-dn');
  void node.offsetWidth;
  node.classList.add('bump');
  if (dir > 0) node.classList.add('glow-up');
  else if (dir < 0) node.classList.add('glow-dn');
  setTimeout(() => node.classList.remove('bump', 'glow-up', 'glow-dn'), 900);
}

export function showDelta(node, text, dir) {
  if (!node) return;
  node.textContent = text;
  node.className = 'stat-delta show ' + (dir > 0 ? 'up' : dir < 0 ? 'dn' : '');
  clearTimeout(node._t);
  node._t = setTimeout(() => { node.className = 'stat-delta'; }, 2600);
}
