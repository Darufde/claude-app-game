/* ═══════════════════════════════════════════════════════════════
   card — the prospectus card + swipe gesture

   Drag physics: rotation tracks horizontal offset, stamps fade in
   past a dead zone, release either flings (distance OR velocity) or
   springs home. Buttons drive the same fling path so the two input
   methods feel identical.
   ═══════════════════════════════════════════════════════════════ */

import { el, money, pct, clamp, chipStyle, tween, easeOutCubic, wait } from './util.js';
import { METRIC_VIEWS } from './company.js';
import { FLAG_BY_ID } from './data.js';
import { prefs } from './state.js';
import { sfx } from './audio.js';
import { haptic } from './haptics.js';

const SWIPE_DIST = 0.26;      // fraction of card width
const SWIPE_VEL  = 0.42;      // px per ms
const DEAD_ZONE  = 14;

export function createCard(co, { onDecide, onBlocked, canFling, interactive = true } = {}) {
  /* ─── structure ──────────────────────────────────────────── */
  const node = el('div', { class: 'card enter' });

  const head = el('div', { class: 'card-head' },
    el('div', { class: 'card-row1' },
      el('div', { class: 'tickerbox', style: chipStyle(co.ticker) + ';', text: co.ticker }),
      el('div', { class: 'sector-tag', text: co.sectorLabel }),
      el('div', { class: 'card-round', text: `${(co.floatPct * 100).toFixed(0)}% FLOAT` }),
    ),
    el('div', { class: 'card-name', text: co.name }),
    el('div', { class: 'card-blurb', text: co.blurb }),
  );

  const ask = el('div', { class: 'card-ask' },
    el('div', { class: 'ask-cell' },
      el('span', { class: 'k', text: 'ASK' }), el('span', { class: 'v', text: money(co.askValuation) })),
    el('div', { class: 'ask-cell' },
      el('span', { class: 'k', text: 'RAISE' }), el('span', { class: 'v', text: money(co.raise) })),
    el('div', { class: 'ask-cell fee' },
      el('span', { class: 'k', text: 'YOUR FEE' }), el('span', { class: 'v', text: money(co.listingFee) })),
  );

  const metrics = el('div', { class: 'card-metrics' });
  const bars = [];
  for (const M of METRIC_VIEWS) {
    const bar = el('i', { class: M.tone(co.stats) });
    bars.push([bar, M.bar(co.stats)]);
    metrics.append(el('div', { class: 'metric' },
      el('div', { class: 'metric-top' },
        el('span', { class: 'metric-k', text: M.label }),
        el('span', { class: 'metric-v', text: M.fmt(co.stats) })),
      el('div', { class: 'metric-bar' }, bar),
    ));
  }

  const flagWrap = el('div', { class: 'card-flags' });
  const renderFlag = (id, isNew) => {
    const F = FLAG_BY_ID[id];
    if (!F) return null;
    return el('span', { class: `flag ${F.tone}${isNew ? ' hidden-flag' : ''}`, text: F.text });
  };
  for (const id of co.flags) { const f = renderFlag(id); if (f) flagWrap.append(f); }

  const auditWrap = el('div', { class: 'card-audit-wrap' });

  const foot = el('div', { class: 'card-foot' },
    el('div', { class: 'underwriter' },
      el('span', { class: 'uw-dot', style: { background: co.uwTier === 3 ? '#e8bb62' : co.uwTier === 2 ? '#59a8ff' : '#5f6c8a' } }),
      el('span', { text: co.underwriter })),
    el('span', { text: `${co.shares > 1e6 ? (co.shares / 1e6).toFixed(1) + 'M' : co.shares} SH @ $${co.ipoPrice.toFixed(2)}` }),
  );

  const stampYes = el('div', { class: 'stamp stamp-yes', text: 'LIST' });
  const stampNo  = el('div', { class: 'stamp stamp-no',  text: 'PASS' });

  node.append(head, ask, metrics, flagWrap, auditWrap, foot, stampYes, stampNo);

  /* Short viewports (Safari with its chrome showing) plus two audit readouts
     can leave less room than the four metric rows need. Rather than letting
     the last row clip in half, drop whole rows that do not fit. Measured for
     real, because the audit boxes vary in height with their copy. */
  function fitMetrics() {
    const rows = [...metrics.children];
    for (const r of rows) r.style.display = '';
    const avail = metrics.clientHeight - 4;
    if (avail <= 0) return;
    const gap = 7;
    let used = 0, shown = 0;
    for (const r of rows) {
      const h = r.offsetHeight;
      if (used + h > avail) r.style.display = 'none';
      else { used += h + gap; shown++; }
    }
    // If nothing survived, collapse the region so it leaves no void.
    metrics.style.flex = shown ? '' : '0 0 0';
    metrics.style.padding = shown ? '' : '0';
  }

  // Animate the metric bars in once mounted.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    fitMetrics();
    for (const [bar, v] of bars) bar.style.width = (clamp(v, 0.03, 1) * 100).toFixed(1) + '%';
  }));

  /* ─── gesture ────────────────────────────────────────────── */
  let dragging = false, startX = 0, startY = 0, dx = 0, dy = 0;
  let lastX = 0, lastT = 0, vx = 0, pid = null, locked = false, decided = false;
  let hintTick = 0;

  const width = () => node.offsetWidth || 320;

  function apply(x, y, rot, immediate) {
    node.style.transition = immediate ? 'none' : '';
    node.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg)`;
  }

  function paint() {
    const w = width();
    const prog = clamp((Math.abs(dx) - DEAD_ZONE) / (w * SWIPE_DIST), 0, 1);
    const rot = clamp(dx * 0.055, -16, 16);
    apply(dx, dy * 0.32, rot, true);
    stampYes.style.opacity = dx > 0 ? prog : 0;
    stampNo.style.opacity  = dx < 0 ? prog : 0;
    const s = 1.25 - prog * 0.25;
    stampYes.style.transform = `rotate(-15deg) scale(${s})`;
    stampNo.style.transform  = `rotate(15deg) scale(${s})`;
    node.style.borderColor = dx > DEAD_ZONE ? `rgba(47,212,138,${0.1 + prog * 0.5})`
      : dx < -DEAD_ZONE ? `rgba(255,77,94,${0.1 + prog * 0.5})` : '';

    if (prog >= 1 && hintTick !== 1) { hintTick = 1; haptic.select(); sfx.drag(); }
    else if (prog < 1) hintTick = 0;
  }

  function onDown(e) {
    if (!interactive || decided || e.button > 0) return;
    dragging = true; locked = false;
    pid = e.pointerId;
    startX = lastX = e.clientX; startY = e.clientY;
    lastT = performance.now(); vx = 0;
    node.setPointerCapture?.(pid);
    node.style.transition = 'none';
  }

  function onMove(e) {
    if (!dragging || e.pointerId !== pid) return;
    const nx = e.clientX - startX, ny = e.clientY - startY;
    if (!locked) {
      if (Math.abs(nx) < 6 && Math.abs(ny) < 6) return;
      locked = true;
    }
    dx = nx; dy = ny;
    const now = performance.now(), dt = now - lastT;
    if (dt > 0) vx = (e.clientX - lastX) / dt * 0.6 + vx * 0.4;
    lastX = e.clientX; lastT = now;
    e.preventDefault();
    paint();
  }

  function onUp(e) {
    if (!dragging || (pid != null && e.pointerId !== pid)) return;
    dragging = false;
    node.releasePointerCapture?.(pid);
    pid = null;
    const w = width();
    const far = Math.abs(dx) > w * SWIPE_DIST;
    const fast = Math.abs(vx) > SWIPE_VEL && Math.abs(dx) > DEAD_ZONE * 2;
    const dir = dx > 0 ? 1 : -1;
    if (!(far || fast)) { springBack(); return; }
    // A blocked direction springs home instead of completing the swipe.
    if (canFling && !canFling(dir)) { springBack(); onBlocked?.(dir); return; }
    fling(dir, vx);
  }

  function springBack() {
    dx = 0; dy = 0;
    node.style.transition = 'transform .52s cubic-bezier(.34,1.56,.64,1), border-color .3s';
    node.style.transform = 'translate3d(0,0,0) rotate(0deg)';
    node.style.borderColor = '';
    stampYes.style.opacity = 0; stampNo.style.opacity = 0;
  }

  /** dir: 1 = accept, -1 = reject */
  function fling(dir, velocity = 0) {
    if (decided) return;
    decided = true; interactive = false;
    const w = window.innerWidth;
    const targetX = dir * (w * 1.15 + 120);
    const targetY = dy * 0.5 + (dir > 0 ? -46 : 46);
    const rot = dir * (Math.abs(velocity) > 1 ? 34 : 24);

    node.style.transition = 'transform .46s cubic-bezier(.22,.7,.3,1), opacity .36s ease-out .1s';
    node.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) rotate(${rot}deg)`;
    node.style.opacity = '0';
    (dir > 0 ? stampYes : stampNo).style.opacity = '1';

    sfx.swipe();
    onDecide?.(dir > 0 ? 'accept' : 'reject');
    setTimeout(() => node.remove(), 520);
  }

  // Always bound — `interactive` is re-checked inside the handlers. Binding
  // conditionally would leave promoted cards permanently undraggable.
  node.addEventListener('pointerdown', onDown);
  node.addEventListener('pointermove', onMove, { passive: false });
  node.addEventListener('pointerup', onUp);
  node.addEventListener('pointercancel', onUp);

  /* ─── audit rendering ────────────────────────────────────── */
  function showAudit(a) {
    let text = a.text;
    if (a.kind === 'valuation') {
      text = text.replace('__EST__', `<b style="color:#fff">${money(a.est)}</b>`)
                 .replace('__ASK__', `<b style="color:#fff">${money(a.ask)}</b>`);
    }
    const box = el('div', { class: 'card-audit' },
      el('div', { class: 'ak', text: a.title }),
      el('div', { class: 'av', html: text }),
    );
    if (a.tone === 'bad') { box.style.background = 'rgba(255,77,94,.08)'; box.style.borderColor = 'rgba(255,77,94,.28)'; box.querySelector('.ak').style.color = '#ff8892'; }
    else if (a.tone === 'good') { box.style.background = 'rgba(47,212,138,.08)'; box.style.borderColor = 'rgba(47,212,138,.26)'; box.querySelector('.ak').style.color = '#5fe3ab'; }
    // Keep at most two readouts; the older one collapses to a single line.
    while (auditWrap.children.length >= 2) auditWrap.firstChild.remove();
    auditWrap.append(box);
    const kids = [...auditWrap.children];
    kids.forEach((n, i) => n.classList.toggle('compact', i < kids.length - 1));
    node.classList.remove('has-audit-1', 'has-audit-2');
    node.classList.add(`has-audit-${Math.min(kids.length, 2)}`);
    requestAnimationFrame(fitMetrics);
  }

  function addFlags(ids) {
    for (const id of ids) { const f = renderFlag(id, true); if (f) flagWrap.append(f); }
  }

  function setDepth(n) {
    node.dataset.depth = String(n);
    if (n === 0) delete node.dataset.depth;
  }

  return {
    el: node, company: co,
    fling, showAudit, addFlags, setDepth,
    get decided() { return decided; },
    setInteractive(v) { interactive = v; },
    destroy() { node.remove(); },
  };
}
