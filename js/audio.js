/* ═══════════════════════════════════════════════════════════════
   audio — fully synthesised SFX (no assets, works offline)
   ═══════════════════════════════════════════════════════════════ */

let ctx = null;
let master = null;
let enabled = true;
let unlocked = false;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.34;
  master.connect(ctx.destination);
  return ctx;
}

/** iOS requires a user gesture before audio will play. */
export function unlock() {
  if (unlocked) return;
  const c = ensure();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  // Silent tick to fully open the pipe on iOS.
  const o = c.createOscillator(), g = c.createGain();
  g.gain.value = 0.0001;
  o.connect(g); g.connect(master);
  o.start(); o.stop(c.currentTime + 0.02);
  unlocked = true;
}

export function setEnabled(v) {
  enabled = !!v;
  if (master) master.gain.setTargetAtTime(enabled ? 0.34 : 0, ctx.currentTime, 0.02);
}
export const isEnabled = () => enabled;

function env(node, t0, { a = 0.005, d = 0.09, peak = 1, sustain = 0, r = 0.05, dur = 0.15 }) {
  const g = node.gain;
  g.setValueAtTime(0.0001, t0);
  g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
  g.exponentialRampToValueAtTime(Math.max(sustain || 0.0001, 0.0001), t0 + a + d);
  g.exponentialRampToValueAtTime(0.0001, t0 + dur + r);
}

function tone(freq, opts = {}) {
  if (!enabled) return;
  const c = ensure(); if (!c || c.state === 'suspended') return;
  const {
    type = 'sine', dur = 0.16, gain = 0.5, slideTo = null,
    detune = 0, delay = 0, filter = null, q = 1,
  } = opts;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), t0 + dur);
  o.detune.value = detune;
  let last = g;
  if (filter) {
    const f = c.createBiquadFilter();
    f.type = typeof filter === 'string' ? filter : 'lowpass';
    f.frequency.value = opts.cutoff ?? 2400;
    f.Q.value = q;
    g.connect(f); last = f;
  }
  env(g, t0, { ...opts, peak: gain, dur });
  o.connect(g); last.connect(master);
  o.start(t0); o.stop(t0 + dur + (opts.r ?? 0.05) + 0.02);
}

function noise(opts = {}) {
  if (!enabled) return;
  const c = ensure(); if (!c || c.state === 'suspended') return;
  const { dur = 0.2, gain = 0.3, type = 'highpass', cutoff = 1200, q = 0.8, delay = 0, sweepTo = null } = opts;
  const t0 = c.currentTime + delay;
  const frames = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(cutoff, t0); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(sweepTo, 20), t0 + dur);
  const g = c.createGain();
  env(g, t0, { a: 0.006, d: dur * 0.5, peak: gain, dur });
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + dur + 0.02);
}

/* ─── the kit ──────────────────────────────────────────────── */
export const sfx = {
  tap:    () => tone(880, { type: 'triangle', dur: 0.05, gain: 0.16, r: 0.03 }),
  nav:    () => { tone(520, { type: 'sine', dur: 0.07, gain: 0.2 }); tone(780, { type: 'sine', dur: 0.09, gain: 0.12, delay: 0.045 }); },
  back:   () => { tone(620, { type: 'sine', dur: 0.07, gain: 0.16 }); tone(420, { type: 'sine', dur: 0.09, gain: 0.12, delay: 0.045 }); },

  swipe:  () => noise({ dur: 0.16, gain: 0.16, type: 'bandpass', cutoff: 2600, sweepTo: 700, q: 0.6 }),
  drag:   () => tone(1400, { type: 'sine', dur: 0.03, gain: 0.05, r: 0.02 }),

  accept: () => {
    tone(523.25, { type: 'triangle', dur: 0.12, gain: 0.28 });
    tone(659.25, { type: 'triangle', dur: 0.13, gain: 0.24, delay: 0.07 });
    tone(783.99, { type: 'triangle', dur: 0.24, gain: 0.22, delay: 0.14 });
    noise({ dur: 0.3, gain: 0.05, cutoff: 4000, delay: 0.05 });
  },
  reject: () => {
    tone(220, { type: 'sawtooth', dur: 0.18, gain: 0.2, slideTo: 110, filter: 'lowpass', cutoff: 900 });
    noise({ dur: 0.12, gain: 0.09, cutoff: 500, type: 'lowpass' });
  },

  cash: () => {
    [1318.5, 1760, 2093].forEach((f, i) =>
      tone(f, { type: 'triangle', dur: 0.1, gain: 0.14 - i * 0.03, delay: i * 0.055 }));
    noise({ dur: 0.22, gain: 0.06, cutoff: 5200, delay: 0.02 });
  },
  loss: () => {
    tone(311, { type: 'sawtooth', dur: 0.3, gain: 0.18, slideTo: 155, filter: 'lowpass', cutoff: 1100 });
  },

  audit: () => {
    tone(1046, { type: 'sine', dur: 0.06, gain: 0.16 });
    tone(1568, { type: 'sine', dur: 0.14, gain: 0.14, delay: 0.05 });
    noise({ dur: 0.18, gain: 0.05, cutoff: 3600, sweepTo: 9000, type: 'bandpass', q: 2 });
  },

  bell: () => {
    // Opening bell: layered inharmonic partials.
    [{ f: 660, g: 0.3 }, { f: 990, g: 0.2 }, { f: 1490, g: 0.12 }, { f: 2210, g: 0.07 }]
      .forEach(({ f, g }, i) => tone(f, { type: 'sine', dur: 1.5, gain: g, r: 0.9, delay: i * 0.006, d: 1.2 }));
    noise({ dur: 0.4, gain: 0.06, cutoff: 6000 });
  },

  alarm: () => {
    for (let i = 0; i < 3; i++) {
      tone(740, { type: 'square', dur: 0.1, gain: 0.13, delay: i * 0.17, filter: 'lowpass', cutoff: 1800 });
      tone(560, { type: 'square', dur: 0.1, gain: 0.11, delay: i * 0.17 + 0.085, filter: 'lowpass', cutoff: 1800 });
    }
  },

  tier: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      tone(f, { type: 'triangle', dur: 0.4, gain: 0.2, delay: i * 0.085, r: 0.3 }));
  },

  gameover: () => {
    [392, 349, 311, 233].forEach((f, i) =>
      tone(f, { type: 'sawtooth', dur: 0.6, gain: 0.17, delay: i * 0.22, filter: 'lowpass', cutoff: 1000, r: 0.4 }));
  },

  tick: (up) => tone(up ? 1180 : 760, { type: 'sine', dur: 0.035, gain: 0.07, r: 0.02 }),
};
