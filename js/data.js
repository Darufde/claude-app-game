/* ═══════════════════════════════════════════════════════════════
   data — sectors, name pools, flags, underwriters, event deck
   ═══════════════════════════════════════════════════════════════ */

export const SECTORS = {
  tech: {
    label: 'Technology', vol: 0.95, liq: 1.25, hype: 1.35,
    heads: ['Nexus', 'Vertex', 'Lumen', 'Cipher', 'Quanta', 'Helix', 'Orbital', 'Sable', 'Kestrel', 'Praxis', 'Axiom', 'Nimbus', 'Zenith', 'Halcyon', 'Vantage'],
    tails: ['Systems', 'Labs', 'Dynamics', 'Compute', 'Networks', 'Technologies', 'Cloud', 'Interactive', 'Digital'],
    blurbs: [
      'Orchestration layer for enterprise workloads nobody wants to migrate.',
      'Developer tooling with a beloved community and no pricing page.',
      'Edge inference silicon. Two customers, both of them investors.',
      'Vertical SaaS for an industry that still faxes things.',
      'Data infrastructure. Growth is real; the margins are aspirational.',
      'They built an internal tool, then sold it. Now it is the whole company.',
    ],
  },
  bio: {
    label: 'Biotech', vol: 1.55, liq: 0.95, hype: 1.25,
    heads: ['Corvexa', 'Meridia', 'Alveo', 'Cytoris', 'Nuvara', 'Peptide', 'Elara', 'Somaris', 'Halcyra', 'Verdant', 'Ossia', 'Trellis'],
    tails: ['Therapeutics', 'Biosciences', 'Pharma', 'Genomics', 'Bio', 'Medical', 'Health'],
    blurbs: [
      'Phase II readout in eleven weeks. Everything rides on it.',
      'Platform company. Six programs, zero approvals, infinite optimism.',
      'Licensed a shelved compound and gave it a better name.',
      'Oncology asset with genuinely striking preclinical data.',
      'Diagnostics business subsidising a moonshot pipeline.',
      'The founder is a Nobel laureate. The CFO is her nephew.',
    ],
  },
  energy: {
    label: 'Energy', vol: 1.2, liq: 1.05, hype: 0.85,
    heads: ['Boreal', 'Cascade', 'Ironwood', 'Solstice', 'Anvil', 'Permian', 'Northwind', 'Terravolt', 'Aegis', 'Basalt'],
    tails: ['Energy', 'Power', 'Resources', 'Petroleum', 'Renewables', 'Grid', 'Hydrogen'],
    blurbs: [
      'Proven reserves, unproven management.',
      'Grid-scale storage with a signed offtake agreement.',
      'Offshore wind. Capital intensive, politically fashionable.',
      'Refining assets bought at the bottom of the cycle.',
      'Small modular reactors, large modular promises.',
      'Cash-generative today, structurally obsolete by 2040.',
    ],
  },
  fin: {
    label: 'Financials', vol: 0.9, liq: 1.35, hype: 0.9,
    heads: ['Blackrail', 'Sterling', 'Covenant', 'Ashfield', 'Harborline', 'Chandler', 'Redmont', 'Ironbank', 'Larkspur', 'Whitmore'],
    tails: ['Capital', 'Holdings', 'Financial', 'Bancorp', 'Partners', 'Credit', 'Asset Management'],
    blurbs: [
      'Specialty lender. The book looks clean, in this rate environment.',
      'Payments rails in three emerging markets and one lawsuit.',
      'Insurance float invested rather more adventurously than disclosed.',
      'Asset manager listing right as its flagship fund peaks.',
      'Consumer credit with delinquency curves drawn optimistically.',
      'Exchange-adjacent infrastructure. Boring, profitable, unloved.',
    ],
  },
  ind: {
    label: 'Industrials', vol: 0.75, liq: 0.9, hype: 0.65,
    heads: ['Girdler', 'Halloran', 'Vantablock', 'Merrow', 'Kessler', 'Braddock', 'Tarn', 'Stanchion', 'Fairweather', 'Grimsby'],
    tails: ['Industries', 'Manufacturing', 'Works', 'Engineering', 'Fabrication', 'Group'],
    blurbs: [
      'Precision components. Boring, profitable, family-controlled.',
      'Order book stretches into 2031. So does the debt schedule.',
      'Robotics integrator with genuine pricing power.',
      'Three plants, two unions, one very good CEO.',
      'Aerospace tier-two supplier. Certification is the moat.',
      'Legacy machinery business pivoting to service revenue.',
    ],
  },
  cons: {
    label: 'Consumer', vol: 1.0, liq: 1.15, hype: 1.15,
    heads: ['Marlowe', 'Hearthstone', 'Peartree', 'Bellweather', 'Copperleaf', 'Tandem', 'Wildgrove', 'Sundry', 'Latchkey', 'Rosewater'],
    tails: ['Brands', 'Company', 'Collective', 'Goods', 'Retail', 'Foods', 'Studios'],
    blurbs: [
      'Direct-to-consumer darling with a customer acquisition problem.',
      'Nine hundred stores and a lease portfolio like a hostage note.',
      'The brand is genuinely loved. The supply chain is not.',
      'Beverage company growing 40% off a very small base.',
      'Founder-led, cult following, no succession plan.',
      'Private label manufacturer nobody notices until margins move.',
    ],
  },
  re: {
    label: 'Real Estate', vol: 0.8, liq: 0.85, hype: 0.7,
    heads: ['Cornerstone', 'Kingsmere', 'Alderway', 'Pinnacle', 'Rowanhall', 'Fieldgate', 'Estuary', 'Thornbury'],
    tails: ['Properties', 'REIT', 'Estates', 'Realty', 'Land Trust', 'Development'],
    blurbs: [
      'Logistics warehouses. The tenant list is the whole thesis.',
      'Office REIT. Yes, in this market. They are aware.',
      'Data centre landlord with a queue of hyperscaler demand.',
      'Residential developer with a very leveraged balance sheet.',
      'Ground leases in three capitals. Slow, safe, dull.',
      'Retail parks bought at distressed prices in 2021.',
    ],
  },
  mine: {
    label: 'Materials', vol: 1.45, liq: 0.8, hype: 1.05,
    heads: ['Sierra Plata', 'Kolar', 'Deepvein', 'Auroch', 'Tamarind', 'Blackrock Ridge', 'Vulcan Bay', 'Quarrystone'],
    tails: ['Mining', 'Metals', 'Minerals', 'Resources', 'Extraction', 'Lithium'],
    blurbs: [
      'One asset, one jurisdiction, one very political permit.',
      'Copper grades that would be exceptional if the drill logs are real.',
      'Lithium brine with a decade of offtake demand behind it.',
      'Gold explorer that has never produced an ounce.',
      'Rare earths outside China. Everyone wants this to work.',
      'Producing mine, falling grades, rising strip ratio.',
    ],
  },
  media: {
    label: 'Media', vol: 1.25, liq: 1.2, hype: 1.4,
    heads: ['Silverline', 'Chroma', 'Fable', 'Broadsheet', 'Nightingale', 'Lantern', 'Ovation', 'Tessellate'],
    tails: ['Media', 'Studios', 'Entertainment', 'Broadcasting', 'Networks', 'Content'],
    blurbs: [
      'Content library worth more than the operating business.',
      'Streaming service with subscriber numbers defined creatively.',
      'Games studio between hits. It is always between hits.',
      'Live events business with genuinely unstoppable momentum.',
      'Legacy publisher with one very valuable franchise.',
      'Creator economy platform. Churn is the elephant.',
    ],
  },
  log: {
    label: 'Logistics', vol: 0.85, liq: 1.0, hype: 0.75,
    heads: ['Portside', 'Ridgeway', 'Continental', 'Fairhaven', 'Longhaul', 'Beacon Line', 'Trellick', 'Waypoint'],
    tails: ['Logistics', 'Freight', 'Shipping', 'Transport', 'Supply', 'Rail'],
    blurbs: [
      'Last-mile network with real density in four cities.',
      'Dry bulk shipping. Cyclical, and the cycle is turning.',
      'Cold chain operator with the pharma contracts to prove it.',
      'Regional rail concession running to 2049.',
      'Freight brokerage with a software multiple ambition.',
      'Port terminal. The permit is the business.',
    ],
  },
  space: {
    label: 'Aerospace', vol: 1.6, liq: 1.1, hype: 1.55,
    heads: ['Perihelion', 'Astra Vale', 'Kármán', 'Ionis', 'Starkeep', 'Highwater', 'Orbex Prime', 'Lodestar'],
    tails: ['Aerospace', 'Orbital', 'Launch', 'Space Systems', 'Dynamics', 'Propulsion'],
    blurbs: [
      'Two successful launches. Three unsuccessful ones. Improving.',
      'Satellite constellation, 8% deployed, 100% capitalised.',
      'Defence contracts that are real but slow and thin.',
      'In-orbit servicing. A market that does not exist yet.',
      'Propulsion supplier to everyone else in this sector.',
      'Earth observation data with genuine government demand.',
    ],
  },
  crypto: {
    label: 'Digital Assets', vol: 1.9, liq: 1.45, hype: 1.75,
    heads: ['Obelisk', 'Ledgerworks', 'Bastion', 'Aureus', 'Chainmark', 'Vaultline', 'Numeraire', 'Tessera'],
    tails: ['Digital', 'Holdings', 'Protocol Labs', 'Custody', 'Exchange', 'Treasury'],
    blurbs: [
      'Custody and settlement. The compliance build is expensive.',
      'Treasury company. The strategy is "hold, loudly".',
      'Mining fleet with a very good power contract.',
      'Institutional trading venue. Volumes follow sentiment exactly.',
      'Tokenisation platform pitching to banks that nod politely.',
      'Profitable in bull markets. That is the entire disclosure.',
    ],
  },
};

export const SECTOR_KEYS = Object.keys(SECTORS);

/* ─── ticker generation ────────────────────────────────────── */
const VOWELS = 'AEIOU';
export function makeTicker(name, taken, r) {
  const clean = name.toUpperCase().replace(/[^A-Z ]/g, '');
  const words = clean.split(/\s+/).filter(Boolean);
  const cands = [];
  if (words.length >= 2) cands.push(words.map(w => w[0]).join('').slice(0, 4));
  const first = words[0] || 'XX';
  cands.push(first.slice(0, 4));
  cands.push(first.slice(0, 3));
  cands.push(first[0] + first.slice(1).replace(new RegExp(`[${VOWELS}]`, 'g'), '').slice(0, 3));
  for (const c of cands) {
    const t = c.replace(/[^A-Z]/g, '');
    if (t.length >= 2 && !taken.has(t)) return t;
  }
  for (let i = 0; i < 400; i++) {
    const t = (first.slice(0, 2) + String.fromCharCode(65 + Math.floor(r() * 26)) + String.fromCharCode(65 + Math.floor(r() * 26)));
    if (!taken.has(t)) return t;
  }
  return 'ZZ' + Math.floor(r() * 90 + 10);
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
   `w` is the weight of the flag appearing; `q` is how much it
   correlates with true quality (positive) or fraud (negative).
   `hidden: true` flags only ever surface through an audit.
   ────────────────────────────────────────────────────────────── */
export const FLAGS = [
  // visible — positive
  { id: 'profitable',  text: 'Profitable',              tone: 'pos', w: 1.0, q: 0.55, f: -0.25 },
  { id: 'founderled',  text: 'Founder-led',             tone: 'pos', w: 0.9, q: 0.18, f: 0 },
  { id: 'moat',        text: 'Defensible moat',         tone: 'pos', w: 0.7, q: 0.42, f: -0.1 },
  { id: 'backlog',     text: 'Contracted backlog',      tone: 'pos', w: 0.7, q: 0.38, f: -0.18 },
  { id: 'anchor',      text: 'Anchor investors',        tone: 'pos', w: 0.9, q: 0.32, f: -0.12 },
  { id: 'lockup',      text: 'Long lock-up',            tone: 'pos', w: 0.8, q: 0.24, f: -0.2 },
  { id: 'divid',       text: 'Dividend at listing',     tone: 'pos', w: 0.4, q: 0.34, f: -0.22 },

  // visible — negative
  { id: 'burn',        text: 'Heavy cash burn',         tone: 'neg', w: 1.0, q: -0.42, f: 0.1 },
  { id: 'dual',        text: 'Dual-class shares',       tone: 'neg', w: 0.8, q: -0.14, f: 0.18 },
  { id: 'related',     text: 'Related-party deals',     tone: 'neg', w: 0.7, q: -0.3, f: 0.45 },
  { id: 'concen',      text: 'Customer concentration',  tone: 'neg', w: 0.9, q: -0.28, f: 0.12 },
  { id: 'litig',      text: 'Pending litigation',      tone: 'neg', w: 0.7, q: -0.24, f: 0.28 },
  { id: 'auditchg',    text: 'Auditor changed twice',   tone: 'neg', w: 0.5, q: -0.3, f: 0.55 },
  { id: 'restate',     text: 'Restated accounts',       tone: 'neg', w: 0.45, q: -0.34, f: 0.6 },
  { id: 'insider',     text: 'Founders selling down',   tone: 'neg', w: 0.7, q: -0.26, f: 0.3 },
  { id: 'cyclical',    text: 'Peak-cycle earnings',     tone: 'neg', w: 0.6, q: -0.2, f: 0.05 },

  // visible — neutral / ambiguous
  { id: 'hot',         text: 'Heavily oversubscribed',  tone: 'neu', w: 0.9, q: 0.05, f: 0.1 },
  { id: 'retail',      text: 'Retail frenzy',           tone: 'neu', w: 0.7, q: -0.05, f: 0.14 },
  { id: 'pe',          text: 'PE sponsor exit',         tone: 'neu', w: 0.8, q: -0.1, f: 0.12 },
  { id: 'spin',        text: 'Corporate spin-off',      tone: 'neu', w: 0.6, q: 0.12, f: -0.05 },
  { id: 'foreign',     text: 'Foreign domicile',        tone: 'neu', w: 0.6, q: -0.06, f: 0.2 },

  // audit-only
  { id: 'circular',    text: 'Circular revenue found',  tone: 'neg', w: 0.5, q: -0.5, f: 0.9,  hidden: true },
  { id: 'ghost',       text: 'Unverifiable customers',  tone: 'neg', w: 0.5, q: -0.45, f: 0.85, hidden: true },
  { id: 'offbal',      text: 'Off-balance-sheet debt',  tone: 'neg', w: 0.5, q: -0.4, f: 0.7,  hidden: true },
  { id: 'sanction',    text: 'Sanctioned counterparty', tone: 'neg', w: 0.35, q: -0.35, f: 0.75, hidden: true },
  { id: 'cleanbooks',  text: 'Books verified clean',    tone: 'pos', w: 0.6, q: 0.4, f: -0.8,  hidden: true },
  { id: 'undersold',   text: 'Priced below fair value', tone: 'pos', w: 0.5, q: 0.5, f: -0.3,  hidden: true },
];

export const FLAG_BY_ID = Object.fromEntries(FLAGS.map(f => [f.id, f]));

/* ─── exchange tiers ───────────────────────────────────────── */
/* `slots` is the hard cap on simultaneous listings at each tier. It is the
   spine of the whole game: board space is scarce, so every approval spends
   something you cannot get back until a company leaves. */
export const TIERS = [
  { name: 'Curb Market',       rep: 0,  cap: 0,      quality: 0.00, valMult: 1.00, flow: 1.00, slots: 10 },
  { name: 'Regional Exchange', rep: 56, cap: 3.5e9,  quality: 0.08, valMult: 1.35, flow: 1.10, slots: 16 },
  { name: 'National Exchange', rep: 68, cap: 2.4e10, quality: 0.16, valMult: 2.10, flow: 1.20, slots: 24 },
  { name: 'Global Exchange',   rep: 79, cap: 1.4e11, quality: 0.24, valMult: 3.40, flow: 1.32, slots: 34 },
  { name: 'Apex Bourse',       rep: 89, cap: 6.0e11, quality: 0.32, valMult: 5.20, flow: 1.45, slots: 48 },
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
  euphoric: { label: 'Euphoric',   drift:  0.0070, vol: 1.15, flow: 1.30, valMult: 1.28, tone: 'up' },
  bull:     { label: 'Bull',       drift:  0.0034, vol: 0.92, flow: 1.14, valMult: 1.12, tone: 'up' },
  steady:   { label: 'Steady',     drift:  0.0009, vol: 0.85, flow: 1.00, valMult: 1.00, tone: 'neu' },
  jittery:  { label: 'Jittery',    drift: -0.0008, vol: 1.35, flow: 0.92, valMult: 0.94, tone: 'neu' },
  bear:     { label: 'Bear',       drift: -0.0042, vol: 1.25, flow: 0.78, valMult: 0.82, tone: 'dn' },
  panic:    { label: 'Panic',      drift: -0.0120, vol: 1.90, flow: 0.55, valMult: 0.66, tone: 'dn' },
};

/** Regime transition matrix (row = current, weights over next). */
export const REGIME_FLOW = {
  euphoric: [['euphoric', 40], ['bull', 34], ['jittery', 18], ['panic', 8]],
  bull:     [['bull', 48], ['euphoric', 16], ['steady', 26], ['jittery', 10]],
  steady:   [['steady', 46], ['bull', 22], ['jittery', 22], ['bear', 10]],
  jittery:  [['jittery', 36], ['steady', 26], ['bear', 24], ['bull', 14]],
  bear:     [['bear', 42], ['jittery', 28], ['panic', 12], ['steady', 18]],
  panic:    [['panic', 26], ['bear', 40], ['jittery', 26], ['steady', 8]],
};
