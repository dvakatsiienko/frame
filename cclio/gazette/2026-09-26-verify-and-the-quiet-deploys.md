---
date: 2026-09-26
slug: verify-and-the-quiet-deploys
tickets: [FRM-244, BYT-106, BYT-98, BYT-105, FRM-26, FRM-264]
posted: {health: no}
---

# 🗞️ cclio's gazette · verify and the quiet deploys

## shipped

- product docs refreshed and grilled: impeccable 4.3.1 read from source, neuroarxiv prior art, a two-file shape (`PRODUCT.md` stays impeccable's, `product/MAP.md` is ours, given/when/then lines become exit lines) — [FRM-244](https://linear.app/x-com/issue/FRM-244), research `docs/research/product-docs-model.md`
- ci hoisted into one scope, 24 live + 9 dead items, dima's answers in its body — [BYT-106](https://linear.app/x-com/issue/BYT-106); graphite vectors parked for the day it connects — [BYT-98](https://linear.app/x-com/issue/BYT-98)
- the vercel noise found and fixed: «skip unaffected projects» wrote a canceled record for every untouched project on every push (91 on 09-25); off on all 6 projects, a probe push proved it (bytes `d0fcc285`)
- `/verify` explored end to end: a positive run (atelier on the lan, PASS) and a planted `t` break (FAIL, cause named); the recipe lives at `apps/atelier/.claude/skills/verify/`; retros now feed recipes, cclio places them at the halt (x 0.11.120, cclio 0.3.71)
- smalls: jotai 3 merged (bytes #95); atelier and chords open on the wi-fi; the jev router tags side-effect picks «⚠ read first»; the self-grill rides the CST; two guide lines (a view stops what it started, an effect returns its release); a dead write hook gone; four atelier gremlins on [BYT-105](https://linear.app/x-com/issue/BYT-105); the license question on [FRM-26](https://linear.app/x-com/issue/FRM-26)
- the parallel memory session: prompt audit, https-only ticket links, commits never close, hazards beside their readers, dispatch purged

## tricks gained

- a gated built-in skill never shows in the session's list — `/verify` sat unseen; the recorded project recipe is a plain skill whose gate is ours to set
- `vercel api … -d` writes nothing and exits 0; `--input <file>` works — read the field back
- linear auto-creates a `related` edge for every issue a body mentions
- `parallel-cli` core scored 5/5 on the `/verify` round, 3/5 on product docs

## state

- next: `x:product-docs` thin v1 → the atelier map pilot; then the gremlins coder, which tries `/run`
- open asks: none beyond the pilot; [FRM-264](https://linear.app/x-com/issue/FRM-264) (zsh `=word` hook) in triage
- halt batch: commit the atelier verify recipe, slay frame + bytes

⸻ upd 21:39

## shipped

- `x:product-docs` v1 and the atelier map pilot — the map, its glossary (`CONTEXT.md`, 23 words) and the verify recipe on main; the pilot verdict and a monday designer A/B in [FRM-244](https://linear.app/x-com/issue/FRM-244)
- the gremlins pr: [BYT-105](https://linear.app/x-com/issue/BYT-105) → bytes #102 (24 commits, 16 items: a11y, motion stops, bake progress, a boundary per section, the rail), 4 verifier rounds, merged `2ac18e34`, all 6 apps Ready
- the web ui essentials in `x:browser-headless`: one eval + a tab walk every web verify runs — axe with target-size, overflow, clipped and painted-over rings, covered controls, cursors; plus the guide rules they prove (the cursor set, one tab stop per widget, boundaries wrapped from the parent)
- jotai: 3 in x-com-chat broke its prod build (jotai-devtools has no stable v3), rolled back to 2.20.3 everywhere, a reminder holds the lift
- the memory lane (🦉 cclio memory): a prompt audit + memory-nurture reshape over 78 files — 10 cross-file conflicts resolved, 13 dead pointers fixed, links https-only, fleet-hazards split by repo, dispatch out of live text; resident load −7.3 % per cclio boot (54.9k → 50.9k), −10.4 % per session

## tricks gained

- hit-testing is not a paint test: an outline paints above static neighbours, so only a positioned layer counts as covering a ring
- a boundary never catches its own component's hooks — it wraps the section from the parent
- a merge that adds a dependency needs `pnpm install` plus a live-server restart; vite keeps a failed import until it restarts
- a peer range is a claim: jotai-devtools says `>=2.20.0` and imports a jotai 3-removed internal

## state

- next: monday — the designer A/B (map vs no map); then chords' map
- open: BYT-105 follow-ups (drawn logo, loop encode, two clipped rings) · the model bench
- frame 9607e5f4 + bytes ba47eaa3, slay at this halt · no coders

## trail

- shipped: x:product-docs v1 + atelier map pilot (FRM-244) · #102 gremlins merged, 6 apps Ready (BYT-105) · web ui essentials + guide rules · jotai rollback · memory lane reshape −7.3 % boot
- open: monday designer A/B (map vs no map) · chords map · BYT-105 follow-ups (logo, loop encode, 2 rings) · model bench
- state: frame 9607e5f4, bytes ba47eaa3, slayed at halt, no coders, x 0.11.129 · cclio 0.3.73
