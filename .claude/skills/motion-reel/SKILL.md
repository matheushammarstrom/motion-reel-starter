---
name: motion-reel
description: Make or change a motion film (a launch reel, a feature clip, a motion ad, a new cut, format or language of an existing one) rendered from code with this repository's engine - a seek(t) page, a parallel headless-browser renderer, a score synthesized on the same clock, and a critique loop before anything is shown. Use when the user asks for a video, reel, launch film, animated clip or motion ad about their product.
---

# Motion reel

Brief: $ARGUMENTS

The engine and its house rules live in this repository: read `README.md` and `CLAUDE.md` first.
The 12-second sample film (`film.js`, `lib/timeline.js`, `lib/copy.js`, `audio/score.mjs`)
is the reference. Reuse its grammar (the brand's dot as the one protagonist, closed-form
springs, one container that morphs between screens, captions that rise out of masks) and write
a new story only when the brief needs one.

Needs Node 20+, ffmpeg (`brew install ffmpeg` or your package manager) and `npm install`
(which installs Playwright's Chromium).

## 1. Inputs

Ask only what the brief leaves open:
- where it plays (Reels 9:16, feed 1:1, YouTube, LinkedIn or a landing 16:9), duration,
  languages;
- the one thing the viewer should keep, and which features carry it;
- the brand: tokens (colours, the display font), the one accent, the copy rules the product's
  public pages follow;
- the product screens to show, and where their real code or mocks live.

Every line on screen must be something the product can claim today, in the product's own
voice. Prefer strings that already exist in the product (its UI, its site), so the film says
what the product says.

## 2. Plan before code

Write `docs/style_guide.md` and `docs/shotlist.md` first: a beat sheet on the 120 BPM grid
(a beat is 0.5 s) with picture, text and sound per beat. A new film gets its own folder: copy
this one and change the timeline, the copy and the scene builders. A new cut of the same film
is a flag, not a copy.

## 3. Build

- Times live in `lib/timeline.js`, which the picture and the score both read. Strings live in
  `lib/copy.js`, one object per language.
- Product UI is ported from the real screens at the app's own sizes, zoomed per format. Never
  invent a screen, a state or a feature.
- Motion comes from `lib/motion.js`: springs and tracks, never CSS transitions, timers or
  `Math.random`.
- A format is an entry in `LAYOUTS` (`film.js`). Reframe it; never crop another format.
- Tokens live in `index.html`'s `:root` and, as numbers, in `COL` in `film.js`. Change both.

## 4. Critique loop

Don't show anything before three rounds, and log each in `docs/review_log.md`:
1. `node stills.mjs --fmt <f>` for a contact sheet at one frame per beat, plus 12-frame strips
   around every fast action (`--every 0.0417 --from <t> --to <t+0.5> --cols 12 --thumb 150`).
2. After a render, the phone test: `ffmpeg -i <mp4> -vf "fps=1,scale=360:-1,tile=6x4" -frames:v 1 phone.png`.
3. Score 1 to 10: hook in 2 s, readability at 360 px, motion, variety, composition, brand, sync.
   Fix the three worst, then repeat until every score is 8 or more.

## 5. Sound

`node audio/score.mjs`. You can't listen, so balance by numbers: solo each group
(`SOLO=bass node audio/score.mjs`) and measure it with ffmpeg's `ebur128` over the groove.
Aim for bass about 3 LU under the kick, clap and stabs about 7, UI sounds about 10, then master
to -14 LUFS. Check a spectrogram. Tell the user plainly that nobody has listened to it yet.

## 6. Render and deliver

`node render.mjs --fmt <f> --lang <l>` takes about four minutes per 1080p minute. Before sending:
- loop: t = DUR paints the same frame as t = 0;
- determinism: the same frame rendered twice has the same hash (on an idle machine);
- colour: the accent reads as the token's RGB in the encoded video (decode with
  `flags=accurate_rnd` when you measure, or ffmpeg's fast rounding will lie by a few levels).
`bash check.sh out/<file>.mp4` runs these and makes the phone test.

Send each MP4 to the user. Renders stay in `out/`, which is gitignored: commit source only.
