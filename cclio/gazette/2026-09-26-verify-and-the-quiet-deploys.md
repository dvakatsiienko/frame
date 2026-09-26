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

## trail

- shipped: product docs shape settled (FRM-244) · ci sweep scoped (BYT-106) · vercel skipped records fixed on all 6 · /verify explored, atelier recipe written · lan apps, jotai 3, jev ⚠ tag
- open: x:product-docs thin v1 → atelier map pilot · gremlins coder tries /run · FRM-264 zsh hook · the verify recipe commit
- state: frame 8c489347, bytes d0fcc285, unpushed (slay at halt), no coders, checkpoint written
