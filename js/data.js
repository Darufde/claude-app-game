/* ═══════════════════════════════════════════════════════════════
   data — flags, underwriters, tiers, upgrades, milestones, regimes
   Sector/niche content lives in industries.js
   ═══════════════════════════════════════════════════════════════ */

export { SECTORS, SECTOR_KEYS, NICHES, nicheOf, tailsFor } from './industries.js';

/* ─── ticker generation ────────────────────────────────────── */
const VOWELS = 'AEIOU';
export function makeTicker(name, taken, r) {
  const clean = name.toUpperCase().replace(/[^A-Z ]/g, '');
  const words = clean.split(/\s+/).filter(Boolean);
  const cands = [];
  if (words.length >= 2) cands.push(words.map(w => w[0]).join('').slice(0, 4));
  const first = words[0] || 'XX';
  cands.push(first.slice(0, 4), first.slice(0, 3));
  cands.push(first[0] + first.slice(1).replace(new RegExp(`[${VOWELS}]`, 'g'), '').slice(0, 3));
  for (const c of cands) {
    const t = c.replace(/[^A-Z]/g, '');
    if (t.length >= 2 && !taken.has(t)) return t;
  }
  for (let i = 0; i < 400; i++) {
    const t = first.slice(0, 2)
      + String.fromCharCode(65 + Math.floor(r() * 26))
      + String.fromCharCode(65 + Math.floor(r() * 26));
    if (!taken.has(t)) return t;
  }
  return 'ZZ' + Math.floor(r() * 90 + 10);
}

/** Shared validation for player-chosen tickers. */
export function validateTicker(raw, taken, currentTicker) {
  const t = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  if (t.length < 2) return { ok: false, value: t, error: 'Two characters minimum.' };
  if (!/^[A-Z]/.test(t)) return { ok: false, value: t, error: 'Must start with a letter.' };
  if (t !== currentTicker && taken.has(t)) return { ok: false, value: t, error: `${t} is already on the board.` };
  return { ok: true, value: t, error: null };
}

export function validateName(raw) {
  const n = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 30);
  if (n.length < 2) return { ok: false, value: n, error: 'A little longer, please.' };
  return { ok: true, value: n, error: null };
}

/* ─── underwriters ─────────────────────────────────────────── */
export const UNDERWRITERS = [
  { name: 'Halberd & Co.',        tier: 3 },
  { name: 'Ashgrove Sachs',       tier: 3 },
  { name: 'Pell Brothers',        tier: 3 },
  { name: 'Chandler Weiss',       tier: 2 },
  { name: 'Norvane Securities',   tier: 2 },
  { name: 'Ludlow Partners',      tier: 2 },
  { name: 'Kestrel Capital Mkts', tier: 2 },
  { name: 'Dunmore & Fitch',      tier: 1 },
  { name: 'Bayside Equities',     tier: 1 },
  { name: 'Colt Vandergriff',     tier: 1 },
  { name: 'Redfern Advisory',     tier: 1 },
];

/* ─── disclosure flags ─────────────────────────────────────────
   `q` correlates the flag with genuine business quality, `f` with
   aggressive accounting. The emphasis is on what kind of company
   this is, not on catching liars.
   ────────────────────────────────────────────────────────────── */
export const FLAGS = [
  // positive
  { id: 'profitable', text: 'Profitable',            tone: 'pos', w: 1.0, q: .55, f: -.20 },
  { id: 'recurring',  text: 'Recurring revenue',     tone: 'pos', w: .85, q: .46, f: -.12 },
  { id: 'moat',       text: 'Defensible moat',       tone: 'pos', w: .75, q: .48, f: -.10 },
  { id: 'backlog',    text: 'Contracted backlog',    tone: 'pos', w: .75, q: .40, f: -.14 },
  { id: 'leader',     text: 'Category leader',       tone: 'pos', w: .6,  q: .44, f: -.08 },
  { id: 'netcash',    text: 'Net cash',              tone: 'pos', w: .7,  q: .38, f: -.18 },
  { id: 'anchor',     text: 'Anchor investors',      tone: 'pos', w: .9,  q: .30, f: -.10 },
  { id: 'lockup',     text: 'Long lock-up',          tone: 'pos', w: .8,  q: .24, f: -.14 },
  { id: 'founderled', text: 'Founder-led',           tone: 'pos', w: .9,  q: .18, f: 0 },
  { id: 'divid',      text: 'Dividend at listing',   tone: 'pos', w: .4,  q: .34, f: -.16 },

  // negative
  { id: 'burn',       text: 'Heavy cash burn',       tone: 'neg', w: 1.0, q: -.44, f: .06 },
  { id: 'concen',     text: 'Customer concentration',tone: 'neg', w: .9,  q: -.30, f: .08 },
  { id: 'capex',      text: 'Capex heavy',           tone: 'neg', w: .8,  q: -.24, f: .04 },
  { id: 'cyclical',   text: 'Peak-cycle earnings',   tone: 'neg', w: .7,  q: -.26, f: .06 },
  { id: 'unproven',   text: 'Unproven at scale',     tone: 'neg', w: .85, q: -.34, f: .10 },
  { id: 'margin',     text: 'Margin pressure',       tone: 'neg', w: .7,  q: -.30, f: .06 },
  { id: 'keyperson',  text: 'Key-person risk',       tone: 'neg', w: .6,  q: -.20, f: .06 },
  { id: 'regexp',     text: 'Regulatory exposure',   tone: 'neg', w: .65, q: -.18, f: .10 },
  { id: 'dual',       text: 'Dual-class shares',     tone: 'neg', w: .7,  q: -.12, f: .14 },
  { id: 'thinfloat',  text: 'Thin free float',       tone: 'neg', w: .7,  q: -.16, f: .10 },
  { id: 'related',    text: 'Related-party deals',   tone: 'neg', w: .45, q: -.26, f: .34 },

  // neutral / ambiguous
  { id: 'hot',        text: 'Heavily oversubscribed',tone: 'neu', w: .9,  q: .04, f: .08 },
  { id: 'retail',     text: 'Retail interest',       tone: 'neu', w: .7,  q: -.04, f: .10 },
  { id: 'pe',         text: 'PE sponsor exit',       tone: 'neu', w: .8,  q: -.08, f: .10 },
  { id: 'spin',       text: 'Corporate spin-off',    tone: 'neu', w: .6,  q: .12, f: -.04 },
  { id: 'foreign',    text: 'Foreign domicile',      tone: 'neu', w: .55, q: -.04, f: .12 },
  { id: 'cornerstone',text: 'Cornerstone investor',  tone: 'neu', w: .6,  q: .16, f: -.06 },

  // audit-only — mostly genuinely useful intelligence
  { id: 'undersold',  text: 'Priced below fair value', tone: 'pos', w: .6, q: .50, f: -.24, hidden: true },
  { id: 'solidbooks', text: 'Accounts verified clean', tone: 'pos', w: .6, q: .38, f: -.70, hidden: true },
  { id: 'pipeline',   text: 'Undisclosed pipeline',    tone: 'pos', w: .5, q: .44, f: -.10, hidden: true },
  { id: 'talent',     text: 'Exceptional bench',       tone: 'pos', w: .45, q: .40, f: -.08, hidden: true },
  { id: 'churn',      text: 'Churn worse than stated', tone: 'neg', w: .5, q: -.44, f: .40, hidden: true },
  { id: 'offbal',     text: 'Off-balance-sheet debt',  tone: 'neg', w: .45, q: -.40, f: .55, hidden: true },
  { id: 'aggressive', text: 'Aggressive revenue rec.', tone: 'neg', w: .45, q: -.38, f: .72, hidden: true },
];

export const FLAG_BY_ID = Object.fromEntries(FLAGS.map(f => [f.id, f]));

/* ─── exchange tiers ───────────────────────────────────────── */
export const TIERS = [
  { name: 'Curb Market',       rep: 0,  cap: 0,      quality: .00, valMult: 1.00, flow: 1.00, slots: 10 },
  { name: 'Regional Exchange', rep: 52, cap: 3.0e9,  quality: .08, valMult: 1.35, flow: 1.10, slots: 16 },
  { name: 'National Exchange', rep: 64, cap: 2.0e10, quality: .16, valMult: 2.10, flow: 1.20, slots: 24 },
  { name: 'Global Exchange',   rep: 75, cap: 1.1e11, quality: .24, valMult: 3.40, flow: 1.32, slots: 34 },
  { name: 'Apex Bourse',       rep: 85, cap: 4.5e11, quality: .32, valMult: 5.20, flow: 1.45, slots: 48 },
];

/* ─── exchange upgrades ────────────────────────────────────────
   The building layer. Costs scale per level; effects are read
   directly by the sim, so adding a tier here needs no other code.
   ────────────────────────────────────────────────────────────── */
export const UPGRADES = {
  analysts: {
    name: 'Analyst Desk', icon: '◎',
    blurb: 'Research staff on retainer. Each level adds a due-diligence review every week.',
    levels: 4, baseCost: 900_000, costMult: 2.6,
    effect: (lvl) => ({ audits: lvl }),
    detail: (lvl) => `+${lvl} review${lvl === 1 ? '' : 's'} per week`,
  },
  committee: {
    name: 'Listings Committee', icon: '☰',
    blurb: 'More people to vet filings means more companies you can carry at once.',
    levels: 4, baseCost: 2_400_000, costMult: 2.9,
    effect: (lvl) => ({ slots: lvl * 3 }),
    detail: (lvl) => `+${lvl * 3} board slots`,
  },
  colocation: {
    name: 'Colocation Hall', icon: '⌘',
    blurb: 'Sell rack space beside the matching engine. Every trade you host pays a little more.',
    levels: 5, baseCost: 1_400_000, costMult: 2.4,
    effect: (lvl) => ({ feeMult: 1 + lvl * 0.10 }),
    detail: (lvl) => `+${lvl * 10}% trading fee capture`,
  },
  marketing: {
    name: 'Issuer Relations', icon: '✦',
    blurb: 'Bankers who talk you up over lunch. Better companies file with you.',
    levels: 4, baseCost: 1_100_000, costMult: 2.5,
    effect: (lvl) => ({ quality: lvl * 0.045, flow: 1 + lvl * 0.08 }),
    detail: (lvl) => `+${(lvl * 4.5).toFixed(0)}% applicant quality`,
  },
  terminal: {
    name: 'Data Terminal', icon: '▦',
    blurb: 'Your own market data product. Sells to everyone, and sharpens every prospectus you read.',
    levels: 4, baseCost: 1_800_000, costMult: 2.7,
    effect: (lvl) => ({ clarity: lvl * 0.22, income: lvl * 46_000 }),
    detail: (lvl) => `Clearer filings · +$${(lvl * 46).toFixed(0)}K/day`,
  },
  surveillance: {
    name: 'Surveillance Unit', icon: '◉',
    blurb: 'Watches your own board. Catches trouble early and softens the damage when it lands.',
    levels: 3, baseCost: 2_000_000, costMult: 2.8,
    effect: (lvl) => ({ scandalCut: lvl * 0.22, repShield: lvl * 0.16 }),
    detail: (lvl) => `−${lvl * 22}% blow-up risk · −${lvl * 16}% standing damage`,
  },
};

export const UPGRADE_KEYS = Object.keys(UPGRADES);

export function upgradeCost(key, currentLevel) {
  const U = UPGRADES[key];
  if (!U || currentLevel >= U.levels) return null;
  return Math.round(U.baseCost * Math.pow(U.costMult, currentLevel) / 10000) * 10000;
}

/** Aggregate every purchased upgrade into one effect object. */
export function upgradeEffects(levels = {}) {
  const acc = { audits: 0, slots: 0, feeMult: 1, quality: 0, flow: 1, clarity: 0, income: 0, scandalCut: 0, repShield: 0 };
  for (const key of UPGRADE_KEYS) {
    const lvl = levels[key] | 0;
    if (lvl <= 0) continue;
    const e = UPGRADES[key].effect(lvl);
    for (const [k, v] of Object.entries(e)) {
      if (k === 'feeMult' || k === 'flow') acc[k] *= v;
      else acc[k] += v;
    }
  }
  return acc;
}

/* ─── milestones ───────────────────────────────────────────────
   Celebrations, not objectives. Each fires once per session.
   ────────────────────────────────────────────────────────────── */
export const MILESTONES = [
  { id: 'first',     test: (s) => s.stats.accepted >= 1,        title: 'First Listing',        body: 'Something trades here now. That is the hard part done.' },
  { id: 'named',     test: (s) => s.stats.named >= 1,           title: 'Christened',           body: 'You put your own name on a company. It is on the tape forever.' },
  { id: 'five',      test: (s) => s.liveCount >= 5,             title: 'A Real Board',         body: 'Five companies. Enough that the tape has something to say.' },
  { id: 'cap1b',     test: (s) => s.mcap >= 1e9,                title: 'One Billion',          body: 'Your floor is worth a billion. Somebody will write about this.' },
  { id: 'full',      test: (s) => s.liveCount >= s.slots,       title: 'Full House',           body: 'Every slot taken. From here, quality is the only way up.' },
  { id: 'sector5',   test: (s) => s.sectorCount >= 5,           title: 'Diversified',          body: 'Five sectors represented. One bad industry can no longer sink you.' },
  { id: 'sector9',   test: (s) => s.sectorCount >= 9,           title: 'The Whole Economy',    body: 'Nine sectors on one board. This is what a real exchange looks like.' },
  { id: 'ten',       test: (s) => s.stats.accepted >= 10,       title: 'Ten Listed',           body: 'Ten companies admitted. The filings are stacking up.' },
  { id: 'cap10b',    test: (s) => s.mcap >= 1e10,               title: 'Ten Billion',          body: 'Institutional money has to pay attention at this size.' },
  { id: 'cap100b',   test: (s) => s.mcap >= 1e11,               title: 'One Hundred Billion',  body: 'You are now market infrastructure. Nations care what you do.' },
  { id: 'cap1t',     test: (s) => s.mcap >= 1e12,               title: 'A Trillion',           body: 'There are only a handful of these in the world. One is yours.' },
  { id: 'rep80',     test: (s) => s.reputation >= 80,           title: 'Impeccable',           body: 'Standing of eighty. Founders now call you before their bankers.' },
  { id: 'ten x',     test: (s) => s.bestMultiple >= 10,         title: 'A Ten-Bagger',         body: 'One of your listings is up ten times its issue price.' },
  { id: 'upgrade1',  test: (s) => s.upgradeCount >= 1,          title: 'Building Out',         body: 'You spent capital on the exchange itself. That compounds.' },
  { id: 'upgrade6',  test: (s) => s.upgradeCount >= 6,          title: 'Institution',          body: 'Six upgrades in. This floor runs itself rather well now.' },
  { id: 'year',      test: (s) => s.week >= 52,                 title: 'A Full Year',          body: 'Fifty-two weeks of trading. You built something that lasted.' },
];

/* ─── exchange name pool ───────────────────────────────────── */
export const EXCHANGE_NAMES = [
  'MERIDIAN', 'ARCADIA', 'BRIGHTWATER', 'CONCORD', 'DELMARVA', 'EASTGATE',
  'FAIRHAVEN', 'GRANITE', 'HOLLOWAY', 'IRONGATE', 'JUNIPER', 'KESTREL',
  'LANTERN', 'MERCATOR', 'NORTHSTAR', 'OBSIDIAN', 'PARAGON', 'QUARRY',
  'REDOUBT', 'SENTINEL', 'TALLOW', 'VANGUARD', 'WESTMARK', 'ZENITH',
];

/* ─── market regimes ───────────────────────────────────────── */
export const REGIMES = {
  euphoric: { label: 'Euphoric', drift:  .0070, vol: 1.15, flow: 1.30, valMult: 1.28, tone: 'up' },
  bull:     { label: 'Bull',     drift:  .0036, vol:  .92, flow: 1.14, valMult: 1.12, tone: 'up' },
  steady:   { label: 'Steady',   drift:  .0014, vol:  .85, flow: 1.00, valMult: 1.00, tone: 'neu' },
  jittery:  { label: 'Jittery',  drift: -.0004, vol: 1.30, flow:  .94, valMult:  .95, tone: 'neu' },
  bear:     { label: 'Bear',     drift: -.0034, vol: 1.22, flow:  .82, valMult:  .85, tone: 'dn' },
  panic:    { label: 'Panic',    drift: -.0098, vol: 1.80, flow:  .60, valMult:  .70, tone: 'dn' },
};

export const REGIME_FLOW = {
  euphoric: [['euphoric', 38], ['bull', 36], ['jittery', 18], ['panic', 8]],
  bull:     [['bull', 48], ['euphoric', 16], ['steady', 28], ['jittery', 8]],
  steady:   [['steady', 48], ['bull', 24], ['jittery', 20], ['bear', 8]],
  jittery:  [['jittery', 34], ['steady', 30], ['bear', 20], ['bull', 16]],
  bear:     [['bear', 38], ['jittery', 30], ['panic', 10], ['steady', 22]],
  panic:    [['panic', 22], ['bear', 40], ['jittery', 28], ['steady', 10]],
};
