---
name: speak
description: the voice admin for x-speak — the pill, unfolded
colors:
  pill-indigo: "#4a55c8"
  pill-indigo-night: "#9aa2ff"
  paper: "#f6f5f2"
  paper-surface: "#ffffff"
  paper-surface-2: "#efede8"
  paper-ink: "#1c1b19"
  paper-muted: "#5d5a53"
  paper-line: "#d8d4cb"
  night: "#121212"
  night-surface: "#1d1d1f"
  night-surface-2: "#262628"
  night-ink: "#ecebe8"
  night-muted: "#a9a59c"
  night-line: "#3a3a3d"
  ok: "#2f6b3a"
  warn: "#8a5a00"
  bad: "#a33a2a"
  meter-indigo: "#8f94ff"
typography:
  headline:
    fontFamily: "-apple-system, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.45
  title:
    fontFamily: "-apple-system, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.45
  body:
    fontFamily: "-apple-system, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "-apple-system, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button:
    backgroundColor: "{colors.paper-surface-2}"
    textColor: "{colors.paper-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "32px"
  button-primary:
    backgroundColor: "{colors.pill-indigo}"
    textColor: "{colors.paper-surface}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "32px"
  input:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.paper-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "4px 8px"
  engine-card:
    backgroundColor: "{colors.paper-surface}"
    rounded: "{rounded.lg}"
    padding: "12px"
  state-badge:
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
  pill:
    backgroundColor: "{colors.night}"
    rounded: "{rounded.full}"
    width: "236px"
    height: "36px"
---

# Design System: speak

## Overview

**Creative North Star: "The Pill, Unfolded"**

the pill is the product's most-seen surface: a dark-glass capsule that floats over any app while x-speak reads,
with one live indigo meter. this page is that pill opened up — the same restraint, the same single accent, room to
tune what the pill plays. the page is a tool dima opens now and then, so it stays quiet and flat and lets the
engines and their state carry the reading.

density is working-tool dense: three language columns side by side, a card per engine, every control in reach
without scrolling a column far. nothing moves at rest; the only motion in the family is the pill's meter, and it
runs only while audio plays.

**Key Characteristics:**
- one accent, pill indigo, on primary actions, checked controls, focus and selection
- flat: 1px lines and layered greys, never a shadow on the page
- state in words and borders (`live`, `no quota`, `benched`), colour only as a second signal
- lowercase, short, plain copy
- light (paper) and dark (night) from the same tokens

## Colors

a warm-neutral paper and a near-black night, one indigo voice, three quiet state hues.

### Primary
- **Pill Indigo** (light #4a55c8, dark #9aa2ff): the save button, checked switches and checkboxes, slider fills,
  the focus ring and text selection. the same hue as the pill's live bars.

### Neutral
- **Paper** (#f6f5f2) / **Night** (#121212): the page ground, light and dark.
- **Surface** (paper #ffffff, night #1d1d1f): a chain card, an input, the voice popover.
- **Surface 2** (paper #efede8, night #262628): a plain button's fill.
- **Ink** (paper #1c1b19, night #ecebe8): body text and values.
- **Muted** (paper #5d5a53, night #a9a59c): labels, ranks, helper text — still ≥4.5:1 on every ground.
- **Line** (paper #d8d4cb, night #3a3a3d): every border and divider, 1px.

### State
- **Ok** (#2f6b3a light, #8cc79a dark): `live`, a save that landed.
- **Warn** (#8a5a00 light, #e0b35c dark): `benched until …`.
- **Bad** (#a33a2a light, #ec8a78 dark): `no key`, a rejected save.
- **Muted** also marks a waiting state: `no quota` is expected and already skipped, so it reads quiet.

### Named Rules
**The One Voice Rule.** indigo is the only accent. a state hue marks state and nothing else; a brand colour never
leaks into a control.

**The Brand Stays Home Rule.** each engine keeps its own hue — elevenlabs ink, kokoro rose (#e0457b), siri violet
(#8b5cf6), fish ocean (#0e8fd6), gemini blue (#6f8cf2) — but only in its 24px mark and a 10% wash along the top of
its chain card. a card outside the chain dims its mark.

**The Word First Rule.** every state reads as a word in a bordered badge; the colour only repeats it.

## Typography

**Body Font:** the system sans (-apple-system, system-ui)

**Character:** the mac's own voice — nothing to load, nothing that looks like a website.

### Hierarchy
- **Headline** (700, 18px): the app name, top-left, a link home.
- **Title** (600, 16px): a language column's name and an engine's name.
- **Body** (400, 15px, 1.45): the default.
- **Label** (400, 14px): controls, badges, helper lines, the status line; numbers in `tabular-nums`.

### Named Rules
**The 14px Floor Rule.** nothing renders below 14px; small and dim never meet.

## Layout

a centred column, max 1280px, 16px gutters. under the header, a playback panel (22px-rounded surface, like the
chrome): first audio budget, pill glide, pill flow, infinite waveform. then the language columns: stacked below
900px, three across above it, 24px apart, 40px apart when stacked, 32px under the panel; cards 12px apart. inside a column: the title, the sample line, then the cards 8px apart; inside a card,
8px steps. a sticky save bar holds the bottom edge, and focus scrolls clear of it (88px scroll padding). the scale
is 4px-based: 4, 8, 12, 16.

## Elevation & Depth

no shadows on the page. depth is tonal: ground, then surface, then surface 2, each a step lighter at night and a step
off-white by day, each edged by a 1px line. the only raised elements are the voice popover and the ⓘ tooltip: a
surface with a soft shadow, so they read above the card they opened from. the pill alone uses glass: vibrancy under a 55% black
tint.

### Named Rules
**The Flat Page Rule.** a card is a surface and a line, never a shadow; a shadow means «floating above the page».

## Shapes

gently rounded: 4px on a badge, 6px on buttons and inputs, 8px on a card. a card in the chain has a solid line; an
engine outside the chain has a dashed one — the dash says «not playing». the pill is a full capsule.

## Components

### Pill chrome (header and save bar)
- the header and the save bar are the pill, grown: a 22px-rounded capsule of dark glass (#151517 at 95%) with a white
  hairline, sticky 12px from the top and bottom edge, in both themes.
- inside, the pill's own ink and the night indigo: the save button is an indigo capsule, the others hairline capsules.
- the save bar pads evenly, 8px on every side of its 32px buttons.
- the header holds the name with a still meter mark (five indigo bars, centre-heavy), the language links, the daemon
  line and stop; the settings row (first audio budget, pill glide) sits under it on the page.

### Buttons
- **Shape:** on a card, a round 32px hairline (the pill's button on the page); in the chrome, 32px-tall capsules.
- **Plain:** surface-2 fill, 1px line, ink label; hover lifts to the surface with a muted line.
- **Primary:** pill indigo fill and line, semibold label; hover brightens. one per screen: save.
- **Disabled:** half opacity and a not-allowed cursor.
- **Focus:** a 2px indigo ring, 2px out.

### Engine card
- **In the chain:** 16px-rounded, surface fill with its brand wash, solid 1px line, 16px padding, 12px between rows.
  the top row: grip (grab cursor), mark, engine name, state badge. then a 16px switch labelled «1st in the en chain»
  (the rank lives in the words), ↑ / ↓ and ▶. then voice, speed and gain.
- **Outside the chain:** no fill, dashed line, name and switch only.
- **Out of quota:** a muted `no quota` badge and a disabled ▶; the credits left and the provider's message sit in the
  badge's tooltip. nothing red — the chain already skips it.
- **Drop target:** a 2px indigo outline while a dragged card hovers it.

### Inputs / Fields
- **Style:** surface fill, 1px line, 6px corners, 14px text.
- **Sliders:** native range in pill indigo; the track takes a click, the handle a grab.

### State badge
- a word in a 4px-rounded 1px border of its own state hue: `live`, `benched until 20:15`, `no key`, `no quota`.

### Voice picker
- a button showing the voice (♥ first when a favourite) opens a popover list: a pick button and a ♥ toggle per row,
  favourites first, «only ♥ favourites» on top. esc, a pick or a click outside closes it.

### The pill (signature, lives in the daemon)
- a 236×36 capsule of dark glass (vibrancy under 55% black) with a 1px white line at 14%, in both themes.
- one meter of 17 bars, 2.5px wide with 2.5px gaps, centre-heavy (edges reach 40% of the centre), with headroom so
  a loud read never fills it; live bars in meter indigo (#8f94ff), rest bars as dim dots (white at 22%).
- ✕, ⏸ / ▶, ■ with its F5 hint, and the pin, each a quiet glyph button.
- the meter reads the sound every 10 ms (each 100 ms audio buffer cut into ten windows) and glides by the «pill
  glide» setting; it animates only while audio plays and at rest draws once and holds.

## Do's and Don'ts

### Do:
- **Do** take every colour from the `theme.css` tokens; both themes come free.
- **Do** say state in a word first, colour second.
- **Do** keep indigo for action, selection and focus.
- **Do** keep the page still; motion belongs to the pill's meter.

### Don't:
- **Don't** add a shadow to a card or a second accent colour.
- **Don't** render text under 14px.
- **Don't** animate anything at rest — no pulse, shimmer or spinner (dima's rule).
