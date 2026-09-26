---
name: guide-ui-ux
description: Load EVERY time you render anything a human looks at — html, react/jsx, an artifact page, a chart, a tui — before the first element is written or reviewed.
---

# UI/UX floor

Binding on every rendered element, whatever the stack; a review flags each miss. Distilled
from WCAG 2.2, MDN and Material 3 — the rules a senior reviewer flags on sight. Stack-specific
guides (`guide-react`) sit on top of this one.


- **text ≥14px, dense data ≥12px, never below** — small AND dim is the failure pair; ≥4.5:1
  contrast for text, ≥3:1 for icons, chart marks, axis lines, focus rings
- **`user-select: none` only on chrome** — buttons, icons, chart marks, drag handles. Values,
  ids, code, errors stay selectable. Dark theme sets `::selection` explicitly (opaque bg)
- **the cursor says what the pointer will do** — tailwind 4 resets buttons to `default`, so every
  app restores it in `@layer base`, then each control picks its kind:
  - `pointer` — buttons, links, tabs, menu items, options, switches, checkboxes, selects, a
    slider's track (a click sets the value), anything that opens on click
  - `grab` → `grabbing` while held — slider thumbs, drag handles, a canvas that pans. base-ui lays
    a transparent `input` over each thumb: the rule reaches `[data-slot=slider-thumb] input` too
  - `col-resize` / `row-resize` — splitters (react-resizable-panels sets them itself)
  - `text` — inputs and editable text · `not-allowed` — disabled controls · `zoom-in` /
    `zoom-out` — an image that zooms on click · `progress` — the app works in the background and
    stays usable · `wait` — only when input is truly blocked · `copy` — a drag that copies ·
    `help` — an element whose hover explains it · `crosshair` — a picker
  - plain text and non-interactive cards keep `default`
- **one tab stop per widget** — a group (toggle group, radio group, tabs, toolbar, listbox) is one
  stop and arrows move inside it: build it from the base-ui composite, never hand-rolled
  `tabIndex`; positive `tabIndex` is banned. a splitter is a stop by default (arrows resize); an
  app opts out only with a reason in its verify recipe's `--deny` list
- **a scroll box never clips a focus ring** — a ring on an element inside an overflow container
  is `ring-inset` / a negative `outline-offset`, or the container carries padding for it
- **every clickable is `<button>`/`<a>` with its cursor and a visible hover state** — the
  surface, border or underline shifts under the pointer; an image that opens a zoom is a
  clickable too. A `div` with onClick is a keyboard hole. Hit target ≥24×24 (44 touch); a dense
  chart gets a transparent padded hit rect per cell, empty cells included
- **the app's logo or name, top-left, is always a link to the app's root (`/`)** with
  `cursor: pointer` — the one way home from any screen (dima, 2026-09-25)
- **state never by colour alone** — pair with weight, underline, border. `:focus-visible` ring
  ≥2px, never removed
- **honour `prefers-reduced-motion` and `prefers-color-scheme`** — both palettes as tokens
- **leaving a view stops what it started** — autoplay, animation loops, audio, polling: a route
  change or a closed panel halts them, and coming back resumes from a still frame, never mid-play
  (dima, 2026-09-26)
- **`tabular-nums` on every numeric column**; truncated text carries the full value in a
  tooltip; tooltips are hoverable and Esc-dismissible
- **dark surface ≈ `#121212`, never `#000`** — elevation by lighter surface, accents
  desaturated
- one spacing scale (4px base), never ad-hoc px
- **a structural change invalidates every layout measurement banked before it** — a landmark, a
  wrapper, a grid item added above the measured element re-runs the numbers (a `<main>` made a
  board unshrinkable at 768 while «no overflow» stood from an earlier commit, 2026-09-20)
- **a control is measured in its enabled state** — the disabled one is grey on purpose and hides
  a primary button at 1.16:1 (shipped through a polish pass, 2026-09-20)
- **a visual fix is measured, never eyeballed** — before the change, read the computed geometry of
  the element and its container (bounding boxes, at 390 / 768 / 1280); state the delta in px; make
  ONE change that closes it; re-measure. three guessed offsets on one emoji is the failure this kills

A rule here grows only from a defect Dima saw — the trigger was trophy-sys: dim colours on
10px text, `user-select` on chart marks, dead clicks on empty cells.
