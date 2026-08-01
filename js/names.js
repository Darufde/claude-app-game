/* ═══════════════════════════════════════════════════════════════
   names — company name generation

   Several patterns, weighted per sector, so a biotech coins a Latinate
   coinage, an industrial is named after the family that founded it, and
   a consumer brand sounds like something you'd actually buy. The old
   Head + Tail formula is still in the mix — it just isn't the only one.
   ═══════════════════════════════════════════════════════════════ */

import { pick, weighted, rf } from './util.js';

/* ─── vocabularies ─────────────────────────────────────────── */

const SURNAMES = [
  'Ashcroft', 'Barrow', 'Calloway', 'Devereux', 'Ellingham', 'Fairbairn',
  'Garrity', 'Hollingsworth', 'Ingram', 'Jarrow', 'Kessler', 'Lindqvist',
  'Marchetti', 'Nakamura', 'Ostrander', 'Pemberton', 'Quill', 'Rothwell',
  'Sandoval', 'Thackeray', 'Ueda', 'Vandermeer', 'Whitlock', 'Yarborough',
  'Alderton', 'Bramwell', 'Corrigan', 'Danforth', 'Everly', 'Fenwick',
  'Grimshaw', 'Hartnell', 'Iverson', 'Kowalski', 'Lockhart', 'Merriweather',
  'Nystrom', 'Okonkwo', 'Prendergast', 'Ravenscroft', 'Sinclair', 'Tremaine',
  'Vasquez', 'Wexford', 'Ziegler', 'Bhandari', 'Castellanos', 'Delacroix',
];

const PLACES = [
  'Ardmore', 'Belhaven', 'Castleton', 'Dunmore', 'Ellesmere', 'Foxfield',
  'Granthorpe', 'Havenhill', 'Inverness', 'Kirkwall', 'Langdale', 'Merrivale',
  'Northgate', 'Oakhurst', 'Pentland', 'Ravensbourne', 'Silverdale', 'Thornbury',
  'Ullswater', 'Vantage Point', 'Westmere', 'Yarrow', 'Blackwater', 'Cedarbrook',
  'Drakemoor', 'Edgewater', 'Fernhill', 'Glenmara', 'Harlow', 'Kingsmead',
];

const ADJECTIVES = [
  'Iron', 'Golden', 'Silver', 'Crimson', 'Amber', 'Cobalt', 'Slate', 'Ember',
  'Northern', 'Eastern', 'Wild', 'Quiet', 'True', 'Bright', 'Deep', 'High',
  'Old', 'New', 'First', 'Grand', 'Royal', 'Common', 'Pure', 'Bold',
];

const NOUNS = [
  'Harbour', 'Anchor', 'Compass', 'Lantern', 'Meridian', 'Summit', 'Vale',
  'Ridge', 'Hollow', 'Thistle', 'Falcon', 'Otter', 'Heron', 'Badger',
  'Ferry', 'Mill', 'Forge', 'Quarry', 'Orchard', 'Meadow', 'Beacon', 'Wharf',
  'Bridge', 'Gate', 'Spire', 'Crown', 'Arrow', 'Kite', 'Ledger', 'Compass',
];

/* Syllable kit for coined names — biotech and deep tech mostly. */
const COIN_HEAD = [
  'Nov', 'Cyt', 'Zen', 'Ther', 'Vel', 'Cor', 'Lum', 'Ax', 'Ory', 'Kyn',
  'Ver', 'Sen', 'Alt', 'Prax', 'Eth', 'Ion', 'Nex', 'Sol', 'Tyr', 'Vir',
  'Hel', 'Arc', 'Bio', 'Gen', 'Immu', 'Neur', 'Card', 'Onc', 'Renu', 'Sana',
];
const COIN_MID = ['a', 'e', 'i', 'o', 'u', 'ar', 'er', 'or', 'yn', 'al', 'en'];
const COIN_TAIL = [
  'gen', 'tex', 'nix', 'dyne', 'via', 'ris', 'lex', 'con', 'mos', 'thera',
  'sys', 'lux', 'nova', 'core', 'stat', 'zen', 'phase', 'wave', 'vance', 'mira',
];

const GREEK = [
  'Alpha', 'Beta', 'Delta', 'Sigma', 'Omega', 'Kappa', 'Lambda', 'Theta',
  'Zephyr', 'Atlas', 'Helios', 'Orion', 'Vesta', 'Juno', 'Ceres', 'Hyperion',
  'Argus', 'Kronos', 'Nereid', 'Pallas', 'Triton', 'Icarus', 'Thalia',
];

const CONNECTORS = ['&', 'and'];

/* ─── pattern weights per sector ───────────────────────────────
   Each entry is [pattern, weight]. Patterns not listed never fire
   for that sector, which is what keeps the flavour distinct.      */
const PATTERNS = {
  tech:   [['coin', 22], ['greek', 16], ['headTail', 20], ['noun', 14], ['surnameTail', 8], ['bare', 12], ['adjNoun', 8]],
  bio:    [['coin', 40], ['greek', 18], ['headTail', 16], ['surnameTail', 10], ['bare', 10], ['noun', 6]],
  energy: [['headTail', 22], ['placeTail', 22], ['adjNoun', 18], ['surnameTail', 12], ['greek', 10], ['noun', 16]],
  fin:    [['surnameAmp', 26], ['surnameTail', 22], ['placeTail', 18], ['headTail', 16], ['adjNoun', 10], ['initialTail', 8]],
  ind:    [['surnameTail', 28], ['surnameAmp', 20], ['placeTail', 16], ['headTail', 16], ['initialTail', 10], ['adjNoun', 10]],
  cons:   [['adjNoun', 26], ['noun', 20], ['surnameTail', 14], ['bare', 16], ['headTail', 14], ['placeTail', 10]],
  re:     [['placeTail', 32], ['surnameTail', 18], ['adjNoun', 16], ['headTail', 18], ['noun', 16]],
  mat:    [['placeTail', 24], ['adjNoun', 20], ['headTail', 22], ['surnameTail', 14], ['greek', 10], ['noun', 10]],
  media:  [['noun', 24], ['bare', 20], ['adjNoun', 18], ['headTail', 18], ['greek', 10], ['surnameTail', 10]],
  log:    [['placeTail', 26], ['surnameTail', 18], ['headTail', 22], ['adjNoun', 16], ['noun', 10], ['initialTail', 8]],
  agri:   [['placeTail', 26], ['adjNoun', 20], ['headTail', 20], ['noun', 18], ['surnameTail', 16]],
  svc:    [['surnameAmp', 24], ['surnameTail', 24], ['placeTail', 16], ['headTail', 18], ['initialTail', 10], ['noun', 8]],
};

const DEFAULT_PATTERNS = [['headTail', 40], ['surnameTail', 20], ['placeTail', 20], ['adjNoun', 20]];

/* ─── coining ──────────────────────────────────────────────── */
function coin(r) {
  let head = pick(r, COIN_HEAD);
  let tail = pick(r, COIN_TAIL);
  // Avoid "Gengen" and friends — a repeated syllable reads as a typo.
  for (let i = 0; i < 6 && tail.toLowerCase().startsWith(head.toLowerCase()); i++) {
    tail = pick(r, COIN_TAIL);
  }
  let s = head + (r() < 0.35 ? pick(r, COIN_MID) : '') + tail;
  s = s.replace(/([aeiou])\1+/gi, '$1').replace(/(.)\1\1+/g, '$1$1');
  return s[0].toUpperCase() + s.slice(1).toLowerCase();
}

const initials = (r) => {
  const a = pick(r, SURNAMES)[0], b = pick(r, SURNAMES)[0];
  return a === b ? `${a}${b}${pick(r, SURNAMES)[0]}` : `${a}&${b}`;
};

/**
 * Build a company name.
 * @param r       seeded rng
 * @param niche   the niche record (supplies `heads`)
 * @param tails   sector tail pool ("Industries", "Therapeutics", …)
 * @param sector  sector key, selects the pattern mix
 */
export function makeCompanyName(r, niche, tails, sector) {
  const pattern = weighted(r, PATTERNS[sector] || DEFAULT_PATTERNS);
  const head = () => pick(r, niche.heads);
  const tail = () => pick(r, tails);

  switch (pattern) {
    case 'coin':        return r() < 0.45 ? `${coin(r)} ${tail()}` : coin(r);
    case 'greek':       return `${pick(r, GREEK)} ${tail()}`;
    case 'surnameAmp':  return `${pick(r, SURNAMES)} ${pick(r, CONNECTORS)} ${pick(r, SURNAMES)}`;
    case 'surnameTail': return `${pick(r, SURNAMES)} ${tail()}`;
    case 'placeTail':   return `${pick(r, PLACES)} ${tail()}`;
    case 'initialTail': return `${initials(r)} ${tail()}`;
    case 'adjNoun':     return r() < 0.22
      ? `${pick(r, ADJECTIVES)} ${pick(r, NOUNS)} ${tail()}`
      : `${pick(r, ADJECTIVES)} ${pick(r, NOUNS)}`;
    case 'noun':        return r() < 0.5 ? `${pick(r, NOUNS)} ${tail()}` : `${pick(r, ADJECTIVES)} ${pick(r, NOUNS)}`;
    case 'bare':        return head();
    case 'headTail':
    default:            return `${head()} ${tail()}`;
  }
}

/* ─── fund naming ──────────────────────────────────────────── */
const FUND_STYLES = ['Index', 'Composite', 'Select', 'Core', 'Broad', 'Prime', 'Capital'];

export function suggestFundName(exchangeName, mandateLabel, r) {
  const short = exchangeName.split(/\s+/)[0];
  // "MERCATOR Total Market Capital" is a mouthful; only add a style word
  // when the mandate label is short enough to carry one.
  const style = mandateLabel.split(/\s+/).length > 1 ? '' : ' ' + pick(r, FUND_STYLES);
  return `${short} ${mandateLabel}${style}`.replace(/\s+/g, ' ').trim().slice(0, 30);
}
