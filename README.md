# PARQUET — The Exchange

A stock exchange management game for iPhone. You don't pick stocks — you decide **who gets to be
a stock**. Companies file to list on your floor; swipe right to admit them, left to turn them away.

Built as an installable PWA: no build step, no dependencies, runs offline once installed.

## ▶ Play

**https://darufde.github.io/claude-app-game/**

Open it in **Safari** on your iPhone, then **Share → Add to Home Screen** and launch from the icon.
That gives you the full screen with no browser chrome — which is what the card layout is tuned for —
and it keeps working offline.

Deploys automatically from `main` via `.github/workflows/pages.yml`.

---

## Running it locally

```bash
git clone https://github.com/Darufde/claude-app-game.git
cd claude-app-game
npx http-server -p 8123 -c-1
```

Open `http://localhost:8123`. Arrow keys work on desktop: **←** pass, **→** list, **↑** audit.

To reach it from your phone on the same wifi, swap `localhost` for your computer's LAN IP
(`ipconfig getifaddr en0` on macOS, `hostname -I` on Linux).

> Don't open `index.html` directly from the filesystem — the game uses ES modules, which browsers
> block over `file://`. It has to be served over http.

---

## The game

You start with cash, a middling reputation, and an empty board. The **Floor** is home — your index,
your capital, your assets under management and the wire all live there. Filings are something you go
and do, a week at a time, then come back and watch what you built.

| Resource | What it does |
| --- | --- |
| **Capital** | Listing fees, trading fees and data sales come in; running costs go out every session. |
| **Standing** | What the market thinks of your judgement. It settles at the level your board deserves, and gates who files with you. |
| **Market cap** | Total value of everything on your board. It's the score, and it drives trading-fee income. |
| **AUM** | Money investors have left in your funds. You charge a management fee on all of it. |

### What actually decides it

**Quality compounds.** A genuinely good business drifts upward for as long as you hold it; a merely
adequate one goes nowhere; a weak one rots. The whole game is telling them apart before you spend a
slot on one.

Read the prospectus properly — growth and margin matter, but so does what you're being asked to pay.
A wonderful company at a silly price is still a bad listing. Aggressive accounting exists, but it's
the minority case, not the point.

Refuse a genuinely great company and it lists on a rival floor, doubles, and the press asks why you
passed.

### Setbacks, not endings

On **Founder's Market** and **Open Outcry** you can't lose. Run out of cash and a consortium extends
emergency credit — you keep trading, but the debt is real and interest is charged every session.
Lose the regulator's confidence and you go on probation rather than being closed. Only
**Black Monday** can genuinely end a run.

### Name them

When you admit a company you can put your own name and ticker on it. It's your exchange; the tape
says what you decide it says. Rename anything later from its page.

### Build the exchange

Spend capital on the floor itself — analyst desk, listings committee, colocation hall, issuer
relations, data terminal, surveillance unit. Six upgrade tracks, each compounding with everything
you list afterwards. This is the difference between a curb market and an institution.

### Funds

A fund declares a mandate — **total market**, a single **sector**, a **size band**, or an **income**,
**growth** or **quality** screen. Every listing that fits becomes a constituent automatically and
permanently, so a fund launched in week three quietly absorbs companies you admit in week thirty.

You set the management fee. Higher earns more per dollar and repels the money that reads the fine
print — that trade-off is the product decision.

### Investors

Five cohorts re-score your funds every week. Retail chases whatever went up. Pension funds want low
fees and low volatility. Sovereign wealth wants scale and won't touch a disreputable exchange. Hedge
funds actively want the volatility and leave as fast as they came.

Their money isn't only fee income: inflows have to *buy* the constituents, so a popular fund lifts
the prices of everything inside it.

### How the market moves

Prices aren't independent. Each session draws a market shock, then one per sector, then one per
niche, and every company loads on all three plus its own news. Measured over a 200-session run, the
realised correlations come out at **0.57 same-niche, 0.49 same-sector, 0.32 cross-sector** — two
lithium miners move nearly together, a miner and a software company share only the market. Some
sectors are genuinely linked (energy/materials, financials/property, transport/industrials).

That's why breadth is worth something.

### Charts

Every listing has a full candlestick chart with volume, its issue-price reference line and 1W/1M/3M/
ALL ranges. The **Markets** screen carries your exchange's own chained cap-weighted index, market cap
by sector, live sector sentiment, and the week's movers.

### Board space is the real currency

Your exchange can only list so many companies at once — **10** at the bottom rung, rising to **48**
at the top. This is the constraint everything turns on: you can't approve everything, because every
slot spent on something mediocre is a slot you don't have when something excellent files next week.

Slots free up when a company is taken over, collapses, or is poached. You can also open **The Board**,
tap a listing, and force it off yourself — costly in standing, but ejecting a disaster is far
cheaper than ejecting a winner.

Takeovers are frequent enough that the board keeps churning, so you're still making real decisions
in week forty.

### Due diligence

The magnifier commissions a review of the file in front of you, billed against the size of the
company. Three stages: **valuation desk** (what it's actually worth vs. what it's asking),
**business review** (how good it really is), and **the full file** (integrity, plus disclosures that
were never published). Reviews aren't free and aren't always worth it — that judgement is part of
the game.

### The clock

One decision is one trading day. Five days is a week — settlement, a report, reviews refresh. Four
weeks is a quarter — annual fees land and the regulator samples your book. List too much junk and
they fine you.

### Climbing

Standing plus scale promotes you through five tiers, Curb Market → Regional → National → Global →
Apex Bourse. Each tier grants more slots, richer valuations, and better applicants. A broad board
across many sectors earns more standing than a narrow one. Sixteen milestones track the build, and
they persist across sessions.

### Controls

- Drag the prospectus, or tap the buttons underneath.
- Star icon opens **Build**; chart icon opens **The Board**.
- Tap any listing for its full chart, history, rename and delist options.
- "Index" inside the board opens **Markets**.
- Keyboard: ← pass, → list, ↑ audit.

---

## Structure

```
index.html             markup for every screen
css/                   base tokens · components · menu · game · build
js/
  app.js               bootstrap, routing, menu, setup, docs
  game.js              the core loop controller
  sim.js               market engine — prices, fees, scandals, tiers
  company.js           IPO applicant generation + due diligence
  events.js            the event deck
  state.js             game state, economy constants, save/load
  card.js              prospectus card + swipe physics
  ui.js                screens, modals, toasts, ticker tape, sparklines
  floor.js             the Floor dashboard, funds and investor screens
  market.js            the factor model — market/sector/niche shocks
  funds.js             fund mandates, NAV chaining, management fees
  investors.js         the five investor cohorts and weekly allocation
  names.js             company and fund name generation
  industries.js        12 sectors, 57 niches — the company content
  charts.js            canvas candlestick / index / sector charts
  celebrate.js         particle bursts for milestones
  bg.js                animated candlestick backdrop (canvas)
  audio.js             fully synthesised SFX — no audio assets
  haptics.js           best-effort haptics, degrades to no-op
  util.js              seeded RNG, math, formatting, DOM, tweening
scripts/make-icons.mjs generates the PNG icons (no dependencies)
sw.js                  offline cache
```

Everything is vanilla ES modules — no bundler, no framework, no runtime dependencies. The
simulation is deterministic given a seed, which is what makes headless balance testing possible.

### Regenerating icons

```bash
node scripts/make-icons.mjs
```

---

## Design notes

- **Applicants are drawn as a niche first** — a radiopharmacy shop, a self-storage REIT, a cold-chain
  operator — and the niche drives naming, flavour, volatility and growth character. 57 of them.
- **Names come from several patterns weighted per sector**: biotechs coin Latinate names, industrials
  are named after the family that founded them, consumer brands sound like something you'd buy.
- **The quality neutral point sits above average on purpose.** Fair value compounds at
  `(quality − 0.55) × 0.016` per session, so an adequate business goes nowhere and only genuinely
  good ones compound. This is what makes reading the prospectus worth doing.
- **Standing is target-seeking, not accumulated.** It converges on a level derived from how your
  listings perform, how good they actually are, how full the floor is, and how many blow-ups are on
  your record. You can't bank reputation and coast.
- **Fair value compounds with quality.** Good companies drift up, bad ones rot, and prices
  mean-revert toward fair value. A well-chosen board grows on its own; a careless one bleeds.
- **The exchange index is properly chained.** It moves by the cap-weighted return of constituents
  listed on both the previous and current session, so admitting or losing a company never moves the
  index by itself — only price does.
- Balance is tuned against a headless harness playing full 52-week seasons across six strategies.
  Current spread on Open Outcry: accept-everything reaches ~$45B, careful prospectus-reading ~$154B,
  perfect information ~$214B. Nobody dies except on the hardest setting.
