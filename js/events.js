/* ═══════════════════════════════════════════════════════════════
   events — the deck of things that happen to you

   Each entry declares when it *can* fire, how likely it is, and what
   it does. Events return a descriptor the UI renders as a modal or a
   toast; all state mutation happens inside `run`.
   ═══════════════════════════════════════════════════════════════ */

import { clamp, rf, ri, pick, money, pct } from './util.js';
import { REGIMES, SECTORS, SECTOR_KEYS } from './data.js';
import { liveListings, marketCap, pushLog, applyRep } from './state.js';

const bigger = (a, b) => b.price * b.shares - a.price * a.shares;

/** Random live listing, optionally filtered. */
function anyListing(s, r, filter) {
  const pool = liveListings(s).filter(filter || (() => true));
  return pool.length ? pool[Math.floor(r() * pool.length)] : null;
}

export const EVENTS = [
  /* ─── short-seller report ─────────────────────────────── */
  {
    id: 'short',
    weight: 14,
    can: (s) => s.day > 7 && liveListings(s).length >= 2,
    run(s, r) {
      const target = anyListing(s, r, l => s.day - l.listedDay > 3);
      if (!target) return null;
      // Short sellers are usually right, but not always.
      const correct = r() < clamp(0.35 + target._f * 0.6, 0.2, 0.94);
      const hit = correct ? rf(r, 0.16, 0.34) : rf(r, 0.07, 0.16);
      target.price = Math.max(0.05, target.price * (1 - hit));
      if (correct) target.fairPrice *= (1 - hit * 0.75);
      const rep = correct ? -1.8 : -0.4;
      applyRep(s, rep);
      pushLog(s, { kind: 'short', ticker: target.ticker, text: `${target.ticker} hit by short report` });
      return {
        kind: 'modal', tone: 'bad', kicker: 'Short report',
        title: `“${pick(r, ['A House of Cards', 'The Emperor’s Ledger', 'Nothing Underneath', 'Manufactured Growth', 'The Phantom Backlog'])}”`,
        body: `An activist short fund published a ${ri(r, 38, 140)}-page report on <em>${target.name}</em>. `
            + `The stock closed down <em>${pct(-hit, 0)}</em>. ${correct
              ? 'The desk’s read is that most of it lands.'
              : 'Your analysts think the thesis is thin — but the tape does not care today.'}`,
        stats: [['Move', pct(-hit, 1)], ['Standing', rep.toFixed(1)]],
      };
    },
  },

  /* ─── earnings surprise ───────────────────────────────── */
  {
    id: 'earnings',
    weight: 20,
    can: (s) => liveListings(s).length >= 1 && s.day > 5,
    run(s, r) {
      const t = anyListing(s, r, l => s.day - l.listedDay > 4);
      if (!t) return null;
      const beat = r() < clamp(0.32 + t._q * 0.5 - t._f * 0.3, 0.1, 0.88);
      const move = beat ? rf(r, 0.08, 0.27) : -rf(r, 0.08, 0.26);
      t.price = Math.max(0.05, t.price * (1 + move));
      t.fairPrice *= (1 + move * 0.55);
      return {
        kind: 'toast', tone: beat ? 'good' : 'bad',
        text: `${t.ticker} ${beat ? 'beats' : 'misses'} — ${pct(move, 0)}`,
      };
    },
  },

  /* ─── sector rotation ─────────────────────────────────── */
  {
    id: 'rotation',
    weight: 13,
    can: (s) => s.day > 9,
    run(s, r) {
      const into = pick(r, SECTOR_KEYS);
      let outOf = pick(r, SECTOR_KEYS);
      if (outOf === into) outOf = SECTOR_KEYS[(SECTOR_KEYS.indexOf(into) + 3) % SECTOR_KEYS.length];
      s.sectorHeat[into] = clamp((s.sectorHeat[into] ?? 0) + rf(r, 0.5, 0.95), -1, 1);
      s.sectorHeat[outOf] = clamp((s.sectorHeat[outOf] ?? 0) - rf(r, 0.4, 0.85), -1, 1);
      return {
        kind: 'modal', tone: 'neu', kicker: 'Rotation',
        title: `Money moves into ${SECTORS[into].label}`,
        body: `Allocators are rotating out of <em>${SECTORS[outOf].label}</em> and into `
            + `<em>${SECTORS[into].label}</em>. Expect the flow to show up in your applicant `
            + `mix within a week, and in valuations sooner than that.`,
        stats: [['Bid', SECTORS[into].label], ['Offered', SECTORS[outOf].label]],
      };
    },
  },

  /* ─── index inclusion ─────────────────────────────────── */
  {
    id: 'index',
    weight: 9,
    can: (s) => s.tierIndex >= 1 && liveListings(s).length >= 3,
    run(s, r) {
      const t = liveListings(s).sort(bigger)[0];
      if (!t || t.indexed) return null;
      t.indexed = true;
      t._liq *= 1.45;
      const move = rf(r, 0.06, 0.17);
      t.price *= (1 + move);
      t.fairPrice *= (1 + move * 0.4);
      applyRep(s, 1.6);
      return {
        kind: 'modal', tone: 'good', kicker: 'Index inclusion',
        title: `${t.ticker} joins the benchmark`,
        body: `<em>${t.name}</em> has been added to the national index. Passive money must now `
            + `buy it, which means permanent volume on your tape — and a quiet vote of confidence `
            + `in your listing standards.`,
        stats: [['Move', pct(move, 1)], ['Liquidity', '+45%'], ['Standing', '+1.6']],
      };
    },
  },

  /* ─── rival poach ─────────────────────────────────────── */
  {
    id: 'poach',
    weight: 8,
    can: (s) => liveListings(s).length >= 4 && s.reputation < 74,
    run(s, r) {
      const t = liveListings(s).filter(l => l.price > l.ipoPrice).sort(bigger)[0];
      if (!t) return null;
      const stay = s.reputation > 58 && r() < 0.55;
      if (!stay) {
        t.status = 'moved';
        t.note = 'moved to a rival floor';
        applyRep(s, -1.9);
        pushLog(s, { kind: 'poach', ticker: t.ticker, text: `${t.ticker} left for a rival` });
      }
      return {
        kind: 'modal', tone: stay ? 'good' : 'bad', kicker: 'Rival exchange',
        title: stay ? `${t.ticker} stays put` : `${t.ticker} transfers out`,
        body: stay
          ? `A rival floor made a run at <em>${t.name}</em> with a fee holiday. The board declined — `
            + `they like the company they keep here.`
          : `A rival floor offered <em>${t.name}</em> a fee holiday and a friendlier index. `
            + `They took it. You keep the history and lose the volume.`,
        stats: stay ? [['Standing', '+0.0']] : [['Lost', t.ticker], ['Standing', '−1.9']],
      };
    },
  },

  /* ─── block trade windfall ────────────────────────────── */
  {
    id: 'block',
    weight: 12,
    can: (s) => liveListings(s).length >= 2,
    run(s, r) {
      const t = anyListing(s, r);
      if (!t) return null;
      const notional = t.price * t.shares * rf(r, 0.03, 0.11);
      const fee = Math.round(notional * s.balance.tradingFeeBps / 10000 * 3.4);
      s.capital += fee;
      s.stats.feesTrading += fee;
      return { kind: 'toast', tone: 'gold', text: `Block trade in ${t.ticker} — ${money(fee)} in fees` };
    },
  },

  /* ─── flash crash ─────────────────────────────────────── */
  {
    id: 'flash',
    weight: 7,
    can: (s) => liveListings(s).length >= 3 && s.day > 14,
    run(s, r) {
      const depth = rf(r, 0.05, 0.13) * (REGIMES[s.regime].vol);
      for (const l of liveListings(s)) l.price = Math.max(0.05, l.price * (1 - depth * rf(r, 0.5, 1.5)));
      const rep = -1.1;
      applyRep(s, rep);
      return {
        kind: 'modal', tone: 'bad', kicker: 'Market structure', title: 'Flash crash',
        body: `A stale quote cascaded through your matching engine and the whole board gapped down `
            + `before the circuit breakers caught it. Prints will stand. The press will not let this go `
            + `for a week.`,
        stats: [['Board', pct(-depth, 1)], ['Standing', rep.toFixed(1)]],
        shake: true,
      };
    },
  },

  /* ─── retail mania ────────────────────────────────────── */
  {
    id: 'mania',
    weight: 9,
    can: (s) => ['bull', 'euphoric'].includes(s.regime) && liveListings(s).length >= 2,
    run(s, r) {
      const t = anyListing(s, r, l => l._hype > 0.9);
      if (!t) return null;
      const move = rf(r, 0.22, 0.75);
      t.price *= (1 + move);
      t._vol *= 1.35;
      t._liq *= 1.6;
      return {
        kind: 'modal', tone: 'good', kicker: 'Retail flow', title: `${t.ticker} goes vertical`,
        body: `<em>${t.name}</em> found a message board. Volume is ten times normal and the price has `
            + `no relationship to anything in the filings. Wonderful for fees. Temporary.`,
        stats: [['Move', pct(move, 0)], ['Volatility', '+35%']],
      };
    },
  },

  /* ─── regulator inquiry ───────────────────────────────── */
  {
    id: 'inquiry',
    weight: 10,
    can: (s) => s.reputation < 46 && s.day > 12,
    run(s, r) {
      const fine = Math.round(clamp(s.capital * rf(r, 0.04, 0.11), 60_000, 4e6));
      s.capital -= fine;
      const rep = -1.2;
      applyRep(s, rep);
      return {
        kind: 'modal', tone: 'bad', kicker: 'Regulator', title: 'Formal inquiry opened',
        body: `The commission has opened a formal inquiry into your admission process. `
            + `Legal costs are immediate; the reputational bill arrives later, in instalments.`,
        stats: [['Cost', money(-fine)], ['Standing', rep.toFixed(1)]],
      };
    },
  },

  /* ─── prestige listing offer ──────────────────────────── */
  {
    id: 'prestige',
    weight: 8,
    can: (s) => s.reputation > 66 && s.tierIndex >= 1,
    run(s, r) {
      const rep = rf(r, 1.4, 3.0);
      applyRep(s, rep);
      const fee = Math.round(rf(r, 0.4, 1.6) * 1e6 * (1 + s.tierIndex));
      s.capital += fee;
      s.stats.feesListing += fee;
      return {
        kind: 'modal', tone: 'good', kicker: 'Cross-listing', title: 'A blue chip picks you',
        body: `A ${pick(r, ['sovereign', 'family-controlled', 'century-old', 'state-backed'])} issuer `
            + `has chosen your floor for a secondary listing. They did not negotiate on fees, which `
            + `tells you what your standing is now worth.`,
        stats: [['Fee', money(fee)], ['Standing', '+' + rep.toFixed(1)]],
      };
    },
  },

  /* ─── quiet day ───────────────────────────────────────── */
  {
    id: 'quiet',
    weight: 6,
    can: (s) => true,
    run(s, r) {
      return { kind: 'toast', tone: 'neu', text: pick(r, [
        'Thin tape. Nobody wants to be the first bid.',
        'Quiet session. Half the desk is at lunch.',
        'Volumes light ahead of the print.',
        'The floor is calm. Enjoy it.',
      ]) };
    },
  },
];

const COOLDOWN = { short: 9, rotation: 8, index: 20, poach: 16, flash: 22, mania: 12, inquiry: 14, prestige: 18, quiet: 6, earnings: 3, block: 5 };

export function rollEvents(s, r, dayReport) {
  s.eventCooldowns ||= {};
  for (const k of Object.keys(s.eventCooldowns)) {
    if (s.eventCooldowns[k] > 0) s.eventCooldowns[k]--;
  }
  if (s.day < 4) return [];

  const chance = 0.20 + Math.min(liveListings(s).length, 12) * 0.011;
  if (r() > chance) return [];

  const pool = EVENTS.filter(e => (s.eventCooldowns[e.id] ?? 0) <= 0 && e.can(s));
  if (!pool.length) return [];

  let total = 0;
  for (const e of pool) total += e.weight;
  let x = r() * total;
  let chosen = pool[pool.length - 1];
  for (const e of pool) { x -= e.weight; if (x <= 0) { chosen = e; break; } }

  const out = chosen.run(s, r);
  if (!out) return [];
  s.eventCooldowns[chosen.id] = COOLDOWN[chosen.id] ?? 8;
  out.id = chosen.id;
  return [out];
}
