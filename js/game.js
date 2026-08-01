/* ═══════════════════════════════════════════════════════════════
   game — the core loop controller
   ═══════════════════════════════════════════════════════════════ */

import {
  $, el, money, pct, price, num, clamp, wait, countTo, chipStyle, tween,
} from './util.js';
import {
  DAYS_PER_WEEK, prefs, liveListings, marketCap, dayOfWeek,
  saveGame, recordSession, clearSave, slots, slotsFree, canAccept, auditsMax,
  sectorSpread, applyRep,
} from './state.js';
import {
  TIERS, REGIMES, SECTORS, SECTOR_KEYS, UPGRADES, UPGRADE_KEYS,
  upgradeCost, validateName, validateTicker, MILESTONES,
} from './data.js';
import { drawPriceChart, drawIndexChart, drawSectorBars } from './charts.js';
import { burst, cannons, sparkle } from './celebrate.js';
import {
  advanceDay, acceptApplicant, rejectApplicant, refillQueue,
  forceDelist, forceDelistCost,
} from './sim.js';
import { runAudit } from './company.js';
import { createCard } from './card.js';
import {
  showScreen, openSheet, closeSheet, toast, modal, makeTape, namingSheet,
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
    // Name it before it prices, so the debut prints under your chosen ticker.
    await offerNaming(co);
    listResult = acceptApplicant(S, co, R);
    sfx.cash(); haptic.success();
    const p = listResult.pop;
    if (p > 0.05) sparkle(0.5, 0.55, 'green');
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

/**
 * Give the player the chance to rename an admitted company.
 * Skipped entirely if they've turned it off in settings.
 */
async function offerNaming(co) {
  if (!prefs.naming) return;
  const result = await namingSheet({
    company: co,
    taken: S.takenTickers,
    validateName, validateTicker, chipStyle,
  });
  if (!result) return;
  if (result.ticker !== co.ticker) {
    S.takenTickers.delete(co.ticker);
    S.takenTickers.add(result.ticker);
  }
  co.name = result.name;
  co.ticker = result.ticker;
  co.renamed = true;
  S.stats.named++;
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

  /* rescue / probation — setbacks, presented as such */
  if (rep.rescue) {
    sfx.alarm(); haptic.warn(); flash('rgba(232,187,98,.4)');
    await modal({
      tone: 'bad', kicker: 'Emergency financing', title: rep.rescue.title,
      body: rep.rescue.body,
      stats: [
        ['Facility drawn', money(rep.rescue.facility)],
        ['Standing', '−' + rep.rescue.repCost.toFixed(1)],
        ['Times rescued', String(rep.rescue.count)],
      ],
      actions: [{ label: 'Get back to work', kind: 'primary', value: 'ok' }],
    });
  }
  if (rep.probation) {
    sfx.alarm(); haptic.warn();
    await modal({
      tone: 'bad', kicker: 'Regulator', title: rep.probation.title, body: rep.probation.body,
      actions: [{ label: 'Understood', kind: 'primary', value: 'ok' }],
    });
  }

  if (rep.quarterClose) await presentQuarter(rep.quarterClose);
  if (rep.weekClose) await presentWeek(rep.weekClose, rep);
  if (rep.tierChange) await presentTier(rep.tierChange);
  for (const m of rep.milestones || []) await presentMilestone(m);

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
  ledger.push({ label: 'Due diligence restored', value: `${auditsMax(S)} reviews`, big: true, tone: 'up' });

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

async function presentMilestone(M) {
  sfx.tier(); haptic.success();
  cannons('mixed');
  await modal({
    tone: 'good', kicker: 'Milestone', title: M.title, titleClass: 'over-title',
    body: M.body,
    actions: [{ label: 'Onwards', kind: 'primary', value: 'ok' }],
  });
}

async function presentTier(tc) {
  const T = TIERS[tc.to];
  if (tc.promoted) {
    sfx.tier(); haptic.success(); flash('rgba(232,187,98,.45)'); bg.shock(1);
    cannons('gold');
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
    // Flash the row in the direction it moved on the last session.
    const moved = !dead && l.prevPrice
      ? (l.price > l.prevPrice * 1.004 ? ' moved-up' : l.price < l.prevPrice * 0.996 ? ' moved-dn' : '')
      : '';
    const row = el('div', {
      class: 'listing' + (dead ? ' dead' : '') + moved,
      style: { '--d': `${Math.min(i, 14) * 34}ms` },
    },
      el('div', { class: 'lt', style: chipStyle(l.ticker) + ';', text: l.ticker }),
      el('div', { class: 'lmid' },
        el('div', { class: 'ln', text: l.name }),
        el('div', { class: 'ls', text: dead ? (l.note || l.status) : `${l.nicheLabel || l.sectorLabel} · ${money(l.price * l.shares)}` })),
      sparkline(l.history, { animate: i < 8 }),
      el('div', { class: 'lright' },
        el('div', { class: 'lp', text: price(l.price) }),
        el('div', { class: 'lc ' + (ch >= 0 ? 'up' : 'dn'), text: pct(ch, 1) })),
    );
    row.classList.add('tappable');
    row.addEventListener('click', () => {
      sfx.tap(); haptic.light();
      renderCompany(l);
      openSheet('company');
    });
    list.append(row);
  });

  function cell(k, v, color) {
    const c = el('div', { class: 'bs-cell' }, el('span', { class: 'k', text: k }), el('span', { class: 'v', text: v }));
    if (color) c.querySelector('.v').style.color = color;
    return c;
  }
}

/* ═══ build sheet ═════════════════════════════════════════════ */
export function renderUpgrades() {
  const doc = $('#upgrades-doc');
  $('#upg-capital').textContent = money(S.capital);
  doc.innerHTML = '';

  doc.append(el('p', { class: 'upg-lede', text:
    'An exchange is infrastructure. Spend on it and every listing you take afterwards works harder.' }));

  UPGRADE_KEYS.forEach((key, i) => {
    const U = UPGRADES[key];
    const lvl = S.upgrades[key] | 0;
    const cost = upgradeCost(key, lvl);
    const maxed = lvl >= U.levels;
    const affordable = cost != null && S.capital >= cost;

    const pips = el('div', { class: 'upg-pips' });
    for (let n = 0; n < U.levels; n++) pips.append(el('i', { class: n < lvl ? 'on' : '' }));

    const row = el('div', {
      class: 'upg' + (maxed ? ' maxed' : '') + (!maxed && !affordable ? ' poor' : ''),
      style: { '--d': `${i * 45}ms` },
    },
      el('div', { class: 'upg-icon', text: U.icon }),
      el('div', { class: 'upg-mid' },
        el('div', { class: 'upg-name' }, el('span', { text: U.name }), pips),
        el('div', { class: 'upg-blurb', text: U.blurb }),
        lvl > 0 ? el('div', { class: 'upg-current', text: 'Now: ' + U.detail(lvl) }) : null,
        !maxed ? el('div', { class: 'upg-next', text: 'Next: ' + U.detail(lvl + 1) }) : null,
      ),
      el('button', {
        class: 'upg-buy' + (maxed ? ' done' : ''),
        disabled: maxed || !affordable,
      }, maxed ? el('span', { text: 'MAX' }) : el('span', { text: money(cost) })),
    );

    if (!maxed && affordable) {
      row.querySelector('.upg-buy').addEventListener('click', () => buyUpgrade(key));
    }
    doc.append(row);
  });

  const spent = S.stats.upgradeSpend;
  doc.append(el('div', { class: 'upg-foot', text: spent
    ? `${money(spent)} invested in this exchange so far.`
    : 'Nothing built yet. Trading fees pay for the first one.' }));
}

async function buyUpgrade(key) {
  const lvl = S.upgrades[key] | 0;
  const cost = upgradeCost(key, lvl);
  if (cost == null || S.capital < cost) return;

  S.capital -= cost;
  S.upgrades[key] = lvl + 1;
  S.stats.upgradeSpend += cost;
  // Buying analyst capacity should feel immediate, not next week.
  if (key === 'analysts') S.audits += 1;

  sfx.tier(); haptic.success();
  burst({ x: 0.5, y: 0.4, count: 40, palette: 'gold', power: 0.9 });
  toast(`${UPGRADES[key].name} → level ${lvl + 1}`, 'gold');

  saveGame(S, R);
  renderUpgrades();
  syncHud();
}

/* ═══ markets sheet ═══════════════════════════════════════════ */
export function renderMarkets() {
  const series = S.history.index || [];
  const last = series.length ? series[series.length - 1] : 100;
  const prev = series.length > 5 ? series[series.length - 6] : 100;
  const chg = prev ? (last - prev) / prev : 0;

  $('#index-value').textContent = last.toFixed(1);
  const chgEl = $('#index-change');
  chgEl.textContent = series.length > 5 ? pct(chg, 1) + ' / wk' : '—';
  chgEl.className = 'panel-change ' + (chg > 0 ? 'up' : chg < 0 ? 'dn' : '');
  $('#index-foot').textContent = series.length
    ? `${series.length} sessions · peak ${Math.max(...series).toFixed(1)}`
    : 'The index begins with your first listing.';

  drawIndexChart($('#chart-index'), series, { height: 150 });

  /* sector allocation */
  const buckets = {};
  for (const l of liveListings(S)) {
    buckets[l.sector] ||= { key: l.sector, label: SECTORS[l.sector]?.label ?? l.sector, value: 0, n: 0 };
    buckets[l.sector].value += l.price * l.shares;
    buckets[l.sector].n++;
  }
  const rows = Object.values(buckets);
  drawSectorBars($('#chart-sectors'), rows);
  $('#sector-foot').textContent = rows.length
    ? `${rows.length} sector${rows.length === 1 ? '' : 's'} represented · breadth lifts your standing`
    : 'Nothing listed yet.';

  /* sector heat */
  const heat = $('#heat-grid');
  heat.innerHTML = '';
  const sorted = SECTOR_KEYS
    .map(k => ({ k, v: S.sectorHeat[k] ?? 0 }))
    .sort((a, b) => b.v - a.v);
  for (const { k, v } of sorted) {
    const hue = SECTORS[k]?.hue ?? 210;
    const strength = clamp(Math.abs(v), 0, 1);
    const cell = el('div', { class: 'heat-cell' },
      el('span', { class: 'hk', text: SECTORS[k]?.short ?? k.toUpperCase() }),
      el('span', { class: 'hv', text: v > .06 ? 'HOT' : v < -.06 ? 'COLD' : '—' }),
    );
    cell.style.background = v > 0
      ? `hsla(${hue}, 65%, 50%, ${0.10 + strength * 0.34})`
      : `rgba(90,104,138,${0.06 + strength * 0.16})`;
    cell.style.borderColor = v > .06
      ? `hsla(${hue}, 70%, 60%, .5)` : 'rgba(255,255,255,.07)';
    heat.append(cell);
  }

  /* movers */
  const movers = $('#movers-list');
  movers.innerHTML = '';
  const live = liveListings(S).map(l => {
    const span = Math.min(5, l.history.length - 1);
    const from = l.history[l.history.length - 1 - span] || l.price;
    return { l, ret: (l.price - from) / from };
  }).sort((a, b) => b.ret - a.ret);

  if (!live.length) {
    movers.append(el('div', { class: 'board-empty', text: 'No listings to move yet.' }));
  } else {
    const show = [...live.slice(0, 3), ...live.slice(-3)]
      .filter((v, i, a) => a.indexOf(v) === i);
    for (const { l, ret } of show) {
      movers.append(el('div', { class: 'mover' },
        el('div', { class: 'mv-t', style: chipStyle(l.ticker) + ';', text: l.ticker }),
        el('div', { class: 'mv-n', text: l.name }),
        el('div', { class: 'mv-c ' + (ret >= 0 ? 'up' : 'dn'), text: pct(ret, 1) })));
    }
  }
}

/* ═══ company detail ══════════════════════════════════════════ */
let chartRange = 20;

export function renderCompany(l) {
  const doc = $('#company-doc');
  $('#co-heading').textContent = l.ticker;
  const ch = l.price / l.ipoPrice - 1;
  const dead = l.status !== 'live';
  doc.innerHTML = '';

  doc.append(
    el('div', { class: 'co-head' },
      el('div', { class: 'co-chip', style: chipStyle(l.ticker) + ';', text: l.ticker }),
      el('div', {},
        el('div', { class: 'co-name', text: l.name }),
        el('div', { class: 'co-sub', text: [l.nicheLabel, SECTORS[l.sector]?.label].filter((v, i, a) => v && a.indexOf(v) === i).join(' · ') })),
    ),
    el('div', { class: 'co-price' },
      el('div', { class: 'cp-now', text: price(l.price) }),
      el('div', { class: 'cp-chg ' + (ch >= 0 ? 'up' : 'dn'),
        text: `${pct(ch, 1)} vs issue ${price(l.ipoPrice)}` }),
    ),
  );

  const canvas = el('canvas', { class: 'co-chart' });
  const ranges = el('div', { class: 'range-row' });
  const opts = [['1W', 5], ['1M', 20], ['3M', 60], ['ALL', 'all']];
  for (const [label, val] of opts) {
    const b = el('button', {
      class: 'range' + (val === chartRange ? ' on' : ''),
      text: label,
    });
    b.addEventListener('click', () => {
      chartRange = val;
      sfx.tap(); haptic.select();
      [...ranges.children].forEach(c => c.classList.toggle('on', c === b));
      drawPriceChart(canvas, l, { range: val, height: 210, mode: 'candle' });
    });
    ranges.append(b);
  }
  doc.append(el('div', { class: 'panel chart-panel' }, canvas, ranges));
  requestAnimationFrame(() => drawPriceChart(canvas, l, { range: chartRange, height: 210, mode: 'candle' }));

  const rows = [
    ['Market cap', money(l.price * l.shares)],
    ['Shares out', l.shares > 1e6 ? (l.shares / 1e6).toFixed(1) + 'M' : num(l.shares)],
    ['Issue price', price(l.ipoPrice)],
    ['All-time high', price(l.peak)],
    ['All-time low', price(l.trough)],
    ['Listed on', `day ${l.listedDay}`],
    ['Sessions traded', String(Math.max(0, (l.history?.length ?? 1) - 1))],
  ];
  if (l.renamed) rows.push(['Named by you', 'yes']);
  if (dead) rows.push(['Status', l.note || l.status]);

  const stats = el('div', { class: 'co-stats' });
  rows.forEach(([k, v], i) => stats.append(
    el('div', { class: 'co-stat', style: { '--d': `${i * 32}ms` } },
      el('span', { class: 'k', text: k }), el('span', { class: 'v', text: v }))));
  doc.append(el('div', { class: 'panel' }, stats));

  if (!dead) {
    const cost = forceDelistCost(S, l);
    const actions = el('div', { class: 'co-actions' });

    const rename = el('button', { class: 'btn btn-ghost btn-wide' },
      el('span', { class: 'btn-label', text: 'Rename listing' }));
    rename.addEventListener('click', async () => {
      sfx.tap();
      const res = await namingSheet({
        company: l, taken: S.takenTickers, validateName, validateTicker, chipStyle,
      });
      if (!res) return;
      if (res.ticker !== l.ticker) { S.takenTickers.delete(l.ticker); S.takenTickers.add(res.ticker); }
      if (!l.renamed) S.stats.named++;
      l.name = res.name; l.ticker = res.ticker; l.renamed = true;
      saveGame(S, R);
      toast(`Now trading as ${l.ticker}`, 'gold');
      renderCompany(l); renderBoard(); tape.update(tapeItems());
    });

    const remove = el('button', { class: 'btn btn-danger btn-wide' },
      el('span', { class: 'btn-label', text: 'Force delisting' }),
      el('span', { class: 'btn-meta', text: `−${cost.rep.toFixed(1)} standing · ${money(cost.cash)}` }));
    remove.addEventListener('click', async () => {
      sfx.tap();
      const c = await modal({
        tone: 'bad', kicker: 'Confirm', title: `Remove ${l.ticker}?`,
        body: `This frees a board slot immediately. ${ch >= 0
          ? 'It is trading above issue, which makes this an expensive thing to do.'
          : 'It is below issue, so the market will not argue much.'}`,
        actions: [
          { label: 'Remove it', kind: 'danger', value: 'yes' },
          { label: 'Leave it listed', kind: 'primary', value: 'no' },
        ],
      });
      if (c !== 'yes') return;
      forceDelist(S, l);
      sfx.loss(); haptic.warn();
      toast(`${l.ticker} removed from the board`, 'bad');
      saveGame(S, R); syncHud(); tape.update(tapeItems());
      closeSheet(); renderBoard();
    });

    actions.append(rename, remove);
    doc.append(actions);
  }
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
