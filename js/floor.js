/* ═══════════════════════════════════════════════════════════════
   floor — the dashboard, funds and investor screens

   The exchange is the game; the filings deck is one activity inside
   it. This module owns everything you look at when you are *not*
   deciding on a company.
   ═══════════════════════════════════════════════════════════════ */

import { $, el, money, pct, price, num, clamp, chipStyle, countTo } from './util.js';
import {
  liveListings, marketCap, dayOfWeek, slots, slotsFree, saveGame, prefs,
} from './state.js';
import { TIERS, REGIMES, SECTORS, SECTOR_KEYS, UPGRADE_KEYS } from './data.js';
import {
  MANDATES, MANDATE_KEYS, SIZE_BANDS, createFund, fundSetupCost,
  previewMandate, fundReturn, fundVol, totalAum, suggestedFee, FEE_RANGE,
  constituents,
} from './funds.js';
import { investorSummary, COHORTS } from './investors.js';
import { suggestFundName } from './names.js';
import { validateName, validateTicker } from './data.js';
import { drawIndexChart, drawPriceChart } from './charts.js';
import { toast, modal, openSheet, closeSheet } from './ui.js';
import { sfx } from './audio.js';
import { haptic } from './haptics.js';
import { burst } from './celebrate.js';

let S = null, R = null, hooks = {};

export function bindFloor(state, rng, h = {}) { S = state; R = rng; hooks = h; }

/* ═══ dashboard ═══════════════════════════════════════════════ */
export function renderFloor() {
  const body = $('#floor-body');
  if (body) body.scrollTop = 0;
  const idx = S.history.index || [];
  const last = idx.length ? idx[idx.length - 1] : 100;
  const prev = idx.length > 5 ? idx[idx.length - 6] : 100;
  const chg = prev ? (last - prev) / prev : 0;
  const aum = totalAum(S);

  $('#floor-name').textContent = S.name;
  $('#floor-tier').textContent = TIERS[S.tierIndex].name.toUpperCase();
  $('#floor-index').textContent = last.toFixed(1);
  const chgEl = $('#floor-index-chg');
  chgEl.textContent = idx.length > 5 ? pct(chg, 1) : '—';
  chgEl.className = 'panel-change ' + (chg > 0 ? 'up' : chg < 0 ? 'dn' : '');
  $('#floor-session').textContent = `WEEK ${S.week} · DAY ${dayOfWeek(S)} · ${REGIMES[S.regime].label.toUpperCase()}`;

  // No point reserving a full chart before the first listing.
  drawIndexChart($('#floor-chart'), idx, { height: idx.length > 1 ? 132 : 54 });

  /* headline figures */
  const stats = $('#floor-stats');
  stats.innerHTML = '';
  const cells = [
    ['CAPITAL', money(S.capital), S.capital < 0 ? 'var(--down)' : null],
    ['MARKET CAP', money(marketCap(S)), null],
    ['AUM', money(aum), aum > 0 ? 'var(--gold-hi)' : null],
    ['STANDING', Math.round(S.reputation) + '/100', null],
  ];
  cells.forEach(([k, v, colour], i) => {
    const c = el('div', { class: 'fstat', style: { '--d': `${i * 45}ms` } },
      el('span', { class: 'k', text: k }), el('span', { class: 'v', text: v }));
    if (colour) c.querySelector('.v').style.color = colour;
    stats.append(c);
  });

  /* navigation summaries */
  // Relegation can leave you holding more listings than your tier allows —
  // legitimate, but it needs to read as over-capacity rather than a glitch.
  const nLive = liveListings(S).length, cap = slots(S);
  const boardEl = $('#fn-board');
  boardEl.textContent = `${nLive}/${cap}`;
  boardEl.style.color = nLive > cap ? 'var(--down)' : nLive === cap ? 'var(--gold)' : '';
  $('#fn-funds').textContent = S.funds.length ? `${S.funds.length} live` : 'None';
  $('#fn-markets').textContent = `${new Set(liveListings(S).map(l => l.sector)).size} sectors`;
  const built = Object.values(S.upgrades).reduce((a, b) => a + b, 0);
  $('#fn-build').textContent = built ? `${built} built` : 'Nothing';

  const free = slotsFree(S);
  $('#filings-meta').textContent = free > 0
    ? `${free} slot${free === 1 ? '' : 's'} open · ${S.audits} review${S.audits === 1 ? '' : 's'} left`
    : free < 0
      ? `Over capacity by ${-free} — remove a listing to admit anything`
      : 'Board is full — you can still pass on filings';

  /* the wire */
  const feed = $('#floor-feed');
  feed.innerHTML = '';
  // Rejections are the majority of the log and none of the news.
  const entries = (S.log || []).filter(e => e.kind !== 'reject').slice(0, 8);
  if (!entries.length) {
    feed.append(el('div', { class: 'feed-empty', text: 'Nothing has happened yet. Open the session.' }));
  } else {
    entries.forEach((e, i) => feed.append(
      el('div', { class: `feed-row k-${e.kind}`, style: { '--d': `${i * 40}ms` } },
        el('span', { class: 'fd-day', text: 'D' + e.day }),
        el('span', { class: 'fd-t', text: e.text }))));
  }
}

/* ═══ funds list ══════════════════════════════════════════════ */
export function renderFunds() {
  const doc = $('#funds-doc');
  $('#funds-aum').textContent = money(totalAum(S));
  doc.innerHTML = '';

  doc.append(el('p', { class: 'upg-lede', text:
    'A fund holds every company on your board that fits its mandate — including the ones you have '
    + 'not admitted yet. Investors allocate to what they like; you charge a fee on whatever stays.' }));

  if (!S.funds.length) {
    doc.append(el('div', { class: 'board-empty', html:
      'No funds yet.<br/>Launch one and the money can find you.' }));
  }

  S.funds.forEach((f, i) => {
    const M = MANDATES[f.mandate];
    const ret = fundReturn(f, 20);
    const row = el('div', { class: 'fund tappable', style: { '--d': `${i * 45}ms` } },
      el('div', { class: 'fund-chip', style: chipStyle(f.ticker) + ';', text: f.ticker }),
      el('div', { class: 'fund-mid' },
        el('div', { class: 'fund-name', text: f.name }),
        el('div', { class: 'fund-sub', text:
          `${M?.short ?? f.mandate} · ${f.holdingsCount ?? 0} holdings · ${(f.feeBps / 100).toFixed(2)}% fee` })),
      el('div', { class: 'fund-right' },
        el('div', { class: 'fund-aum', text: money(f.aum) }),
        el('div', { class: 'fund-ret ' + (ret >= 0 ? 'up' : 'dn'), text: pct(ret, 1) })),
    );
    row.addEventListener('click', () => { sfx.tap(); haptic.light(); renderFund(f); openSheet('fund'); });
    doc.append(row);
  });

  const launch = el('button', { class: 'btn btn-primary btn-wide', style: { marginTop: '18px' } },
    el('span', { class: 'btn-label', text: 'Launch a Fund' }),
    el('span', { class: 'btn-meta', text: `From ${money(fundSetupCost(S, 'sector'))}` }));
  launch.addEventListener('click', () => { sfx.tap(); launchFundFlow(); });
  doc.append(launch);

  if (S.funds.length) {
    doc.append(el('div', { class: 'upg-foot', text:
      `${money(S.stats.feesManagement || 0)} collected in management fees so far.` }));
  }
}

/* ═══ fund detail ═════════════════════════════════════════════ */
export function renderFund(f) {
  const doc = $('#fund-doc');
  const M = MANDATES[f.mandate];
  $('#fund-heading').textContent = f.ticker;
  doc.innerHTML = '';

  const ret = fundReturn(f, 20);
  const vol = fundVol(f, 20);

  doc.append(
    el('div', { class: 'co-head' },
      el('div', { class: 'co-chip', style: chipStyle(f.ticker) + ';', text: f.ticker }),
      el('div', {},
        el('div', { class: 'co-name', text: f.name }),
        el('div', { class: 'co-sub', text: M?.label ?? f.mandate }))),
    el('div', { class: 'co-price' },
      el('div', { class: 'cp-now', text: f.nav.toFixed(2) }),
      el('div', { class: 'cp-chg ' + (ret >= 0 ? 'up' : 'dn'), text: `${pct(ret, 1)} over 20 sessions` })),
  );

  const canvas = el('canvas');
  doc.append(el('div', { class: 'panel chart-panel' }, canvas));
  requestAnimationFrame(() => drawIndexChart(canvas, f.navHistory, { height: 170 }));

  const holdings = constituents(S, f);
  const rows = [
    ['Assets under management', money(f.aum)],
    ['Peak AUM', money(f.peakAum || 0)],
    ['Management fee', (f.feeBps / 100).toFixed(2) + '%'],
    ['Fees earned', money(f.feesEarned || 0)],
    ['Holdings', num(holdings.length)],
    ['Volatility', (vol * 100).toFixed(0) + '%'],
    ['Launched', `day ${f.inceptionDay}`],
  ];
  const stats = el('div', { class: 'co-stats' });
  rows.forEach(([k, v], i) => stats.append(
    el('div', { class: 'co-stat', style: { '--d': `${i * 30}ms` } },
      el('span', { class: 'k', text: k }), el('span', { class: 'v', text: v }))));
  doc.append(el('div', { class: 'panel' }, stats));

  if (holdings.length) {
    const hl = el('div', { class: 'panel' },
      el('div', { class: 'panel-head' }, el('div', { class: 'panel-k', text: 'CONSTITUENTS' })));
    const sorted = [...holdings].sort((a, b) => b.price * b.shares - a.price * a.shares).slice(0, 12);
    const basket = holdings.reduce((t, l) => t + l.price * l.shares, 0) || 1;
    for (const l of sorted) {
      const w = (l.price * l.shares) / basket;
      hl.append(el('div', { class: 'holding' },
        el('div', { class: 'mv-t', style: chipStyle(l.ticker) + ';', text: l.ticker }),
        el('div', { class: 'mv-n', text: l.name }),
        el('div', { class: 'hold-w', text: (w * 100).toFixed(1) + '%' })));
    }
    if (holdings.length > 12) {
      hl.append(el('div', { class: 'panel-foot', text: `and ${holdings.length - 12} more` }));
    }
    doc.append(hl);
  }

  /* fee adjustment — the core lever on a fund */
  const feeWrap = el('div', { class: 'panel' },
    el('div', { class: 'panel-head' }, el('div', { class: 'panel-k', text: 'MANAGEMENT FEE' })));
  const feeVal = el('div', { class: 'fee-val', text: (f.feeBps / 100).toFixed(2) + '%' });
  const slider = el('input', {
    type: 'range', class: 'fee-slider',
    min: String(FEE_RANGE.min), max: String(FEE_RANGE.max), step: '1', value: String(f.feeBps),
  });
  slider.addEventListener('input', () => { feeVal.textContent = (slider.value / 100).toFixed(2) + '%'; });
  slider.addEventListener('change', () => {
    f.feeBps = clamp(parseInt(slider.value, 10), FEE_RANGE.min, FEE_RANGE.max);
    sfx.nav(); haptic.select();
    toast(`${f.ticker} fee set to ${(f.feeBps / 100).toFixed(2)}%`, 'gold');
    saveGame(S, R);
  });
  feeWrap.append(feeVal, slider, el('div', { class: 'panel-foot', text:
    'A higher fee earns more on every dollar, and repels the money that reads the fine print.' }));
  doc.append(feeWrap);

  const rename = el('button', { class: 'btn btn-ghost btn-wide' },
    el('span', { class: 'btn-label', text: 'Rename fund' }));
  rename.addEventListener('click', async () => {
    sfx.tap();
    const res = await hooks.nameSheet?.({ name: f.name, ticker: f.ticker });
    if (!res) return;
    if (res.ticker !== f.ticker) { S.takenTickers.delete(f.ticker); S.takenTickers.add(res.ticker); }
    f.name = res.name; f.ticker = res.ticker;
    saveGame(S, R); renderFund(f); renderFunds();
  });
  doc.append(rename);
}

/* ═══ fund creation ═══════════════════════════════════════════ */
async function launchFundFlow() {
  /* 1 — mandate */
  const opts = MANDATE_KEYS.map(k => {
    const M = MANDATES[k];
    const p = M.needsArg ? null : previewMandate(S, k, null);
    return {
      label: M.label,
      description: p ? `${M.blurb} Would hold ${p.n} companies today.` : M.blurb,
      value: k,
    };
  });
  const mandate = await modal({
    tone: 'neu', kicker: 'New fund', title: 'What should it track?',
    body: 'The mandate is permanent. Anything you list later that fits will join automatically.',
    actions: [...opts.map(o => ({ label: o.label, meta: o.description.slice(0, 74), kind: 'ghost', value: o.value })),
      { label: 'Not now', kind: 'primary', value: 'cancel' }],
  });
  if (!mandate || mandate === 'cancel' || mandate === 'dismiss') return;

  /* 2 — argument, where the mandate needs one */
  const M = MANDATES[mandate];
  let arg = null;
  if (M.needsArg === 'sector') {
    const withCounts = SECTOR_KEYS.map(k => ({ k, ...previewMandate(S, 'sector', k) }))
      .sort((a, b) => b.n - a.n).slice(0, 8);
    const pickSector = await modal({
      tone: 'neu', kicker: 'Mandate', title: 'Which sector?',
      body: 'Sectors with nothing listed can still be launched — the fund simply waits.',
      actions: [...withCounts.map(x => ({
        label: SECTORS[x.k].label, meta: `${x.n} listed · ${money(x.cap)}`, kind: 'ghost', value: x.k,
      })), { label: 'Cancel', kind: 'primary', value: 'cancel' }],
    });
    if (!pickSector || pickSector === 'cancel' || pickSector === 'dismiss') return;
    arg = pickSector;
  } else if (M.needsArg === 'size') {
    const bands = Object.entries(SIZE_BANDS).map(([k, b]) => ({ k, b, ...previewMandate(S, 'size', k) }));
    const pickBand = await modal({
      tone: 'neu', kicker: 'Mandate', title: 'Which size band?',
      body: 'Companies move between bands as they grow, and the fund follows them.',
      actions: [...bands.map(x => ({
        label: x.b.label, meta: `${x.n} listed · ${money(x.cap)}`, kind: 'ghost', value: x.k,
      })), { label: 'Cancel', kind: 'primary', value: 'cancel' }],
    });
    if (!pickBand || pickBand === 'cancel' || pickBand === 'dismiss') return;
    arg = pickBand;
  }

  /* 3 — cost check */
  const cost = fundSetupCost(S, mandate);
  if (S.capital < cost) {
    toast(`Launching that costs ${money(cost)} — you cannot cover it.`, 'bad');
    return;
  }

  /* 4 — name it */
  const label = M.name(arg);
  const suggested = suggestFundName(S.name, label, R);
  const res = await hooks.nameSheet?.({
    name: suggested,
    ticker: null,
    kicker: 'Launching a fund',
    title: 'Name the product',
    body: `A ${label.toLowerCase()} fund. Setup and seed costs ${money(cost)}.`,
    confirm: 'Launch it',
  });
  if (!res) return;

  const f = createFund(S, {
    mandate, arg, name: res.name, ticker: res.ticker,
    feeBps: suggestedFee(mandate),
  });
  if (!f) return;

  S.capital -= cost;
  S.takenTickers.add(f.ticker);
  S.stats.fundsLaunched++;

  sfx.bell(); haptic.success();
  burst({ x: 0.5, y: 0.42, count: 60, palette: 'gold' });
  toast(`${f.ticker} is live`, 'gold');
  saveGame(S, R);
  renderFunds();
  hooks.afterChange?.();
}

/* ═══ investors ═══════════════════════════════════════════════ */
export function renderInvestors() {
  const doc = $('#investors-doc');
  const sum = investorSummary(S);
  doc.innerHTML = '';

  doc.append(el('p', { class: 'upg-lede', text:
    'Five kinds of money watch your funds. They score every product each week on performance, '
    + 'volatility, fee and your standing — then move accordingly.' }));

  doc.append(el('div', { class: 'panel' },
    el('div', { class: 'panel-head' },
      el('div', {},
        el('div', { class: 'panel-k', text: 'ALLOCATED TO YOU' }),
        el('div', { class: 'panel-v', text: money(sum.deployed) })),
      el('div', { class: 'panel-change', text: money(sum.dryPowder) + ' idle' }))));

  if (!S.funds.length) {
    doc.append(el('div', { class: 'board-empty', html:
      'You have no funds for them to buy.<br/>Launch one and they will start scoring it.' }));
  }

  for (const p of sum.pools) {
    const share = sum.deployed > 0 ? p.allocated / sum.deployed : 0;
    const mood = p.mood > 0.15 ? 'keen' : p.mood < -0.15 ? 'cautious' : 'neutral';
    doc.append(el('div', { class: 'panel investor' },
      el('div', { class: 'inv-top' },
        el('div', { class: 'inv-name', text: p.name }),
        el('div', { class: 'inv-amt', text: money(p.allocated) })),
      el('div', { class: 'inv-blurb', text: p.blurb }),
      el('div', { class: 'inv-bar' }, el('i', { style: { width: (share * 100).toFixed(1) + '%' } })),
      el('div', { class: 'inv-foot', text: `${money(p.pool)} uncommitted · currently ${mood}` }),
    ));
  }
}
