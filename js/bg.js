/* ═══════════════════════════════════════════════════════════════
   bg — ambient market backdrop (candles + grid + motes)
   Cheap enough for a phone: capped DPR, ~34fps, pauses when hidden.
   ═══════════════════════════════════════════════════════════════ */

import { clamp, gauss, rand } from './util.js';

let cv, ctx, W, H, dpr = 1;
let candles = [], motes = [], t = 0, raf = 0, last = 0;
let running = false, mood = 0;      // −1 bearish … +1 bullish
let intensity = 1;                   // dimmed on gameplay screens

const CANDLE_W = 13;
const FRAME_MS = 1000 / 34;

function seedCandles() {
  candles = [];
  let p = 60 + rand() * 25;
  const n = Math.ceil(W / (CANDLE_W * dpr)) + 4;
  for (let i = 0; i < n; i++) candles.push(nextCandle(p)), p = candles[candles.length - 1].c;
}

function nextCandle(prev) {
  const drift = mood * 0.9;
  const o = prev;
  const c = clamp(o + gauss(rand) * 1.9 + drift, 8, 132);
  const wick = Math.abs(gauss(rand)) * 1.6 + 0.5;
  return { o, c, h: Math.max(o, c) + wick, l: Math.min(o, c) - wick };
}

function resize() {
  if (!cv) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = cv.width = Math.floor(window.innerWidth * dpr);
  H = cv.height = Math.floor(window.innerHeight * dpr);
  cv.style.width = window.innerWidth + 'px';
  cv.style.height = window.innerHeight + 'px';
  seedCandles();
  motes = Array.from({ length: 26 }, () => ({
    x: rand() * W, y: rand() * H,
    vx: (rand() - 0.5) * 0.09 * dpr, vy: -(0.05 + rand() * 0.14) * dpr,
    r: (0.6 + rand() * 1.5) * dpr, a: 0.08 + rand() * 0.22,
  }));
}

function draw(now) {
  if (!running) return;
  raf = requestAnimationFrame(draw);
  if (now - last < FRAME_MS) return;
  const dt = Math.min((now - last) / 16.67, 3);
  last = now;
  t += dt;

  ctx.clearRect(0, 0, W, H);

  /* ── base wash ─────────────────────────────────────────── */
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#080c14');
  g.addColorStop(0.55, '#05080f');
  g.addColorStop(1, '#03050a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  /* ── grid ──────────────────────────────────────────────── */
  ctx.save();
  ctx.globalAlpha = 0.05 * intensity;
  ctx.strokeStyle = '#7d92c4';
  ctx.lineWidth = dpr;
  const step = 44 * dpr;
  const off = (t * 0.16) % step;
  ctx.beginPath();
  for (let y = -off; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  for (let x = -off; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  ctx.stroke();
  ctx.restore();

  /* ── candles ───────────────────────────────────────────── */
  const cw = CANDLE_W * dpr;
  const scroll = (t * 0.32) % cw;
  if (scroll < 0.4 && t > 1) { candles.push(nextCandle(candles[candles.length - 1].c)); candles.shift(); }

  const baseY = H * 0.62;
  const unit = H * 0.0055;
  ctx.save();
  ctx.globalAlpha = 0.30 * intensity;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const x = i * cw - scroll;
    const up = c.c >= c.o;
    ctx.strokeStyle = up ? 'rgba(47,212,138,.85)' : 'rgba(255,77,94,.8)';
    ctx.fillStyle = up ? 'rgba(47,212,138,.3)' : 'rgba(255,77,94,.28)';
    ctx.lineWidth = Math.max(1, dpr);
    const yH = baseY - c.h * unit, yL = baseY - c.l * unit;
    ctx.beginPath(); ctx.moveTo(x + cw / 2, yH); ctx.lineTo(x + cw / 2, yL); ctx.stroke();
    const yO = baseY - c.o * unit, yC = baseY - c.c * unit;
    const top = Math.min(yO, yC), h = Math.max(Math.abs(yC - yO), dpr);
    ctx.fillRect(x + dpr, top, cw - dpr * 3, h);
    ctx.strokeRect(x + dpr, top, cw - dpr * 3, h);
  }
  ctx.restore();

  /* ── trend line over the closes ────────────────────────── */
  ctx.save();
  ctx.globalAlpha = 0.5 * intensity;
  ctx.strokeStyle = 'rgba(232,187,98,.5)';
  ctx.lineWidth = 1.6 * dpr;
  ctx.beginPath();
  for (let i = 0; i < candles.length; i++) {
    const x = i * cw - scroll + cw / 2;
    const y = baseY - candles[i].c * unit;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  /* ── motes ─────────────────────────────────────────────── */
  ctx.save();
  for (const m of motes) {
    m.x += m.vx * dt; m.y += m.vy * dt;
    if (m.y < -10) { m.y = H + 10; m.x = rand() * W; }
    if (m.x < -10) m.x = W + 10; if (m.x > W + 10) m.x = -10;
    ctx.globalAlpha = m.a * intensity;
    ctx.fillStyle = '#cfe0ff';
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/* ─── api ──────────────────────────────────────────────────── */
export function initBackdrop() {
  cv = document.getElementById('bg-canvas');
  if (!cv) return;
  ctx = cv.getContext('2d', { alpha: false });
  resize();
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    document.hidden ? stop() : start();
  });
  start();
}
export function start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(draw); }
export function stop() { running = false; cancelAnimationFrame(raf); }
export function setMood(v) { mood = clamp(v, -1, 1); }
export function setIntensity(v) { intensity = clamp(v, 0, 1); }
/** Punch the backdrop — used on crashes and bells. */
export function shock(dir = -1) {
  for (let i = 0; i < 6; i++) candles.push(nextCandle(candles[candles.length - 1].c + dir * 5));
  candles.splice(0, 6);
}
