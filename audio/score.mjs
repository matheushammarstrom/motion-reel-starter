// The score, synthesized in code on the film's own clock (lib/timeline.js): 120 BPM house in
// A minor, every hit on a picture event. Deterministic (seeded noise), stereo, 48 kHz.
// The reverb tail past DUR is folded back onto the start so the film loops without a seam.
// Instruments first, then the arrangement: rewrite the arrangement for your film, keep the
// instruments or add your own.
//
//   node audio/score.mjs              → out/score.wav, loudness-normalised to -14 LUFS
//   SOLO=bass node audio/score.mjs    → out/solo-bass.wav at mix level, for balancing by numbers
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BEAT, BAR, DUR, T, CUES } from '../lib/timeline.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SR = 48000;
const TAIL = 3;
const N = Math.ceil((DUR + TAIL) * SR);
const L = new Float64Array(N);
const Rr = new Float64Array(N);
const sendL = new Float64Array(N); // reverb send
const sendR = new Float64Array(N);
const duck = new Float64Array(N).fill(1); // sidechain gain, written by the kick
const bar = (b) => b * 4 * BEAT;

let seed = 7;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
};
const TAU = Math.PI * 2;
const midi = (m) => 440 * 2 ** ((m - 69) / 12);
const NOTE = (name) => {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return midi(base + 12 * (Number(m[3]) + 1));
};
const idx = (t) => Math.round(t * SR);

// Every voice belongs to a group, so one group can be soloed and measured.
const SOLO = process.env.SOLO ?? '';
let GROUP = 'sfx';
const inst = (group, fn) => (...a) => {
  const prev = GROUP;
  GROUP = group;
  try {
    return fn(...a);
  } finally {
    GROUP = prev;
  }
};

const GROUP_GAIN = { sfx: 1.6 };

/** Add a mono voice at time t0 with pan (-1..1) and a reverb send amount. fn(t) → sample. */
function voice(t0, dur, fn, { gain = 1, pan = 0, send = 0, ducked = false } = {}) {
  const muted = SOLO && SOLO !== GROUP;
  gain *= GROUP_GAIN[GROUP] ?? 1;
  const i0 = idx(t0);
  const n = Math.ceil(dur * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < n; i++) {
    const k = i0 + i;
    if (k < 0 || k >= N) continue;
    let s = fn(i / SR); // always run, so noise() stays in step whatever is soloed
    if (muted) continue;
    if (ducked) s *= duck[k];
    L[k] += s * gl;
    Rr[k] += s * gr;
    if (send) {
      sendL[k] += s * gl * send;
      sendR[k] += s * gr * send;
    }
  }
}
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) * d)); // attack, then exponential decay

// ---- filters (RBJ biquads) ----
function biquad(type, f, q) {
  const w = (TAU * Math.min(f, SR * 0.45)) / SR;
  const c = Math.cos(w);
  const s = Math.sin(w);
  const al = s / (2 * q);
  let b0, b1, b2;
  if (type === 'lp') [b0, b1, b2] = [(1 - c) / 2, 1 - c, (1 - c) / 2];
  else if (type === 'hp') [b0, b1, b2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
  else [b0, b1, b2] = [al, 0, -al]; // band-pass, 0 dB peak
  const a0 = 1 + al;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * c) / a0, a2: (1 - al) / a0 };
}
function filter() {
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  return (x, co) => {
    const y = co.b0 * x + co.b1 * x1 + co.b2 * x2 - co.a1 * y1 - co.a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
}
/** Band-limited saw (PolyBLEP). */
function saw(freq) {
  let ph = 0;
  const dt = freq / SR;
  return () => {
    let v = 2 * ph - 1;
    if (ph < dt) {
      const x = ph / dt;
      v -= x + x - x * x - 1;
    } else if (ph > 1 - dt) {
      const x = (ph - 1) / dt;
      v -= x * x + x + x + 1;
    }
    ph += dt;
    if (ph >= 1) ph -= 1;
    return v;
  };
}

// =====================================================================================
// Instruments
// =====================================================================================
const kick = inst('kick', (t0, vel = 1) => {
  let ph = 0;
  voice(t0, 0.5, (t) => {
    const f = 46 + 120 * Math.exp(-t * 30);
    ph += (TAU * f) / SR;
    const body = Math.sin(ph) * env(t, 0.002, 7.5);
    const click = noise() * Math.exp(-t * 500) * 0.25;
    return Math.tanh((body + click) * 1.6) * 0.8;
  }, { gain: vel });
  // sidechain: everything ducked dips under the kick and breathes back
  const i0 = idx(t0);
  for (let i = 0; i < 0.3 * SR; i++) {
    const k = i0 + i;
    if (k >= 0 && k < N) duck[k] = Math.min(duck[k], 1 - 0.55 * Math.exp(-(i / SR) * 12));
  }
});
const clap = inst('clap', (t0, vel = 1) => {
  const bp = filter();
  const co = biquad('bp', 1250, 0.9);
  voice(t0, 0.35, (t) => {
    const bursts = [0, 0.009, 0.018, 0.028].reduce((a, o) => a + (t >= o ? Math.exp(-(t - o) * 180) : 0), 0);
    const tail = t >= 0.028 ? Math.exp(-(t - 0.028) * 16) * 0.7 : 0;
    return bp(noise(), co) * (bursts * 0.6 + tail) * 1.6;
  }, { gain: 0.85 * vel, send: 0.35 });
});
const HAT_FREQS = [205.3, 304.4, 369.6, 522.7, 540, 800];
const hat = inst('hat', (t0, open = false, vel = 1, pan = 0.25) => {
  const hp = filter();
  const co = biquad('hp', 7200, 0.7);
  const ph = HAT_FREQS.map(() => 0);
  voice(t0, open ? 0.35 : 0.08, (t) => {
    let s = 0;
    for (let j = 0; j < 6; j++) {
      ph[j] = (ph[j] + (HAT_FREQS[j] * 1.7) / SR) % 1;
      s += ph[j] < 0.5 ? 1 : -1;
    }
    return hp(s / 6 + noise() * 0.35, co) * env(t, 0.001, open ? 11 : 55);
  }, { gain: (open ? 0.42 : 0.27) * vel, pan, send: open ? 0.08 : 0 });
});
const crash = inst('hat', (t0, vel = 1) => {
  const hp = filter();
  const co = biquad('hp', 5000, 0.6);
  voice(t0, 1.6, (t) => hp(noise(), co) * env(t, 0.002, 2.6), { gain: 0.1 * vel, pan: -0.2, send: 0.3 });
});
const bass = inst('bass', (t0, note, dur = 0.22, vel = 1) => {
  const f = NOTE(note);
  const s = saw(f);
  const lp = filter();
  let ph = 0;
  voice(t0, dur + 0.05, (t) => {
    ph += (TAU * f) / SR;
    const co = biquad('lp', 220 + 900 * Math.exp(-t * 18), 0.9);
    const a = t < 0.004 ? t / 0.004 : t > dur ? Math.max(0, 1 - (t - dur) / 0.04) : 1;
    return (Math.sin(ph) * 0.8 + lp(s(), co) * 0.45) * a;
  }, { gain: 0.68 * vel, ducked: true });
});
/** A chord stab: two slightly detuned saws per note, panned apart, through a plucked low-pass. */
const stab = inst('stab', (t0, notes, { dur = 0.16, vel = 1, bright = 1, send = 0.28 } = {}) => {
  for (const [spread, pan] of [[-0.06, -0.55], [0.06, 0.55]]) {
    const oscs = notes.map((n) => saw(NOTE(n) * 2 ** (spread / 12)));
    const lp = filter();
    voice(t0, dur + 0.35, (t) => {
      const co = biquad('lp', 500 + 3800 * bright * Math.exp(-t * 14), 1.1);
      const a = env(t, 0.003, 3) * (t > dur ? Math.exp(-(t - dur) * 14) : 1);
      return lp(oscs.reduce((acc, o) => acc + o(), 0) / notes.length, co) * a;
    }, { gain: 0.36 * vel, pan, send, ducked: true });
  }
});
const pluck = inst('fx', (t0, note, { vel = 1, pan = 0, send = 0.35 } = {}) => {
  const f = NOTE(note);
  let ph = 0;
  let ph2 = 0;
  voice(t0, 0.9, (t) => {
    ph += (TAU * f) / SR;
    ph2 += (TAU * f * 2) / SR;
    return (Math.sin(ph + 0.8 * Math.sin(ph2) * Math.exp(-t * 18)) * 0.8 + Math.sin(ph2) * 0.15) * env(t, 0.002, 7);
  }, { gain: 0.22 * vel, pan, send });
});
const sub = inst('fx', (t0, note = 'A1', dur = 1.2, vel = 1) => {
  const f = NOTE(note);
  let ph = 0;
  voice(t0, dur, (t) => {
    ph += (TAU * f * (1 + 0.6 * Math.exp(-t * 25))) / SR;
    return Math.sin(ph) * env(t, 0.004, 2.6);
  }, { gain: 0.5 * vel });
});
const riser = inst('fx', (t0, dur, vel = 1) => {
  const bp = filter();
  let ph = 0;
  voice(t0, dur, (t) => {
    const p = t / dur;
    const co = biquad('bp', 400 * 15 ** p, 1.4);
    ph += (TAU * NOTE('A3') * 4 ** p) / SR;
    return (bp(noise(), co) * 1.2 + Math.sin(ph) * 0.12) * p * p;
  }, { gain: 0.3 * vel, send: 0.2 });
});

// ---- UI sounds (group "sfx"; the hook's line stabs count as music) ----
const SFX = {
  slam(c) {
    stab(c.t, ['A1', 'A2'], { dur: 0.12, vel: 1.25, bright: 0.5, send: 0.1 });
    const hp = filter();
    const co = biquad('hp', 2500, 0.7);
    voice(c.t, 0.05, (t) => hp(noise(), co) * Math.exp(-t * 90), { gain: 0.18 });
  },
  slash(c) {
    const bp = filter();
    voice(c.t - 0.02, 0.32, (t) => {
      const co = biquad('bp', 6000 * 0.12 ** (t / 0.32), 1.2);
      return bp(noise(), co) * env(t, 0.01, 9) * 1.4;
    }, { gain: 0.35, pan: -0.3, send: 0.2 });
  },
  tick(c) {
    const f = 2200 * 2 ** ((c.i ?? 0) / 6);
    voice(c.t, 0.04, (t) => Math.sin(TAU * f * t) * Math.exp(-t * 140), { gain: c.soft ? 0.07 : 0.12, pan: 0.15 });
  },
  boom(c) {
    // the kick itself is scheduled with the others
    sub(c.t, c.soft ? 'G1' : 'A1', c.soft ? 0.9 : 1.4, c.soft ? 0.6 : 1);
    if (!c.soft) stab(c.t, ['A3', 'C4', 'E4', 'A4'], { dur: 0.5, vel: 1.15, bright: 1.2, send: 0.45 });
  },
  pop(c) {
    const f = NOTE(c.note);
    let ph = 0;
    voice(c.t, 0.3, (t) => {
      ph += (TAU * f * (1 + 0.5 * Math.exp(-t * 60))) / SR;
      return Math.sin(ph) * env(t, 0.002, c.big ? 12 : 18);
    }, { gain: c.big ? 0.22 : 0.15, send: 0.25 });
  },
  whoosh(c) {
    const bp = filter();
    const dur = 0.38;
    voice(c.t - 0.18, dur, (t) => {
      const p = t / dur;
      const co = biquad('bp', 350 + 2600 * Math.sin(Math.PI * p), 0.9);
      return bp(noise(), co) * Math.sin(Math.PI * p) ** 2;
    }, { gain: 0.22, send: 0.15 });
  },
  click(c) {
    voice(c.t, 0.05, (t) => Math.sin(TAU * 1700 * t) * Math.exp(-t * 110) + noise() * Math.exp(-t * 900) * 0.4, { gain: 0.16 });
  },
  chime(c) {
    c.notes.forEach((n, j) => {
      const f = NOTE(n);
      voice(c.t + j * 0.07, 0.8, (t) => (Math.sin(TAU * f * t) + 0.25 * Math.sin(TAU * f * 2.01 * t)) * env(t, 0.002, 6), { gain: 0.1, pan: j ? 0.2 : -0.2, send: 0.4 });
    });
  },
  cash(c) {
    ['A6', 'E7'].forEach((n, j) => {
      const f = NOTE(n);
      voice(c.t + j * 0.06, 0.6, (t) => (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 2.76 * t)) * env(t, 0.001, 9), { gain: 0.08, pan: j ? 0.3 : -0.3, send: 0.35 });
    });
    const hp = filter();
    const co = biquad('hp', 8000, 0.7);
    voice(c.t, 0.4, (t) => hp(noise(), co) * env(t, 0.002, 10), { gain: 0.12, send: 0.3 });
  },
  push(c) {
    // the reminder's two soft notes, a lock-screen ding
    ['C6', 'G6'].forEach((n, j) => {
      const f = NOTE(n);
      voice(c.t + j * 0.09, 0.7, (t) => (Math.sin(TAU * f * t) + 0.2 * Math.sin(TAU * f * 3.01 * t)) * env(t, 0.003, 7), { gain: 0.09, pan: j ? 0.25 : -0.1, send: 0.45 });
    });
  },
  key(c) {
    // a key tap on the glass: a short bright tick with a little noise
    const f = 2600 + (c.i ?? 0) * 180;
    voice(c.t, 0.05, (t) => Math.sin(TAU * f * t) * Math.exp(-t * 160) * 0.7 + noise() * Math.exp(-t * 700) * 0.35, { gain: 0.1, pan: 0.1 });
  },
  thud(c) {
    // a paste landing: a short low thump with a little paper noise
    let ph = 0;
    voice(c.t, 0.25, (t) => {
      ph += (TAU * (70 + 90 * Math.exp(-t * 40))) / SR;
      return Math.sin(ph) * env(t, 0.003, 18) * 0.8 + noise() * Math.exp(-t * 300) * 0.15;
    }, { gain: 0.3 });
  },
  suck(c) {
    const bp = filter();
    const dur = 0.3;
    voice(c.t - 0.05, dur, (t) => {
      const p = t / dur;
      const co = biquad('bp', 4000 * 0.1 ** p, 1.1);
      return bp(noise(), co) * p * p * 1.5;
    }, { gain: 0.3, send: 0.2 });
  },
};

// =====================================================================================
// Arrangement, the sample: the hook, a groove from the drop to the fold, the lockup.
// =====================================================================================
const CHORDS = {
  Am: { bass: 'A1', stab: ['A3', 'C4', 'E4'] },
  F: { bass: 'F1', stab: ['A3', 'C4', 'F4'] },
  C: { bass: 'C2', stab: ['G3', 'C4', 'E4'] },
  G: { bass: 'G1', stab: ['G3', 'B3', 'D4'] },
};
const PROG = ['Am', 'F', 'C', 'G'];
/** The chord under a moment: one per bar from the drop, cycling the four. */
const chordAt = (t) => CHORDS[PROG[((Math.floor((t - T.drop) / BAR) % 4) + 4) % 4]];
/** Beat times in [t0, t1), on the grid. */
const beats = (t0, t1, step = BEAT) => {
  const out = [];
  for (let t = Math.ceil(t0 / step - 1e-9) * step; t < t1 - 1e-9; t += step) out.push(+t.toFixed(6));
  return out;
};

// Kicks first: every later voice that is `ducked` reads the sidechain they write.
const KICKS = T.lines.map((t) => [t, 0.95]).concat([[T.strike, 1]]);
for (const tb of beats(T.drop, T.fold)) KICKS.push([tb, (tb - T.drop) % BAR < 1e-6 ? 1 : 0.92]);
for (const tb of beats(T.lockup, T.outro)) KICKS.push([tb, (tb - T.lockup) % BAR < 1e-6 ? 1 : 0.92]);
for (const c of CUES) if (c.type === 'boom') KICKS.push([c.t, c.soft ? 0.7 : 1]);
for (const [t, v] of KICKS) kick(t, v);

// The hook: a clock of closed hats under the lines, then strike → riser → boom → logo.
for (let s = 0; s < 6; s++) hat((s * BEAT) / 2, false, 0.6 + (s % 2) * 0.3, 0.3);
clap(T.strike, 1.2);
riser(T.absorb - 0.1, 0.55, 1);
pluck(T.wordmark, 'E5', { vel: 1, pan: -0.2 });
pluck(T.wordmark + BEAT / 2, 'A5', { vel: 1.1, pan: 0.2 });

/** One beat of the groove at tb: clap on 2 and 4, hats, the offbeat bass. `origin` is the section's downbeat. */
function grooveBeat(tb, { outro = false, origin = T.drop } = {}) {
  const ch = chordAt(tb);
  const beat = Math.round(((tb - origin) % BAR) / BEAT) % 4;
  if (!outro && (beat === 1 || beat === 3)) clap(tb);
  hat(tb + BEAT / 2, true, 0.9, -0.25);
  if (!outro) for (let s = 0; s < 4; s++) hat(tb + (s * BEAT) / 4, false, s === 2 ? 0.35 : 0.55 + 0.2 * (s % 2), 0.3);
  bass(tb + BEAT / 2, beat === 3 ? ch.bass.replace(/\d/, (d) => String(Number(d) + 1)) : ch.bass, 0.2, outro ? 0.8 : 1);
  if (beat === 0) stab(tb + BEAT / 2, ch.stab, { vel: outro ? 0.7 : 0.95 });
  if (beat === 2) stab(tb + BEAT / 2, ch.stab, { vel: outro ? 0.6 : 0.9 });
}
for (const tb of beats(T.drop, T.fold)) grooveBeat(tb);
for (const tb of beats(T.lockup, T.outro)) grooveBeat(tb, { outro: tb >= T.lockup + BAR, origin: T.lockup });
crash(T.drop, 1.2);
crash(T.lockup, 1.1);
pluck(T.lockup + BEAT / 2, 'E5', { vel: 0.9, pan: -0.2 });
pluck(T.lockup + BEAT, 'A5', { vel: 1, pan: 0.2 });

for (const c of CUES) SFX[c.type](c);

// =====================================================================================
// Reverb (Freeverb-style: parallel damped combs into series all-passes), master, loop fold
// =====================================================================================
function reverb(input, offs) {
  const out = new Float64Array(N);
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ d: d + offs, buf: new Float64Array(d + offs), i: 0, store: 0 }));
  const aps = [556, 441].map((d) => ({ d: d + offs, buf: new Float64Array(d + offs), i: 0 }));
  const fb = 0.86;
  const damp = 0.3;
  for (let k = 0; k < N; k++) {
    let s = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.store = y * (1 - damp) + c.store * damp;
      c.buf[c.i] = input[k] + c.store * fb;
      c.i = (c.i + 1) % c.d;
      s += y;
    }
    for (const a of aps) {
      const y = a.buf[a.i];
      a.buf[a.i] = s + y * 0.5;
      a.i = (a.i + 1) % a.d;
      s = y - s;
    }
    out[k] = s * 0.18;
  }
  return out;
}
const wetL = reverb(sendL, 0);
const wetR = reverb(sendR, 23);
for (let k = 0; k < N; k++) {
  L[k] += wetL[k];
  Rr[k] += wetR[k];
}
// fold the tail past DUR onto the start, so the loop has no seam
const n = DUR * SR;
for (let k = n; k < N; k++) {
  L[k - n] += L[k];
  Rr[k - n] += Rr[k];
}

function writeWav(file, pre) {
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  const sat = (x) => Math.tanh(x * 1.2) / Math.tanh(1.2);
  for (let k = 0; k < n; k++) {
    buf.writeInt16LE(Math.round(sat(L[k] * pre) * 32000), 44 + k * 4);
    buf.writeInt16LE(Math.round(sat(Rr[k] * pre) * 32000), 46 + k * 4);
  }
  writeFileSync(file, buf);
}
mkdirSync(join(ROOT, 'out'), { recursive: true });
if (SOLO) {
  writeWav(join(ROOT, 'out', `solo-${SOLO}.wav`), 0.5); // fixed gain: solos compare against each other
  process.exit(0);
}
let peak = 0;
for (let k = 0; k < n; k++) peak = Math.max(peak, Math.abs(L[k]), Math.abs(Rr[k]));
const raw = join(ROOT, 'out', 'score-raw.wav');
const final = join(ROOT, 'out', 'score.wav');
writeWav(raw, 0.9 / peak);

// Two-pass loudness normalisation to -14 LUFS integrated, -1 dBTP (streaming targets).
const report = execFileSync('sh', ['-c', `ffmpeg -hide_banner -i "${raw}" -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1`], { encoding: 'utf8' });
const m = JSON.parse(report.slice(report.lastIndexOf('{'), report.lastIndexOf('}') + 1));
execFileSync('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-af',
  `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,
  '-ar', String(SR), '-c:a', 'pcm_s16le', final,
]);
console.log(`score: out/score.wav · input ${m.input_i} LUFS → -14 LUFS`);
