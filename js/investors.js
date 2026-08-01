/* ═══════════════════════════════════════════════════════════════
   investors — the money that shows up

   Five cohorts, each with their own pool of capital and their own
   idea of a good product. Every week they re-score your funds and
   move money. Retail chases whatever went up; pensions want low
   volatility and low fees; sovereign wealth wants scale and will
   not touch a disreputable exchange.

   Flows are not just fee income — money arriving has to buy the
   constituents, which pushes their prices up. That feedback loop is
   why a well-marketed fund can lift the whole board.
   ═══════════════════════════════════════════════════════════════ */

import { clamp, gauss, rf } from './util.js';
import { MANDATES, fundReturn, fundVol, totalAum } from './funds.js';

export const COHORTS = [
  {
    id: 'retail', capacity: 0.07, name: 'Retail', blurb: 'Fast, fickle, and enormous in aggregate.',
    seed: 3.0e8, growth: 0.0022,
    chase: 1.45,        // weight on trailing performance
    feeAversion: 0.45,  // how much a high fee puts them off
    volAversion: 0.15,  // how much volatility puts them off
    standing: 0.35,     // how much your reputation matters
    scale: 0.10,        // preference for large, liquid funds
    loyalty: 0.55,      // stickiness of existing allocations
    likes: ['growth', 'sector'],
  },
  {
    id: 'wealth', capacity: 0.10, name: 'Wealth Managers', blurb: 'Allocates on behalf of people who read statements.',
    seed: 5.5e8, growth: 0.0020,
    chase: 0.85, feeAversion: 0.85, volAversion: 0.55, standing: 0.70, scale: 0.35,
    loyalty: 0.78, likes: ['index', 'quality', 'income'],
  },
  {
    id: 'pension', capacity: 0.13, name: 'Pension Funds', blurb: 'Slow money with liabilities to match.',
    seed: 9.0e8, growth: 0.0016,
    chase: 0.35, feeAversion: 1.25, volAversion: 1.15, standing: 1.05, scale: 0.75,
    loyalty: 0.92, likes: ['index', 'income', 'size'],
  },
  {
    id: 'sovereign', capacity: 0.17, name: 'Sovereign Wealth', blurb: 'Vast, patient, and impossible to impress.',
    seed: 1.4e9, growth: 0.0014,
    chase: 0.30, feeAversion: 0.95, volAversion: 0.80, standing: 1.55, scale: 1.20,
    loyalty: 0.94, likes: ['index', 'quality'],
  },
  {
    id: 'hedge', capacity: 0.06, name: 'Hedge Funds', blurb: 'Here for the trade, gone by Thursday.',
    seed: 4.0e8, growth: 0.0026,
    chase: 1.80, feeAversion: 0.25, volAversion: -0.35,  // negative: they want the volatility
    standing: 0.20, scale: 0.15,
    loyalty: 0.30, likes: ['sector', 'growth', 'size'],
  },
];

export const COHORT_BY_ID = Object.fromEntries(COHORTS.map(c => [c.id, c]));

export function initInvestors(s) {
  s.investors = COHORTS.map(c => ({
    id: c.id,
    pool: c.seed,          // uncommitted capital
    allocated: {},         // fundId -> amount
    mood: 0,               // -1 .. 1, drifts with your performance
  }));
  return s.investors;
}

/**
 * Score how much a cohort wants a given fund, on a roughly 0..3 scale.
 * Everything here is information the player controls: what mandate they
 * chose, what fee they set, what they put on the board.
 */
function appetite(s, cohort, fund) {
  const M = MANDATES[fund.mandate];
  if (!M) return 0;

  const ret = fundReturn(fund, 20);
  const vol = fundVol(fund, 20);
  const feePct = fund.feeBps / 10000;
  const aum = totalAum(s) || 1;

  let score = 0.55 * (M.appeal ?? 1);
  score += clamp(ret, -0.5, 1.2) * cohort.chase;
  score -= clamp(vol, 0, 1.2) * cohort.volAversion * 0.55;
  score -= feePct * 100 * cohort.feeAversion * 0.85;
  score += ((s.reputation - 45) / 55) * cohort.standing * 0.60;
  score += clamp(Math.log10(Math.max(fund.aum, 1e5) / 1e6) / 4, -0.5, 0.9) * cohort.scale;
  if (cohort.likes.includes(fund.mandate)) score += 0.42;

  // A fund with almost nothing in it is not investable.
  if ((fund.holdingsCount ?? 0) < 2) score *= 0.25;
  // Probation frightens the conservative money badly.
  if (s.probation > 0) score -= cohort.standing * 0.8;

  return Math.max(0, score);
}

/**
 * Weekly reallocation. Returns a per-fund flow map plus a summary
 * the UI can present.
 */
export function runAllocation(s, r, mcap = 0) {
  if (!s.investors) initInvestors(s);
  if (!s.funds?.length) return { flows: {}, total: 0, byCohort: {} };

  const flows = {};
  const byCohort = {};
  let total = 0;

  for (const inv of s.investors) {
    const C = COHORT_BY_ID[inv.id];
    if (!C) continue;

    // Pools grow on their own, and also scale with the size of the market they
    // are looking at — a $60bn exchange attracts money a $2bn one never sees.
    inv.pool *= (1 + C.growth * 5);
    const deployedNow = Object.values(inv.allocated).reduce((a, b) => a + b, 0);
    const capacity = Math.max(C.seed, mcap * (C.capacity ?? 0.08));
    if (inv.pool + deployedNow < capacity) {
      inv.pool += (capacity - inv.pool - deployedNow) * 0.12;
    }
    inv.mood = clamp(inv.mood * 0.7 + gauss(r) * 0.18, -1, 1);

    const scores = s.funds.map(f => ({ f, a: appetite(s, C, f) * (1 + inv.mood * 0.22) }));
    const sum = scores.reduce((t, x) => t + x.a, 0);

    // How much of its capital this cohort is willing to have deployed here.
    const conviction = clamp(sum / (s.funds.length * 1.4), 0, 1.1);
    const targetDeployed = inv.pool * clamp(0.06 + conviction * 0.26, 0, 0.42);

    const currentDeployed = Object.values(inv.allocated).reduce((a, b) => a + b, 0);

    for (const { f, a } of scores) {
      const share = sum > 0 ? a / sum : 0;
      const target = targetDeployed * share;
      const held = inv.allocated[f.id] ?? 0;
      // Loyalty damps how fast money actually moves.
      const move = (target - held) * (1 - C.loyalty * 0.72) * rf(r, 0.7, 1.3);
      const next = Math.max(0, held + move);
      const delta = next - held;
      if (Math.abs(delta) < 1) continue;

      inv.allocated[f.id] = next;
      inv.pool -= delta;
      f.aum = Math.max(0, f.aum + delta);
      flows[f.id] = (flows[f.id] ?? 0) + delta;
      byCohort[inv.id] = (byCohort[inv.id] ?? 0) + delta;
      total += delta;
    }
  }

  return { flows, total, byCohort };
}

/**
 * Money arriving in a fund has to buy the constituents. Applies a
 * gentle, size-aware price impact so big inflows visibly lift a sector.
 */
export function applyFlowImpact(s, flows) {
  const moved = [];
  for (const f of s.funds) {
    const flow = flows[f.id];
    if (!flow) continue;
    const M = MANDATES[f.mandate];
    if (!M) continue;
    const holdings = s.listings.filter(l => l.status === 'live' && M.matches(l, f.arg));
    if (!holdings.length) continue;
    const basket = holdings.reduce((t, l) => t + l.price * l.shares, 0);
    if (basket <= 0) continue;

    // Impact is the flow as a share of the basket, heavily damped.
    const impact = clamp((flow / basket) * 0.55, -0.05, 0.05);
    if (Math.abs(impact) < 0.0002) continue;
    for (const l of holdings) {
      l.price = Math.max(0.05, l.price * (1 + impact));
      l.fairPrice *= (1 + impact * 0.25);
    }
    moved.push({ fund: f, impact, n: holdings.length });
  }
  return moved;
}

/** Totals for the dashboard. */
export function investorSummary(s) {
  if (!s.investors) return { pools: [], deployed: 0, dryPowder: 0 };
  let deployed = 0, dryPowder = 0;
  const pools = s.investors.map(inv => {
    const C = COHORT_BY_ID[inv.id];
    const alloc = Object.values(inv.allocated).reduce((a, b) => a + b, 0);
    deployed += alloc;
    dryPowder += inv.pool;
    return {
      id: inv.id, name: C?.name ?? inv.id, blurb: C?.blurb ?? '',
      allocated: alloc, pool: inv.pool, mood: inv.mood,
    };
  }).sort((a, b) => b.allocated - a.allocated);
  return { pools, deployed, dryPowder };
}
