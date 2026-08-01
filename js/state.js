/* ═══════════════════════════════════════════════════════════════
   state — the whole game world, plus save / load
   ═══════════════════════════════════════════════════════════════ */

import { store, clamp, makeRng } from './util.js';
import { TIERS, SECTOR_KEYS } from './data.js';

export const SAVE_KEY = 'parquet.save.v1';
export const META_KEY = 'parquet.meta.v1';
export const PREF_KEY = 'parquet.prefs.v1';

export const DAYS_PER_WEEK = 5;
export const WEEKS_PER_QUARTER = 4;

export const DIFFICULTIES = {
  calm:   { label: 'Bull Run',     capital: 6.0e6, rep: 58, opex: 0.86, repDecay: 0.74, audits: 4 },
  normal: { label: 'Open Outcry',  capital: 4.0e6, rep: 50, opex: 1.00, repDecay: 1.00, audits: 3 },
  brutal: { label: 'Black Monday', capital: 3.0e6, rep: 44, opex: 1.12, repDecay: 1.26, audits: 2 },
};

export const BALANCE = {
  listingFeeRate:   0.0022,   // share of the raise you collect at listing
  annualFeePerCo:   140_000,  // charged each quarter
  tradingFeeBps:    26,       // basis points of traded notional
  opexBase:         88_000,   // per trading day
  opexPerListing:   7_000,
  auditCost:        150_000,  // floor; the real cost scales with the size of the file
  auditRate:        0.00040,  // of the ask valuation
  delistThreshold:  0.24,     // of IPO price
  queueTarget:      3,
};

/* ─── prefs ────────────────────────────────────────────────── */
export const prefs = Object.assign(
  { sound: true, haptics: true, motion: true, confirmBig: true },
  store.get(PREF_KEY, {})
);
export function savePrefs() { store.set(PREF_KEY, prefs); }

/* ─── meta (records across sessions) ───────────────────────── */
export const meta = Object.assign(
  { bestCap: 0, bestWeeks: 0, bestTier: 0, sessions: 0, totalListed: 0, fraudsCaught: 0, bestName: '' },
  store.get(META_KEY, {})
);
export function saveMeta() { store.set(META_KEY, meta); }

/* ─── construction ─────────────────────────────────────────── */
export function newGame({ name, difficulty = 'normal', seed }) {
  const D = DIFFICULTIES[difficulty] ?? DIFFICULTIES.normal;
  const s = {
    version: 1,
    seed: seed ?? ((Math.random() * 4294967296) >>> 0),
    rngState: null,
    name: (name || 'MERIDIAN').toUpperCase().slice(0, 22),
    difficulty,

    capital: D.capital,
    reputation: D.rep,
    day: 1,          // 1-based, global
    week: 1,
    quarter: 1,

    regime: 'steady',
    regimeDaysLeft: 12,
    sectorHeat: Object.fromEntries(SECTOR_KEYS.map(k => [k, 0])),

    listings: [],
    queue: [],
    takenTickers: [],

    audits: D.audits,
    auditsMax: D.audits,

    balance: { ...BALANCE, opexBase: Math.round(BALANCE.opexBase * D.opex), repDecay: D.repDecay },

    stats: {
      accepted: 0, rejected: 0, delisted: 0, scandals: 0,
      fraudsCaught: 0, fraudsListed: 0, starsMissed: 0,
      feesListing: 0, feesTrading: 0, feesAnnual: 0, opexPaid: 0,
      peakCapital: D.capital, peakMcap: 0, auditsRun: 0,
    },

    history: { mcap: [], cap: [], rep: [] },
    log: [],
    over: null,          // { reason, title, body } once finished
    tierIndex: 0,
  };
  s.takenTickersSet = new Set();
  return s;
}

/* ─── derived ──────────────────────────────────────────────── */
export function liveListings(s) { return s.listings.filter(l => l.status === 'live'); }

export function marketCap(s) {
  let t = 0;
  for (const l of s.listings) if (l.status === 'live') t += l.price * l.shares;
  return t;
}

/**
 * Standing is easy to lose and progressively harder to gain — the last ten
 * points of a reputation cost far more than the first ten. Lives here rather
 * than in the sim so the event deck can reach it without a circular import.
 */
export function applyRep(s, delta) {
  if (delta < 0) delta *= s.balance.repDecay;
  else delta *= clamp(1 - Math.pow(s.reputation / 100, 2.2) * 0.88, 0.12, 1);
  s.reputation = clamp(s.reputation + delta, 0, 100);
  return delta;
}

/** How many companies this exchange may list at once. */
export function slots(s) { return (TIERS[s.tierIndex] ?? TIERS[0]).slots; }
export function slotsFree(s) { return slots(s) - liveListings(s).length; }
export function canAccept(s) { return slotsFree(s) > 0; }

export function tierIndexFor(s) {
  const cap = marketCap(s);
  let idx = 0;
  for (let i = 0; i < TIERS.length; i++) {
    if (s.reputation >= TIERS[i].rep && cap >= TIERS[i].cap) idx = i;
  }
  return idx;
}

/** Attach convenience getters used all over the sim + UI. */
export function decorate(s) {
  Object.defineProperty(s, 'tierDef', { get: () => TIERS[s.tierIndex] ?? TIERS[0], configurable: true });
  Object.defineProperty(s, 'takenTickers', {
    get: () => s.takenTickersSet, configurable: true,
    set: (v) => { s.takenTickersSet = v instanceof Set ? v : new Set(v); },
  });
  if (!s.takenTickersSet) s.takenTickersSet = new Set();
  return s;
}

export function dayOfWeek(s) { return ((s.day - 1) % DAYS_PER_WEEK) + 1; }

export function pushLog(s, entry) {
  s.log.unshift({ ...entry, day: s.day });
  if (s.log.length > 80) s.log.length = 80;
}

/* ─── persistence ──────────────────────────────────────────── */
export function serialize(s, rng) {
  const out = {
    ...s,
    rngState: rng ? rng.state() : s.rngState,
    takenTickers: [...(s.takenTickersSet || [])],
  };
  delete out.takenTickersSet;
  delete out.tierDef;
  return out;
}

export function saveGame(s, rng) {
  try { return store.set(SAVE_KEY, serialize(s, rng)); } catch { return false; }
}

export function loadGame() {
  const raw = store.get(SAVE_KEY, null);
  if (!raw || raw.version !== 1 || raw.over) return null;
  const s = raw;
  s.takenTickersSet = new Set(s.takenTickers || []);
  decorate(s);
  s.tierIndex = clamp(s.tierIndex | 0, 0, TIERS.length - 1);
  return s;
}

export function hasSave() {
  const raw = store.get(SAVE_KEY, null);
  return !!(raw && raw.version === 1 && !raw.over);
}

export function clearSave() { store.del(SAVE_KEY); }

export function rngFor(s) {
  const r = makeRng(s.seed);
  if (s.rngState != null) r.seed(s.rngState);
  return r;
}

/* ─── records ──────────────────────────────────────────────── */
export function recordSession(s) {
  const cap = marketCap(s);
  meta.sessions++;
  meta.totalListed += s.stats.accepted;
  meta.fraudsCaught += s.stats.fraudsCaught;
  if (cap > meta.bestCap) { meta.bestCap = cap; meta.bestName = s.name; }
  if (s.week > meta.bestWeeks) meta.bestWeeks = s.week;
  if (s.tierIndex > meta.bestTier) meta.bestTier = s.tierIndex;
  saveMeta();
}
