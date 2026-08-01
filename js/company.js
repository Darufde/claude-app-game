/* ═══════════════════════════════════════════════════════════════
   company — IPO applicant generation

   Applicants are drawn as a *niche* first — a radiopharmacy shop, a
   self-storage REIT, a cold-chain operator — and the niche drives
   naming, flavour and risk character.

   The judgement the player makes is mostly about VALUE: is this
   company worth what it is asking, will it compound, does it fit the
   board you are building. Aggressive accounting exists but is the
   minority case, not the whole game.
   ═══════════════════════════════════════════════════════════════ */

import { rf, ri, pick, weighted, gauss, clamp, lerp, inv } from './util.js';
import { NICHES, SECTORS, FLAGS, UNDERWRITERS, makeTicker, REGIMES, tailsFor } from './data.js';
import { makeCompanyName } from './names.js';

let uid = 0;

function skewed(r, bias, tightness = 3) {
  let acc = 0;
  for (let i = 0; i < tightness; i++) acc += r();
  const base = acc / tightness;
  return clamp(base * 0.74 + bias * 0.48 + gauss(r) * 0.05, 0.03, 0.99);
}

export function generateApplicant(state, r) {
  const tier = state.tierDef;
  const regime = REGIMES[state.regime];
  const boost = state.upgrades ? state.upgradeEffects : null;
  const qualityBoost = (boost?.quality ?? 0);
  const clarity = clamp(boost?.clarity ?? 0, 0, 0.85);

  /* ── pick a niche, weighted by sector heat ─────────────── */
  const N = weighted(r, NICHES.map(n => {
    const heat = state.sectorHeat[n.sector] ?? 0;
    return [n, 1 + Math.max(0, heat) * 1.7];
  }));
  const S = SECTORS[N.sector];

  /* ── hidden truth ──────────────────────────────────────── */
  const quality = clamp(skewed(r, 0.52 + tier.quality + qualityBoost) + (N.grow ?? 0) * 0.55, 0.03, 0.99);

  // Aggressive accounting is now uncommon, and rarer still up the tiers.
  let fraud = 0;
  if (r() < 0.20) {
    fraud = clamp(Math.pow(r(), 1.5) * (0.30 + (1 - quality) * 0.55) - tier.quality * 0.16, 0, 0.85);
  }

  const vol = clamp(N.vol * regime.vol * rf(r, 0.68, 1.34), 0.28, 3.2);
  const hype = clamp(N.hype * rf(r, 0.5, 1.28) * (0.8 + quality * 0.3), 0.15, 2.4);
  const liquidity = clamp(N.liq * rf(r, 0.65, 1.35), 0.32, 2.4) * 0.0075;

  /* ── the ask ───────────────────────────────────────────── */
  const scale = tier.valMult * regime.valMult;
  const sizeRoll = weighted(r, [['micro', 24], ['small', 38], ['mid', 28], ['large', 10]]);
  const baseVal = { micro: 9e7, small: 3.2e8, mid: 1.1e9, large: 4.4e9 }[sizeRoll];
  const askValuation = Math.round(baseVal * scale * rf(r, .65, 1.7) * (.82 + quality * .46) / 1e6) * 1e6;

  const floatPct = clamp(rf(r, .12, .34), .08, .45);
  const raise = askValuation * floatPct;
  const ipoPrice = Math.round(rf(r, 9, 46) * 100) / 100;
  const shares = Math.round(askValuation / ipoPrice);

  /* ── fair value (hidden) ───────────────────────────────── */
  let fairMult = 0.52 + quality * 1.10;
  fairMult *= (1 - fraud * 0.60);
  fairMult *= (1 - clamp((hype - 1) * 0.18, -0.14, 0.32));
  fairMult = clamp(fairMult * rf(r, .92, 1.10), .10, 1.95);
  const fairValue = askValuation * fairMult;

  /* ── presented fundamentals ────────────────────────────────
     A data terminal narrows the gap between what is presented and
     what is true — that is what you are paying for.                */
  const distortion = (fraud * 0.55) * (1 - clarity);
  const presented = clamp(quality + distortion + gauss(r) * 0.05 * (1 - clarity * 0.5), 0.03, 1);

  const revMultiple = lerp(1.7, 13.5, presented) * (N.hype / 1.1) * rf(r, .78, 1.28);
  const revenue = Math.max(2e6, askValuation / Math.max(revMultiple, .6));
  const growth = clamp(lerp(-.06, 1.25, Math.pow(presented, 1.3)) * rf(r, .74, 1.3), -.25, 3.0);
  const margin = clamp(lerp(-.5, .42, presented) * rf(r, .78, 1.26) + rf(r, -.04, .04), -1.3, .62);
  const leverage = clamp(lerp(.68, .06, presented) * rf(r, .58, 1.55) + (N.sector === 're' ? .2 : 0), 0, 1.15);

  /* ── flags ─────────────────────────────────────────────── */
  const flags = [], hiddenFlags = [];
  for (const F of FLAGS) {
    let p = F.w * 0.185;
    p *= 1 + (F.q ?? 0) * (quality - 0.48) * 2.5;
    p *= 1 + (F.f ?? 0) * (fraud - 0.22) * 2.4;
    if (F.id === 'profitable') p = margin > .08 ? .92 : .02;
    if (F.id === 'burn')       p = margin < -.2 ? .88 : .03;
    if (F.id === 'netcash')    p = leverage < .12 ? .7 : .02;
    if (F.id === 'capex')      p = leverage > .55 ? .6 : .05;
    if (F.id === 'divid' && margin < .12) p = 0;
    if (F.id === 'thinfloat')  p = floatPct < .15 ? .65 : .03;
    if (F.id === 'solidbooks') p = fraud < .1 ? .58 : .02;
    if (F.id === 'undersold')  p = fairMult > 1.22 ? .62 : .01;
    if (F.id === 'aggressive') p = fraud > .45 ? .6 : .02;
    if (p <= 0) continue;
    if (r() < clamp(p, 0, .94)) (F.hidden ? hiddenFlags : flags).push(F.id);
  }
  while (flags.length > 4) flags.splice(Math.floor(r() * flags.length), 1);
  while (hiddenFlags.length > 3) hiddenFlags.splice(Math.floor(r() * hiddenFlags.length), 1);

  /* ── identity ──────────────────────────────────────────── */
  const name = makeCompanyName(r, N, tailsFor(N.sector), N.sector);
  const ticker = makeTicker(name, state.takenTickers, r);

  const uwTier = weighted(r, [
    [3, 6 + quality * 26 + tier.quality * 40],
    [2, 30],
    [1, 28 + fraud * 24],
  ]);
  const underwriter = pick(r, UNDERWRITERS.filter(u => u.tier === uwTier));
  const listingFee = Math.round(raise * state.balance.listingFeeRate);

  return {
    id: ++uid,
    name, ticker,
    sector: N.sector, sectorLabel: N.sectorLabel,
    niche: N.key, nicheLabel: N.label,
    blurb: pick(r, N.blurbs),
    underwriter: underwriter.name, uwTier,

    askValuation, floatPct, raise, ipoPrice, shares, listingFee,
    stats: { revenue, growth, margin, leverage, revMultiple },
    flags, hiddenFlags,

    _q: quality, _f: fraud, _vol: vol, _hype: hype, _liq: liquidity,
    _fair: fairValue, _fairMult: fairMult,

    audits: [], auditLevel: 0,
    renamed: false,
  };
}

/* ─── due diligence ────────────────────────────────────────── */

const OUTLOOK = [
  { min: .78, tone: 'good', text: 'Exceptional. Durable advantage, and the numbers understate it.' },
  { min: .62, tone: 'good', text: 'Strong operator in a good niche. We would be happy to own this.' },
  { min: .46, tone: 'warn', text: 'Competent but unremarkable. It will do roughly what the market does.' },
  { min: .30, tone: 'warn', text: 'Structurally challenged. Growth here is bought, not earned.' },
  { min: .00, tone: 'bad',  text: 'Weak franchise. We struggle to see what protects this business.' },
];

const INTEGRITY = [
  { max: .12, tone: 'good', text: 'Books reconcile cleanly. Nothing in the file gives us pause.' },
  { max: .30, tone: 'good', text: 'Minor presentational polish, nothing we would call material.' },
  { max: .50, tone: 'warn', text: 'Revenue recognition is stretched. Defensible, but only just.' },
  { max: .70, tone: 'warn', text: 'Several disclosures do not tie out. We would want more time.' },
  { max: 1.01, tone: 'bad', text: 'Material irregularities. We would not put our name on this.' },
];

/**
 * One stage of due diligence.
 * 1 → valuation, 2 → business quality, 3 → integrity + hidden disclosures.
 */
export function runAudit(co, r, clarity = 0) {
  co.auditLevel++;
  const lvl = co.auditLevel;
  const noise = 0.09 * (1 - clamp(clarity, 0, .8));

  if (lvl === 1) {
    const est = co._fair * (1 + gauss(r) * noise);
    const delta = est / co.askValuation - 1;
    const verdict =
      delta >  .18 ? { tone: 'good', word: 'a genuine discount' } :
      delta >  .02 ? { tone: 'good', word: 'fair, maybe cheap' } :
      delta > -.15 ? { tone: 'warn', word: 'full but not absurd' } :
      delta > -.40 ? { tone: 'bad',  word: 'materially rich' } :
                     { tone: 'bad',  word: 'a fantasy' };
    co.audits.push({
      kind: 'valuation', tone: verdict.tone, title: 'Valuation desk',
      text: `We mark them near __EST__ against an ask of __ASK__ — ${verdict.word}.`,
      est, ask: co.askValuation,
    });
  } else if (lvl === 2) {
    const read = OUTLOOK.find(o => co._q >= o.min) ?? OUTLOOK[OUTLOOK.length - 1];
    co.audits.push({ kind: 'outlook', tone: read.tone, title: 'Business review', text: read.text });
  } else {
    const read = INTEGRITY.find(i => co._f < i.max) ?? INTEGRITY[INTEGRITY.length - 1];
    let text = read.text;
    if (co.hiddenFlags.length) {
      const revealed = co.hiddenFlags.splice(0, co.hiddenFlags.length);
      co.flags.push(...revealed);
      co.revealedFlags = (co.revealedFlags || []).concat(revealed);
      text += ' Additional disclosures are tagged above.';
    }
    co.audits.push({ kind: 'deep', tone: read.tone, title: 'Full file review', text });
  }
  return co.audits[co.audits.length - 1];
}

/* ─── metric presentation ──────────────────────────────────── */
export const METRIC_VIEWS = [
  {
    key: 'growth', label: 'Revenue growth',
    fmt: (s) => (s.growth >= 0 ? '+' : '−') + Math.abs(s.growth * 100).toFixed(0) + '%',
    bar: (s) => inv(s.growth, -.3, 1.6),
    tone: (s) => s.growth > .35 ? 'g' : s.growth > .05 ? 'a' : 'r',
  },
  {
    key: 'margin', label: 'Operating margin',
    fmt: (s) => (s.margin >= 0 ? '+' : '−') + Math.abs(s.margin * 100).toFixed(0) + '%',
    bar: (s) => inv(s.margin, -.8, .5),
    tone: (s) => s.margin > .12 ? 'g' : s.margin > -.1 ? 'a' : 'r',
  },
  {
    key: 'leverage', label: 'Leverage',
    fmt: (s) => s.leverage.toFixed(2) + '×',
    bar: (s) => 1 - inv(s.leverage, 0, 1.05),
    tone: (s) => s.leverage < .28 ? 'g' : s.leverage < .62 ? 'a' : 'r',
  },
  {
    key: 'multiple', label: 'Ask / revenue',
    fmt: (s) => s.revMultiple.toFixed(1) + '×',
    bar: (s) => 1 - inv(s.revMultiple, 1, 16),
    tone: (s) => s.revMultiple < 4 ? 'g' : s.revMultiple < 9 ? 'a' : 'r',
  },
];
