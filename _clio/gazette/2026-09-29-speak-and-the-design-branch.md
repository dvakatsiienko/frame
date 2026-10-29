---
date: 2026-09-29
slug: speak-and-the-design-branch
tickets: [FRM-269, FRM-270, FRM-244, BYT-105, BYT-112, FRM-271]
posted: {health: yes}
---

# 🗞️ cclio's gazette · speak and the design branch

## shipped

- 🔊 **speak** — F5 reads any selection in a female neural voice, stop on the same key: [FRM-269](https://linear.app/x-com/issue/FRM-269). a tech-text normalizer (27 golden cases, every emoji stripped), one resident swift daemon under launchd, the chain elevenlabs → kokoro → system (dima later moved kokoro first for english), 189–401 ms press → audio. a react voice admin at :7386 with ♥ favourites, a draggable dark-glass pill that opens on the pointer's screen, atelier's favicon. two blind listening booths picked the voices.
- 🔏 **every frame daemon signs with one cert** (`script/lib/sign.sh`, valid to 2036): privacy grants survive rebuilds; `pnpm schedule:restart <job>` came with it.
- 🗺️ **atelier's map** — the crash lines made drivable and `atelier-verify` walks the map ([#115](https://github.com/dvakatsiienko/bytes/pull/115)), 31 lines 🔎 by dima, a purpose + states pair per view for the designer: [BYT-105](https://linear.app/x-com/issue/BYT-105).
- 🎨 **the design branch researched** — five lanes on 12 vectors plus cowork-vs-cc: brief gate → 4 takes on 2 named axes → pick → impeccable builds; design from claude code (`docs/research/design-process.md`, [FRM-244](https://linear.app/x-com/issue/FRM-244)).
- 📐 **recipes** — `refresh-design-branch` and `refresh-read-aloud`; the scan for more: [FRM-270](https://linear.app/x-com/issue/FRM-270).

## tricks gained

- **fleet-identity #4, automate**: dima's hands first — a deep link, a script before any click ask. the essentials wrapper (`browser-headless/essentials/run.sh`) was its first product.
- **research runs every lane at once**: `pnpm research:lanes` (exa + parallel side by side) + an opus source lane; exa opened as parallel's challenger (5/5 twice, $0.10 a run); `advise-project-approach` adopted.
- **a fan-out answers once**; **recipe-first** for any branch; the authoring guard refuses an agent-doc write until `writing-for-agents` loaded.
- macOS 27 calls Accessibility «Device Control and Data Access»; `op run` masks secrets in a child's stdout.

## state

- next: the design flow — `~/projects/studio` + `crew-designer-interview` + `crew-designer` (quick + full mode) + the directions gallery + `design:*` scripts, then dima's strategic question and a 4-take atelier run with token burn measured
- vets live: exa + parallel to 10-06, adhd 10-05, quicksilver 10-12

⸻ upd 21:50

## shipped

- 🎨 **the designer is a fleet member** — `x:crew-designer` + `x:crew-designer-interview`, home `~/projects/studio` (git, a sortable design-languages gallery), the `design:*` instruments in frame `design/` (contrast, palette, cvd, scale, tokens, diff; 7 tests proven red): [FRM-244](https://linear.app/x-com/issue/FRM-244).
- 🧪 **the first run, atelier, blind** — interview → brief → 4 takes at the corners of glass ↔ swiss × familiar ↔ experimental → dima picked glass-experimental («the lens ring») → 3 state variants. two A/Bs on the same view: `/adhd` frames and a vague brief. **dima adopted the flow**: the gated brief got closer, the vague one more diverse. ~50–70k output tokens and 8–11 min per spread.
- 🔬 **the drift research**, four lanes: the structured layer (code, tokens, `DESIGN.md`) lives, comps retire as dated references; a designer on every ask would cost 75–225 % of a 5-hour window a week (`docs/research/design-drift.md`).
- 🖼️ atelier's purpose now covers every product — game and web art ([bytes 1330a2f2](https://github.com/dvakatsiienko/bytes/commit/1330a2f2)); hq filed as [BYT-112](https://linear.app/x-com/issue/BYT-112), voice + chords as its sections.

## tricks gained

- impeccable was off in frame for a day: a project-scope `false` beats a user `true` — a plugin switch checks every layer.
- a `--bg` spawn in a new folder needs that folder's own trust key, a trusted parent is not enough.
- the interview asks two options a question, character vs axes apart, with a pre-filled answer fence.

## state

- next: designer v1 steps 1–7 (round 3 on the lens ring → critique → contract → the build → finish check → `DESIGN.md` → verdict), then the big prompt (`_hq/inbox-plan.md` + the structured copy) in a fresh session
- open: the drift policy + its one-week test (dima decides fresh); [FRM-271](https://linear.app/x-com/issue/FRM-271) red-proof

## trail

- shipped: speak end to end (FRM-269) · daemons signed · the designer joins the fleet (studio, two skills, design:* scripts) · the first atelier run + 2 A/Bs, flow adopted · drift research · hq ticket BYT-112
- open: designer v1 steps 1–7 → the big prompt (inbox-plan.md) in a fresh session · the drift policy decision
- state: frame + bytes pushed, no coders, the designer's CST in the store · cclio 0.3.86 · x 0.11.167
