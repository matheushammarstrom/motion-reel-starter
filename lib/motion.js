// Closed-form motion. Every function here is a pure function of time, so window.seek(t) can
// paint frame 812 without simulating frames 0–811, and a render is identical every run.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;
/** 0 → 1 as x goes a → b, clamped. */
export const ramp = (x, a, b) => clamp((x - a) / (b - a));
/** 4p(1−p): 0 at both ends, 1 in the middle — the height profile of a hop. */
export const arc = (p) => 4 * clamp(p) * (1 - clamp(p));
export const smooth = (p) => {
  const x = clamp(p);
  return x * x * (3 - 2 * x);
};

/** Damped spring from 0 to 1, unit mass, stiffness k, damping d. */
export function spring(t, k = 170, d = 26) {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(k);
  const z = d / (2 * w0);
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
  }
  if (z === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  const s = Math.sqrt(z * z - 1);
  const r1 = -w0 * (z - s);
  const r2 = -w0 * (z + s);
  return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
}

// [stiffness, damping]. Tiny overshoot on UI, none on type.
export const SNAPPY = [420, 34]; // ζ≈0.83 — buttons, toggles, leading edges (≈1% overshoot)
export const POP = [400, 24]; // ζ≈0.60 — pills popping in, the landing's lp-pop-in (≈10%)
export const DEFAULT = [170, 26]; // ζ≈1.0 — cards, containers, camera
export const HEAVY = [110, 22]; // ζ≈1.05 — big type, the wordmark
export const LAZY = [40, 13]; // ζ≈1.03 — slow drifts

/**
 * A value that changes target several times. keys: [[time, value, spring?], …] sorted by time.
 * One spring per change, each starting at its own time — motion stays continuous and the
 * value at any t is still closed-form.
 */
export function track(t, keys, sp = DEFAULT) {
  let v = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [ti, vi, s = sp] = keys[i];
    if (t <= ti) break;
    v += (vi - keys[i - 1][1]) * spring(t - ti, s[0], s[1]);
  }
  return v;
}

/** Visibility of something that enters at tIn and leaves at tOut (tOut = Infinity: stays). */
export function win(t, tIn, tOut = Infinity, fadeIn = 0.12, fadeOut = 0.1) {
  return Math.min(ramp(t, tIn, tIn + fadeIn), tOut === Infinity ? 1 : 1 - ramp(t, tOut - fadeOut, tOut));
}

/** A spring-shaped bump: 0 → ~1 → 0, starting at t0. For pulses and presses. */
export function bump(t, t0, hold = 0.08, sp = SNAPPY) {
  return spring(t - t0, sp[0], sp[1]) - spring(t - t0 - hold, sp[0], sp[1]);
}

/** Seamless loop: pin the last frame to the first. */
export const loopT = (t, dur) => ((t % dur) + dur) % dur;

/** Mix two [r, g, b, a] colors. */
export function mixColor(c1, c2, p) {
  return c1.map((v, i) => lerp(v, c2[i], p));
}
export const rgba = (c) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3].toFixed(3)})`;
export function hex(h, a = 1) {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

/** Seeded PRNG (mulberry32). Never Math.random: the render must be identical every run. */
export function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
