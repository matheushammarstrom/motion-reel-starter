// DOM and type helpers shared by the film's files. `ctx` is filled by film.js before any scene
// is built: the layout, the language, the copy and the three stage layers.

import { ramp, spring, track, win, SNAPPY } from './motion.js';
import { ICONS } from './icons.js';

export const TYPE = [400, 40]; // critically damped and quick: type moves without overshoot

/** Filled once by film.js: { Lay, LX, CW, CAP, LANG, C, U, world, typeL, topL }. */
export const ctx = {};

// ---------- DOM ----------
export function add(parent, html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  const node = tpl.content.firstElementChild;
  parent.appendChild(node);
  return node;
}
export const K = (root, k) => root.querySelector(`[data-k="${k}"]`);
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
export const f2 = (v) => v.toFixed(2);

/** Set a style only when it changes: the renderer paints thousands of frames. */
export function S(e, k, v) {
  const c = e.__c || (e.__c = {});
  if (c[k] !== v) {
    c[k] = v;
    e.style[k] = v;
  }
}
export function fade(e, o) {
  S(e, 'opacity', o <= 0.002 ? '0' : o >= 0.998 ? '1' : o.toFixed(3));
  S(e, 'visibility', o <= 0.002 ? 'hidden' : 'visible');
}
export function put(e, { x = 0, y = 0, s = 1, sx = s, sy = s, o = 1, blur = 0 } = {}) {
  S(e, 'transform', `translate(${f2(x)}px,${f2(y)}px)` + (sx !== 1 || sy !== 1 ? ` scale(${sx.toFixed(4)},${sy.toFixed(4)})` : ''));
  fade(e, o);
  S(e, 'filter', blur > 0.05 ? `blur(${f2(blur)}px)` : 'none');
}
export function rect(e) {
  const r = e.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
}
export const icon = (name, size, color, { sw = 2, fill = 'none' } = {}) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

/** Enter-from-below with a snappy spring; returns {y, o} for put(). */
export function rise(t, t0, dy = 8, tOut = Infinity) {
  const p = spring(t - t0, ...SNAPPY);
  return { y: (1 - p) * dy, o: win(t, t0, tOut, 0.1, 0.12) };
}

// ---------- rolling digits ----------
const DIGITS = Array.from({ length: 30 }, (_, i) => i % 10).join('<br>');
export const ROLL_INIT = {};
/** A number whose digits roll: roll('frames', '720') in the HTML, then rolls('frames', keys). */
export function roll(key, str) {
  ROLL_INIT[key] = str;
  let html = `<span class="roll" data-roll="${key}">`;
  for (const ch of str) {
    html +=
      ch >= '0' && ch <= '9'
        ? `<span class="rc"><span class="rs">${DIGITS}</span><span class="rg">0</span></span>`
        : `<span class="rx">${esc(ch)}</span>`;
  }
  return html + '</span>';
}
const ROLLS = [];
/** keys: [[t, "720"], …]; digits roll up when the value grows, down when it shrinks. */
export function rolls(key, keys, { spin = 0, stagger = 0.04, sp = SNAPPY } = {}) {
  delete ROLL_INIT[key];
  const node = document.querySelector(`[data-roll="${key}"]`);
  const strips = [...node.querySelectorAll('.rs')];
  const digits = (s) => [...s].filter((ch) => ch >= '0' && ch <= '9').map(Number);
  const value = (s) => Number(digits(s).join(''));
  const tracks = strips.map((_, c) => {
    let pos = digits(keys[0][1])[c] - spin * 10;
    const out = [[0, pos]];
    for (let k = 1; k < keys.length; k++) {
      const [t, s] = keys[k];
      const d1 = digits(s)[c];
      if (spin && k === 1) pos = d1;
      else {
        const d0 = ((pos % 10) + 10) % 10;
        pos += value(s) >= value(keys[k - 1][1]) ? (d1 - d0 + 10) % 10 : -((d0 - d1 + 10) % 10);
      }
      out.push([t + c * stagger, pos, sp]);
    }
    return out;
  });
  ROLLS.push({ strips, tracks });
}
export function drawRolls(t) {
  for (const { strips, tracks } of ROLLS) {
    strips.forEach((strip, c) => {
      const p = track(t, tracks[c]);
      const m = (((p % 10) + 10) % 10) + 10;
      S(strip, 'transform', `translateY(${(-(m / 30) * 100).toFixed(3)}%)`);
    });
  }
}

// ---------- type metrics ----------
const cvs = document.createElement('canvas').getContext('2d');
/** Where the font's period sits relative to the pen and the baseline, so the dot can replace it. */
export function periodMetrics(size, weight = 800) {
  cvs.font = `${weight} ${size}px ${ctx.font}`;
  const m = cvs.measureText('.');
  const left = -m.actualBoundingBoxLeft;
  const right = m.actualBoundingBoxRight;
  const up = m.actualBoundingBoxAscent;
  const down = m.actualBoundingBoxDescent;
  const d = Math.max(right - left, up + down);
  return { d, cx: (left + right) / 2, cy: -(up - down) / 2, adv: m.width };
}
/** Pen position after the text and the baseline, both relative to the element's box. */
export function measure(node) {
  const probe = document.createElement('span');
  probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
  node.appendChild(probe);
  const nr = node.getBoundingClientRect();
  const pr = probe.getBoundingClientRect();
  probe.remove();
  return { w: pr.left - nr.left, base: pr.top - nr.top };
}
export function fitSize(texts, cls, maxW, maxSize, weight = 800) {
  let widest = 0;
  for (const s of texts) {
    const n = add(ctx.typeL, `<div class="a disp ${cls}" style="font-size:100px;font-weight:${weight}">${esc(s)}</div>`);
    widest = Math.max(widest, measure(n).w + periodMetrics(100, weight).adv);
    n.remove();
  }
  return Math.min(maxSize, Math.floor((100 * maxW) / widest));
}
/** A line of display type, left edge at LX, baseline at yb. Returns the node and its period. */
export function displayLine(parent, text, size, yb, cls = '') {
  const node = add(parent, `<div class="a disp ${cls}" style="font-size:${size}px"><span>${esc(text)}</span></div>`);
  const m = measure(node);
  const pm = periodMetrics(size);
  const box = Math.ceil(m.w + pm.adv * 2 + 40); // room for the period, so no mask ever clips it
  node.style.left = ctx.LX + 'px';
  node.style.top = yb - m.base + 'px';
  node.style.width = box + 'px';
  return { node, w: m.w, box, top: yb - m.base, yb, pm, period: { x: ctx.LX + m.w + pm.cx, y: yb + pm.cy } };
}

/** Caption: each line in its own mask; the last one ends in the accent period. */
export function caption(text, top = ctx.CAP.top, parent = ctx.topL, { size = ctx.CAP.size } = {}) {
  const lines = text.split('\n').filter((l) => l.length);
  const lh = size * ctx.CAP.lh;
  const pm = periodMetrics(size);
  const wrap = add(parent, `<div class="a" style="left:${ctx.LX}px;top:${top}px"></div>`);
  const spans = lines.map((line, j) => {
    const mask = add(wrap, `<div class="a cap-line" style="top:${f2(j * lh)}px;height:${f2(lh + 6)}px;width:${ctx.CW + 80}px"></div>`);
    const last = j === lines.length - 1;
    return add(
      mask,
      `<span style="font-size:${size}px">${esc(line)}${last ? `<i class="cap-dot" style="width:${f2(pm.d)}px;height:${f2(pm.d)}px;margin-left:${f2(pm.cx - pm.d / 2)}px"></i>` : ''}</span>`,
    );
  });
  const dot = rect(wrap.querySelector('.cap-dot'));
  return { wrap, spans, dot: { x: dot.cx, y: dot.cy }, pm };
}
/** Caption lines ride up out of their masks, and leave upward. */
export function captionLines(c, t, tin, tout) {
  c.spans.forEach((sp, j) => {
    const pIn = spring(t - tin - j * 0.05, ...SNAPPY);
    const pOut = spring(t - (tout - 0.14) - j * 0.04, ...SNAPPY);
    const y = (1 - pIn) * 105 - pOut * 105;
    S(sp, 'transform', `translateY(${f2(y)}%)`);
    fade(sp, t < tin ? 0 : pOut > 0.995 ? 0 : 1);
  });
}

/** Display-type wipe from the left edge toward its period. */
export function wipe(L, t, tIn, tOut, sp = TYPE) {
  const p = spring(t - tIn, ...sp);
  const pOut = spring(t - tOut, ...SNAPPY);
  S(L.node, 'clipPath', p > 0.999 ? 'none' : `inset(-30% ${f2((1 - p) * L.box)}px -30% -30px)`);
  put(L.node, { y: -pOut * 40, o: (t < tIn ? 0 : 1) * (1 - ramp(pOut, 0, 0.6)), blur: 18 * pOut });
}

// ---------- product layers ----------
/**
 * A product screen at the app's own size, zoomed into the layout's UI column. `sizeWithout`
 * names a part (a toast) that must not count toward the fit; `column` overrides the column;
 * `fit` measures one node instead of the whole layer ({ node, share, fillColumn }).
 */
export function layer(html, widthPx, { sizeWithout = null, column = null, fit: fitOpt = null } = {}) {
  const ui = { ...ctx.Lay.ui, ...(column ?? {}) };
  const pos = add(ctx.world, `<div class="a"></div>`);
  const z = add(pos, `<div class="ui" style="width:${widthPx}px">${html}</div>`);
  const skip = sizeWithout && K(z, sizeWithout);
  if (skip) skip.style.display = 'none';
  const h0 = (fitOpt ? K(z, fitOpt.node) : z).getBoundingClientRect().height;
  const zoom = Math.min(ui.w / widthPx, ((fitOpt?.share ?? 1) * ui.maxH) / h0);
  if (skip) skip.style.display = '';
  z.style.zoom = zoom;
  const fit = { w: widthPx * zoom, h: h0 * zoom };
  if (fitOpt?.fillColumn) {
    z.firstElementChild.style.height = f2(ui.maxH / zoom) + 'px';
    fit.h = ui.maxH;
  }
  pos.style.left = ui.x + (ui.w - fit.w) / 2 + 'px';
  pos.style.top = (ui.center ? ui.top + (ui.maxH - fit.h) / 2 : ui.top) + 'px';
  return { pos, z, zoom, fit };
}
/** A whole layer blurs out as the container starts its next morph. */
export function layerOut(L, t, tOut) {
  const p = ramp(t, tOut - 0.12, tOut + 0.02);
  put(L.pos, { y: -p * 16, o: 1 - p, blur: 12 * p });
}
/** Hidden until tin, then blurs out at tOut. */
export function layerWindow(L, t, tin, tOut) {
  if (t < tin) fade(L.pos, 0);
  else layerOut(L, t, tOut);
}
