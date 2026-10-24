// The sample film. window.seek(t) paints the exact frame for any t in [0, DUR]: no timers, no
// CSS transitions, no state carried between frames. Layout is measured once, after the fonts
// load; every frame after that is arithmetic on the clock in lib/timeline.js.
//
// The grammar it demonstrates: the brand's dot as the one protagonist (every period, every
// button), one container morphing between screens, captions rising out of masks, a touch
// indicator driving every change, numbers that roll. Replace the two product layers with ports
// of your own screens and keep the rest.

import { clamp, ramp, arc, smooth, spring, track, win, bump, loopT, SNAPPY, POP, DEFAULT, mixColor, rgba, hex } from './lib/motion.js';
import { T, DUR } from './lib/timeline.js';
import { COPY } from './lib/copy.js';
import { ctx, TYPE, add, K, esc, f2, S, fade, put, rect, icon, rise, roll, rolls, drawRolls, ROLL_INIT, periodMetrics, fitSize, displayLine, caption, captionLines, wipe, layer, layerWindow } from './lib/ui.js';

const FONT = 'Inter'; // the display font loaded in index.html
const q = new URLSearchParams(location.search);
const LANG = COPY[q.get('lang')] ? q.get('lang') : 'en';
const C = COPY[LANG];
const U = C.ui;
document.documentElement.lang = LANG;

// ---------- frame: one layout per format, reframed rather than cropped ----------
const LAYOUTS = {
  // Reels: text inside x 72–940, y 250–1560 (the app's own UI covers the rest)
  '9x16': {
    W: 1080, H: 1920, lx: 106, cw: 868, cap: { size: 84, top: 384 }, eyeY: 276,
    ui: { x: 106, w: 868, top: 690, maxH: 860, center: false }, hook: { cy: 930, w: 868, max: 104 },
    big: { yb: 1010, w: 848, max: 150 }, lock: { yb: 960, max: 300, tag: 54, tagDy: 92, url: 44, urlDy: 186 },
  },
  // YouTube, LinkedIn, a landing page: words on the left, the product on the right
  '16x9': {
    W: 1920, H: 1080, lx: 150, cw: 780, cap: { size: 84, top: 498 }, eyeY: 390,
    ui: { x: 1020, w: 750, top: 90, maxH: 900, center: true }, hook: { cy: 560, w: 1500, max: 150 },
    big: { yb: 612, w: 1400, max: 210 }, lock: { yb: 580, max: 360, tag: 60, tagDy: 104, url: 48, urlDy: 206 },
  },
  // Instagram feed: the vertical cut, tightened
  '1x1': {
    W: 1080, H: 1080, lx: 100, cw: 880, cap: { size: 66, top: 150 }, eyeY: 64,
    ui: { x: 100, w: 880, top: 356, maxH: 680, center: false }, hook: { cy: 560, w: 880, max: 92 },
    big: { yb: 600, w: 860, max: 140 }, lock: { yb: 560, max: 250, tag: 46, tagDy: 80, url: 38, urlDy: 160 },
  },
};
const FMT = LAYOUTS[q.get('fmt')] ? q.get('fmt') : '9x16';
const Lay = LAYOUTS[FMT];
const { W, H } = Lay;
const LX = Lay.lx; // left edge of the type
const CW = Lay.cw; // width of the type column
const CAP = { size: Lay.cap.size, top: Lay.cap.top, lh: 1.12 };
const EYE_Y = Lay.eyeY;

const stage = document.getElementById('stage');
const world = document.getElementById('world');
const typeL = document.getElementById('type');
const topL = document.getElementById('top');
for (const n of [stage, document.body, world, typeL, topL]) {
  n.style.width = W + 'px';
  n.style.height = H + 'px';
}
Object.assign(ctx, { Lay, LX, CW, CAP, LANG, C, U, font: FONT, world, typeL, topL });

// Colours the film mixes between frames (the CSS tokens in index.html, as numbers).
const COL = {
  bg: hex('#15151A'),
  card: hex('#1E1E24'),
  border: hex('#33333B'),
  fg: hex('#F2F2F0'),
  muted: hex('#9A9AA3'),
  primary: hex('#4F7CFF'),
};

// =====================================================================================
// Build
// =====================================================================================
let ready = false;
const R = {}; // measured layout

/** The captions in film order, each with the window it is on screen. */
const CAPS = [
  ['card', () => T.drop + 0.1, () => T.list - 0.05],
  ['list', () => T.list, () => T.fold],
];
/** The eyebrow's roles and when each takes the pill. */
const EYES = [
  [T.drop + 0.08, T.list],
  [T.list, T.fold + 0.02],
];

async function build() {
  await document.fonts.ready;
  for (const w of [400, 500, 600, 700, 800, 900]) await document.fonts.load(`${w} 40px ${FONT}`);

  // ---------- hook: the old way, one line per beat ----------
  const n = C.hook.length;
  const F1 = fitSize(C.hook, '', Lay.hook.w, Lay.hook.max);
  const G1 = Math.round(F1 * 1.17);
  const yb0 = Math.round(Lay.hook.cy - ((n - 1) * G1 - 0.73 * F1) / 2);
  R.hook = C.hook.map((text, i) => {
    const L = displayLine(typeL, text, F1, yb0 + i * G1);
    const sh = Math.max(6, Math.round(F1 * 0.075));
    const last = i === n - 1;
    const strikeW = L.w + (last ? 0 : L.pm.adv) + 10;
    L.strike = add(L.node, `<div class="a strike" style="left:-10px;top:${f2(L.yb - L.top - F1 * 0.33 - sh / 2)}px;width:${f2(strikeW + 10)}px;height:${sh}px"></div>`);
    if (!last) {
      const d = L.pm.d;
      L.stamp = add(L.node, `<div class="a pd" style="left:${f2(L.w + L.pm.cx - d / 2)}px;top:${f2(L.yb - L.top + L.pm.cy - d / 2)}px;width:${f2(d)}px;height:${f2(d)}px"></div>`);
    }
    L.text = L.node.firstElementChild;
    return L;
  });
  const P = R.hook.map((L) => L.period);
  R.dHook = R.hook[0].pm.d;
  // Every struck line collapses into the dot, which is sitting at the end of the last line.
  for (const L of R.hook) L.node.style.transformOrigin = `${f2(P[n - 1].x - LX)}px ${f2(P[n - 1].y - L.top)}px`;

  // ---------- "Full stop." → the wordmark ----------
  const F2 = fitSize([C.fullStop], '', Lay.big.w, Lay.big.max);
  R.stop = displayLine(typeL, C.fullStop, F2, Lay.big.yb);
  R.mark = displayLine(typeL, C.wordmark, F2, Lay.big.yb, 'word');

  // ---------- lockup ----------
  const K4 = Lay.lock;
  const F4 = fitSize([C.wordmark], 'word', Lay.big.w, K4.max);
  R.lock = displayLine(typeL, C.wordmark, F4, K4.yb, 'word');
  R.tag = add(typeL, `<div class="a" style="left:${LX + 6}px;top:${K4.yb + K4.tagDy}px;font-size:${K4.tag}px;font-weight:700;letter-spacing:-0.02em;white-space:nowrap">${esc(C.tagline)}.</div>`);
  const urlDot = periodMetrics(K4.url, 700);
  R.url = add(typeL, `<div class="a" style="left:${LX + 6}px;top:${K4.yb + K4.urlDy}px;font-size:${K4.url}px;font-weight:700;letter-spacing:-0.02em;color:var(--muted);white-space:nowrap">${esc(C.url[0])}<i class="ib pd" style="width:${f2(urlDot.d)}px;height:${f2(urlDot.d)}px;margin:0 ${f2(urlDot.adv - urlDot.d - 2)}px 0 2px;background:var(--primary)"></i>${esc(C.url[1])}</div>`);

  // ---------- captions and eyebrow ----------
  const capLines = CAPS.flatMap(([k]) => C.captions[k].split('\n'));
  CAP.size = Math.min(CAP.size, fitSize(capLines, '', CW - 10, CAP.size));
  R.caps = {};
  for (const [k, tin, tout] of CAPS) R.caps[k] = { ...caption(C.captions[k]), tin: tin(), tout: tout() };
  R.dCap = periodMetrics(CAP.size).d;
  R.eye = add(topL, `<div class="a eyebrow" style="left:${LX}px;top:${EYE_Y}px"></div>`);
  R.eyeSpans = C.eyebrows.map((s) => add(R.eye, `<span class="a">${esc(s)}</span>`));
  R.eyeW = R.eyeSpans.map((sp) => sp.getBoundingClientRect().width + 4);
  R.eyeKeys = [[0, 0], ...EYES.map(([a], i) => [a, R.eyeW[i]]), [T.fold + 0.02, 0]];

  // ---------- the morphing container and the product layers ----------
  R.box = add(world, `<div id="box" class="a"></div>`);
  buildCard();
  buildList();
  buildDot();
  R.finger = add(topL, `<div class="a" style="width:104px;height:104px;border-radius:50%;background:rgba(242,242,240,.2);border:2px solid rgba(242,242,240,.6);box-shadow:0 14px 34px rgba(0,0,0,.4)"></div>`);
  R.ripple = add(topL, `<div class="a" style="width:104px;height:104px;border-radius:50%;border:3px solid rgba(242,242,240,.7)"></div>`);
  R.taps = [{ t: T.tap, at: R.cardSlot }];

  for (const key of Object.keys(ROLL_INIT)) rolls(key, [[0, ROLL_INIT[key]]]);
  buildDotRoute();
  buildBoxRoute();
  ready = true;
}

// ---------- scene 1: a card with a button the dot presses, and a number that rolls ----------
// Port your own screen here, at the app's own sizes (this one is 268 px wide, a phone card).
function buildCard() {
  const L = layer(
    `<div style="padding:14px">
      <p data-k="label" class="lm">${esc(U.label)}</p>
      <p data-k="title" style="margin-top:6px;font-size:28px;line-height:1;font-weight:800;letter-spacing:-0.02em">${esc(U.title)}</p>
      <p data-k="line" class="tnum" style="margin-top:8px;font-size:12px;color:var(--muted)">${esc(U.line[0])}${roll('frames', '000')}${esc(U.line[1])}</p>
      <div data-k="slot" style="position:relative;margin-top:14px;height:40px">
        <div data-k="doneBtn" class="btn a" style="width:100%;height:100%;font-size:13px;background:rgba(52,199,123,.15);border:1px solid rgba(52,199,123,.4)">
          <span data-k="done" class="row" style="gap:6px;color:var(--success)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path data-k="check" d="M4 12l5 5L20 6" stroke-dasharray="22.7" stroke-dashoffset="22.7"/></svg>${esc(U.rendered)}</span>
        </div>
      </div>
    </div>`,
    268,
  );
  R.card = L;
  R.cardRect = rect(L.z);
  R.cardSlot = rect(K(L.z, 'slot'));
  R.cardKeys = ['label', 'title', 'line'].map((k) => K(L.z, k));
  R.doneBtn = K(L.z, 'doneBtn');
  R.done = K(L.z, 'done');
  R.check = K(L.z, 'check');
  rolls('frames', [[0, '000'], [T.done + 0.1, '720']], { stagger: 0.05 });
}
function drawCard(t) {
  layerWindow(R.card, t, 0, T.list - 0.02);
  R.cardKeys.forEach((e, i) => put(e, rise(t, T.drop + 0.5 + i * 0.0625, 7)));
  // The success state waits under the dot; when the dot contracts back to a period, it's there.
  fade(R.doneBtn, t >= T.tap + 0.1 ? 1 : 0);
  const pd = spring(t - T.done - 0.02, ...SNAPPY);
  put(R.done, { s: 0.85 + 0.15 * pd, o: ramp(t, T.done + 0.02, T.done + 0.12) });
  S(R.check, 'strokeDashoffset', f2(22.7 * (1 - spring(t - T.done - 0.05, ...DEFAULT))));
}

// ---------- scene 2: a list whose rows pop on 16ths ----------
function buildList() {
  const L = layer(
    U.rows
      .map(
        (r, i) => `<div data-k="r${i}" class="row" style="gap:12px;padding:12px 14px;${i ? 'border-top:1px solid var(--border)' : ''}">
          <span class="tile" style="width:32px;height:32px;background:rgba(79,124,255,.15)">${icon('check', 16, 'var(--primary)', { sw: 2.6 })}</span>
          <p style="flex:1;font-size:14px;font-weight:600">${esc(r)}</p>
          ${icon('chevron-right', 16, 'var(--faint)')}
        </div>`,
      )
      .join(''),
    300,
  );
  R.list = L;
  R.listRect = rect(L.z);
  R.listRows = U.rows.map((_, i) => K(L.z, `r${i}`));
}
function drawList(t) {
  const tin = T.list + 0.2;
  layerWindow(R.list, t, tin, T.fold + 0.5);
  const o = t < tin ? 0 : 1;
  R.listRows.forEach((e, i) => {
    const t0 = T.rows + i * 0.125;
    const p = spring(t - t0, ...POP);
    put(e, { s: 0.85 + 0.15 * p, y: 10 * (1 - p), o: o * ramp(t, t0, t0 + 0.08) });
  });
}

// ---------- the dot: every period, and every button the film presses ----------
function buildDot() {
  R.dot = add(topL, `<div id="dot" class="a" style="background:var(--primary)"></div>`);
  const label = (zoom, html) => {
    const outer = add(R.dot, `<div class="dl"></div>`);
    add(outer, `<div style="zoom:${zoom}">${html}</div>`);
    return outer;
  };
  R.dlRender = label(R.card.zoom, `<div class="row" style="gap:6px;font-size:13px;font-weight:700;color:#fff">${icon('play', 12, '#fff', { fill: '#fff' })}<span>${esc(U.render)}</span></div>`);
  R.dlSpin = label(R.card.zoom, `<svg style="display:block" width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="40 100"/></svg>`);
  R.dlSpinSvg = R.dlSpin.querySelector('svg');
}

function buildDotRoute() {
  const D = { x: [], y: [], w: [], h: [], r: [] };
  const hops = [];
  const go = (t, props, sp = SNAPPY) => {
    for (const k in props) D[k].push([t, props[k], sp]);
  };
  const circle = (d) => ({ w: d, h: d, r: d / 2 });
  const to = (t, p, sp = TYPE, h = 0, dur = 0.26) => {
    go(t, { x: p.x, y: p.y }, sp);
    if (h) hops.push({ t0: t, dur, h });
  };
  // travel as a dot, open into the button on arrival
  const button = (t, r, radius) => {
    go(t, { x: r.cx, y: r.cy }, SNAPPY);
    go(t + 0.13, { w: r.w, h: r.h, r: radius }, SNAPPY);
  };
  // the button's job is done: back to a period, then home to the caption's own period
  const home = (t, cap) => {
    go(t, circle(R.dCap), SNAPPY);
    to(t + 0.1, cap, [210, 26], 140, 0.42);
  };
  const P = R.hook.map((L) => L.period);
  const caps = Object.fromEntries(Object.entries(R.caps).map(([k, c]) => [k, c.dot]));

  go(0, { x: P[0].x, y: P[0].y, ...circle(R.dHook) });
  // the old way: hop to the end of each new line, landing on its beat
  for (let i = 1; i < P.length; i++) to(T.lines[i] - 0.2, P[i], TYPE, 70, 0.24);
  // Full stop. → the wordmark.
  to(T.fullStop - 0.1, R.stop.period, TYPE, 90, 0.3);
  go(T.fullStop - 0.1, circle(R.stop.pm.d), TYPE);
  to(T.wordmark - 0.05, R.mark.period, TYPE);
  // the card's button, the tap, home
  button(T.drop, R.cardSlot, 12 * R.card.zoom);
  home(T.done, caps.card);
  to(T.list - 0.1, caps.list, TYPE, 50);
  // the fold, then the lockup
  R.foldAt = { x: R.listRect.cx, y: R.listRect.cy };
  to(T.fold - 0.12, R.foldAt, SNAPPY);
  to(T.lockup - 0.06, R.lock.period, TYPE, 60, 0.3);
  go(T.lockup - 0.06, circle(R.lock.pm.d), TYPE);
  // back to the first frame, fully settled before t = DUR so the loop has no seam
  to(T.outro + 0.1, P[0], TYPE);
  go(T.outro + 0.1, circle(R.dHook), TYPE);

  for (const k in D) D[k].sort((a, b) => a[0] - b[0]);
  R.D = D;
  R.hops = hops;
}

// The container's route: [time, state]. States are measured rects plus a surface style.
function buildBoxRoute() {
  const pick = (r) => ({ x: r.x, y: r.y, w: r.w, h: r.h });
  const panel = (r, z) => ({ ...pick(r), r: 16 * z, bg: COL.card, bd: COL.border, hl: 0.025, hlh: 56 * z });
  R.boxStates = [
    [0, { ...panel(R.cardSlot, R.card.zoom), r: 12 * R.card.zoom }],
    [T.drop + 0.16, panel(R.cardRect, R.card.zoom)],
    [T.list, panel(R.listRect, R.list.zoom)],
  ];
  // the slow push of each scene toward the thing it is about to press (or show)
  R.drifts = [
    [T.drop + 0.3, T.list, R.cardSlot],
    [T.list + 0.3, T.fold, R.listRect],
  ];
}

// =====================================================================================
// Draw
// =====================================================================================
function draw(t) {
  drawRolls(t);
  drawHook(t);
  drawBig(t);
  drawCaptions(t);
  drawWorld(t);
  drawDot(t);
  drawFinger(t);
}

function drawHook(t) {
  const n = R.hook.length;
  R.hook.forEach((L, i) => {
    const t0 = i === 0 ? T.lines[0] : T.lines[i] - 0.06;
    const pIn = spring(t - t0, ...SNAPPY);
    const ts = T.strike + i * 0.06;
    const ta = T.absorb + (n - 1 - i) * 0.08; // nearest line first
    const pa = spring(t - ta, ...SNAPPY);
    const clipR = (1 - pIn) * L.box;
    S(L.node, 'clipPath', pIn > 0.999 ? 'none' : `inset(-40% ${f2(clipR)}px -40% -20px)`);
    const struck = ramp(t, ts, ts + 0.16);
    S(L.text, 'color', rgba(mixColor(COL.fg, COL.muted, struck)));
    S(L.strike, 'transform', `scaleX(${spring(t - ts, ...SNAPPY).toFixed(4)})`);
    if (L.stamp) {
      const left = T.lines[i + 1] - 0.14;
      const cool = ramp(t, left, left + 0.3);
      S(L.stamp, 'background', rgba(mixColor(mixColor(COL.primary, COL.fg, cool), COL.muted, struck)));
      fade(L.stamp, t >= left ? 1 : 0);
    }
    put(L.node, {
      y: (1 - pIn) * L.pm.d * 1.4,
      sx: 1 - pa,
      sy: 1 - 0.82 * pa,
      o: (t < t0 ? 0 : 1) * (1 - ramp(pa, 0.72, 1)),
      blur: 14 * pa,
    });
  });
}

function drawBig(t) {
  // "Full stop" wipes in behind the landing dot, then swaps to the wordmark behind a blur.
  wipe(R.stop, t, T.fullStop - 0.06, T.wordmark - 0.06);
  const pb = spring(t - T.wordmark, ...SNAPPY);
  const pbOut = spring(t - (T.drop - 0.04), ...SNAPPY);
  S(R.mark.node, 'clipPath', 'none');
  put(R.mark.node, {
    y: (1 - pb) * 30 - pbOut * 60,
    o: ramp(pb, 0, 0.5) * (1 - ramp(pbOut, 0, 0.5)),
    blur: 18 * (1 - ramp(pb, 0, 0.8)) + 18 * pbOut,
  });
  // lockup
  wipe(R.lock, t, T.lockup, T.outro);
  const leave = (el, tin, dy, tOutDelay) => {
    const out = spring(t - T.outro - tOutDelay, ...SNAPPY);
    const r = rise(t, tin, dy);
    put(el, { y: r.y - out * 40, o: r.o * (1 - ramp(out, 0, 0.6)), blur: 16 * out });
  };
  leave(R.tag, T.tagline, 34, 0.04);
  leave(R.url, T.url, 34, 0.08);
}

function drawCaptions(t) {
  for (const c of Object.values(R.caps)) captionLines(c, t, c.tin, c.tout);
  // Eyebrow pill: one container, its width morphing between the roles.
  const w = Math.max(0, track(t, R.eyeKeys, SNAPPY));
  S(R.eye, 'width', f2(w) + 'px');
  fade(R.eye, w > 2 ? 1 : 0);
  R.eyeSpans.forEach((sp, i) => {
    const [a, b] = EYES[i];
    const inP = ramp(t, a + 0.04, a + 0.17);
    const outP = ramp(t, b - 0.1, b - 0.02);
    const o = Math.min(inP, 1 - outP);
    put(sp, { y: (1 - inP) * 14 - outP * 14, o, blur: 6 * (1 - o) });
  });
}

function boxAt(t) {
  const st = R.boxStates;
  const num = ['x', 'y', 'w', 'h', 'r', 'hl', 'hlh'];
  const out = {};
  for (const k of num) out[k] = track(t, st.map(([ti, s]) => [ti, s[k]]), DEFAULT);
  // surface colors blend over the first 0.3 s of each morph
  let bg = st[0][1].bg;
  let bd = st[0][1].bd;
  for (let i = 1; i < st.length; i++) {
    const p = ramp(t, st[i][0], st[i][0] + 0.3);
    if (p <= 0) break;
    bg = mixColor(bg, st[i][1].bg, p);
    bd = mixColor(bd, st[i][1].bd, p);
  }
  out.bg = bg;
  out.bd = bd;
  return out;
}

function drawWorld(t) {
  // Camera: a slow push toward each scene's button, pivoting on it so the dot never drifts; the fold.
  let ds = 1;
  let piv = R.cardSlot;
  for (const [a, b, p] of R.drifts) {
    if (t < a - 0.01 || t > b + 0.6) continue;
    ds = 1 + 0.03 * smooth(ramp(t, a, b - 0.05)) * (1 - spring(t - (b - 0.05), ...DEFAULT));
    piv = p;
  }
  const drift = `translate(${f2(piv.cx)}px,${f2(piv.cy)}px) scale(${ds.toFixed(5)}) translate(${f2(-piv.cx)}px,${f2(-piv.cy)}px)`;
  const pf = spring(t - T.fold, ...SNAPPY);
  const fs = 1 - pf;
  const fx = R.foldAt.x;
  const fy = R.foldAt.y;
  S(world, 'transform', `translate(${f2(fx)}px,${f2(fy)}px) scale(${Math.max(0.0001, fs).toFixed(4)}) translate(${f2(-fx)}px,${f2(-fy)}px) ${drift}`);
  fade(world, 1 - ramp(pf, 0.75, 1));
  S(world, 'filter', pf > 0.01 ? `blur(${f2(14 * pf)}px)` : 'none');

  drawBox(t);
  drawCard(t);
  drawList(t);
}

function drawBox(t) {
  const b = boxAt(t);
  const o = ramp(t, T.drop + 0.1, T.drop + 0.16);
  const e = R.box;
  fade(e, o);
  if (o <= 0) return;
  S(e, 'transform', `translate(${f2(b.x)}px,${f2(b.y)}px)`);
  S(e, 'width', f2(b.w) + 'px');
  S(e, 'height', f2(b.h) + 'px');
  S(e, 'borderRadius', f2(b.r) + 'px');
  S(e, 'borderWidth', '3px');
  S(e, 'borderColor', rgba(b.bd));
  S(e, 'background', `linear-gradient(180deg, rgba(255,255,255,${b.hl.toFixed(4)}), transparent ${f2(b.hlh)}px), ${rgba(b.bg)}`);
}

function drawDot(t) {
  const D = R.D;
  const x = track(t, D.x);
  let y = track(t, D.y);
  for (const h of R.hops) y -= h.h * arc((t - h.t0) / h.dur);
  const w = Math.max(0, track(t, D.w));
  const h = Math.max(0, track(t, D.h));
  const r = Math.max(0, Math.min(track(t, D.r), w / 2, h / 2));
  let s = 1;
  // swallow pulses during the absorb, presses on taps, a heartbeat under the lockup
  for (let k = 0; k < R.hook.length; k++) s += 0.28 * bump(t, T.absorb + k * 0.08 + 0.1, 0.05);
  for (const tap of R.taps) s -= 0.05 * bump(t, tap.t - 0.02, 0.08);
  for (let b = T.lockup + 1; b < T.outro; b += 0.5) s += 0.07 * bump(t, b - 0.01, 0.05);
  const e = R.dot;
  S(e, 'width', f2(w) + 'px');
  S(e, 'height', f2(h) + 'px');
  S(e, 'borderRadius', f2(r) + 'px');
  S(e, 'transform', `translate(${f2(x - w / 2)}px,${f2(y - h / 2)}px) scale(${s.toFixed(4)})`);
  fade(e, s > 0.001 ? 1 : 0);
  // labels appear once the dot is wide enough to hold them
  const lab = (el, tin, tout) => {
    const o = win(t, tin, tout, 0.1, 0.08);
    S(el, 'transform', `translate(-50%,-50%) scale(${(0.9 + 0.1 * o).toFixed(4)})`);
    fade(el, o);
  };
  lab(R.dlRender, T.drop + 0.2, T.tap + 0.08);
  lab(R.dlSpin, T.tap + 0.08, T.done - 0.02);
  S(R.dlSpinSvg, 'transform', `rotate(${f2((t - T.tap) * 900)}deg)`);
}

function drawFinger(t) {
  let best = null;
  for (const tap of R.taps) if (t > tap.t - 0.5 && t < tap.t + 0.75) best = tap;
  if (!best) {
    fade(R.finger, 0);
    fade(R.ripple, 0);
    return;
  }
  const { t: tt, at } = best;
  const pin = spring(t - (tt - 0.46), ...DEFAULT);
  const pout = spring(t - (tt + 0.2), 140, 24);
  const tx = at.cx + 26;
  const ty = at.cy + 30;
  const x = tx + 260 * (1 - pin) + 300 * pout;
  const y = ty + 420 * (1 - pin) + 380 * pout;
  const press = bump(t, tt - 0.03, 0.07);
  const o = win(t, tt - 0.46, tt + 0.62, 0.12, 0.25);
  put(R.finger, { x: x - 52, y: y - 52, s: 1 - 0.16 * press, o });
  const pr = ramp(t, tt, tt + 0.42);
  put(R.ripple, { x: tx - 52, y: ty - 52, s: 1 + 1.3 * pr, o: t < tt ? 0 : 0.7 * (1 - pr) });
}

// =====================================================================================
window.seek = (t) => {
  if (!ready) return false;
  draw(loopT(t, DUR)); // t = DUR is t = 0: the film is a loop
  return true;
};
window.__film = { DUR, W, H, LANG, FMT, R }; // R: the measured layout, for debugging in the console
build().then(() => {
  window.__ready = true;
  const t0 = q.get('t');
  if (t0 !== null) window.seek(Number(t0));
  else if (!navigator.webdriver) {
    const start = performance.now();
    const loop = () => {
      window.seek(((performance.now() - start) / 1000) % DUR);
      requestAnimationFrame(loop);
    };
    loop();
  } else window.seek(0);
});
