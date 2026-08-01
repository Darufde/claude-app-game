/* ═══════════════════════════════════════════════════════════════
   haptics — best-effort. Vibration API on Android/Chrome; on iOS
   Safari we use the switch-control trick (WebKit fires a system
   haptic when a <input switch> is toggled by a label activation).
   Everything degrades silently to a no-op.
   ═══════════════════════════════════════════════════════════════ */

let enabled = true;
let iosTap = null;

const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

function buildIosTap() {
  if (iosTap || typeof document === 'undefined') return iosTap;
  try {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    Object.assign(label.style, {
      position: 'fixed', top: '-9999px', left: '-9999px',
      width: '1px', height: '1px', opacity: '0', pointerEvents: 'none',
    });
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.style.appearance = 'none';
    label.appendChild(input);
    document.body.appendChild(label);
    iosTap = { label, input };
  } catch { iosTap = null; }
  return iosTap;
}

export function init() { buildIosTap(); }
export function setEnabled(v) { enabled = !!v; }
export const isEnabled = () => enabled;

function pulseIos(times = 1) {
  const t = buildIosTap();
  if (!t) return;
  for (let i = 0; i < times; i++) {
    setTimeout(() => { try { t.label.click(); } catch {} }, i * 55);
  }
}

function fire(pattern) {
  if (!enabled) return;
  if (canVibrate) { try { navigator.vibrate(pattern); } catch {} return; }
  pulseIos(Array.isArray(pattern) ? Math.ceil(pattern.length / 2) : 1);
}

export const haptic = {
  light:   () => fire(8),
  medium:  () => fire(15),
  heavy:   () => fire(28),
  success: () => fire([10, 45, 22]),
  warn:    () => fire([18, 55, 18]),
  error:   () => fire([30, 60, 30, 60, 55]),
  select:  () => fire(6),
};
