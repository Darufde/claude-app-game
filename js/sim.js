/* ═══════════════════════════════════════════════════════════════
   sim — the market engine

   One decision = one trading day. Five days = a week (settlement).
   Four weeks = a quarter (annual fees, regulator review).
   ═══════════════════════════════════════════════════════════════ */

import { clamp, gauss, rf, ri, pick, weighted, lerp } from './util.js';
import { REGIMES, REGIME_FLOW, SECTOR_KEYS, SECTORS, TIERS, MILESTONES } from './data.js';
import {
  DAYS_PER_WEEK, WEEKS_PER_QUARTER, liveListings, marketCap,
  tierIndexFor, pushLog, applyRep, canAccept, slots, auditsMax, sectorSpread,
} from './state.js';

export { applyRep, canAccept } from './state.js';

/* ═══ milestones ══════════════════════════════════════════════ */
export function checkMilestones(s) {
  const live = liveListings(s);
  let bestMultiple = 1;
  for (const l of live) bestMultiple = Math.max(bestMultiple, l.price / l.ipoPrice);
  s.stats.bestMultiple = Math.max(s.stats.bestMultiple || 1, bestMultiple);

  const view = {
    ...s,
    liveCount: live.length,
    mcap: marketCap(s),
    slots: slots(s),
    sectorCount: sectorSpread(s).size,
    bestMultiple,
    upgradeCount: Object.values(s.upgrades || {}).reduce((a, b) => a + b, 0),
  };

  const fired = [];
  for (const M of MILESTONES) {
    if (s.milestones.includes(M.id)) continue;
    let hit = false;
    try { hit = M.test(view); } catch { hit = false; }
    if (!hit) continue;
    s.milestones.push(M.id);
    fired.push(M);
  }
  return fired;
}

/* ═══ intraday shape ══════════════════════════════════════════
   The sim only needs a close, but a chart needs a candle. Derive a
   plausible open/high/low around the day's move so the charts have
   something real to draw.                                          */
function makeCandle(open, close, volatility, r) {
  const span = Math.abs(close - open) + open * volatility * 0.011 * (0.4 + r() * 1.3);
  const high = Math.max(open, close) + span * rf(r, 0.05, 0.55);
  const low = Math.max(0.02, Math.min(open, close) - span * rf(r, 0.05, 0.55));
  return { o: open, h: high, l: low, c: close };
}
import { generateApplicant } from './company.js';
import { rollEvents } from './events.js';
import { stepFactors, factorReturn, drawBetas, initFactors } from './market.js';
import { stepFunds, collectFundFees, totalAum, screenFor } from './funds.js';
import { runAllocation, applyFlowImpact, initInvestors } from './investors.js';

/* ═══ queue ═══════════════════════════════════════════════════ */
export function refillQueue(s, r) {
  const target = s.balance.queueTarget + 1;
  while (s.queue.length < target) {
    const co = generateApplicant(s, r);
    s.takenTickers.add(co.ticker);
    s.queue.push(co);
  }
}

/* ═══ listing ═════════════════════════════════════════════════ */
export function acceptApplicant(s, co, r) {
  const regime = REGIMES[s.regime];

  // Day-one pop: hype and demand versus the discipline of the price.
  const heat = s.sectorHeat[co.sector] ?? 0;
  const demand = (co._hype - 0.9) * 0.42 + (co._fairMult - 1) * 0.30
               + heat * 0.35 + regime.drift * 22 + gauss(r) * 0.085;
  const pop = clamp(demand, -0.42, 1.45);

  const listing = {
    id: co.id, name: co.name, ticker: co.ticker,
    sector: co.sector, sectorLabel: co.sectorLabel, nicheLabel: co.nicheLabel,
    ipoPrice: co.ipoPrice,
    price: Math.max(0.4, co.ipoPrice * (1 + pop)),
    prevPrice: co.ipoPrice,
    fairPrice: co.ipoPrice * co._fairMult,
    shares: co.shares,
    listedDay: s.day,
    status: 'live',
    _q: co._q, _f: co._f, _vol: co._vol, _hype: co._hype, _liq: co._liq,
    niche: co.niche,
    ...drawBetas(r),
    audited: co.auditLevel > 0,
    screen: screenFor(co),
    peak: co.ipoPrice * (1 + Math.max(pop, 0)),
    trough: co.ipoPrice * (1 + Math.min(pop, 0)),
    history: [co.ipoPrice],
    candles: [makeCandle(co.ipoPrice, Math.max(0.4, co.ipoPrice * (1 + pop)), co._vol, r)],
    volumes: [co.shares * co._liq * 9],   // debut turnover is always heavy
    scandal: false, note: null,
  };
  listing.history.push(listing.price);
  s.listings.push(listing);

  s.capital += co.listingFee;
  s.stats.feesListing += co.listingFee;
  s.stats.accepted++;
  if (co._f > 0.55) s.stats.fraudsListed++;

  // Standing reacts to how the debut is priced.
  let rep = 0, note;
  if (pop > 0.85) { rep = -0.9; note = 'left money on the table'; }
  else if (pop > 0.06) { rep = 1.6; note = 'a clean debut'; }
  else if (pop > -0.06) { rep = 0.3; note = 'flat out of the gate'; }
  else { rep = -2.0; note = 'broke issue on day one'; }
  if (co.uwTier === 3) rep += 0.5;
  if (co.uwTier === 1) rep -= 0.3;
  applyRep(s, rep);

  pushLog(s, { kind: 'list', ticker: co.ticker, text: `${co.ticker} listed — ${note}` });

  return { listing, pop, fee: co.listingFee, repDelta: rep, note };
}

export function rejectApplicant(s, co, r) {
  s.stats.rejected++;
  (s.ghosts ||= []).push({
    ticker: co.ticker, name: co.name, sector: co.sector,
    q: co._q, f: co._f, fairMult: co._fairMult,
    raise: co.raise, fee: co.listingFee,
    audited: co.auditLevel > 0,
    resolveDay: s.day + ri(r, 4, 13),
  });
  pushLog(s, { kind: 'reject', ticker: co.ticker, text: `${co.ticker} withdrawn` });
  return { repDelta: 0 };
}

/**
 * Throw a company off your own board to free a slot.
 * Ejecting a disaster is cheap and the market broadly agrees with you.
 * Ejecting a winner is expensive, and everyone notices.
 */
export function forceDelistCost(s, l) {
  const perf = l.price / l.ipoPrice - 1;
  return {
    rep: clamp(2.5 + perf * 7, 1.0, 9),
    cash: Math.round(Math.max(150_000, l.price * l.shares * 0.0002)),
  };
}

export function forceDelist(s, l) {
  if (l.status !== 'live') return null;
  const cost = forceDelistCost(s, l);
  l.status = 'delisted';
  l.note = 'removed by the exchange';
  s.capital -= cost.cash;
  s.stats.delisted++;
  applyRep(s, -cost.rep);
  pushLog(s, { kind: 'delist', ticker: l.ticker, text: `${l.ticker} removed from the board` });
  return cost;
}

/* ═══ one trading day ═════════════════════════════════════════ */
export function advanceDay(s, r) {
  const report = {
    day: s.day, moves: [], events: [], scandals: [], delistings: [],
    acquisitions: [], ghosts: [],
    tradingFees: 0, opex: 0, annualFees: 0, capitalDelta: 0,
    repDelta: 0, weekClose: null, quarterClose: null,
    tierChange: null, over: null,
    mcapBefore: marketCap(s), regimeChanged: null,
  };

  const capBefore = s.capital;
  const repBefore = s.reputation;
  const regime = REGIMES[s.regime];

  /* ── sector heat drifts ──────────────────────────────────── */
  for (const k of SECTOR_KEYS) {
    const h = s.sectorHeat[k] ?? 0;
    s.sectorHeat[k] = clamp(h * 0.94 + gauss(r) * 0.055, -1, 1);
  }

  /* ── factors ─────────────────────────────────────────────────
     One draw per session, shared by every listing. This is what makes
     a sector sell off together rather than each name wandering alone. */
  if (!s.factors) initFactors(s);
  stepFactors(s, r);

  /* ── price walk ──────────────────────────────────────────── */
  let notional = 0;
  // Index constituents: only companies that traded yesterday as well as today.
  let indexNum = 0, indexDen = 0;
  for (const l of s.listings) {
    if (l.status !== 'live') continue;

    // Fair value compounds with company quality, and the neutral point sits
    // above average on purpose: a merely adequate business drifts nowhere,
    // a good one compounds hard, a weak one rots. This is the whole game.
    l.fairPrice *= (1 + (l._q - 0.55) * 0.016 + regime.drift * 0.35 + gauss(r) * 0.0025);
    l.fairPrice = Math.max(0.05, l.fairPrice);

    const gap = Math.log(l.fairPrice / l.price);
    const reversion = clamp(gap * 0.021, -0.028, 0.028);
    const heat = (s.sectorHeat[l.sector] ?? 0) * 0.0052;
    const drift = reversion + regime.drift + heat + (l._q - 0.5) * 0.0026;
    // Systematic move shared with the sector and niche, plus what is
    // genuinely this company's own news.
    const systematic = factorReturn(s, l);
    const idio = gauss(r) * l._vol * 0.0080;
    const shock = systematic + idio;

    l.prevPrice = l.price;
    l.price = Math.max(0.05, l.price * Math.exp(drift + shock));
    l.peak = Math.max(l.peak, l.price);
    l.trough = Math.min(l.trough, l.price);
    l.history.push(l.price);
    (l.candles ||= []).push(makeCandle(l.prevPrice, l.price, l._vol, r));
    if (l.history.length > 260) l.history.shift();
    if (l.candles.length > 260) l.candles.shift();

    if (s.day - l.listedDay >= 1) {
      indexDen += l.prevPrice * l.shares;
      indexNum += l.price * l.shares;
    }

    const ret = (l.price - l.prevPrice) / l.prevPrice;
    const mcap = l.price * l.shares;
    const turnover = mcap * l._liq * (1 + Math.abs(ret) * 6.5) * lerp(0.75, 1.3, regime.flow / 1.3);
    notional += turnover;
    (l.volumes ||= []).push(turnover / Math.max(l.price, .01));
    if (l.volumes.length > 260) l.volumes.shift();

    report.moves.push({ ticker: l.ticker, ret, price: l.price });

    /* ── fraud detonation ─────────────────────────────────── */
    const age = s.day - l.listedDay;
    const scandalOdds = Math.pow(l._f, 2.4) * 0.024 * (1 - (s.upgradeEffects.scandalCut || 0));
    if (!l.scandal && age > 2 && r() < scandalOdds) {
      const crash = rf(r, 0.45, 0.74);
      l.price = Math.max(0.05, l.price * (1 - crash));
      l.fairPrice = l.price * rf(r, 0.55, 0.95);
      l.scandal = true;
      l.note = 'accounting scandal';
      s.stats.scandals++;
      const shield = 1 - (s.upgradeEffects.repShield || 0);
      const hit = -(3.6 + l._f * 5.4 + (l.audited ? -1.4 : 1.2)) * shield;
      report.repDelta += applyRep(s, hit);
      report.scandals.push({ ticker: l.ticker, name: l.name, crash, repHit: hit });
      pushLog(s, { kind: 'scandal', ticker: l.ticker, text: `${l.ticker} — accounting scandal` });
    }

    /* ── takeover (the good ending for a listing) ─────────── */
    // Takeovers are the good exit, and they free a slot. Frequent enough that
    // a well-run board keeps churning and you keep getting to choose.
    if (l.status === 'live' && !l.scandal && age > 8 && l._q > 0.62 &&
        r() < 0.0034 * (1 + l._q) * (regime.flow)) {
      const premium = rf(r, 0.24, 0.62);
      l.price *= (1 + premium);
      l.status = 'acquired';
      l.note = `acquired at +${Math.round(premium * 100)}%`;
      const fee = Math.round(l.price * l.shares * 0.00035);
      s.capital += fee;
      report.acquisitions.push({ ticker: l.ticker, name: l.name, premium, fee });
      report.repDelta += applyRep(s, 2.6);
      pushLog(s, { kind: 'acq', ticker: l.ticker, text: `${l.ticker} acquired at a premium` });
    }

    /* ── delisting ────────────────────────────────────────── */
    if (l.status === 'live' && l.price < l.ipoPrice * s.balance.delistThreshold) {
      l.status = 'delisted';
      l.note = l.note || 'delisted';
      s.stats.delisted++;
      report.delistings.push({ ticker: l.ticker, name: l.name });
      report.repDelta += applyRep(s, -3.2);
      pushLog(s, { kind: 'delist', ticker: l.ticker, text: `${l.ticker} delisted` });
    }
  }

  /* ── revenue & cost ──────────────────────────────────────── */
  /* ── funds ───────────────────────────────────────────────────
     Marked to market on the new prices, then billed. */
  stepFunds(s);
  const mgmtFees = collectFundFees(s);
  report.mgmtFees = mgmtFees;
  s.stats.peakAum = Math.max(s.stats.peakAum || 0, totalAum(s));

  const up = s.upgradeEffects;
  const tradingFees = Math.round(notional * s.balance.tradingFeeBps / 10000 * up.feeMult);
  const dataFees = Math.round(up.income);
  const n = liveListings(s).length;
  // Rescue facilities are debt, and debt is serviced daily.
  const interest = Math.round((s.debt || 0) * 0.0009);
  const opex = Math.round(s.balance.opexBase + s.balance.opexPerListing * n) + interest;
  s.capital += tradingFees + dataFees - opex;
  s.stats.feesTrading += tradingFees;
  s.stats.feesData += dataFees;
  s.stats.opexPaid += opex;
  report.tradingFees = tradingFees;
  report.dataFees = dataFees;
  report.opex = opex;
  report.interest = interest;

  /* ── the ones that got away ──────────────────────────────── */
  if (s.ghosts?.length) {
    const still = [];
    for (const g of s.ghosts) {
      if (s.day < g.resolveDay) { still.push(g); continue; }
      if (g.f > 0.55) {
        const rep = g.audited ? 2.4 : 1.2;
        report.repDelta += applyRep(s, rep);
        s.stats.fraudsCaught++;
        report.ghosts.push({ ...g, outcome: 'fraud', rep,
          text: `${g.ticker} listed elsewhere and collapsed in a fraud investigation.` });
      } else if (g.q > 0.74 && g.fairMult > 1.05) {
        const rep = -1.4;
        report.repDelta += applyRep(s, rep);
        s.stats.starsMissed++;
        report.ghosts.push({ ...g, outcome: 'star', rep,
          text: `${g.ticker} listed on a rival floor and has doubled. The press noticed.` });
      } else {
        report.ghosts.push({ ...g, outcome: 'quiet', rep: 0,
          text: `${g.ticker} listed quietly elsewhere. No loss.` });
      }
    }
    s.ghosts = still;
  }

  /* ── standing converges on what the board deserves ───────────
     Rather than drifting, reputation seeks a target derived from how
     your listings actually perform, how good they actually are, how
     full the floor is, and how many blow-ups are on your record. A
     history of scandals permanently caps the ceiling — an exchange
     known for detonations cannot attract quality, however it trades. */
  const live = liveListings(s);
  if (live.length) {
    let wsum = 0, psum = 0, qsum = 0;
    for (const l of live) {
      const w = Math.max(l.price * l.shares, 1);
      wsum += w;
      psum += w * (l.price / l.ipoPrice - 1);
      qsum += w * l._q;
    }
    const perf = psum / wsum;
    const avgQ = qsum / wsum;
    const util = live.length / slots(s);
    // Reputation must see failures, not just survivors — otherwise a board that
    // quietly buries its mistakes reads as flawless.
    const scar = Math.min(s.stats.scandals * 3.6, 30)
               + Math.min(s.stats.delisted * 2.0, 20);

    // A broad board is a more serious exchange, and survives a bad sector.
    const spread = sectorSpread(s).size;
    const breadth = Math.min(spread, 10) * 1.2;
    report.breadth = spread;

    const target = clamp(
      26 + clamp(perf, -1, 1.6) * 40 + (avgQ - 0.5) * 75 + util * 10 + breadth - scar,
      0, 100
    );
    let pull = clamp((target - s.reputation) * 0.030, -1.1, 1.1);
    if (pull < 0) pull *= s.balance.repDecay;
    s.reputation = clamp(s.reputation + pull, 0, 100);
    report.repTarget = target;
  } else if (s.day > 4) {
    report.repDelta += applyRep(s, -0.4);   // an empty floor is not a floor
  }

  /* ── events ──────────────────────────────────────────────── */
  report.events = rollEvents(s, r, report);

  /* ── regime clock ────────────────────────────────────────── */
  s.regimeDaysLeft--;
  if (s.regimeDaysLeft <= 0) {
    const next = weighted(r, REGIME_FLOW[s.regime] ?? REGIME_FLOW.steady);
    if (next !== s.regime) report.regimeChanged = { from: s.regime, to: next };
    s.regime = next;
    s.regimeDaysLeft = ri(r, 7, 18);
  }

  /* ── calendar ────────────────────────────────────────────── */
  /* ── exchange index ──────────────────────────────────────────
     A chained, cap-weighted index. Each session it moves by the weighted
     return of the constituents that were listed yesterday *and* today, so
     admitting or losing a company never moves the index by itself — only
     price does. That is how a real index handles changing membership.   */
  if (indexDen > 0) {
    const dayReturn = indexNum / indexDen - 1;
    s.indexValue = clamp((s.indexValue ?? 100) * (1 + dayReturn), 0.1, 1e7);
  } else if (s.indexValue == null && liveListings(s).length) {
    s.indexValue = 100;
  }
  if (s.indexValue != null) {
    s.history.index.push(Math.round(s.indexValue * 10) / 10);
    if (s.history.index.length > 260) s.history.index.shift();
  }

  s.day++;
  if ((s.day - 1) % DAYS_PER_WEEK === 0) {
    s.week++;
    s.audits = auditsMax(s);

    /* Investors re-score every fund and move money. Inflows have to buy
       the constituents, so the flow itself moves prices. */
    if (s.funds.length) {
      if (!s.investors) initInvestors(s);
      const alloc = runAllocation(s, r, marketCap(s));
      applyFlowImpact(s, alloc.flows);
      for (const f of s.funds) f.peakAum = Math.max(f.peakAum || 0, f.aum);
      report.allocation = alloc;
    }
    report.weekClose = closeWeek(s, r, report);
    if (s.week % WEEKS_PER_QUARTER === 1 && s.week > 1) {
      report.quarterClose = closeQuarter(s, r, report);
    }
  }

  /* ── tier ────────────────────────────────────────────────── */
  const newTier = tierIndexFor(s);
  if (newTier !== s.tierIndex) {
    report.tierChange = { from: s.tierIndex, to: newTier, promoted: newTier > s.tierIndex };
    s.tierIndex = newTier;
  }

  /* ── bookkeeping ─────────────────────────────────────────── */
  const mcapNow = marketCap(s);
  s.stats.peakCapital = Math.max(s.stats.peakCapital, s.capital);
  s.stats.peakMcap = Math.max(s.stats.peakMcap, mcapNow);
  s.history.mcap.push(Math.round(mcapNow));
  s.history.cap.push(Math.round(s.capital));
  s.history.rep.push(Math.round(s.reputation * 10) / 10);
  for (const k of ['mcap', 'cap', 'rep']) if (s.history[k].length > 260) s.history[k].shift();

  report.capitalDelta = s.capital - capBefore;
  report.repDelta = s.reputation - repBefore;
  report.mcapAfter = mcapNow;

  /* ── setbacks ────────────────────────────────────────────────
     On the two ordinary settings these are things you trade your way
     out of. Only Black Monday still ends the run.                    */
  if (s.capital < 0) {
    if (s.permadeath) {
      report.over = {
        reason: 'insolvent', title: 'The Floor Goes Dark',
        body: 'Operating costs outran the fee book. Clearing halted at the open, and the '
            + 'receivers took the keys before lunch. An exchange that cannot pay its own '
            + 'settlement staff is not an exchange.',
      };
    } else {
      report.rescue = grantRescue(s);
    }
  }
  if (!report.over && s.reputation <= 0.5) {
    if (s.permadeath) {
      report.over = {
        reason: 'discredited', title: 'Licence Revoked',
        body: 'The regulator ran out of patience. Every listing you approved is being '
            + 'reviewed, and none of the reviewers are on your side. Trading is suspended '
            + 'indefinitely.',
      };
    } else if (!s.probation) {
      s.probation = 20;
      s.reputation = 12;
      report.probation = {
        title: 'Placed on probation',
        body: 'The commission has not closed you, but it has taken an interest. You keep your '
            + 'licence and your board. What you have lost is the benefit of the doubt — earn '
            + 'it back with the listings you approve from here.',
      };
      pushLog(s, { kind: 'probation', text: 'Exchange placed on regulatory probation' });
    }
  }
  if (s.probation > 0) s.probation--;
  if (report.over) s.over = report.over;

  /* ── milestones ──────────────────────────────────────────── */
  report.milestones = checkMilestones(s);

  return report;
}

/**
 * Emergency financing. The exchange survives; the terms are unpleasant and
 * get worse each time you need it.
 */
function grantRescue(s) {
  s.bailouts++;
  const n = s.bailouts;
  // Always enough to reopen tomorrow, but it goes on the balance sheet and the
  // interest is charged every session from here. Repeat borrowers feel it.
  const facility = Math.round(Math.abs(s.capital) + 1.4e6 + marketCap(s) * 0.002);
  const repCost = 3.2 + n * 1.4;
  s.capital += facility;
  s.debt = (s.debt || 0) + facility;
  applyRep(s, -repCost);
  pushLog(s, { kind: 'rescue', text: `Emergency facility drawn — ${n}` });
  return {
    facility, repCost, count: n, debt: s.debt,
    title: n === 1 ? 'A Line of Credit' : 'The Banks Return, Reluctantly',
    body: n === 1
      ? 'You ran out of cash. A consortium has extended an emergency facility because a failed '
        + 'exchange embarrasses everyone who cleared through it. You keep trading. The story '
        + 'travels, and your standing takes the hit.'
      : `Facility number ${n}. The terms are worse, the sums are smaller, and the phone calls `
        + 'are shorter. Your board needs to start paying for itself.',
  };
}

/* ═══ week close ══════════════════════════════════════════════ */
function closeWeek(s, r, dayReport) {
  const live = liveListings(s);
  const wk = {
    week: s.week - 1,
    listings: live.length,
    mcap: marketCap(s),
    capital: s.capital,
    reputation: s.reputation,
    tier: TIERS[s.tierIndex].name,
    regime: REGIMES[s.regime].label,
    bestMover: null, worstMover: null,
  };

  let best = null, worst = null;
  for (const l of live) {
    const span = Math.min(DAYS_PER_WEEK, l.history.length - 1);
    if (span < 1) continue;
    const from = l.history[l.history.length - 1 - span];
    const ret = (l.price - from) / from;
    if (!best || ret > best.ret) best = { ticker: l.ticker, name: l.name, ret };
    if (!worst || ret < worst.ret) worst = { ticker: l.ticker, name: l.name, ret };
  }
  wk.bestMover = best; wk.worstMover = worst;
  return wk;
}

/* ═══ quarter close ═══════════════════════════════════════════ */
function closeQuarter(s, r, dayReport) {
  s.quarter++;
  const live = liveListings(s);
  const annual = live.length * s.balance.annualFeePerCo;
  s.capital += annual;
  s.stats.feesAnnual += annual;
  dayReport.annualFees = annual;

  const q = { quarter: s.quarter - 1, annualFees: annual, listings: live.length, review: null };

  // Regulator review: are you listing junk?
  if (live.length >= 4) {
    const junk = live.filter(l => l._f > 0.5 || l.price < l.ipoPrice * 0.55).length;
    const ratio = junk / live.length;
    if (ratio > 0.34) {
      const fine = Math.round(s.capital * clamp(ratio * 0.16, 0.03, 0.16));
      s.capital -= fine;
      const rep = -(2 + ratio * 6);
      applyRep(s, rep);
      q.review = { tone: 'bad', ratio, fine, rep,
        text: 'The regulator sampled your book and did not enjoy it. A fine has been levied '
            + 'and your listing standards are now a matter of public record.' };
    } else if (ratio < 0.1 && s.reputation > 55) {
      const rep = 2.4;
      applyRep(s, rep);
      q.review = { tone: 'good', ratio, fine: 0, rep,
        text: 'The quarterly review came back clean. Institutional money notices things like that.' };
    }
  }
  return q;
}
