/* ═══════════════════════════════════════════════════════════════
   charts — canvas price charts

   drawPriceChart  candlestick or line, with volume, grid, axis labels,
                   issue-price reference line and an animated reveal
   drawIndexChart  the exchange's own composite index
   drawSectorBars  where your market cap actually sits
   ═══════════════════════════════════════════════════════════════ */

import { clamp, easeOutCubic, price as fmtPrice, money } from './util.js';
import { prefs } from './state.js';
import { SECTORS } from './industries.js';

const UP = '#2fd48a', DOWN = '#ff4d5e', GOLD = '#e8bb62';
const GRID = 'rgba(125,146,196,.13)';
const TEXT = 'rgba(151,163,189,.85)';

function setup(canvas, h) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 320;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function niceTicks(lo, hi, count = 4) {
  const span = hi - lo || 1;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}

/**
 * @param canvas   target <canvas>
 * @param listing  { candles, history, volumes, ipoPrice, ticker }
 * @param opts     { range: number|'all', height, mode: 'candle'|'line', animate }
 */
export function drawPriceChart(canvas, listing, opts = {}) {
  const { height = 210, mode = 'candle', animate = true } = opts;
  const { ctx, w, h } = setup(canvas, height);

  let candles = listing.candles?.length
    ? listing.candles
    : (listing.history || []).map((c, i, a) => ({ o: i ? a[i - 1] : c, h: c, l: c, c }));
  const volumes = listing.volumes || [];

  const range = opts.range === 'all' ? candles.length : Math.min(opts.range || 40, candles.length);
  const start = Math.max(0, candles.length - range);
  candles = candles.slice(start);
  const vols = volumes.slice(start);
  if (!candles.length) return;

  const padL = 6, padR = 42, padT = 8;
  const volH = vols.length ? Math.min(34, h * 0.2) : 0;
  const plotH = h - padT - volH - 16;
  const plotW = w - padL - padR;

  let lo = Infinity, hi = -Infinity;
  for (const c of candles) { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); }
  const showIssue = listing.ipoPrice != null && listing.ipoPrice >= lo * 0.55 && listing.ipoPrice <= hi * 1.45;
  if (showIssue) { lo = Math.min(lo, listing.ipoPrice); hi = Math.max(hi, listing.ipoPrice); }
  const pad = (hi - lo) * 0.10 || hi * 0.05 || 1;
  lo -= pad; hi += pad;
  const yOf = (v) => padT + plotH - ((v - lo) / (hi - lo)) * plotH;
  const xOf = (i) => padL + (candles.length === 1 ? plotW / 2 : (i / (candles.length - 1)) * plotW);

  /* ── grid + price axis ─────────────────────────────────── */
  ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  for (const t of niceTicks(lo, hi, 4)) {
    const y = yOf(t);
    if (y < padT - 2 || y > padT + plotH + 2) continue;
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y + .5); ctx.lineTo(padL + plotW, y + .5); ctx.stroke();
    ctx.fillStyle = TEXT;
    ctx.fillText(fmtPrice(t), padL + plotW + 6, y);
  }

  /* ── issue price reference ─────────────────────────────── */
  if (showIssue) {
    const y = yOf(listing.ipoPrice);
    ctx.save();
    ctx.strokeStyle = 'rgba(232,187,98,.55)';
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y + .5); ctx.lineTo(padL + plotW, y + .5); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(232,187,98,.9)';
    ctx.font = '8px ui-monospace, monospace';
    ctx.fillText('ISSUE', padL + 2, y - 7);
    ctx.restore();
  }

  /* ── volume ────────────────────────────────────────────── */
  if (vols.length) {
    const vmax = Math.max(...vols) || 1;
    const bw = Math.max(1, plotW / candles.length * 0.62);
    const vTop = padT + plotH + 12;
    for (let i = 0; i < candles.length; i++) {
      const v = vols[i] ?? 0;
      const bh = (v / vmax) * volH;
      const up = candles[i].c >= candles[i].o;
      ctx.fillStyle = up ? 'rgba(47,212,138,.28)' : 'rgba(255,77,94,.26)';
      ctx.fillRect(xOf(i) - bw / 2, vTop + volH - bh, bw, bh);
    }
  }

  /* ── the price series ──────────────────────────────────── */
  const paint = (progress) => {
    const shown = Math.max(1, Math.floor(candles.length * progress));

    // clear only the plot band so grid/volume survive the animation
    ctx.clearRect(padL - 3, padT - 4, plotW + 6, plotH + 8);
    ctx.strokeStyle = GRID; ctx.lineWidth = 1;
    for (const t of niceTicks(lo, hi, 4)) {
      const y = yOf(t);
      if (y < padT - 2 || y > padT + plotH + 2) continue;
      ctx.beginPath(); ctx.moveTo(padL, y + .5); ctx.lineTo(padL + plotW, y + .5); ctx.stroke();
    }
    if (showIssue) {
      const y = yOf(listing.ipoPrice);
      ctx.save(); ctx.strokeStyle = 'rgba(232,187,98,.55)'; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(padL, y + .5); ctx.lineTo(padL + plotW, y + .5); ctx.stroke();
      ctx.restore();
    }

    if (mode === 'candle' && candles.length <= 70) {
      const bw = Math.max(1.6, plotW / candles.length * 0.62);
      for (let i = 0; i < shown; i++) {
        const c = candles[i];
        const up = c.c >= c.o;
        const x = xOf(i);
        ctx.strokeStyle = up ? UP : DOWN;
        ctx.fillStyle = up ? 'rgba(47,212,138,.55)' : 'rgba(255,77,94,.5)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, yOf(c.h)); ctx.lineTo(x, yOf(c.l)); ctx.stroke();
        const yo = yOf(c.o), yc = yOf(c.c);
        const top = Math.min(yo, yc);
        const bh = Math.max(Math.abs(yc - yo), 1);
        ctx.fillRect(x - bw / 2, top, bw, bh);
        ctx.strokeRect(x - bw / 2, top, bw, bh);
      }
    } else {
      // dense ranges read better as an area
      const rising = candles[shown - 1].c >= candles[0].o;
      const col = rising ? UP : DOWN;
      ctx.beginPath();
      for (let i = 0; i < shown; i++) {
        const x = xOf(i), y = yOf(candles[i].c);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
      grad.addColorStop(0, rising ? 'rgba(47,212,138,.26)' : 'rgba(255,77,94,.24)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.lineTo(xOf(shown - 1), padT + plotH);
      ctx.lineTo(xOf(0), padT + plotH);
      ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();

      ctx.beginPath();
      for (let i = 0; i < shown; i++) {
        const x = xOf(i), y = yOf(candles[i].c);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = col; ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.stroke();

      const lx = xOf(shown - 1), ly = yOf(candles[shown - 1].c);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(lx, ly, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = .25;
      ctx.beginPath(); ctx.arc(lx, ly, 6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  };

  if (animate && prefs.motion && candles.length > 2) {
    const t0 = performance.now(), dur = 620;
    const step = (now) => {
      const t = clamp((now - t0) / dur, 0, 1);
      paint(easeOutCubic(t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  } else {
    paint(1);
  }
}

/** The exchange's composite index — one line, big and proud. */
export function drawIndexChart(canvas, series, opts = {}) {
  const { height = 150, animate = true } = opts;
  const { ctx, w, h } = setup(canvas, height);
  if (!series || series.length < 2) {
    ctx.fillStyle = TEXT;
    ctx.font = '11px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('The index begins with your first listing.', w / 2, h / 2);
    return;
  }

  const padL = 6, padR = 40, padT = 10, padB = 16;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  let lo = Math.min(...series), hi = Math.max(...series);
  lo = Math.min(lo, 100); hi = Math.max(hi, 100);
  const pad = (hi - lo) * .12 || 6;
  lo -= pad; hi += pad;
  const yOf = (v) => padT + plotH - ((v - lo) / (hi - lo)) * plotH;
  const xOf = (i) => padL + (i / (series.length - 1)) * plotW;

  ctx.font = '9px ui-monospace, monospace';
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  for (const t of niceTicks(lo, hi, 3)) {
    const y = yOf(t);
    if (y < padT || y > padT + plotH) continue;
    ctx.strokeStyle = GRID; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y + .5); ctx.lineTo(padL + plotW, y + .5); ctx.stroke();
    ctx.fillStyle = TEXT; ctx.fillText(t.toFixed(0), padL + plotW + 6, y);
  }

  // the 100 baseline — where you started
  const y100 = yOf(100);
  ctx.save();
  ctx.strokeStyle = 'rgba(232,187,98,.45)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, y100 + .5); ctx.lineTo(padL + plotW, y100 + .5); ctx.stroke();
  ctx.restore();

  const last = series[series.length - 1];
  const col = last >= 100 ? UP : DOWN;

  const paint = (p) => {
    const shown = Math.max(2, Math.floor(series.length * p));
    ctx.clearRect(padL - 2, padT - 6, plotW + 4, plotH + 12);
    ctx.strokeStyle = GRID; ctx.lineWidth = 1;
    for (const t of niceTicks(lo, hi, 3)) {
      const y = yOf(t);
      if (y < padT || y > padT + plotH) continue;
      ctx.beginPath(); ctx.moveTo(padL, y + .5); ctx.lineTo(padL + plotW, y + .5); ctx.stroke();
    }
    ctx.save();
    ctx.strokeStyle = 'rgba(232,187,98,.45)'; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(padL, y100 + .5); ctx.lineTo(padL + plotW, y100 + .5); ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    for (let i = 0; i < shown; i++) { const x = xOf(i), y = yOf(series[i]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.lineTo(xOf(shown - 1), padT + plotH); ctx.lineTo(xOf(0), padT + plotH); ctx.closePath();
    const g = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    g.addColorStop(0, last >= 100 ? 'rgba(47,212,138,.3)' : 'rgba(255,77,94,.26)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < shown; i++) { const x = xOf(i), y = yOf(series[i]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = col; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;

    const lx = xOf(shown - 1), ly = yOf(series[shown - 1]);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2); ctx.fill();
  };

  if (animate && prefs.motion) {
    const t0 = performance.now(), dur = 780;
    const step = (now) => {
      const t = clamp((now - t0) / dur, 0, 1);
      paint(easeOutCubic(t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  } else paint(1);
}

/** Horizontal bars: market cap by sector. */
export function drawSectorBars(canvas, buckets, opts = {}) {
  const rows = buckets.filter(b => b.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);
  const rowH = 22;
  const height = Math.max(rowH * rows.length + 8, 40);
  const { ctx, w, h } = setup(canvas, height);
  if (!rows.length) {
    ctx.fillStyle = TEXT; ctx.font = '11px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Nothing listed yet.', w / 2, h / 2);
    return;
  }
  const total = rows.reduce((t, r) => t + r.value, 0) || 1;
  const max = rows[0].value;
  const labelW = 74, valW = 52;
  const barW = w - labelW - valW - 8;

  rows.forEach((r, i) => {
    const y = 4 + i * rowH;
    const hue = SECTORS[r.key]?.hue ?? 210;
    ctx.font = '10px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(238,242,251,.82)';
    ctx.fillText(r.label.length > 12 ? r.label.slice(0, 11) + '…' : r.label, 0, y + rowH / 2 - 1);

    const bw = Math.max(2, (r.value / max) * barW);
    const grad = ctx.createLinearGradient(labelW, 0, labelW + bw, 0);
    grad.addColorStop(0, `hsla(${hue}, 62%, 46%, .95)`);
    grad.addColorStop(1, `hsla(${hue + 24}, 68%, 62%, .95)`);
    ctx.fillStyle = grad;
    const bh = 11;
    const by = y + (rowH - bh) / 2 - 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(labelW, by, bw, bh, 3);
    else ctx.rect(labelW, by, bw, bh);
    ctx.fill();

    ctx.textAlign = 'right';
    ctx.fillStyle = TEXT;
    ctx.font = '9.5px ui-monospace, monospace';
    ctx.fillText((r.value / total * 100).toFixed(0) + '%', w, y + rowH / 2 - 1);
  });
}
