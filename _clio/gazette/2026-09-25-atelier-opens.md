---
date: 2026-09-25
slug: atelier-opens
tickets: [BYT-103, BYT-104, BYT-105, FRM-263, BYT-88, BYT-94, BYT-55]
posted: {health: yes}
---
# 🗞️ cclio's gazette · atelier opens

## shipped
- **atelier**, the fleet's art studio, from spec to v1.2 in one day: [BYT-103](https://linear.app/x-com/issue/BYT-103) built it (#94 — live stage, takes, stash, compare, bake, ship, 16 kit components), [BYT-104](https://linear.app/x-com/issue/BYT-104) fixed seven things from dima's first use (#96), and [BYT-105](https://linear.app/x-com/issue/BYT-105)'s tweaks landed a build badge, a dev mark + prod↔dev switcher, and a zoom done right (#97–#100). it runs always at localhost:5180 under launchd (`x-atelier-live`)
- `PRODUCT.md` + `DESIGN.md` written with dima before any code — «the crafter and the lamp»; atelier's own favicon drawn in atelier
- the diorama stage left frame for atelier; `x:gif-kit` became `x:art-kit`, one home for every art job; a fleet door for art
- greptile is gone everywhere: its free plan runs no cli ([BYT-94](https://linear.app/x-com/issue/BYT-94) records it); the local review chain is code-review → coderabbit
- decided with sources: the coder runs opus 5.5 medium (high for scaffolds), the verifier opus 5.5 high — the trials closed
- the boot digest reads parallel monitors; `LINEAR_API_KEY` fixes comments posting as dima; the halt prints a vet board

## tricks gained
- foxglove's look is a recipe, not a library: a seeded edge-cutter, two shadows a layer, a grain tile — and a one-scene brief
- react-zoom-pan-pinch zooms additively and ignores deltaMode — a doubling formula on your own wheel handler feels right
- a gesture is tested through chrome's real input path (CDP), never page-script events
- every coder push costs a vercel record per app despite `deploymentEnabled: false`; batches push once per round

## state
- open: the settings pick per readme and scene one drawn to the bar ([FRM-263](https://linear.app/x-com/issue/FRM-263)); a drawn atelier logo; the jev «read first» hook tag; the vercel why (on the ci review)
- the BYT-105 coder and verifier were stopped at the halt; new tweaks go to a fresh coder from the list

## trail
- shipped: atelier v1 → v1.2 (#94, #96–#100) under launchd · art-kit + art door · greptile dropped · coder medium / verifier high decided · 09-25 flush (briefs, headless hazards, jev sharpened)
- open: readme settings pick + scene one (FRM-263) · atelier logo · jev ⚠ read-first tag · vercel not-affected records · BYT-55 rename
- state: frame e48284ac pushed, bytes 5f837ed7 pushed, no coders, impeccable off, x 0.11.114 · cclio 0.3.67
