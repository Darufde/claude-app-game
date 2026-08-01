/* ═══════════════════════════════════════════════════════════════
   celebrate — particle bursts for the moments worth marking
   A single full-screen canvas that spins up on demand and tears
   itself down when the last particle dies.
   ═══════════════════════════════════════════════════════════════ */

import { prefs } from './state.js';

let cv = null, ctx = null, parts = [], raf = 0, dpr = 1, W = 0, H = 0;

function ensure() {
  if (cv) return;
  cv = document.createElement('canvas');
  cv.id = 'fx-canvas';
  Object.assign(cv.style, {
    position: 'fixed', inset: '0', zIndex: '58',
    pointerEvents: 'none', width: '100%', height: '100%',
  });
  document.body.appendChild(cv);
  ctx = cv.getContext('2d');
  resize();
  window.addEventListener('resize', resize, { passive: true });
}

function resize() {
  if (!cv) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = cv.width = Math.floor(window.innerWidth * dpr);
  H = cv.height = Math.floor(window.innerHeight * dpr);
}

function tick() {
  raf = requestAnimationFrame(tick);
  ctx.clearRect(0, 0, W, H);
  let alive = 0;

  for (const p of parts) {
    if (p.life <= 0) continue;
    alive++;
    p.life -= 1;
    p.vy += p.g;
    p.vx *= p.drag;
    p.vy *= p.drag;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.spin;

    const t = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 1.8);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.shape === 'rect') {
      ctx.fillRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9);
    } else {
      ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  if (!alive) {
    cancelAnimationFrame(raf);
    raf = 0;
    parts = [];
    ctx.clearRect(0, 0, W, H);
  }
}

const PALETTES = {
  gold:  ['#e8bb62', '#ffd88f', '#fff3d6', '#8d6f34'],
  green: ['#2fd48a', '#86e9bd', '#e6fff4', '#1c7d55'],
  mixed: ['#e8bb62', '#2fd48a', '#59a8ff', '#ffd88f', '#ffffff'],
};

/**
 * Fire a burst.
 * @param opts { x, y (0-1 screen fractions), count, palette, spread, power, shape }
 */
export function burst(opts = {}) {
  if (!prefs.motion) return;
  ensure();
  const {
    x = 0.5, y = 0.42, count = 70, palette = 'gold',
    power = 1, spread = Math.PI * 2, angle = -Math.PI / 2, shape = 'mix',
  } = opts;
  const colors = PALETTES[palette] || PALETTES.gold;
  const ox = x * W, oy = y * H;

  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const speed = (2.4 + Math.random() * 6.5) * power * dpr;
    const maxLife = 55 + Math.random() * 55;
    parts.push({
      x: ox, y: oy,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      g: 0.16 * dpr,
      drag: 0.982,
      r: (1.6 + Math.random() * 3.4) * dpr,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      life: maxLife, maxLife,
      shape: shape === 'mix' ? (Math.random() < 0.55 ? 'rect' : 'dot') : shape,
    });
  }
  if (parts.length > 620) parts.splice(0, parts.length - 620);
  if (!raf) tick();
}

/** Two side cannons — the "you did something big" effect. */
export function cannons(palette = 'gold') {
  if (!prefs.motion) return;
  burst({ x: 0.02, y: 0.9, count: 55, palette, angle: -Math.PI / 3, spread: 0.7, power: 1.7 });
  burst({ x: 0.98, y: 0.9, count: 55, palette, angle: -Math.PI * 2 / 3, spread: 0.7, power: 1.7 });
  setTimeout(() => {
    burst({ x: 0.5, y: 0.35, count: 60, palette, power: 1.2 });
  }, 220);
}

/** A gentle upward drift — used for smaller good news. */
export function sparkle(x = 0.5, y = 0.5, palette = 'green') {
  burst({ x, y, count: 22, palette, power: 0.7, angle: -Math.PI / 2, spread: 1.6 });
}
