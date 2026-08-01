/* ═══════════════════════════════════════════════════════════════
   app — bootstrap, routing, menu / setup / docs
   ═══════════════════════════════════════════════════════════════ */

import { $, $$, el, money, num, pick, rand, wait, store } from './util.js';
import {
  newGame, loadGame, hasSave, clearSave, saveGame, decorate, rngFor,
  prefs, savePrefs, meta, marketCap, DIFFICULTIES, BALANCE, liveListings, recordSession,
} from './state.js';
import { EXCHANGE_NAMES, TIERS, SECTORS, SECTOR_KEYS } from './data.js';
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
  const keys = SECTOR_KEYS;
  for (let i = 0; i < 16; i++) {
    const S = SECTORS[keys[i % keys.length]];
    const head = S.heads[Math.floor(r() * S.heads.length)];
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
    <p>You run a stock exchange. You do not pick stocks — you decide <b>who gets to be a stock</b>.
    Companies file to list on your floor. Swipe right to admit them, left to turn them away.</p>

    <h3>The three numbers</h3>
    <ul>
      <li><b>Capital</b> — cash. Listing fees and trading fees come in; operating costs go out every single day. Hit zero and you are finished.</li>
      <li><b>Standing</b> — what the market thinks of your judgement. It gates the quality of who files with you. Hit zero and the regulator closes you.</li>
      <li><b>Market cap</b> — the total value of everything on your board. It is the score, and it drives your trading fee income.</li>
    </ul>

    <h3>Why this is hard</h3>
    <p>Every prospectus shows real numbers. Some of those numbers are lies. <b>Fraudulent companies
    present better than honest ones</b> — that is the whole trap. A file with spectacular growth,
    fat margins and no debt is either the best company you have ever seen or the worst thing that
    will ever happen to you.</p>
    <p>Admit a fraud and it will eventually detonate on your board: a crash, a scandal, and a
    standing hit you will feel for weeks. Refuse a genuinely great company and it lists on a rival
    floor, doubles, and the press asks why you passed.</p>

    <h3>Due diligence</h3>
    <p>The magnifier commissions a review of the file in front of you. You get a fixed number each
    week, and each one is billed against the size of the company being reviewed — from
    <b>${money(BALANCE.auditCost)}</b> for a small filing to several million for a giant.
    Reviews come in three stages:</p>
    <ul>
      <li><b>Valuation desk</b> — what the company is actually worth against what it is asking.</li>
      <li><b>Forensic review</b> — whether the books are honest.</li>
      <li><b>Deep file</b> — surfaces disclosures that were never in the prospectus.</li>
    </ul>
    <p>Auditing a company you then admit also softens the blow if it later blows up — you did look.</p>

    <h3>Board space is the real currency</h3>
    <p>Your exchange can only list so many companies at once — <b>ten</b> at the bottom rung,
    rising to forty-eight at the top. This is the constraint the whole game turns on. You cannot
    simply approve everything: every slot you spend on something mediocre is a slot you do not
    have when something excellent files next week.</p>
    <p>Slots free up when a company is acquired, collapses, or is poached by a rival. You can also
    open <b>The Board</b>, tap any listing, and force it off yourself — it costs standing and a
    legal fee, but throwing out a disaster is far cheaper than throwing out a winner, and
    sometimes it is the only way to make room.</p>

    <h3>The clock</h3>
    <p>One decision is one trading day. Five days is a week: you settle, you get a report, your
    reviews refresh. Four weeks is a quarter: annual fees land and the regulator samples your book.
    If too much of your board is junk, they fine you.</p>

    <h3>Climbing</h3>
    <p>Standing plus scale promotes your exchange through five tiers, from a <b>Curb Market</b> to an
    <b>Apex Bourse</b>. Each tier gives you more slots, raises the valuations on your floor, and
    improves who walks through the door. That compounding is how you win.</p>
    <p>Standing is not a score you accumulate — it settles at the level your board deserves, based
    on how your listings perform, how good they genuinely are, and how full the floor is. Scandals
    leave a mark that caps how high it can ever go again.</p>

    <h3>Controls</h3>
    <ul>
      <li>Drag the card, or tap the buttons underneath it.</li>
      <li>Tap the chart icon top-right to inspect your board.</li>
      <li>On a keyboard: ← pass, → list, ↑ audit.</li>
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
    ['Frauds kept off the board', num(meta.fraudsCaught)],
  ];
  $('#records-doc').innerHTML =
    `<h3>All time</h3>` +
    rows.map(([k, v]) => `<div class="record-row"><span class="rk">${k}</span><span class="rv">${v}</span></div>`).join('') +
    `<p style="margin-top:26px">Records persist on this device only.</p>`;
}

function buildSettings() {
  const doc = $('#settings-doc');
  const rows = [
    ['sound', 'Sound', 'Synthesised market audio'],
    ['haptics', 'Haptics', 'Where the device supports it'],
    ['motion', 'Full motion', 'Shakes, flashes and flourishes'],
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
