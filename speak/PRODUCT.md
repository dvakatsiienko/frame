# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

on this mac only: served on 127.0.0.1 by a launchd job, never deployed.

grade: **prod** — finished as if shipped: every state drawn, night included, polish at a public app's level.

## Users

mine: my personal app, for my own use.

- the daily use happens outside this page: F4 on a selection in any app reads it aloud through x-speak, and a new
  F4 overrides the reading; F4 with nothing selected, or ⇧F4 always, pauses and resumes; F5 stops.
- the admin stays open in a tab all day: tune the chain, the voices, speed and gain, hear a change, then save. the
  pill and the admin both get top-tier design (dima, 2026-09-30).

## Product Purpose

dima, 2026-09-30: «I use it to hear 90% of text instead of reading … the read aloud hotkey is the most used hotkey
across my whole system.»

one page to set, per language, which engines read aloud and in what order, and how each sounds — and to hear a
change before saving it. success: the next F4 sounds the way dima wants, without editing config.json by hand.

## Positioning

- one key reads a selection in any app, including electron apps and editors.
- an ordered chain per language falls back on its own when an engine fails, is slow, or runs out of quota — with
  free local kokoro always there.
- english, ukrainian and russian, per chunk: a mixed line switches language mid-sentence.
- a normalizer makes tickets, versions and paths speakable (`FRM-266`, `v0.3.85`, `speak/`).

## Operating Context

- x-speak, a swift daemon under launchd, does the reading; this page reaches it only over its control socket and
  edits its config.json.
- the pill: a floating dark-glass capsule with a live level meter, shown while x-speak speaks. it is the product's
  most-seen surface.
- engines: elevenlabs (10k free credits a month), fish (free tier until 2026-11-30), kokoro (local, unlimited),
  the macOS voice, gemini.

## Capabilities and Constraints

- female voices only; no emoji read aloud.
- a preview uses the card's unsaved settings; a ♥ saves at once; save writes config.json through biome.
- an engine out of quota is skipped by the chain and shown as such until its next success.
- the glossary is `GLOSSARY.md`; the feature map is `FTR.md`.
- the cut (the 2026-09-30 re-shape). in: the keys, the pill's volume and speed controls, the pill's word highlight,
  the admin redesign with expressive provider cards, an in-app highlight as an experiment. out: highlight in
  terminals and pdfs, chrome by default, new engines, dropping any provider — every engine stays, they are dima's
  playground.

## Brand Commitments

- part of frame, an x-com product.
- names: speak (this admin), x-speak (the daemon). one name per thing on every layer.
- ui copy: lowercase, short, plain words.
- the pill is the brand's centre; the page takes its cues from it.

## Evidence on Hand

- the running page on http://127.0.0.1:7386 and the pill on screen while speaking.
- favicons in `public/` (`speak-light.svg`, `speak-dark.svg`, png sizes).
- no screenshots, marks or copy beyond these; nothing to invent.

## Product Principles

1. hearing beats reading: every setting can be heard before it is saved.
2. the chain never leaves dima in silence: a failing engine falls through, visibly.
3. instant or it is broken: a press, a pause and a preview answer at once.
4. one person's tool: no onboarding, no accounts, no explanations he does not need.
