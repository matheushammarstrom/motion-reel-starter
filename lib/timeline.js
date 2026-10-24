// The film's clock. Picture (film.js) and sound (audio/score.mjs) both read this file, so a cut
// and its hit can never drift apart. 120 BPM: a beat is 0.5 s, a bar is 2 s. The sample is 12 s.

export const BPM = 120;
export const BEAT = 60 / BPM;
export const BAR = 4 * BEAT;
export const DUR = 12;
export const FPS = 60;

export const T = {
  // Bar 1–2 · the old way, struck and swallowed
  lines: [0, 0.5, 1.0],
  strike: 1.5,
  absorb: 2.0,
  fullStop: 2.5,
  wordmark: 3.0,

  // Bar 3–4 · the card: the dot becomes its button, the tap, the result
  drop: 4.0,
  tap: 5.75,
  done: 6.0,

  // Bar 4–5 · the list
  list: 7.0,
  rows: 7.3,

  // Bar 5–6 · the fold, the lockup, back to the first frame
  fold: 9.0,
  lockup: 9.25,
  tagline: 9.75,
  url: 10.25,
  outro: 11.25,
};

/** One-shot sounds, placed on the picture's own events. */
export const CUES = [
  ...T.lines.map((t, i) => ({ t, type: 'slam', i })),
  { t: T.strike, type: 'slash' },
  ...[0, 1, 2].map((i) => ({ t: T.absorb + 0.06 + i * 0.1, type: 'tick', i })),
  { t: T.fullStop, type: 'boom' },
  { t: T.wordmark, type: 'pop', note: 'A5' },
  { t: T.drop + 0.05, type: 'whoosh' },
  ...[0, 1, 2].map((i) => ({ t: T.drop + 0.5 + i * 0.0625, type: 'tick', i: i + 2, soft: true })),
  { t: T.tap, type: 'click' },
  { t: T.done, type: 'chime', notes: ['E6', 'A6'] },
  { t: T.list - 0.08, type: 'whoosh' },
  ...[0, 1, 2].map((i) => ({ t: T.rows + i * 0.125, type: 'pop', note: ['C6', 'E6', 'A6'][i] })),
  { t: T.fold, type: 'suck' },
  { t: T.lockup, type: 'boom' },
];
