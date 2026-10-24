// Stills and contact sheets for the critique loop — no video needed.
//   node stills.mjs                         one frame per beat, contact sheet at out/contact.png
//   node stills.mjs --times 4.5,6.1,8.6     just those moments, full size, out/stills/
//   node stills.mjs --every 0.125 --from 2 --to 4 --cols 8   a strip around a fast action
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, serve, args, openFilm, ROOT } from './lib/harness.mjs';
import { DUR } from './lib/timeline.js';

const a = args({ times: '', every: 0.5, from: 0, to: DUR, lang: 'en', fmt: '9x16', scale: 0.5, cols: 8, name: 'contact', thumb: 270 });
const times = a.times
  ? String(a.times).split(',').map(Number)
  : Array.from({ length: Math.round((a.to - a.from) / a.every) }, (_, i) => +(a.from + i * a.every).toFixed(4));

const outDir = join(ROOT, 'out', 'stills');
await mkdir(outDir, { recursive: true });
const { server, url } = await serve();
const browser = await chromium.launch();
try {
  const page = await openFilm(browser, url, { lang: a.lang, fmt: a.fmt, scale: a.times ? 1 : a.scale });
  const files = [];
  for (const t of times) {
    await page.evaluate((tt) => window.seek(tt), t);
    const file = join(outDir, `${a.lang}-${a.fmt}-t${t.toFixed(3).padStart(7, '0')}.png`);
    await page.screenshot({ path: file });
    files.push({ t, file });
  }
  if (!a.times) {
    // Contact sheet: a grid of frames, each labelled with its time and beat.
    const cells = files
      .map(({ t, file }) => `<figure><img src="file://${file}"><figcaption>${t.toFixed(2)}s · b${(t * 2).toFixed(1)}</figcaption></figure>`)
      .join('');
    const html = `<html><body style="margin:0;background:#0b0a08;font:600 13px Inter,system-ui;color:#99928A">
      <div style="display:grid;grid-template-columns:repeat(${a.cols},${a.thumb}px);gap:8px;padding:8px">${cells}</div>
      <style>figure{margin:0}img{width:${a.thumb}px;display:block;border-radius:6px}figcaption{padding:4px 2px}</style></body></html>`;
    const sheet = join(ROOT, 'out', `${a.name}.html`);
    await writeFile(sheet, html);
    const p2 = await browser.newPage({ viewport: { width: a.cols * (a.thumb + 8) + 8, height: 400 } });
    await p2.goto('file://' + sheet);
    await p2.waitForLoadState('load');
    await p2.screenshot({ path: join(ROOT, 'out', `${a.name}.png`), fullPage: true });
    await rm(sheet);
    console.log(`contact sheet: out/${a.name}.png (${files.length} frames)`);
  } else console.log(files.map((f) => f.file).join('\n'));
} finally {
  await browser.close();
  server.close();
}
