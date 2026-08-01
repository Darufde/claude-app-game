/* ═══════════════════════════════════════════════════════════════
   company — IPO applicant generation

   Every applicant has a HIDDEN truth (quality, fraud, volatility,
   hype) and a VISIBLE prospectus derived from it *with distortion*.
   Fraud inflates the presented numbers — so a spotless prospectus
   is genuinely ambiguous, and that ambiguity is the game.
   ═══════════════════════════════════════════════════════════════ */

import { rf, ri, pick, weighted, gauss, clamp, lerp, inv } from './util.js';
import { SECTORS, SECTOR_KEYS, FLAGS, UNDERWRITERS, makeTicker, REGIMES } from './data.js';

let uid = 0;

/** Beta-ish draw in [0,1] shaped by `bias` (0 = poor, 1 = excellent). */
function skewed(r, bias, tightness = 2) {
  let acc = 0;
  for (let i = 0; i < tightness; i++) acc += r();
  const base = acc / tightness;                    // ~centred on .5
  return clamp(base * 0.72 + bias * 0.5 + gauss(r) * 0.06, 0.02, 0.99);
}

export function generateApplicant(state, r) {
  const tier = state.tierDef;
  const regime = REGIMES[state.regime];

  const sectorKey = weighted(r, SECTOR_KEYS.map(k => {
    const heat = state.sectorHeat[k] ?? 0;
    return [k, 1 + Math.max(0, heat) * 1.6];
  }));
  const S = SECTORS[sectorKey];

  /* ── hidden truth ──────────────────────────────────────── */
  const quality = skewed(r, 0.5 + tier.quality, 3);

  // Fraud is anti-correlated with quality but never impossible.
  const fraudBase = clamp(1 - quality, 0, 1);
  let fraud = clamp(Math.pow(r(), 2.15) * (0.34 + fraudBase * 0.9) - tier.quality * 0.22, 0, 0.97);
  if (r() < 0.045) fraud = clamp(fraud + rf(r, 0.35, 0.6), 0, 0.99); // rare wolf in good clothing

  const vol = clamp(S.vol * regime.vol * rf(r, 0.62, 1.42), 0.25, 3.2);
  const hype = clamp(S.hype * rf(r, 0.45, 1.3) * (0.75 + quality * 0.35 + fraud * 0.5), 0.15, 2.6);
  const liquidity = clamp(S.liq * rf(r, 0.6, 1.4), 0.3, 2.4) * 0.0075;

  /* ── the ask ───────────────────────────────────────────── */
  const scale = tier.valMult * regime.valMult;
  const sizeRoll = weighted(r, [['micro', 26], ['small', 38], ['mid', 26], ['large', 10]]);
  const baseVal = { micro: 9e7, small: 3.2e8, mid: 1.1e9, large: 4.4e9 }[sizeRoll];
  const askValuation = Math.round(baseVal * scale * rf(r, 0.62, 1.75) * (0.8 + quality * 0.5) / 1e6) * 1e6;

  const floatPct = clamp(rf(r, 0.11, 0.34) + (fraud > 0.5 ? rf(r, 0, 0.09) : 0), 0.08, 0.45);
  const raise = askValuation * floatPct;

  const ipoPrice = Math.round(rf(r, 9, 46) * 100) / 100;
  const shares = Math.round(askValuation / ipoPrice);

  /* ── fair value (hidden) ───────────────────────────────── */
  // >1 means the ask is a bargain; <1 means they're overreaching.
  let fairMult = 0.46 + quality * 1.16;
  fairMult *= (1 - fraud * 0.72);
  fairMult *= (1 - clamp((hype - 1) * 0.16, -0.12, 0.34));  // hype gets priced in, then paid for
  fairMult = clamp(fairMult * rf(r, 0.9, 1.12), 0.06, 1.85);
  const fairValue = askValuation * fairMult;

  /* ── presented (distorted) fundamentals ────────────────── */
  const presented = clamp(quality + fraud * 0.62 + gauss(r) * 0.055, 0.03, 1);

  const revMultiple = lerp(1.6, 14, presented) * (S.hype / 1.1) * rf(r, 0.75, 1.3);
  const revenue = Math.max(2e6, askValuation / Math.max(revMultiple, 0.6));
  const growth = clamp(lerp(-0.08, 1.35, Math.pow(presented, 1.35)) * rf(r, 0.7, 1.35), -0.28, 3.2);
  const margin = clamp(lerp(-0.55, 0.42, presented) * rf(r, 0.75, 1.3) + rf(r, -0.05, 0.05), -1.4, 0.62);
  const leverage = clamp(lerp(0.72, 0.06, presented) * rf(r, 0.55, 1.6) + (sectorKey === 're' ? 0.22 : 0), 0, 1.15);
  const runwayMo = margin > 0 ? 99 : Math.round(clamp(lerp(4, 34, presented) * rf(r, 0.7, 1.4), 2, 60));

  /* ── flags ─────────────────────────────────────────────── */
  const flags = [], hiddenFlags = [];
  for (const F of FLAGS) {
    let p = F.w * 0.19;
    p *= 1 + (F.q ?? 0) * (quality - 0.48) * 2.6;
    p *= 1 + (F.f ?? 0) * (fraud - 0.3) * 2.8;
    if (F.id === 'profitable') p = margin > 0.08 ? 0.92 : 0.02;
    if (F.id === 'burn') p = margin < -0.2 ? 0.88 : 0.03;
    if (F.id === 'divid' && margin < 0.12) p = 0;
    if (F.id === 'cleanbooks') p = fraud < 0.16 ? 0.55 : 0.02;
    if (F.id === 'undersold') p = fairMult > 1.22 ? 0.6 : 0.01;
    if (p <= 0) continue;
    if (r() < clamp(p, 0, 0.94)) (F.hidden ? hiddenFlags : flags).push(F.id);
  }
  // Keep the visible face readable.
  while (flags.length > 4) flags.splice(Math.floor(r() * flags.length), 1);
  while (hiddenFlags.length > 3) hiddenFlags.splice(Math.floor(r() * hiddenFlags.length), 1);

  /* ── identity ──────────────────────────────────────────── */
  const name = `${pick(r, S.heads)} ${pick(r, S.tails)}`;
  const ticker = makeTicker(name, state.takenTickers, r);

  const uwTier = weighted(r, [
    [3, 6 + quality * 26 + tier.quality * 40],
    [2, 30],
    [1, 30 + fraud * 30],
  ]);
  const underwriter = pick(r, UNDERWRITERS.filter(u => u.tier === uwTier));

  const listingFee = Math.round(raise * state.balance.listingFeeRate);

  return {
    id: ++uid,
    name, ticker, sector: sectorKey, sectorLabel: S.label,
    blurb: pick(r, S.blurbs),
    underwriter: underwriter.name, uwTier,

    askValuation, floatPct, raise, ipoPrice, shares, listingFee,

    stats: { revenue, growth, margin, leverage, runwayMo, revMultiple },
    flags, hiddenFlags,

    // hidden truth — never rendered directly
    _q: quality, _f: fraud, _vol: vol, _hype: hype, _liq: liquidity,
    _fair: fairValue, _fairMult: fairMult,

    audits: [],       // revealed audit stages
    auditLevel: 0,
  };
}

/* ─── due diligence ────────────────────────────────────────── */

const INTEGRITY = [
  { max: 0.12, tone: 'good', text: 'Books reconcile cleanly. Nothing in the file gives us pause.' },
  { max: 0.28, tone: 'good', text: 'Minor presentational aggression, nothing we would call material.' },
  { max: 0.46, tone: 'warn', text: 'Revenue recognition is stretched. Defensible, but only just.' },
  { max: 0.66, tone: 'warn', text: 'Several disclosures do not tie out. We would want more time.' },
  { max: 0.84, tone: 'bad',  text: 'Material irregularities. We would not put our name on this.' },
  { max: 1.01, tone: 'bad',  text: 'This file is fiction. Recommend immediate referral to the regulator.' },
];

/**
 * Run one stage of due diligence on an applicant.
 * Stage 1 → valuation opinion, 2 → integrity read, 3 → hidden flags.
 */
export function runAudit(co, r) {
  co.auditLevel++;
  const lvl = co.auditLevel;

  if (lvl === 1) {
    const err = gauss(r) * 0.085;
    const est = co._fair * (1 + err);
    const delta = est / co.askValuation - 1;
    const verdict =
      delta > 0.18 ? { tone: 'good', word: 'a genuine discount' } :
      delta > 0.02 ? { tone: 'good', word: 'fair, maybe cheap' } :
      delta > -0.15 ? { tone: 'warn', word: 'full but not absurd' } :
      delta > -0.40 ? { tone: 'bad', word: 'materially rich' } :
                      { tone: 'bad', word: 'a fantasy' };
    co.audits.push({
      kind: 'valuation', tone: verdict.tone,
      title: 'Valuation desk',
      text: `We mark them near __EST__ against an ask of __ASK__ — ${verdict.word}.`,
      est, ask: co.askValuation,
    });
    return co.audits[co.audits.length - 1];
  }

  if (lvl === 2) {
    const read = INTEGRITY.find(i => co._f < i.max) ?? INTEGRITY[INTEGRITY.length - 1];
    co.audits.push({ kind: 'integrity', tone: read.tone, title: 'Forensic review', text: read.text });
    return co.audits[co.audits.length - 1];
  }

  if (co.hiddenFlags.length) {
    const revealed = co.hiddenFlags.splice(0, co.hiddenFlags.length);
    co.flags.push(...revealed);
    co.revealedFlags = (co.revealedFlags || []).concat(revealed);
    co.audits.push({
      kind: 'deep', tone: 'warn', title: 'Deep file review',
      text: 'Additional disclosures surfaced. See the tags above.',
    });
  } else {
    co.audits.push({
      kind: 'deep', tone: 'good', title: 'Deep file review',
      text: 'Nothing further of substance. The file is what it appears to be.',
    });
  }
  return co.audits[co.audits.length - 1];
}

/* ─── metric presentation helpers ──────────────────────────── */
export const METRIC_VIEWS = [
  {
    key: 'growth', label: 'Revenue growth',
    fmt: (s) => (s.growth >= 0 ? '+' : '−') + Math.abs(s.growth * 100).toFixed(0) + '%',
    bar: (s) => inv(s.growth, -0.3, 1.6),
    tone: (s) => s.growth > 0.35 ? 'g' : s.growth > 0.05 ? 'a' : 'r',
  },
  {
    key: 'margin', label: 'Operating margin',
    fmt: (s) => (s.margin >= 0 ? '+' : '−') + Math.abs(s.margin * 100).toFixed(0) + '%',
    bar: (s) => inv(s.margin, -0.8, 0.5),
    tone: (s) => s.margin > 0.12 ? 'g' : s.margin > -0.1 ? 'a' : 'r',
  },
  {
    key: 'leverage', label: 'Leverage',
    fmt: (s) => s.leverage.toFixed(2) + '×',
    bar: (s) => 1 - inv(s.leverage, 0, 1.05),
    tone: (s) => s.leverage < 0.28 ? 'g' : s.leverage < 0.62 ? 'a' : 'r',
  },
  {
    key: 'multiple', label: 'Ask / revenue',
    fmt: (s) => s.revMultiple.toFixed(1) + '×',
    bar: (s) => 1 - inv(s.revMultiple, 1, 16),
    tone: (s) => s.revMultiple < 4 ? 'g' : s.revMultiple < 9 ? 'a' : 'r',
  },
];
