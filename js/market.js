/* ═══════════════════════════════════════════════════════════════
   market — the factor model

   Prices are not independent random walks. Each session draws a
   nested set of shocks:

       market  →  sector  →  niche  →  company

   A company's return loads on all four. Two lithium miners move
   almost in lockstep; two materials companies in different niches
   move together but less so; a miner and a software company share
   only the market factor. Crashes are correlated, which is what
   makes diversification worth anything.
   ═══════════════════════════════════════════════════════════════ */

import { gauss, clamp, rf } from './util.js';
import { SECTOR_KEYS, SECTORS, NICHES } from './industries.js';
import { REGIMES } from './data.js';

/** Every niche key, prefixed by sector so keys never collide. */
export const NICHE_KEYS = NICHES.map(n => `${n.sector}.${n.key}`);
export const nicheKeyOf = (l) => `${l.sector}.${l.niche ?? 'x'}`;

/* How strongly each sector rides the broad market. Defensive sectors
   have low betas, cyclicals and speculative sectors high ones. */
export const SECTOR_BETA = {
  tech: 1.22, bio: 1.05, energy: 1.02, fin: 1.18, ind: 1.06, cons: 0.86,
  re: 0.92, mat: 1.14, media: 1.16, log: 1.00, agri: 0.74, svc: 0.88,
};

/* Sectors that genuinely tend to move against, or with, one another.
   Only a handful — enough that the board's shape matters.            */
const SECTOR_LINKS = [
  ['energy', 'mat', 0.34],
  ['fin', 're', 0.30],
  ['log', 'ind', 0.32],
  ['tech', 'media', 0.28],
  ['agri', 'cons', 0.22],
  ['energy', 'log', -0.20],   // fuel costs
  ['fin', 'tech', 0.18],
];

export function initFactors(s) {
  s.factors = {
    market: 0,
    sector: Object.fromEntries(SECTOR_KEYS.map(k => [k, 0])),
    niche: Object.fromEntries(NICHE_KEYS.map(k => [k, 0])),
  };
  return s.factors;
}

/**
 * Draw one session of factor shocks. Returns the factor set; the price
 * walk then applies them per company according to its betas.
 */
export function stepFactors(s, r) {
  const F = s.factors || initFactors(s);
  const regime = REGIMES[s.regime];

  /* ── market ───────────────────────────────────────────────
     Mildly persistent: momentum is real, and it makes runs and
     drawdowns last more than a single session.                */
  const marketShock = gauss(r) * 0.0070 * regime.vol;
  F.market = F.market * 0.28 + marketShock;

  /* ── sectors ──────────────────────────────────────────────
     Own shock plus rotation pressure from sector heat, then the
     linkage pass so related sectors drag each other along.     */
  const raw = {};
  for (const k of SECTOR_KEYS) {
    const heat = s.sectorHeat[k] ?? 0;
    raw[k] = (F.sector[k] ?? 0) * 0.34
           + gauss(r) * 0.0105 * regime.vol
           + heat * 0.0022;
  }
  for (const [a, b, rho] of SECTOR_LINKS) {
    const blend = (raw[a] + raw[b]) * 0.5 * rho;
    raw[a] += blend * 0.5;
    raw[b] += blend * 0.5 * Math.sign(rho);
  }
  for (const k of SECTOR_KEYS) F.sector[k] = clamp(raw[k], -0.06, 0.06);

  /* ── niches ───────────────────────────────────────────────
     A niche is a thin extra layer on top of its sector: enough
     that lithium can run while gold does nothing.              */
  for (const nk of NICHE_KEYS) {
    F.niche[nk] = (F.niche[nk] ?? 0) * 0.30 + gauss(r) * 0.0130 * regime.vol;
  }

  return F;
}

/**
 * The factor component of one company's daily return.
 * Idiosyncratic noise is added by the caller, scaled by the company's
 * own volatility, so a stock is never *only* its sector.
 */
export function factorReturn(s, l) {
  const F = s.factors;
  if (!F) return 0;
  const sectorBeta = SECTOR_BETA[l.sector] ?? 1;
  const nk = nicheKeyOf(l);
  return (F.market ?? 0) * (l._betaM ?? 1) * sectorBeta
       + (F.sector[l.sector] ?? 0) * (l._betaS ?? 1)
       + (F.niche[nk] ?? 0) * (l._betaN ?? 1);
}

/** Per-company loadings, drawn once at listing. */
export function drawBetas(r) {
  return {
    _betaM: clamp(0.75 + gauss(r) * 0.22, 0.25, 1.9),
    _betaS: clamp(1.00 + gauss(r) * 0.26, 0.30, 1.9),
    _betaN: clamp(1.00 + gauss(r) * 0.30, 0.20, 2.0),
  };
}

/* ─── readouts for the UI ──────────────────────────────────── */

/** Rolling sector performance, for the heat grid and the sector chart. */
export function sectorPulse(s) {
  const out = {};
  for (const k of SECTOR_KEYS) {
    out[k] = {
      key: k,
      label: SECTORS[k].label,
      short: SECTORS[k].short,
      hue: SECTORS[k].hue,
      factor: s.factors?.sector?.[k] ?? 0,
      heat: s.sectorHeat?.[k] ?? 0,
      beta: SECTOR_BETA[k] ?? 1,
      cap: 0, count: 0, ret: 0,
    };
  }
  let wsum = 0;
  for (const l of s.listings) {
    if (l.status !== 'live') continue;
    const o = out[l.sector];
    if (!o) continue;
    const cap = l.price * l.shares;
    const span = Math.min(5, l.history.length - 1);
    const from = l.history[l.history.length - 1 - span] || l.price;
    o.cap += cap;
    o.count++;
    o.ret += ((l.price - from) / from) * cap;
    wsum += cap;
  }
  for (const k of SECTOR_KEYS) if (out[k].cap > 0) out[k].ret /= out[k].cap;
  return { sectors: out, total: wsum };
}
