// Node-side plumbing shared by render.mjs and stills.mjs: a static server for the film page
// (ES modules don't load from file://), Playwright's Chromium, and a page that is ready to seek.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export { chromium };

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css; charset=utf-8' };

export function serve(root = ROOT) {
  const server = createServer(async (req, res) => {
    try {
      const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
      const file = join(root, path.endsWith('/') ? path + 'index.html' : path);
      if (!file.startsWith(root)) throw new Error('outside root');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })));
}

export function args(defaults) {
  const out = { ...defaults };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    const value = next === undefined || next.startsWith('--') ? true : next;
    if (value !== true) i++;
    out[key] = typeof defaults[key] === 'number' ? Number(value) : value;
  }
  return out;
}

export const FORMATS = { '9x16': [1080, 1920], '16x9': [1920, 1080], '1x1': [1080, 1080] };

/** A page at the film's size, fonts loaded, layout measured, ready for window.seek(t). */
export async function openFilm(browser, url, { lang = 'pt-BR', fmt = '9x16', scale = 1 } = {}) {
  const [W, H] = FORMATS[fmt];
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.goto(`${url}/index.html?lang=${lang}&fmt=${fmt}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  return page;
}
