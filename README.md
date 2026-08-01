# PARQUET — The Exchange

A stock exchange management game for iPhone. You don't pick stocks — you decide **who gets to be
a stock**. Companies file to list on your floor; swipe right to admit them, left to turn them away.

Built as an installable PWA: no build step, no dependencies, runs offline once installed.

---

## Play it on your iPhone

**Option A — GitHub Pages (recommended)**

1. In this repo: **Settings → Pages → Source: Deploy from a branch**, pick this branch, folder `/ (root)`.
2. Wait for the deploy, then open the published URL in **Safari** on your iPhone.
3. Tap the **Share** button → **Add to Home Screen**.
4. Launch it from the home screen. It runs full-screen with no browser chrome, and works offline.

**Option B — local network**

```bash
npx http-server -p 8123 -c-1
```

Then open `http://<your-computer's-LAN-IP>:8123` in Safari on the phone and Add to Home Screen.

> Add to Home Screen matters: in standalone mode you get the full screen (~100px more than Safari
> with its chrome showing), which is what the card layout is tuned for.

---

## The game

You start with cash, a middling reputation, and an empty board.

| Resource | What it does |
| --- | --- |
| **Capital** | Listing and trading fees come in; operating costs go out every trading day. Hit zero and you're finished. |
| **Standing** | What the market thinks of your judgement. Gates who bothers filing with you. Hit zero and the regulator closes you. |
| **Market cap** | Total value of everything on your board. It's the score, and it drives trading-fee income. |

### Why it's hard

Every prospectus shows real numbers, and some of those numbers are lies. **Fraudulent companies
present better than honest ones** — that's the trap. A file with spectacular growth, fat margins and
no debt is either the best company you've ever seen or the worst thing that will ever happen to you.

Admit a fraud and it eventually detonates: a crash, a scandal, and a standing hit that scars your
ceiling permanently. Refuse a genuinely great company and it lists on a rival floor, doubles, and
the press asks why you passed.

### Board space is the real currency

Your exchange can only list so many companies at once — **10** at the bottom rung, rising to **48**
at the top. This is the constraint everything turns on: you can't approve everything, because every
slot spent on something mediocre is a slot you don't have when something excellent files next week.

Slots free up when a company is acquired, collapses, or is poached. You can also open **The Board**,
tap a listing, and force it off yourself — costly in standing, but ejecting a disaster is far
cheaper than ejecting a winner.

### Due diligence

The magnifier commissions a review of the file in front of you, billed against the size of the
company. Three stages: **valuation desk** (what it's actually worth vs. what it's asking),
**forensic review** (whether the books are honest), and **deep file** (disclosures that were never
in the prospectus). You get a fixed number of reviews per week.

### The clock

One decision is one trading day. Five days is a week — settlement, a report, reviews refresh. Four
weeks is a quarter — annual fees land and the regulator samples your book. List too much junk and
they fine you.

### Climbing

Standing plus scale promotes you through five tiers, Curb Market → Regional → National → Global →
Apex Bourse. Each tier grants more slots, higher valuations, and better applicants. That compounding
is how you win.

### Controls

- Drag the prospectus, or tap the buttons underneath.
- Chart icon (top right) opens your board; tap any listing for detail and the delist option.
- Keyboard: ← pass, → list, ↑ audit.

---

## Structure

```
index.html             markup for every screen
css/                   base tokens · components · menu · game
js/
  app.js               bootstrap, routing, menu, setup, docs
  game.js              the core loop controller
  sim.js               market engine — prices, fees, scandals, tiers
  company.js           IPO applicant generation + due diligence
  events.js            the event deck
  state.js             game state, economy constants, save/load
  card.js              prospectus card + swipe physics
  ui.js                screens, modals, toasts, ticker tape, sparklines
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

- **Fraud inflates the visible prospectus.** Presented fundamentals derive from
  `quality + fraud × 0.62`, so a pristine file is genuinely ambiguous. That ambiguity is the game.
- **Standing is target-seeking, not accumulated.** It converges on a level derived from how your
  listings perform, how good they actually are, how full the floor is, and how many blow-ups are on
  your record. You can't bank reputation and coast.
- **Fair value compounds with quality.** Good companies drift up, bad ones rot, and prices
  mean-revert toward fair value. A well-chosen board grows on its own; a careless one bleeds.
- Balance was tuned against a headless harness playing full 52-week seasons across several
  strategies (reject-all, accept-all, coin-flip, surface-read, full-diligence, and a
  perfect-information oracle) to confirm the skill gradient is real and monotonic.
