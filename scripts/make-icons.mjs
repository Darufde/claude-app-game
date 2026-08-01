/* Generates the PWA / home-screen icons as real PNGs — no dependencies.
   Rasterises a dark plaque with a gold rising line and candle bars,
   then encodes with zlib. Run: node scripts/make-icons.mjs           */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(OUT, { recursive: true });

/* ─── png encoder ──────────────────────────────────────────── */
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ─── tiny raster helpers (supersampled) ───────────────────── */
const SS = 3;   // supersample factor

function makeCanvas(n) {
  const px = new Float64Array(n * n * 3);
  return {
    n, px,
    set(x, y, r, g, b, a = 1) {
      if (x < 0 || y < 0 || x >= n || y >= n) return;
      const i = (y * n + x) * 3;
      px[i] = px[i] * (1 - a) + r * a;
      px[i + 1] = px[i + 1] * (1 - a) + g * a;
      px[i + 2] = px[i + 2] * (1 - a) + b * a;
    },
    get(x, y) { const i = (y * n + x) * 3; return [px[i], px[i + 1], px[i + 2]]; },
  };
}

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const cx = ax + vx * t, cy = ay + vy * t;
  return Math.hypot(px - cx, py - cy);
}

/* ─── the artwork ──────────────────────────────────────────── */
function render(size, { maskable = false } = {}) {
  const n = size * SS;
  const cv = makeCanvas(n);
  const pad = maskable ? n * 0.16 : 0;          // maskable needs safe margin
  const inner = n - pad * 2;

  const NAVY_TOP = [22, 31, 48];
  const NAVY_BOT = [6, 9, 15];
  const GOLD = [235, 190, 104];
  const GOLD_HI = [255, 222, 154];
  const GREEN = [47, 212, 138];
  const RED = [255, 77, 94];

  // plate + gradient + corner falloff
  const radius = maskable ? inner * 0.5 : n * 0.225;
  const cx0 = pad, cy0 = pad, cx1 = pad + inner, cy1 = pad + inner;

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      // rounded-rect coverage
      const qx = Math.max(cx0 + radius - x, x - (cx1 - radius), 0);
      const qy = Math.max(cy0 + radius - y, y - (cy1 - radius), 0);
      const d = Math.hypot(qx, qy) - radius;
      const inX = x >= cx0 && x <= cx1, inY = y >= cy0 && y <= cy1;
      let cov = (inX && inY) ? Math.max(0, Math.min(1, 0.5 - d)) : 0;
      if (qx === 0 && qy === 0 && inX && inY) cov = 1;
      if (cov <= 0) continue;

      const t = (y - cy0) / inner;
      let c = mix(NAVY_TOP, NAVY_BOT, Math.min(1, Math.max(0, t)));
      // soft glow from lower-left
      const gx = (x - cx0) / inner, gy = (y - cy0) / inner;
      const glow = Math.max(0, 1 - Math.hypot(gx - 0.28, gy - 0.78) * 1.5);
      c = mix(c, [40, 60, 92], glow * 0.45);
      cv.set(x, y, c[0], c[1], c[2], cov);
    }
  }

  // candle bars along the bottom
  const bars = [
    { x: 0.20, h: 0.16, up: false },
    { x: 0.345, h: 0.26, up: true },
    { x: 0.49, h: 0.20, up: false },
    { x: 0.635, h: 0.36, up: true },
    { x: 0.78, h: 0.48, up: true },
  ];
  const bw = inner * 0.062;
  for (const b of bars) {
    const bx = cx0 + inner * b.x;
    const bottom = cy0 + inner * 0.80;
    const top = bottom - inner * b.h;
    const col = b.up ? GREEN : RED;
    for (let y = Math.floor(top); y <= Math.ceil(bottom); y++) {
      for (let x = Math.floor(bx - bw / 2); x <= Math.ceil(bx + bw / 2); x++) {
        const edgeX = Math.min(x - (bx - bw / 2), (bx + bw / 2) - x);
        const edgeY = Math.min(y - top, bottom - y);
        const a = Math.max(0, Math.min(1, edgeX)) * Math.max(0, Math.min(1, edgeY + 1));
        if (a > 0) cv.set(x, y, col[0], col[1], col[2], a * 0.30);
      }
    }
  }

  // the gold line
  const pts = [
    [0.155, 0.700], [0.315, 0.575], [0.470, 0.630],
    [0.630, 0.375], [0.775, 0.455], [0.885, 0.235],
  ].map(([px, py]) => [cx0 + inner * px, cy0 + inner * py]);

  const lw = inner * 0.052;
  const bounds = { x0: Math.floor(cx0), x1: Math.ceil(cx1), y0: Math.floor(cy0), y1: Math.ceil(cy1) };
  for (let y = bounds.y0; y < bounds.y1; y++) {
    for (let x = bounds.x0; x < bounds.x1; x++) {
      let d = Infinity;
      for (let i = 0; i < pts.length - 1; i++) {
        d = Math.min(d, segDist(x + 0.5, y + 0.5, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
      }
      const a = Math.max(0, Math.min(1, lw / 2 - d + 0.5));
      if (a <= 0) {
        const g = Math.max(0, 1 - (d - lw / 2) / (inner * 0.06));
        if (g > 0) cv.set(x, y, GOLD[0], GOLD[1], GOLD[2], g * g * 0.16);
        continue;
      }
      const shade = mix(GOLD, GOLD_HI, Math.max(0, 1 - (y - cy0) / inner));
      cv.set(x, y, shade[0], shade[1], shade[2], a);
    }
  }

  // terminal dot
  const [tx, ty] = pts[pts.length - 1];
  const dr = inner * 0.048;
  for (let y = Math.floor(ty - dr - 2); y <= Math.ceil(ty + dr + 2); y++) {
    for (let x = Math.floor(tx - dr - 2); x <= Math.ceil(tx + dr + 2); x++) {
      const d = Math.hypot(x + 0.5 - tx, y + 0.5 - ty);
      const a = Math.max(0, Math.min(1, dr - d + 0.5));
      if (a > 0) cv.set(x, y, 255, 246, 224, a);
    }
  }

  /* downsample */
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [pr, pg, pb] = cv.get(x * SS + sx, y * SS + sy);
          r += pr; g += pg; b += pb;
        }
      }
      const k = SS * SS, i = (y * size + x) * 4;
      out[i] = Math.round(r / k); out[i + 1] = Math.round(g / k);
      out[i + 2] = Math.round(b / k); out[i + 3] = 255;
    }
  }
  return encodePng(size, size, out);
}

for (const size of [180, 192, 512]) {
  writeFileSync(resolve(OUT, `icon-${size}.png`), render(size));
  console.log(`icons/icon-${size}.png`);
}
writeFileSync(resolve(OUT, 'icon-maskable-512.png'), render(512, { maskable: true }));
console.log('icons/icon-maskable-512.png');
