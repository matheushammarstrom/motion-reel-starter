// Walks the clock and pipes frames into ffmpeg. Frames are split across parallel headless pages
// (seek(t) is pure, so any page can paint any frame); each worker encodes its own segment and
// the segments are joined without re-encoding.
//
//   node render.mjs                                  final: 9:16, 60 fps, 4 subframes, audio
//   node render.mjs --fmt 16x9                       also 1x1; every format is its own layout
//   node render.mjs --scale 0.5 --fps 30 --sub 1     quick animatic
//   node render.mjs --from 7 --to 10                 re-render only the seconds you changed
import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { cpus } from 'node:os';
import { chromium, serve, args, openFilm, ROOT, FORMATS } from './lib/harness.mjs';
import { DUR } from './lib/timeline.js';

const a = args({
  fps: 60, sub: 4, scale: 1, from: 0, to: DUR, lang: 'en', fmt: '9x16', workers: Math.min(6, Math.max(2, cpus().length - 2)),
  out: '', audio: '', crf: 16, shutter: 0.5,
});
if (!FORMATS[a.fmt]) throw new Error(`--fmt must be one of ${Object.keys(FORMATS).join(', ')}`);
const tag = `${a.lang}-${a.fmt}${a.scale !== 1 ? `-x${a.scale}` : ''}`;
const out = a.out || join(ROOT, 'out', `film-${tag}.mp4`);
const audio = a.audio || join(ROOT, 'out', 'score.wav');
const tmp = join(ROOT, 'out', `.segments-${tag}`);
await rm(tmp, { recursive: true, force: true });
await mkdir(tmp, { recursive: true });

const frames = Math.round((a.to - a.from) * a.fps);
const per = Math.ceil(frames / a.workers);

function ffmpeg(argv) {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...argv], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))));
  return { p, done };
}
// sRGB screenshots → BT.709 limited range, tagged, so players don't shift the orange.
const COLOR = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
const toYuv = `scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p`;
// …and written into the H.264 stream itself (the concat step drops container-level tags)
const VUI = 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0';

const { server, url } = await serve();
const browser = await chromium.launch();
const started = Date.now();
let doneFrames = 0;

async function worker(k) {
  const f0 = k * per;
  const f1 = Math.min(frames, f0 + per);
  if (f0 >= f1) return null;
  const page = await openFilm(browser, url, { lang: a.lang, fmt: a.fmt, scale: a.scale });
  const seg = join(tmp, `seg${String(k).padStart(2, '0')}.mp4`);
  const vf = a.sub > 1 ? `tmix=frames=${a.sub},select='not(mod(n+1\\,${a.sub}))',setpts=N/${a.fps}/TB,${toYuv}` : toYuv;
  const enc = ffmpeg([
    '-f', 'image2pipe', '-framerate', String(a.fps * a.sub), '-i', '-',
    '-vf', vf, '-r', String(a.fps), '-c:v', 'libx264', '-preset', 'medium', '-crf', String(a.crf),
    '-g', String(a.fps), ...COLOR, seg,
  ]);
  for (let f = f0; f < f1; f++) {
    for (let j = 0; j < a.sub; j++) {
      // subframes spread over a 180° shutter centred on the frame's time
      const off = a.sub > 1 ? ((j + 0.5) / a.sub - 0.5) * a.shutter : 0;
      const t = a.from + (f + off) / a.fps;
      await page.evaluate((tt) => window.seek(tt), Math.max(0, t));
      const png = await page.screenshot({ type: 'png' });
      if (!enc.p.stdin.write(png)) await new Promise((r) => enc.p.stdin.once('drain', r));
    }
    doneFrames++;
    if (doneFrames % (a.fps * 2) === 0) {
      const s = (Date.now() - started) / 1000;
      console.log(`${doneFrames}/${frames} frames · ${s.toFixed(0)}s · ~${((s / doneFrames) * (frames - doneFrames)).toFixed(0)}s left`);
    }
  }
  enc.p.stdin.end();
  await enc.done;
  await page.close();
  return seg;
}

try {
  const segs = (await Promise.all(Array.from({ length: a.workers }, (_, k) => worker(k)))).filter(Boolean);
  const list = join(tmp, 'list.txt');
  await writeFile(list, segs.map((s) => `file '${s}'`).join('\n'));
  const silent = join(tmp, 'silent.mp4');
  await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]).done;
  const hasAudio = await access(audio).then(() => true, () => false);
  if (hasAudio && a.from === 0) {
    await ffmpeg([
      '-i', silent, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-bsf:v', VUI, '-c:a', 'aac', '-b:a', '256k',
      '-t', String(a.to - a.from), '-movflags', '+faststart', out,
    ]).done;
  } else {
    await ffmpeg(['-i', silent, '-c', 'copy', '-bsf:v', VUI, '-movflags', '+faststart', out]).done;
  }
  console.log(`${out} · ${frames} frames in ${((Date.now() - started) / 1000).toFixed(0)}s${hasAudio && a.from === 0 ? ' · with score' : ' · silent'}`);
} finally {
  await browser.close();
  server.close();
  await rm(tmp, { recursive: true, force: true });
}
