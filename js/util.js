/* ═══════════════════════════════════════════════════════════════
   util — rng, math, formatting, dom, tweening
   ═══════════════════════════════════════════════════════════════ */

/* ─── deterministic RNG (mulberry32) ───────────────────────── */
export function makeRng(seed) {
  let a = seed >>> 0;
  const fn = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  fn.state = () => a >>> 0;
  fn.seed = (s) => { a = s >>> 0; };
  return fn;
}

export const rand = makeRng((Math.random() * 4294967296) >>> 0);

/** Uniform float in [lo, hi). */
export const rf = (r, lo, hi) => lo + r() * (hi - lo);
/** Uniform integer in [lo, hi]. */
export const ri = (r, lo, hi) => Math.floor(lo + r() * (hi - lo + 1));
/** Pick one element. */
export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
/** Pick n distinct elements (order preserved-ish). */
export function pickN(r, arr, n) {
  const pool = arr.slice(), out = [];
  n = Math.min(n, pool.length);
  for (let i = 0; i < n; i++) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}
/** Weighted pick: items = [[value, weight], ...] */
export function weighted(r, items) {
  let total = 0;
  for (const it of items) total += it[1];
  let x = r() * total;
  for (const it of items) { x -= it[1]; if (x <= 0) return it[0]; }
  return items[items.length - 1][0];
}
/** Approximate standard normal (Irwin–Hall, mean 0, sd ~1). */
export function gauss(r) {
  return (r() + r() + r() + r() + r() + r() + r() + r() + r() + r() + r() + r() - 6);
}

/* ─── math ─────────────────────────────────────────────────── */
export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (v, lo, hi) => clamp((v - lo) / (hi - lo), 0, 1);
export const round2 = (v) => Math.round(v * 100) / 100;

/* ─── formatting ───────────────────────────────────────────── */
export function money(v, { sign = false, precise = false } = {}) {
  const neg = v < 0; const a = Math.abs(v);
  let s;
  if (a >= 1e12) s = (a / 1e12).toFixed(a >= 1e13 ? 0 : 1) + 'T';
  else if (a >= 1e9) s = (a / 1e9).toFixed(a >= 1e10 ? 0 : 1) + 'B';
  else if (a >= 1e6) s = (a / 1e6).toFixed(a >= 1e8 ? 0 : (a >= 1e7 ? 1 : 2)) + 'M';
  else if (a >= 1e3) s = (a / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'K';
  else s = a.toFixed(precise ? 2 : 0);
  return (neg ? '−' : (sign ? '+' : '')) + '$' + s;
}

export const pct = (v, d = 1, sign = true) =>
  (sign && v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v * 100).toFixed(d) + '%';

export const price = (v) => '$' + (v >= 1000 ? v.toFixed(0) : v >= 100 ? v.toFixed(1) : v.toFixed(2));

export const num = (v) => v.toLocaleString('en-US');

/* ─── dom ──────────────────────────────────────────────────── */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return node;
}

export const raf = (fn) => requestAnimationFrame(fn);
export const nextFrame = () => new Promise(r => raf(() => raf(r)));
export const wait = (ms) => new Promise(r => setTimeout(r, ms));

/* ─── easing + tween ───────────────────────────────────────── */
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
export const easeInOut = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Tween a numeric value; returns a cancel fn. */
export function tween(from, to, ms, onUpdate, { ease = easeOutQuint, onDone } = {}) {
  if (ms <= 0 || from === to) { onUpdate(to, 1); onDone?.(); return () => {}; }
  const t0 = performance.now();
  let alive = true;
  const step = (now) => {
    if (!alive) return;
    const t = clamp((now - t0) / ms, 0, 1);
    onUpdate(from + (to - from) * ease(t), t);
    if (t < 1) raf(step); else onDone?.();
  };
  raf(step);
  return () => { alive = false; };
}

/** Animate a text node holding a number, with a custom formatter. */
export function countTo(node, from, to, ms, fmt) {
  node._cancel?.();
  node._cancel = tween(from, to, ms, (v) => { node.textContent = fmt(v); });
}

/* ─── color ────────────────────────────────────────────────── */
/** Deterministic pleasant hue from a string (used for ticker chips). */
export function hashHue(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 360;
}
export const chipStyle = (ticker) => {
  const h = hashHue(ticker);
  return `background:linear-gradient(150deg, hsl(${h} 62% 72%), hsl(${(h + 28) % 360} 58% 54%))`;
};

/* ─── storage ──────────────────────────────────────────────── */
export const store = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  },
  del(key) { try { localStorage.removeItem(key); } catch {} },
};
