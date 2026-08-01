/* ═══════════════════════════════════════════════════════════════
   funds — index products launched by the exchange

   A fund declares a mandate. Every listing that matches is a
   constituent, automatically and forever — so a fund launched in
   week three quietly absorbs companies you admit in week thirty.

   The fund's NAV is a chained cap-weighted index of its holdings.
   Investors allocate into it (see investors.js), and you charge a
   management fee on whatever they leave with you.
   ═══════════════════════════════════════════════════════════════ */

import { clamp, money, pick } from './util.js';
import { SECTORS, SECTOR_KEYS } from './industries.js';

/* ─── size bands, by market capitalisation ─────────────────── */
export const SIZE_BANDS = {
  large: { label: 'Large Cap', min: 8e9,  max: Infinity },
  mid:   { label: 'Mid Cap',   min: 1.2e9, max: 8e9 },
  small: { label: 'Small Cap', min: 0,     max: 1.2e9 },
};

/* ─── mandate catalogue ────────────────────────────────────────
   `matches` is evaluated against a live listing. `screenFlags` are
   read from the listing's disclosure tags at admission, which is
   the only thing the player could see when they chose it.        */
export const MANDATES = {
  index: {
    label: 'Total Market', short: 'Total',
    blurb: 'Every company on the board, weighted by size. The simplest product you can sell, and the one investors trust most.',
    baseFee: 12, appeal: 1.30, setup: 900_000,
    matches: () => true,
    name: () => 'Total Market',
  },
  sector: {
    label: 'Single Sector', short: 'Sector',
    blurb: 'One sector, all of it. Concentrated, volatile, and exactly what a specialist allocator wants.',
    baseFee: 35, appeal: 0.86, setup: 700_000,
    needsArg: 'sector',
    matches: (l, arg) => l.sector === arg,
    name: (arg) => SECTORS[arg]?.label ?? 'Sector',
  },
  size: {
    label: 'Size Band', short: 'Size',
    blurb: 'Large, mid or small companies. Investors use these to tune how much risk they are running.',
    baseFee: 22, appeal: 1.00, setup: 700_000,
    needsArg: 'size',
    matches: (l, arg) => {
      const b = SIZE_BANDS[arg]; if (!b) return false;
      const cap = l.price * l.shares;
      return cap >= b.min && cap < b.max;
    },
    name: (arg) => SIZE_BANDS[arg]?.label ?? 'Size',
  },
  income: {
    label: 'Income', short: 'Income',
    blurb: 'Profitable companies that pay out. Slow, dull, and adored by anyone with liabilities to meet.',
    baseFee: 28, appeal: 1.06, setup: 800_000,
    matches: (l) => l.screen?.income === true,
    name: () => 'Income',
  },
  growth: {
    label: 'Growth', short: 'Growth',
    blurb: 'The fastest-growing names on your board. Spectacular in a bull market, and the first thing sold in a bad one.',
    baseFee: 40, appeal: 0.94, setup: 800_000,
    matches: (l) => l.screen?.growth === true,
    name: () => 'Growth',
  },
  quality: {
    label: 'Quality', short: 'Quality',
    blurb: 'Companies with a moat, a backlog or real recurring revenue. The screen that ages best.',
    baseFee: 30, appeal: 1.12, setup: 900_000,
    matches: (l) => l.screen?.quality === true,
    name: () => 'Quality',
  },
};

export const MANDATE_KEYS = Object.keys(MANDATES);

/**
 * Screening tags, computed once when a company lists, from the same
 * disclosures the player saw on the card. Stored on the listing so a
 * fund's membership never depends on hidden state.
 */
export function screenFor(co) {
  const f = new Set(co.flags || []);
  return {
    income:  f.has('divid') || (f.has('profitable') && (co.stats?.margin ?? 0) > 0.14),
    growth:  (co.stats?.growth ?? 0) > 0.42,
    quality: f.has('moat') || f.has('backlog') || f.has('recurring') || f.has('leader'),
  };
}

/* ─── construction ─────────────────────────────────────────── */
let fundUid = 0;

export function createFund(s, { mandate, arg, name, ticker, feeBps }) {
  const M = MANDATES[mandate];
  if (!M) return null;
  const f = {
    id: ++fundUid,
    name, ticker,
    mandate, arg: arg ?? null,
    feeBps: clamp(Math.round(feeBps), 2, 120),
    inceptionDay: s.day,
    nav: 100,
    navHistory: [100],
    aum: 0,
    flows: [],
    holdings: [],
    peakAum: 0,
    feesEarned: 0,
  };
  s.funds.push(f);
  return f;
}

export function fundSetupCost(s, mandate) {
  const M = MANDATES[mandate];
  if (!M) return 0;
  // Later funds cost more to launch — legal, custody, market-making.
  return Math.round(M.setup * (1 + s.funds.length * 0.35));
}

/* ─── membership + valuation ───────────────────────────────── */

export function constituents(s, f) {
  const M = MANDATES[f.mandate];
  if (!M) return [];
  return s.listings.filter(l => l.status === 'live' && M.matches(l, f.arg));
}

/** Total market value of a fund's constituents. */
export function fundBasket(s, f) {
  let cap = 0, n = 0;
  for (const l of constituents(s, f)) { cap += l.price * l.shares; n++; }
  return { cap, n };
}

/**
 * Advance every fund's NAV by the cap-weighted return of the
 * constituents present in both sessions — the same chaining rule the
 * exchange index uses, so membership changes never fake a return.
 */
export function stepFunds(s) {
  for (const f of s.funds) {
    const M = MANDATES[f.mandate];
    if (!M) continue;
    let num = 0, den = 0, n = 0;
    for (const l of s.listings) {
      if (l.status !== 'live' || !M.matches(l, f.arg)) continue;
      n++;
      // Needs a prior session to contribute a return.
      if (s.day - l.listedDay < 1 || !l.prevPrice) continue;
      den += l.prevPrice * l.shares;
      num += l.price * l.shares;
    }
    if (den > 0) f.nav = clamp(f.nav * (num / den), 0.01, 1e7);
    f.holdingsCount = n;
    f.navHistory.push(Math.round(f.nav * 100) / 100);
    if (f.navHistory.length > 260) f.navHistory.shift();
    // AUM rides the NAV as well as flows.
    if (den > 0 && f.aum > 0) f.aum *= (num / den);
    f.peakAum = Math.max(f.peakAum || 0, f.aum);
  }
}

/** Daily management fee income across every fund. */
export function collectFundFees(s) {
  let total = 0;
  for (const f of s.funds) {
    if (f.aum <= 0) continue;
    const fee = f.aum * (f.feeBps / 10000) / 260;
    f.feesEarned += fee;
    total += fee;
  }
  const rounded = Math.round(total);
  s.capital += rounded;
  s.stats.feesManagement = (s.stats.feesManagement || 0) + rounded;
  return rounded;
}

export const totalAum = (s) => (s.funds || []).reduce((t, f) => t + f.aum, 0);

/** Trailing return over `days` sessions, as a fraction. */
export function fundReturn(f, days = 20) {
  const h = f.navHistory;
  if (!h || h.length < 2) return 0;
  const from = h[Math.max(0, h.length - 1 - days)];
  return from > 0 ? f.nav / from - 1 : 0;
}

/** Realised volatility of daily NAV moves, annualised-ish. */
export function fundVol(f, days = 20) {
  const h = f.navHistory;
  if (!h || h.length < 4) return 0.2;
  const slice = h.slice(-Math.min(days, h.length));
  const rets = [];
  for (let i = 1; i < slice.length; i++) {
    if (slice[i - 1] > 0) rets.push(slice[i] / slice[i - 1] - 1);
  }
  if (!rets.length) return 0.2;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const varr = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  return Math.sqrt(varr) * Math.sqrt(260);
}

/** A suggested fee, and the range the UI lets the player pick from. */
export const FEE_RANGE = { min: 2, max: 90 };
export function suggestedFee(mandate) {
  return MANDATES[mandate]?.baseFee ?? 15;
}

/** Human summary of what a mandate would hold right now. */
export function previewMandate(s, mandate, arg) {
  const M = MANDATES[mandate];
  if (!M) return { n: 0, cap: 0 };
  let cap = 0, n = 0;
  for (const l of s.listings) {
    if (l.status !== 'live' || !M.matches(l, arg)) continue;
    cap += l.price * l.shares; n++;
  }
  return { n, cap };
}
