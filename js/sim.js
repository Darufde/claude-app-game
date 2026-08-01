/* ═══════════════════════════════════════════════════════════════
   sim — the market engine

   One decision = one trading day. Five days = a week (settlement).
   Four weeks = a quarter (annual fees, regulator review).
   ═══════════════════════════════════════════════════════════════ */

import { clamp, gauss, rf, ri, pick, weighted, lerp } from './util.js';
import { REGIMES, REGIME_FLOW, SECTOR_KEYS, SECTORS, TIERS } from './data.js';
import {
  DAYS_PER_WEEK, WEEKS_PER_QUARTER, liveListings, marketCap,
  tierIndexFor, pushLog, applyRep, canAccept, slots,
} from './state.js';

export { applyRep, canAccept } from './state.js';
import { generateApplicant } from './company.js';
import { rollEvents } from './events.js';

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
    sector: co.sector, sectorLabel: co.sectorLabel,
    ipoPrice: co.ipoPrice,
    price: Math.max(0.4, co.ipoPrice * (1 + pop)),
    prevPrice: co.ipoPrice,
    fairPrice: co.ipoPrice * co._fairMult,
    shares: co.shares,
    listedDay: s.day,
    status: 'live',
    _q: co._q, _f: co._f, _vol: co._vol, _hype: co._hype, _liq: co._liq,
    audited: co.auditLevel > 0,
    peak: co.ipoPrice * (1 + Math.max(pop, 0)),
    trough: co.ipoPrice * (1 + Math.min(pop, 0)),
    history: [co.ipoPrice],
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

  /* ── price walk ──────────────────────────────────────────── */
  let notional = 0;
  for (const l of s.listings) {
    if (l.status !== 'live') continue;

    // Fair value itself compounds with company quality — this is the engine
    // that makes a well-chosen board grow and a careless one rot.
    l.fairPrice *= (1 + (l._q - 0.42) * 0.0125 + regime.drift * 0.35 + gauss(r) * 0.0025);
    l.fairPrice = Math.max(0.05, l.fairPrice);

    const gap = Math.log(l.fairPrice / l.price);
    const reversion = clamp(gap * 0.021, -0.028, 0.028);
    const heat = (s.sectorHeat[l.sector] ?? 0) * 0.0052;
    const drift = reversion + regime.drift + heat + (l._q - 0.5) * 0.0026;
    const shock = gauss(r) * l._vol * 0.0165;

    l.prevPrice = l.price;
    l.price = Math.max(0.05, l.price * Math.exp(drift + shock));
    l.peak = Math.max(l.peak, l.price);
    l.trough = Math.min(l.trough, l.price);
    l.history.push(l.price);
    if (l.history.length > 90) l.history.shift();

    const ret = (l.price - l.prevPrice) / l.prevPrice;
    const mcap = l.price * l.shares;
    notional += mcap * l._liq * (1 + Math.abs(ret) * 6.5) * lerp(0.75, 1.3, regime.flow / 1.3);

    report.moves.push({ ticker: l.ticker, ret, price: l.price });

    /* ── fraud detonation ─────────────────────────────────── */
    const age = s.day - l.listedDay;
    if (!l.scandal && age > 2 && r() < Math.pow(l._f, 2.4) * 0.030) {
      const crash = rf(r, 0.62, 0.90);
      l.price = Math.max(0.05, l.price * (1 - crash));
      l.fairPrice = l.price * rf(r, 0.5, 0.9);
      l.scandal = true;
      l.note = 'accounting scandal';
      s.stats.scandals++;
      const hit = -(5.5 + l._f * 7.5 + (l.audited ? -1.5 : 1.5));
      report.repDelta += applyRep(s, hit);
      report.scandals.push({ ticker: l.ticker, name: l.name, crash, repHit: hit });
      pushLog(s, { kind: 'scandal', ticker: l.ticker, text: `${l.ticker} — accounting scandal` });
    }

    /* ── takeover (the good ending for a listing) ─────────── */
    if (l.status === 'live' && !l.scandal && age > 8 && l._q > 0.66 &&
        r() < 0.0011 * (1 + l._q) * (regime.flow)) {
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
  const tradingFees = Math.round(notional * s.balance.tradingFeeBps / 10000);
  const n = liveListings(s).length;
  const opex = Math.round(s.balance.opexBase + s.balance.opexPerListing * n);
  s.capital += tradingFees - opex;
  s.stats.feesTrading += tradingFees;
  s.stats.opexPaid += opex;
  report.tradingFees = tradingFees;
  report.opex = opex;

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
    const scar = Math.min(s.stats.scandals * 5.0, 40);

    const target = clamp(32 + clamp(perf, -1, 1.6) * 42 + (avgQ - 0.5) * 62 + util * 10 - scar, 0, 100);
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
  s.day++;
  if ((s.day - 1) % DAYS_PER_WEEK === 0) {
    s.week++;
    s.audits = s.auditsMax;
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

  /* ── failure states ──────────────────────────────────────── */
  if (s.capital < 0) {
    report.over = {
      reason: 'insolvent', title: 'The Floor Goes Dark',
      body: 'Operating costs outran the fee book. Clearing halted at the open, and the '
          + 'receivers took the keys before lunch. An exchange that cannot pay its own '
          + 'settlement staff is not an exchange.',
    };
  } else if (s.reputation <= 0) {
    report.over = {
      reason: 'discredited', title: 'Licence Revoked',
      body: 'The regulator ran out of patience. Every listing you approved is being '
          + 'reviewed, and none of the reviewers are on your side. Trading is suspended '
          + 'indefinitely.',
    };
  }
  if (report.over) s.over = report.over;

  return report;
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
