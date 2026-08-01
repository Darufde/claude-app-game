/* ═══════════════════════════════════════════════════════════════
   game — the core loop controller
   ═══════════════════════════════════════════════════════════════ */

import {
  $, el, money, pct, price, num, clamp, wait, countTo, chipStyle, tween,
} from './util.js';
import {
  DAYS_PER_WEEK, prefs, liveListings, marketCap, dayOfWeek,
  saveGame, recordSession, clearSave, slots, slotsFree, canAccept,
} from './state.js';
import { TIERS, REGIMES, SECTORS } from './data.js';
import {
  advanceDay, acceptApplicant, rejectApplicant, refillQueue,
  forceDelist, forceDelistCost,
} from './sim.js';
import { runAudit } from './company.js';
import { createCard } from './card.js';
import {
  showScreen, openSheet, closeSheet, toast, modal, makeTape,
  sparkline, bumpStat, showDelta, flash, shakeScreen, isModalOpen,
} from './ui.js';
import { sfx } from './audio.js';
import { haptic } from './haptics.js';
import * as bg from './bg.js';

let S = null, R = null;
let cards = [];               // visible card stack, [0] = top
let busy = false;
let tape = null;
let prevCapital = 0, prevMcap = 0;
let onExit = null;

const dom = {};

function cacheDom() {
  dom.name = $('#hud-name'); dom.tier = $('#hud-tier');
  dom.capital = $('#v-capital'); dom.dCapital = $('#d-capital');
  dom.rep = $('#v-rep'); dom.repFill = $('#rep-fill');
  dom.mcap = $('#v-mcap'); dom.dMcap = $('#d-mcap');
  dom.session = $('#v-session'); dom.queue = $('#v-queue'); dom.dots = $('#week-dots');
  dom.deck = $('#deck'); dom.deckEmpty = $('#deck-empty');
  dom.badge = $('#badge-listings'); dom.auditCount = $('#audit-count');
  dom.statCapital = $('#stat-capital'); dom.statRep = $('#stat-rep'); dom.statCap = $('#stat-cap');
  dom.hint = $('#swipe-hint');
  dom.btnAccept = $('[data-action="accept"]');
  dom.btnReject = $('[data-action="reject"]');
  dom.btnAudit = $('[data-action="audit"]');
}

/* ═══ lifecycle ═══════════════════════════════════════════════ */
export function startGame(state, rng, { exit } = {}) {
  S = state; R = rng; onExit = exit;
  cacheDom();
  cards.forEach(c => c.destroy()); cards = [];
  busy = false;

  prevCapital = S.capital; prevMcap = marketCap(S);
  dom.name.textContent = S.name;

  refillQueue(S, R);
  showScreen('game');
  bg.setIntensity(0.55);

  if (!tape) tape = makeTape($('#game-tape'), tapeItems());
  else tape.update(tapeItems());

  syncHud(true);
  buildStack();

  if (S.day <= 1) {
    sfx.bell();
    setTimeout(() => toast('The bell rings. You are open.', 'gold'), 400);
  }
  dom.hint.classList.toggle('gone', S.stats.accepted + S.stats.rejected > 3);
}

export function stopGame() {
  cards.forEach(c => c.destroy()); cards = [];
  bg.setIntensity(1);
}

export const getState = () => S;
export const getRng = () => R;

/* ═══ HUD ═════════════════════════════════════════════════════ */
function tapeItems() {
  const live = liveListings(S);
  if (!live.length) {
    return ['NO OPEN INTEREST', 'THE BOARD IS EMPTY', 'AWAITING FIRST LISTING']
      .map(t => ({ ticker: t, price: '', change: '·', dir: 0 }));
  }
  return live.slice(0, 24).map(l => {
    const ch = (l.price - l.prevPrice) / (l.prevPrice || l.price);
    return { ticker: l.ticker, price: price(l.price), change: pct(ch, 1), dir: Math.sign(ch) };
  });
}

function syncHud(instant = false) {
  const mcap = marketCap(S);
  const T = TIERS[S.tierIndex];

  dom.tier.textContent = T.name.toUpperCase();
  dom.badge.textContent = `${liveListings(S).length}/${slots(S)}`;
  dom.badge.classList.toggle('full', !canAccept(S));
  dom.auditCount.textContent = String(S.audits);
  dom.btnAudit.disabled = S.audits <= 0 || !cards[0] || cards[0].company.auditLevel >= 3;
  dom.btnAccept.classList.toggle('blocked', !canAccept(S));

  if (instant) {
    dom.capital.textContent = money(S.capital);
    dom.mcap.textContent = money(mcap);
  } else {
    countTo(dom.capital, prevCapital, S.capital, 780, money);
    countTo(dom.mcap, prevMcap, mcap, 780, money);
  }
  prevCapital = S.capital; prevMcap = mcap;

  dom.rep.textContent = Math.round(S.reputation);
  dom.repFill.style.width = clamp(S.reputation, 0, 100) + '%';
  dom.repFill.className = S.reputation < 34 ? 'low' : S.reputation > 68 ? 'high' : '';

  dom.session.textContent = `WEEK ${S.week} · DAY ${dayOfWeek(S)}`;
  dom.queue.textContent = `${REGIMES[S.regime].label.toUpperCase()} TAPE`;

  if (dom.dots.children.length !== DAYS_PER_WEEK) {
    dom.dots.innerHTML = '';
    for (let i = 0; i < DAYS_PER_WEEK; i++) dom.dots.append(el('i'));
  }
  [...dom.dots.children].forEach((d, i) => d.classList.toggle('on', i < dayOfWeek(S)));

  bg.setMood(clamp((S.reputation - 50) / 50 * 0.5 + REGIMES[S.regime].drift * 60, -1, 1));
}

/* ═══ card stack ══════════════════════════════════════════════ */
const cardHooks = () => ({
  onDecide: (k) => resolve(k),
  canFling: (dir) => dir < 0 || canAccept(S),
  onBlocked: () => refuseAccept(),
});

function buildStack() {
  refillQueue(S, R);
  cards.forEach(c => c.destroy());
  cards = [];
  const slice = S.queue.slice(0, 3);
  // Build back-to-front so the top card sits last in the DOM.
  for (let i = slice.length - 1; i >= 0; i--) {
    const c = createCard(slice[i], { interactive: i === 0, ...cardHooks() });
    c.setDepth(i);
    cards[i] = c;
    dom.deck.append(c.el);
  }
  // Re-apply any audits already run on the top applicant (e.g. after reload).
  const top = cards[0];
  if (top) for (const a of top.company.audits) top.showAudit(a);
  dom.deckEmpty.hidden = cards.length > 0;
  syncHud(true);
}

function advanceStack() {
  cards.shift();
  for (let i = 0; i < cards.length; i++) {
    cards[i].setDepth(i);
    if (i === 0) cards[i].setInteractive(true);
  }
  refillQueue(S, R);
  const need = 3 - cards.length;
  for (let i = 0; i < need; i++) {
    const idx = cards.length;
    const co = S.queue[idx];
    if (!co) break;
    const c = createCard(co, { interactive: false, ...cardHooks() });
    c.setDepth(idx);
    cards.push(c);
    dom.deck.insertBefore(c.el, dom.deck.firstChild);
  }
  dom.deckEmpty.hidden = cards.length > 0;
}

/* ═══ input ═══════════════════════════════════════════════════ */
export function handleAction(kind) {
  if (busy || isModalOpen()) return;
  const top = cards[0];
  if (!top || top.decided) return;

  if (kind === 'audit') {
    doAudit();
    return;
  }
  if (kind === 'accept' && !canAccept(S)) {
    refuseAccept();
    return;
  }
  top.fling(kind === 'accept' ? 1 : -1);
}

/** The board is full — say so loudly rather than silently swallowing the swipe. */
function refuseAccept() {
  sfx.reject(); haptic.error();
  toast(`Board is full — ${slots(S)} slots at ${TIERS[S.tierIndex].name}. Remove a listing first.`, 'bad');
  const card = cards[0]?.el;
  if (card && prefs.motion) {
    card.style.transition = 'none';
    card.animate?.(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(14px)' }, { transform: 'translateX(-10px)' },
       { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
      { duration: 340, easing: 'ease-out' }
    );
  }
}

/** Reviewing a $4bn file costs more than reviewing a $90m one. */
function auditCost(co) {
  return Math.round(Math.max(S.balance.auditCost, co.askValuation * S.balance.auditRate) / 1000) * 1000;
}

async function doAudit() {
  const top = cards[0];
  if (!top || S.audits <= 0) return;
  const co = top.company;
  if (co.auditLevel >= 3) { toast('Nothing left to check on this file.', 'neu'); return; }

  const cost = auditCost(co);
  if (S.capital < cost) { toast(`A review of this file costs ${money(cost)} — you cannot cover it.`, 'bad'); return; }

  S.audits--;
  S.capital -= cost;
  S.stats.auditsRun++;
  sfx.audit(); haptic.medium();

  const result = runAudit(co, R);
  if (co.revealedFlags?.length) { top.addFlags(co.revealedFlags); co.revealedFlags = []; }
  top.showAudit(result);
  showDelta(dom.dCapital, money(-cost), -1);
  bumpStat(dom.statCapital, -1);
  syncHud();
  saveGame(S, R);
}

/* ═══ resolution ══════════════════════════════════════════════ */
async function resolve(kind) {
  if (busy) return;
  busy = true;
  dom.hint.classList.add('gone');

  const co = S.queue.shift();
  if (!co) { busy = false; return; }

  const beforeCap = S.capital;
  let listResult = null;

  if (kind === 'accept') {
    listResult = acceptApplicant(S, co, R);
    sfx.cash(); haptic.success();
    const p = listResult.pop;
    toast(
      `${co.ticker} lists · ${money(listResult.fee)} fee · ${pct(p, 0)} debut`,
      p > 0.05 ? 'good' : p < -0.05 ? 'bad' : 'gold'
    );
  } else {
    rejectApplicant(S, co, R);
    sfx.reject(); haptic.light();
    toast(`${co.ticker} withdrawn from the calendar`, 'neu');
  }

  advanceStack();

  const report = advanceDay(S, R);
  await wait(260);

  /* ── HUD ─────────────────────────────────────────────────── */
  const capDelta = S.capital - beforeCap;
  syncHud();
  if (Math.abs(capDelta) > 1) {
    showDelta(dom.dCapital, money(capDelta, { sign: true }), Math.sign(capDelta));
    bumpStat(dom.statCapital, Math.sign(capDelta));
  }
  const mcapDelta = report.mcapAfter - report.mcapBefore;
  if (Math.abs(mcapDelta) > 1 && report.mcapBefore > 0) {
    showDelta(dom.dMcap, pct(mcapDelta / report.mcapBefore, 1), Math.sign(mcapDelta));
    bumpStat(dom.statCap, Math.sign(mcapDelta));
  }
  if (Math.abs(report.repDelta) > 0.4) bumpStat(dom.statRep, Math.sign(report.repDelta));
  tape.update(tapeItems());

  await presentReport(report);

  saveGame(S, R);
  busy = false;

  if (S.over) endGame();
}

/* ═══ report presentation ═════════════════════════════════════ */
async function presentReport(rep) {
  let modalBudget = 2;

  /* scandals — always shown, always loud */
  for (const sc of rep.scandals) {
    flash('rgba(255,77,94,.6)'); shakeScreen(1.15); sfx.alarm(); haptic.error(); bg.shock(-1);
    await modal({
      tone: 'bad', kicker: 'Scandal',
      title: `${sc.ticker} — the numbers were fiction`,
      body: `<em>${sc.name}</em> has admitted to material misstatement. Trading was halted at `
          + `${pct(-sc.crash, 0)}. Every journalist covering this market is currently writing your `
          + `name in the second paragraph.`,
      stats: [['Price', pct(-sc.crash, 0)], ['Standing', sc.repHit.toFixed(1)]],
      actions: [{ label: 'Take the hit', kind: 'primary', value: 'ok' }],
    });
    modalBudget--;
  }

  for (const ac of rep.acquisitions) {
    if (modalBudget > 0) {
      modalBudget--;
      sfx.cash();
      await modal({
        tone: 'good', kicker: 'Takeover',
        title: `${ac.ticker} taken out at a premium`,
        body: `<em>${ac.name}</em> has agreed to an all-cash acquisition at `
            + `<em>+${Math.round(ac.premium * 100)}%</em>. Your shareholders of record do very well, `
            + `and every founder watching your floor took note.`,
        stats: [['Premium', '+' + Math.round(ac.premium * 100) + '%'], ['Transfer fee', money(ac.fee)], ['Standing', '+2.6']],
      });
    } else toast(`${ac.ticker} acquired at +${Math.round(ac.premium * 100)}%`, 'good');
  }

  for (const d of rep.delistings) toast(`${d.ticker} delisted from the board`, 'bad');

  /* events */
  for (const ev of rep.events) {
    if (ev.kind === 'toast' || modalBudget <= 0) {
      toast(ev.text || ev.title, ev.tone === 'good' ? 'good' : ev.tone === 'bad' ? 'bad' : ev.tone === 'gold' ? 'gold' : 'neu');
      continue;
    }
    modalBudget--;
    if (ev.shake) { shakeScreen(1); flash('rgba(255,77,94,.5)'); sfx.alarm(); }
    else if (ev.tone === 'good') sfx.tier();
    await modal({
      tone: ev.tone, kicker: ev.kicker, title: ev.title, body: ev.body, stats: ev.stats,
    });
  }

  /* the ones that got away */
  for (const g of rep.ghosts) {
    if (g.outcome === 'quiet') continue;
    toast(g.text, g.outcome === 'fraud' ? 'good' : 'bad');
    await wait(220);
  }

  if (rep.regimeChanged) {
    const r = REGIMES[rep.regimeChanged.to];
    toast(`Tape turns ${r.label.toLowerCase()}`, r.tone === 'up' ? 'good' : r.tone === 'dn' ? 'bad' : 'neu');
  }

  if (rep.quarterClose) await presentQuarter(rep.quarterClose);
  if (rep.weekClose) await presentWeek(rep.weekClose, rep);
  if (rep.tierChange) await presentTier(rep.tierChange);

  syncHud();
  tape.update(tapeItems());
}

async function presentWeek(wk, rep) {
  sfx.bell();
  const ledger = [
    { label: 'Listings on the board', value: num(wk.listings) },
    { label: 'Market capitalisation', value: money(wk.mcap) },
    { label: 'Cash on hand', value: money(wk.capital), tone: wk.capital > 0 ? '' : 'dn' },
    { label: 'Standing', value: Math.round(wk.reputation) + ' / 100' },
  ];
  if (wk.bestMover) ledger.push({ label: `Best — ${wk.bestMover.ticker}`, value: pct(wk.bestMover.ret, 1), tone: wk.bestMover.ret >= 0 ? 'up' : 'dn' });
  if (wk.worstMover && wk.worstMover.ticker !== wk.bestMover?.ticker) {
    ledger.push({ label: `Worst — ${wk.worstMover.ticker}`, value: pct(wk.worstMover.ret, 1), tone: wk.worstMover.ret >= 0 ? 'up' : 'dn' });
  }
  ledger.push({ label: 'Due diligence restored', value: `${S.auditsMax} reviews`, big: true, tone: 'up' });

  await modal({
    tone: 'neu', kicker: `Week ${wk.week} · settlement`,
    title: `${S.name} closes the week`,
    body: `The tape is <em>${wk.regime.toLowerCase()}</em> and you are operating as a `
        + `<em>${wk.tier}</em>. Analysts are back at their desks Monday.`,
    ledger,
    actions: [{ label: 'Open Monday', kind: 'primary', value: 'ok' }],
  });
}

async function presentQuarter(q) {
  const ledger = [{ label: `Annual fees × ${q.listings}`, value: money(q.annualFees, { sign: true }), tone: 'up', big: !q.review }];
  if (q.review) {
    ledger.push({ label: 'Regulatory review', value: q.review.fine ? money(-q.review.fine) : 'clean', tone: q.review.tone === 'bad' ? 'dn' : 'up' });
    ledger.push({ label: 'Standing', value: (q.review.rep > 0 ? '+' : '') + q.review.rep.toFixed(1), tone: q.review.rep > 0 ? 'up' : 'dn', big: true });
  }
  await modal({
    tone: q.review?.tone === 'bad' ? 'bad' : 'good',
    kicker: `Quarter ${q.quarter}`,
    title: 'Quarterly settlement',
    body: q.review ? q.review.text : 'Annual listing fees have been invoiced and collected. A quiet quarter is a good quarter.',
    ledger,
  });
}

async function presentTier(tc) {
  const T = TIERS[tc.to];
  if (tc.promoted) {
    sfx.tier(); haptic.success(); flash('rgba(232,187,98,.45)'); bg.shock(1);
    await modal({
      tone: 'good', kicker: 'Promotion',
      title: `You are now a<br/>${T.name}`,
      titleClass: 'over-title',
      body: `Standing and scale have carried you up a rung. Larger issuers will take your calls, `
          + `valuations on your floor re-rate upward, and the quality of what walks through the door improves.`,
      stats: [
        ['Valuation multiple', '×' + T.valMult.toFixed(2)],
        ['Applicant quality', '+' + Math.round(T.quality * 100) + '%'],
      ],
      actions: [{ label: 'Ring the bell', kind: 'primary', value: 'ok' }],
    });
  } else {
    sfx.loss(); haptic.warn();
    await modal({
      tone: 'bad', kicker: 'Demotion',
      title: `Relegated to<br/>${T.name}`,
      body: `The board no longer meets the standard you had reached. Issuers notice these things `
          + `immediately, and so do the people who were about to file with you.`,
    });
  }
}

/* ═══ game over ═══════════════════════════════════════════════ */
async function endGame() {
  const cap = marketCap(S);
  sfx.gameover(); haptic.error(); flash('rgba(255,77,94,.5)'); shakeScreen(1.4);
  recordSession(S);
  clearSave();

  const grade =
    S.tierIndex >= 4 ? 'Legendary' :
    S.tierIndex >= 3 ? 'Formidable' :
    S.tierIndex >= 2 ? 'Respectable' :
    S.week >= 12 ? 'Serviceable' : 'Brief';

  const choice = await modal({
    tone: 'bad', kicker: S.over.reason === 'insolvent' ? 'Insolvency' : 'Regulator',
    title: S.over.title, titleClass: 'over-title bad',
    body: S.over.body,
    ledger: [
      { label: 'Weeks survived', value: num(S.week) },
      { label: 'Companies listed', value: num(S.stats.accepted) },
      { label: 'Applications refused', value: num(S.stats.rejected) },
      { label: 'Frauds kept off the board', value: num(S.stats.fraudsCaught), tone: 'up' },
      { label: 'Scandals on your watch', value: num(S.stats.scandals), tone: S.stats.scandals ? 'dn' : '' },
      { label: 'Peak market cap', value: money(S.stats.peakMcap) },
      { label: 'Final rank', value: grade, big: true },
    ],
    dismissible: false,
    actions: [
      { label: 'Open a new exchange', kind: 'primary', value: 'again' },
      { label: 'Back to the menu', kind: 'ghost', value: 'menu' },
    ],
  });

  stopGame();
  onExit?.(choice === 'again' ? 'again' : 'menu');
}

/* ═══ board sheet ═════════════════════════════════════════════ */
export function renderBoard() {
  const summary = $('#board-summary');
  const list = $('#board-list');
  const live = liveListings(S);
  const cap = marketCap(S);

  let wsum = 0, psum = 0;
  for (const l of live) { const w = l.price * l.shares; wsum += w; psum += w * (l.price / l.ipoPrice - 1); }
  const perf = wsum ? psum / wsum : 0;

  summary.innerHTML = '';
  summary.append(
    cell('SLOTS', `${live.length}/${slots(S)}`, slotsFree(S) === 0 ? 'var(--down)' : undefined),
    cell('MARKET CAP', money(cap)),
    cell('VS. ISSUE', pct(perf, 1), perf >= 0 ? 'var(--up)' : 'var(--down)'),
  );

  list.innerHTML = '';
  if (!S.listings.length) {
    list.append(el('div', { class: 'board-empty', html: 'Nothing trades here yet.<br/>Approve an application and the board fills.' }));
    return;
  }

  const sorted = [...S.listings].sort((a, b) => {
    if ((a.status === 'live') !== (b.status === 'live')) return a.status === 'live' ? -1 : 1;
    return b.price * b.shares - a.price * a.shares;
  });

  sorted.forEach((l, i) => {
    const ch = l.price / l.ipoPrice - 1;
    const dead = l.status !== 'live';
    const row = el('div', {
      class: 'listing' + (dead ? ' dead' : ''),
      style: { '--d': `${Math.min(i, 14) * 34}ms` },
    },
      el('div', { class: 'lt', style: chipStyle(l.ticker) + ';', text: l.ticker }),
      el('div', { class: 'lmid' },
        el('div', { class: 'ln', text: l.name }),
        el('div', { class: 'ls', text: dead ? (l.note || l.status) : `${l.sectorLabel} · ${money(l.price * l.shares)}` })),
      sparkline(l.history, { animate: i < 8 }),
      el('div', { class: 'lright' },
        el('div', { class: 'lp', text: price(l.price) }),
        el('div', { class: 'lc ' + (ch >= 0 ? 'up' : 'dn'), text: pct(ch, 1) })),
    );
    if (!dead) {
      row.classList.add('tappable');
      row.addEventListener('click', () => openListing(l));
    }
    list.append(row);
  });

  function cell(k, v, color) {
    const c = el('div', { class: 'bs-cell' }, el('span', { class: 'k', text: k }), el('span', { class: 'v', text: v }));
    if (color) c.querySelector('.v').style.color = color;
    return c;
  }
}

/** Detail sheet for one listing, with the option to throw it off the board. */
async function openListing(l) {
  const ch = l.price / l.ipoPrice - 1;
  const cost = forceDelistCost(S, l);
  const age = S.day - l.listedDay;

  const choice = await modal({
    tone: ch >= 0 ? 'good' : 'bad',
    kicker: `${l.ticker} · ${l.sectorLabel}`,
    title: l.name,
    body: `Listed on day ${l.listedDay}, ${age} session${age === 1 ? '' : 's'} ago at `
        + `<em>$${l.ipoPrice.toFixed(2)}</em>. ${l.scandal ? 'Currently under a cloud. ' : ''}`
        + `Removing it frees a slot, costs you standing, and is entirely your decision.`,
    stats: [
      ['Price', price(l.price)],
      ['Versus issue', pct(ch, 1)],
      ['Market cap', money(l.price * l.shares)],
      ['Peak / trough', `${price(l.peak)} / ${price(l.trough)}`],
    ],
    actions: [
      { label: 'Leave it listed', kind: 'primary', value: 'keep' },
      { label: 'Force delisting', meta: `−${cost.rep.toFixed(1)} standing · ${money(cost.cash)}`, kind: 'danger', value: 'delist' },
    ],
  });

  if (choice !== 'delist') return;
  forceDelist(S, l);
  sfx.loss(); haptic.warn();
  toast(`${l.ticker} removed from the board`, 'bad');
  saveGame(S, R);
  syncHud();
  tape.update(tapeItems());
  renderBoard();
}

/* ═══ pause sheet ═════════════════════════════════════════════ */
export function renderPause() {
  const wrap = $('#pause-stats');
  const st = S.stats;
  const rows = [
    ['CAPITAL', money(S.capital)],
    ['MARKET CAP', money(marketCap(S))],
    ['STANDING', Math.round(S.reputation) + '/100'],
    ['TIER', TIERS[S.tierIndex].name],
    ['SLOTS USED', `${liveListings(S).length}/${slots(S)}`],
    ['LISTED', num(st.accepted)],
    ['REFUSED', num(st.rejected)],
    ['SCANDALS', num(st.scandals)],
    ['FRAUDS DODGED', num(st.fraudsCaught)],
    ['FEES EARNED', money(st.feesListing + st.feesTrading + st.feesAnnual)],
    ['COSTS PAID', money(st.opexPaid)],
  ];
  wrap.innerHTML = '';
  for (const [k, v] of rows) {
    wrap.append(el('div', { class: 'pause-stat' },
      el('span', { class: 'k', text: k }), el('span', { class: 'v', text: v })));
  }
}
