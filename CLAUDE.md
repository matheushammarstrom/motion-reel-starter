# Motion studio rules

## Render contract
- The film is a pure function of time: `window.seek(t)` paints frame t. No CSS transitions or
  animations, no timers, no `requestAnimationFrame` in render mode, no state carried between
  frames. Seeded noise only, never `Math.random`.
- Picture and sound share one clock: `lib/timeline.js`. Move a time there, not in a scene.
- Render with `node render.mjs`; H.264 yuv420p, CRF 16, BT.709.

## Look
- The brand's tokens only (`index.html` :root, mirrored in `COL` in `film.js`). One accent, and
  it belongs to the dot.
- Banned: centered title on gradient, everything fading in, corner labels, frame borders, glow
  on UI chrome, particle bursts, bouncy easing, pure black.
- Product UI is ported from the real app or its mocks at the app's own sizes, never invented.
  On-screen claims must be true of the product today.
- 9:16 text stays inside x 72–940, y 250–1560 (Reels covers the rest). Each format is its own
  entry in `LAYOUTS` (`film.js`): reframe, never crop. Something new every 2–4 s.

## Loop before you show anything
1. `node stills.mjs` → look at `out/contact.png`; strips around fast actions.
2. Score 1–10: hook, readability at 360 px, motion, variety, composition, brand, sync.
3. Fix the three worst problems. Log them in `docs/review_log.md`. Repeat until every score is 8+.
4. Only then `node render.mjs`.

## Working with the user
- Ask only what the brief leaves open. Show contact sheets, not claims, when you report.
- Say plainly what nobody has checked: the score (nobody can listen here), the phone test
  before it ran.
