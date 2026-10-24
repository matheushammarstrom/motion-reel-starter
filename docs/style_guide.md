# Style guide (template)

Write this before any code, from the product's own library: its design tokens, its public pages,
its real screens. Where this file and those disagree, those win.

## The idea in one line

(The film's one protagonist and what it does from the first frame to the last. The last frame
is the first frame.)

## Palette (one accent)

| Role | Hex | Where |
|---|---|---|
| Set / background | | every frame; never pure black |
| Panel | | the morphing container |
| Text / muted / faint | | |
| **Accent** | | the dot and nothing that competes with it |
| Semantic (inside UI only) | | success, warning, danger, as the app uses them |

## Type

(The display font. Display lines: weight, tracking, left-aligned, never centered on a gradient.
Captions: two lines max, ending in the accent period. Numbers: tabular, rolled digit by digit.
UI text is the app's own size × the scene scale, never re-typeset.)

## Surfaces and UI

(Which real screens are ported, from which files, with which sample data. No invented screens,
no invented features, no claim the product can't make today.)

## Motion

- Everything is a pure function of time; closed-form springs only.
- Snappy (buttons, leading edges): tiny overshoot. Default (containers, camera): critically
  damped. Heavy (big type): no overshoot. Playful: none.
- One container never cuts: it morphs size, radius and position between states.
- The dot is always the next action: it becomes each primary button right before the tap, and
  leaves when the button's job is done.
- A touch indicator drives every change.
- 120 BPM. State changes on beats, big moments on downbeats, SFX on the hit.

## Banned

Centered title on gradient · everything fading in · corner labels and frame borders · glow on
UI chrome · particle bursts · bouncy easing · stock "tech" gradients · pure black · a second accent.

## Frame

(60 fps; one layout per format in `LAYOUTS`, never a crop of another. 9:16 text stays inside
x 72–940, y 250–1560.)
