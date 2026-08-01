/* ═══════════════════════════════════════════════════════════════
   app — bootstrap, routing, menu / setup / docs
   ═══════════════════════════════════════════════════════════════ */

import { $, $$, el, money, num, pick, rand, wait, store } from './util.js';
import {
  newGame, loadGame, hasSave, clearSave, saveGame, decorate, rngFor,
  prefs, savePrefs, meta, marketCap, DIFFICULTIES, BALANCE, liveListings, recordSession,
} from './state.js';
import { EXCHANGE_NAMES, TIERS, SECTORS, SECTOR_KEYS, MILESTONES, NICHES } from './data.js';
import { makeRng } from './util.js';
import * as bg from './bg.js';
import { showScreen, openSheet, closeSheet, makeTape, toast, modal, isModalOpen } from './ui.js';
import { sfx, unlock as unlockAudio, setEnabled as setAudio } from './audio.js';
import { haptic, init as initHaptics, setEnabled as setHaptics } from './haptics.js';
import * as game from './game.js';

let setupDiff = 'normal';
let menuTape = null;

/* ═══ boot ════════════════════════════════════════════════════ */
async function boot() {
  bg.initBackdrop();
  initHaptics();
  setAudio(prefs.sound);
  setHaptics(prefs.haptics);
  document.documentElement.style.setProperty('--motion', prefs.motion ? '1' : '0');

  // Stagger the title letters.
  $$('#screen-menu .menu-title .lt').forEach((n, i) => n.style.setProperty('--i', i));
  $('#menu-year').textContent = String(1970 + Math.floor(rand() * 55));

  wireGlobal();
  buildHowTo();
  buildSettings();

  await wait(1750);
  enterMenu();
}

function enterMenu() {
  refreshMenu();
  showScreen('menu');
  game.stopGame();
  bg.setIntensity(1);
  if (!menuTape) menuTape = makeTape($('#menu-tape'), fakeTape());
  else menuTape.update(fakeTape());
}

function fakeTape() {
  const r = makeRng((Math.random() * 4294967296) >>> 0);
  const out = [];
  for (let i = 0; i < 16; i++) {
    // Name pools now live on niches, not sectors.
    const N = NICHES[Math.floor(r() * NICHES.length)];
    const head = N.heads[Math.floor(r() * N.heads.length)];
    const t = head.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    const ch = (r() - 0.46) * 0.09;
    out.push({
      ticker: t,
      price: '$' + (8 + r() * 240).toFixed(2),
      change: (ch >= 0 ? '+' : '−') + Math.abs(ch * 100).toFixed(2) + '%',
      dir: Math.sign(ch),
    });
  }
  return out;
}

function refreshMenu() {
  const btn = $('#btn-continue');
  const save = hasSave() ? store.get('parquet.save.v1', null) : null;
  if (save) {
    btn.hidden = false;
    const cap = (save.listings || []).filter(l => l.status === 'live')
      .reduce((t, l) => t + l.price * l.shares, 0);
    $('#continue-meta').textContent =
      `${save.name} · week ${save.week} · ${money(cap)}`;
  } else {
    btn.hidden = true;
  }

  const best = $('#menu-best');
  best.textContent = meta.sessions
    ? `BEST ${money(meta.bestCap)} · ${TIERS[meta.bestTier].name.toUpperCase()} · ${meta.bestWeeks}W`
    : 'No sessions on record';
}

/* ═══ global wiring ═══════════════════════════════════════════ */
function wireGlobal() {
  document.addEventListener('pointerdown', () => unlockAudio(), { once: true });

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const a = t.dataset.action;
    if (a !== 'accept' && a !== 'reject' && a !== 'audit') { sfx.tap(); haptic.light(); }
    route(a, t);
  });

  // Difficulty picker
  $('#diff-grid').addEventListener('click', (e) => {
    const b = e.target.closest('.diff');
    if (!b) return;
    setupDiff = b.dataset.diff;
    $$('#diff-grid .diff').forEach(d => d.toggleAttribute('data-selected', d === b));
    sfx.nav(); haptic.select();
  });

  $('#btn-dice').addEventListener('click', (e) => {
    e.preventDefault();
    $('#input-exchange').value = pick(rand, EXCHANGE_NAMES);
    sfx.nav(); haptic.select();
  });

  $('#btn-begin').addEventListener('click', () => beginGame());

  $('#input-exchange').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.target.blur(); beginGame(); }
  });

  // Desktop / keyboard play
  window.addEventListener('keydown', (e) => {
    if (isModalOpen()) return;
    const scr = document.querySelector('.screen[data-active]')?.id;
    if (scr !== 'screen-game') return;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); game.handleAction('reject'); }
    if (e.key === 'ArrowRight') { e.preventDefault(); game.handleAction('accept'); }
    if (e.key === 'ArrowUp' || e.key === ' ') { e.preventDefault(); game.handleAction('audit'); }
  });

  // Keep 100vh honest when Safari's chrome moves.
  const fixVh = () => document.documentElement.style.setProperty('--vh', window.innerHeight + 'px');
  fixVh();
  window.addEventListener('resize', fixVh, { passive: true });

  window.addEventListener('pagehide', () => {
    const s = game.getState();
    if (s && !s.over) saveGame(s, game.getRng());
  });
}

function route(action) {
  switch (action) {
    case 'new':        openSetup(); break;
    case 'continue':   resumeGame(); break;
    case 'howto':      openSheet('howto'); break;
    case 'records':    buildRecords(); openSheet('records'); break;
    case 'settings':   openSheet('settings'); break;
    case 'back-menu':  enterMenu(); break;
    case 'close-sheet': closeSheet(); break;

    case 'pause':      game.renderPause(); openSheet('pause'); break;
    case 'board':      game.renderBoard(); openSheet('board'); break;
    case 'markets':    game.renderMarkets(); openSheet('markets'); break;
    case 'funds':      game.renderFunds(); openSheet('funds'); break;
    case 'investors':  game.renderInvestors(); openSheet('investors'); break;
    case 'filings':    game.enterFilings(); break;
    case 'to-floor':   game.enterFloor(); break;
    case 'upgrades':   game.renderUpgrades(); openSheet('upgrades'); break;
    case 'close-company': closeSheet(); break;
    case 'quit':       confirmQuit(); break;

    case 'accept':
    case 'reject':
    case 'audit':      game.handleAction(action); break;
  }
}

async function confirmQuit() {
  const c = await modal({
    tone: 'bad', kicker: 'Confirm', title: 'Abandon this session?',
    body: 'Your floor closes for good. The run is recorded in your all-time figures, but the '
        + 'board and the cash are gone.',
    actions: [
      { label: 'Abandon it', kind: 'danger', value: 'yes' },
      { label: 'Keep trading', kind: 'primary', value: 'no' },
    ],
  });
  if (c !== 'yes') return;
  const s = game.getState();
  if (s) { recordSession(s); }
  clearSave();
  closeSheet();
  game.stopGame();
  enterMenu();
}

/* ═══ navigation ══════════════════════════════════════════════ */
function openSetup() {
  const input = $('#input-exchange');
  if (!input.value) input.placeholder = pick(rand, EXCHANGE_NAMES);
  showScreen('setup', { push: true });
}

function beginGame() {
  const raw = $('#input-exchange').value.trim() || $('#input-exchange').placeholder || 'MERIDIAN';
  const s = decorate(newGame({ name: raw, difficulty: setupDiff }));
  const r = rngFor(s);
  sfx.nav();
  game.startGame(s, r, { exit: onGameExit });
}

function resumeGame() {
  const s = loadGame();
  if (!s) { toast('That session could not be restored.', 'bad'); refreshMenu(); return; }
  const r = rngFor(s);
  game.startGame(s, r, { exit: onGameExit });
}

function onGameExit(where) {
  if (where === 'again') { openSetup(); }
  else enterMenu();
}

/* ═══ docs ════════════════════════════════════════════════════ */
function buildHowTo() {
  $('#howto-doc').innerHTML = `
    <h3>What you are</h3>
    <p>You run a stock exchange. You decide <b>who gets to be a stock</b>, you package those
    companies into funds, and you take a cut of everything that moves across your floor.</p>
    <p>The <b>Floor</b> is home. Your index, your capital, your assets under management and the
    wire all live there. Filings are something you go and do — a week at a time — and then you come
    back and watch what you built.</p>

    <h3>The four numbers</h3>
    <ul>
      <li><b>Capital</b> — cash. Listing fees, trading fees, data sales and management fees come in; running costs go out every session.</li>
      <li><b>Market cap</b> — everything on your board, added up.</li>
      <li><b>AUM</b> — money investors have left in your funds. You charge a fee on all of it.</li>
      <li><b>Standing</b> — what the market thinks of your judgement. It settles at the level your board deserves.</li>
    </ul>

    <h3>Admitting companies</h3>
    <p>Quality compounds. A genuinely good business drifts upward for as long as you hold it; a
    merely adequate one goes nowhere; a weak one rots. Read the prospectus properly — growth and
    margin matter, but so does what you are being asked to pay.</p>
    <p>Board space is capped: <b>ten</b> slots at the bottom rung, far more once you have built up.
    Every slot spent on something mediocre is a slot you do not have next week. Slots free up when a
    company is taken over, collapses, or is poached — and you can remove one yourself from its page.</p>
    <p>When you admit a company you can put your own name and ticker on it. It is your exchange.</p>

    <h3>Funds</h3>
    <p>A fund declares a mandate — <b>total market</b>, a single <b>sector</b>, a <b>size band</b>,
    or an <b>income</b>, <b>growth</b> or <b>quality</b> screen. Every listing that fits is a
    constituent, automatically and permanently, so a fund launched in week three quietly absorbs
    companies you admit in week thirty.</p>
    <p>You set the management fee. A higher fee earns more on every dollar and repels the money that
    reads the fine print — that trade-off is the whole product decision.</p>

    <h3>Investors</h3>
    <p>Five kinds of money watch your funds and re-score them every week. <b>Retail</b> chases
    whatever went up. <b>Pension funds</b> want low fees and low volatility. <b>Sovereign wealth</b>
    wants scale and will not touch a disreputable exchange. <b>Hedge funds</b> actively want the
    volatility, and leave as fast as they came.</p>
    <p>Their money is not just fee income: inflows have to buy the constituents, so a popular fund
    lifts the prices of everything inside it. Build the board the money wants, and the board gets
    more valuable for having been wanted.</p>

    <h3>How the market moves</h3>
    <p>Prices are not independent. Every session draws a market shock, then a shock per sector, then
    one per niche, and each company loads on all three plus its own news. <b>Two lithium miners move
    almost together; two materials companies move together but less; a miner and a software company
    share only the market.</b> Some sectors are genuinely linked — energy and materials, financials
    and property, transport and industrials.</p>
    <p>That is why breadth is worth something. A board concentrated in one sector is one bad rotation
    away from a very quiet quarter.</p>

    <h3>Building the exchange</h3>
    <p>Spend capital on the floor itself: analysts, a listings committee, colocation, issuer
    relations, a data terminal, market surveillance. These compound with everything you do afterwards.</p>

    <h3>Due diligence</h3>
    <p>The magnifier commissions a review of the file in front of you, billed against the size of the
    company. Three stages: <b>valuation</b>, <b>business review</b>, and <b>the full file</b>.
    Reviews are not free and not always worth it.</p>

    <h3>Setbacks, not endings</h3>
    <p>On <b>Founder's Market</b> and <b>Open Outcry</b> you cannot lose. Run out of cash and a
    consortium extends emergency credit — you keep trading, but the debt is real and interest is
    charged every session. Only <b>Black Monday</b> can end a run.</p>

    <h3>Controls</h3>
    <ul>
      <li>From the Floor: <b>Open the Session</b> runs a week of filings, then returns you home.</li>
      <li>Drag the prospectus, or tap the buttons underneath. Keyboard: ← pass, → list, ↑ audit.</li>
      <li>Tap any listing or fund for its full chart and history.</li>
    </ul>`;
}

function buildRecords() {
  const rows = [
    ['Sessions played', num(meta.sessions)],
    ['Best market cap', money(meta.bestCap)],
    ['Best exchange', meta.bestName || '—'],
    ['Highest tier', TIERS[meta.bestTier]?.name ?? '—'],
    ['Longest run', meta.bestWeeks + ' weeks'],
    ['Companies listed, all time', num(meta.totalListed)],
    ['Companies you named', num(meta.totalNamed || 0)],
  ];
  const got = new Set(meta.milestones || []);
  const trophies = MILESTONES.map(m =>
    `<div class="trophy ${got.has(m.id) ? 'got' : ''}">
       <div class="tt">${got.has(m.id) ? m.title : '— — —'}</div>
       <div class="td">${got.has(m.id) ? m.body : 'Not yet reached'}</div>
     </div>`).join('');

  $('#records-doc').innerHTML =
    `<h3>All time</h3>` +
    rows.map(([k, v]) => `<div class="record-row"><span class="rk">${k}</span><span class="rv">${v}</span></div>`).join('') +
    `<h3>Milestones — ${got.size} of ${MILESTONES.length}</h3>` +
    `<div class="trophies">${trophies}</div>` +
    `<p style="margin-top:26px">Records persist on this device only.</p>`;
}

function buildSettings() {
  const doc = $('#settings-doc');
  const rows = [
    ['sound', 'Sound', 'Synthesised market audio'],
    ['haptics', 'Haptics', 'Where the device supports it'],
    ['motion', 'Full motion', 'Shakes, flashes and celebrations'],
    ['naming', 'Name your listings', 'Choose a name and ticker on approval'],
  ];
  doc.innerHTML = `<h3>Preferences</h3>`;
  for (const [key, label, sub] of rows) {
    const row = el('div', { class: 'setting-row' },
      el('div', {}, el('div', { class: 'lbl', text: label }), el('div', { class: 'sub', text: sub })),
      el('button', { class: 'switch', 'data-key': key, ...(prefs[key] ? { 'data-on': '' } : {}) }),
    );
    doc.append(row);
  }
  doc.append(el('h3', { text: 'Data', style: { marginTop: '30px' } }));
  const wipe = el('button', { class: 'btn btn-danger btn-wide' }, el('span', { class: 'btn-label', text: 'Erase all records' }));
  wipe.addEventListener('click', async () => {
    const c = await modal({
      tone: 'bad', kicker: 'Confirm', title: 'Erase everything?',
      body: 'This clears your saved session and every all-time record on this device. It cannot be undone.',
      actions: [
        { label: 'Erase', kind: 'danger', value: 'yes' },
        { label: 'Keep my records', kind: 'ghost', value: 'no' },
      ],
    });
    if (c === 'yes') {
      clearSave();
      store.del('parquet.meta.v1');
      Object.assign(meta, { bestCap: 0, bestWeeks: 0, bestTier: 0, sessions: 0, totalListed: 0, fraudsCaught: 0, bestName: '' });
      toast('Records erased.', 'neu');
      refreshMenu();
    }
  });
  doc.append(wipe);
  doc.append(el('p', { style: { marginTop: '26px', fontSize: '12px' }, text: 'PARQUET — build 1.0' }));

  doc.addEventListener('click', (e) => {
    const sw = e.target.closest('.switch');
    if (!sw) return;
    const key = sw.dataset.key;
    prefs[key] = !prefs[key];
    sw.toggleAttribute('data-on', prefs[key]);
    savePrefs();
    if (key === 'sound') { setAudio(prefs.sound); if (prefs.sound) sfx.nav(); }
    if (key === 'haptics') { setHaptics(prefs.haptics); if (prefs.haptics) haptic.medium(); }
  });
}

/* ═══ service worker ══════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

boot();
