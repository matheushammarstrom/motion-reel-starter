# motion-reel-starter

A motion film rendered from code, driven by Claude Code. One HTML page paints any moment of the
film on demand (`window.seek(t)`), a headless browser walks the clock, and ffmpeg turns the
frames into an MP4. The score is synthesized in Node on the same clock, so every hit lands on
its picture event. A critique loop (contact sheets, frame strips, a phone test) runs before
anyone sees a render.

Built after 0xMovez's "How to build motion design studio with Opus 5.5". First used for the
launch film of a CrossFit box management app; this is the brand-neutral starter: the engine,
a 12-second sample film with placeholder tokens and copy, and the `/motion-reel` skill that
tells Claude Code how to plan, build and review a film with it.

## Use it with Claude Code

1. Clone this repository (or copy it into a `media/` folder of your project, keeping
   `.claude/skills/motion-reel` where Claude Code finds it).
2. `npm install` (installs Playwright's Chromium) and `brew install ffmpeg`.
3. Open Claude Code in the folder and ask for a film: "a 20-second reel for our app's new
   check-out, 9:16, English". The skill asks what the brief leaves open, writes the plan in
   `docs/`, ports your screens, runs the critique loop and renders.

Give it your brand first: the tokens in `index.html` and `COL` in `film.js`, your display
font, your copy rules, and where your real screens live. It ports screens; it does not invent
them.

## Render the sample

```bash
npm install
node audio/score.mjs                                  # out/score.wav at -14 LUFS
node render.mjs                                       # out/film-en-9x16.mp4 (about a minute)
node render.mjs --fmt 16x9                            # any of 9x16 · 16x9 · 1x1
node render.mjs --scale 0.5 --fps 30 --sub 1          # a quick animatic for pacing
node stills.mjs                                       # one frame per beat → out/contact.png
node stills.mjs --times 5.6,8.2                       # full-size stills
node stills.mjs --every 0.0417 --from 5.6 --to 6.1 --cols 12 --thumb 150 --name strip-tap
bash check.sh out/film-en-9x16.mp4                    # loop seam, determinism, the accent, the phone test
```

To preview live, serve the folder with any static server (ES modules don't load from `file://`)
and open `index.html`: `?fmt=16x9`, `?lang=en`, and `?t=5.6` to freeze a moment.

Output: H.264 High at 60 fps, 4 subframes per frame blended over a 180° shutter for motion blur,
CRF 16, BT.709 tagged in the bitstream; AAC at 256 kbps.

## Files

| File | What it holds |
|---|---|
| `lib/timeline.js` | The clock: 120 BPM, every scene time, every sound cue. Picture and sound both read it. |
| `lib/motion.js` | Closed-form springs (`spring`, `track`), presets, windows, seeded noise. |
| `lib/copy.js` | Every string on screen, one object per language. |
| `lib/ui.js` | DOM, type and layer helpers: captions, display lines, rolling digits, product layers. |
| `lib/icons.js` | The few Lucide icons the sample uses; add yours. |
| `film.js` | `LAYOUTS` (one per format), the hook, the big type, the captions, the container, the dot, the camera, the finger, two sample product layers; `window.seek(t)`. |
| `index.html` | Tokens (`:root`) and component CSS. |
| `audio/score.mjs` | Kick, clap, hats, offbeat bass, chord stabs, plucks, UI sounds; the sample's 6-bar arrangement. |
| `render.mjs`, `stills.mjs`, `lib/harness.mjs`, `check.sh` | Parallel renderer, stills and contact sheets, the local static server, the delivery checks. |
| `docs/` | The plan a film is written from (style guide, shot list) and its review log. Templates here. |
| `.claude/skills/motion-reel/SKILL.md` | The recipe Claude Code follows. |

## The grammar the sample shows

The brand's dot is the one protagonist: it punctuates the old way (three struck lines), swallows
them, lands as the period of "Full stop." and of the wordmark, becomes the button the film
presses, flies home to the caption's period, and ends the film where it began, so the film
loops. One container morphs between screens; content swaps behind a short blur. Captions rise
out of masks. A touch indicator drives every tap. Numbers roll digit by digit (a roller keeps its
digit count: "000" → "720"). Nothing fades in on its own.

## Known limits

- Nobody can listen to the score from inside Claude Code: it is balanced by measurement.
  Listen before posting.
- Screens are rebuilt from your app's code, not screen-recorded: when the app changes shape,
  the film won't follow on its own.
- Determinism is exact on an idle machine; under heavy CPU load Chromium may move a few
  glyph-edge pixels by a few levels, which the encoder never keeps.
