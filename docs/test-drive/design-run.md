# design run — the designer flow on trial

Ticket: [FRM-244](https://linear.app/x-com/issue/FRM-244)

the flow under test: `x:crew-designer-interview` → `brief.md` → `x:crew-designer` in `~/projects/studio` → 4 takes on
the Claude Design canvas → dima's pick → 2–3 variants → impeccable builds. evidence behind it:
`docs/research/design-process.md`. verdict line at the end: adopted, reshaped, or dropped.

## what the first run tests (atelier, blind)

- **the brief gate** — do ~10 pick-questions give a brief the designer acts on without asking back?
- **the canvas** — does the Design type fill from files in `jobs/<app>/takes/`, or only its own way?
- **a real spread** — are the 4 takes truly different, labelled by corner? any mash-up ask?
- **pick time** — minutes from the canvas link to dima's pick
- **rounds** — the pick reached in ≤3 iteration rounds?
- **the blinding** — does any of today's atelier look leak into a take?
- **cost** — tokens in/out, wall minutes, usage-window % per spread (the ledger below)
- **comp → build** — how much impeccable loses between the comp and the code (the finish review)
- **two A/Bs, after the pick**
  - axis frames vs `/adhd` frames
  - a picked brief vs a deliberately vague one

## after the first run: the drift research

planned, not yet a recipe vector — dima 2026-09-29: «let's test a designer … have first output — designed atelier, then
research, then decide to fold into recipe or not.»

the question: apps evolve and drift from their prototypes. keep the design alive and in sync, or treat comps as
throwaways? dima's asks, near-verbatim:

- how do other people solve it? does any modern llm-based dev flow work this way?
- the live mode he would pick with no quota limit: every coder + verifier spawn also gets a designer; an ask («add a
  button») goes to the designer first, dima approves the drawing, then the coder builds it
- his main concern is the token cost — without it, he would just adopt the live mode and test it in place
- the flow is llm development **with a human in it**: dima is often present and steers designs and apps
- a solid mock is expensive on his side too (he thinks through and picks an art direction each time), so he would not
  want to lose a polished prototype
- «thoroughly researched and verified, along with neuroarxiv»
- input from the first run: the ledger's cost per spread is the number the live mode multiplies

lanes when it runs: `pnpm research:lanes` (exa + parallel) + an opus source lane + neuroarxiv (`habit-research-lanes`).

→ researched 2026-09-29 (four lanes): `docs/research/design-drift.md` — the structured layer lives, comps retire as
dated references; live mode costs 75–225 % of a 5-hour window a week, selective ~7–22 %.

## ledger — one line per spread

date · app · brief version · mode · takes · artboards · tokens in/out · wall minutes · usage window % before → after ·
pick minutes · rounds

- 2026-09-29 · atelier · brief v1 · full, blind · 4 takes · 5 artboards (4 takes + 1 shared art piece) · ~68k out (session footer; in not read) · 10.7 wall min · 5h 18 → 21 %, 7d 30 → 30 % · pick min pending · round 1
- 2026-09-29 · atelier · brief v1 · full, blind · pick variants of glass-experimental · 3 artboards · out tokens from the session footer (not visible in-session) · 3.1 wall min · 5h 22 → 26 %, 7d 30 → 31 % · round 2
- 2026-09-29 · atelier · brief v1 · A/B adhd — frames from /adhd:adhd instead of the axis corners · 4 takes (remove-the-assumption, inversion, speedrunner, logistics) · 5 artboards (4 takes + 1 shared art piece) · 49.7k out, 138k cache write (session transcript) + 5 sonnet diverge branches ≈ 291k subagent tokens · 8 wall min · 5h 23 → 32 %, 7d 30 → 31 % · pick min pending · round 1
- 2026-09-29 · atelier · brief-vague (A/B vague) · full, blind · 4 takes · 5 artboards (4 takes + 1 shared art piece) · ~59.6k out (session transcript usage), in 137k cache-write + 2.5M cache-read · 9 wall min · 5h 23 → 33 %, 7d 30 → 31 % (window shared with parallel sessions) · pick min pending · round 1
- 2026-09-30 · atelier · brief v1 · full, blind · round 3 on glass-experimental (all settings on the ring, film strip, small-art stage) · 3 artboards · ~35k out (estimate: session footer not visible in-session) · ~7 wall min · 5h 27 → 30 %, 7d 37 → 38 % · round 3 (last allowed)
- 2026-09-30 · atelier · brief v1 · critique (ux, pm, engineer; rendered locally with the canvas runtime in agent-browser) + fix pass + decision.md + contract.md · 3 artboards re-rendered twice · output tokens not visible in-session · ~12 wall min · 5h 30 → 32 % · closed, the pick = glass-experimental

## verdict — 2026-09-29: adopted (dima: «looks very good, and as a first take, almost works for me»)

- dima's comparison, a tired first look: **the gated brief got closer** (v1 best); **the vague brief gave the more different ideas**; glass over swiss

- **the flow works end to end**: interview → brief → 4 blind takes on the canvas in ~11 min → dima's pick → 3 state
  variants in ~3 min. the blinding held (no session read the app's repo or named its old art).
- **cost per spread: ~50–70k output tokens, 8–11 wall minutes** (v1 ~68k, vague ~60k, adhd ~50k + ~291k in five sonnet
  branches). the window % per spread is unreliable tonight — three spreads and four research lanes shared one window
  (18 → 33 % over the evening).
- **open, needs dima's eye**: gated brief vs vague (on-target?), axis corners vs adhd frames (more different? worth the
  extra subagent tokens?). then: adopt, reshape or drop.
- fixed on the way: the interview's question shape (x 0.11.165), the designer's ping + footer tokens (x 0.11.166), the
  12 px key floor.

## comp → build — atelier shipped (2026-09-30)

- the build: [bytes#116](https://github.com/dvakatsiienko/bytes/pull/116) (`2f80ca64`), one coder from `contract.md` + the comp, 9 verifier rounds; favicon [#117](https://github.com/dvakatsiienko/bytes/pull/117) from the new tokens
- impeccable's finish review: 8 material fixes, 3 of them comp devices the coder had skipped — rendering the boards to png first (now `design:comp-render`, a crew-coder step) is the fix
- what the comp never covered, found by dima's eye in 3 review rounds: chrome placement on a letterboxed piece (the comp's art filled the screen) — ended as «The One Frame Rule» in `DESIGN.md`; the pieces list key
- `DESIGN.md` now exists (impeccable's documenter, from the shipped code) → the drift-policy test drive starts today

## model × effort — fable 5.1 vs opus 5.5 (from 2026-10-01)

dima, 2026-10-01: «measure fable designer token usage to compare against opus 5.5 and consider effort». the meter:
`python3 docs/test-drive/design-run/usage.py <session-id>…` — tokens per model (subagents included), wall minutes and $
at list prices, 1h cache writes at 2× input. effort is not recorded in a transcript; it comes from the spawn line.

opus 5.5 baseline, the atelier spreads (effort not recorded at spawn, likely the default):
- spread v1 (62e56c11) · 4 takes · out 107k · cache write 261k · read 12.8M · $6.78 · 46.5 wall min (incl. idle)
- spread vague (ceed2212) · 4 takes · out 62k · write 148k · read 3.9M · $3.20 · 9.4 min
- spread adhd (8882b18d) · 4 takes · out 57k + sonnet branches · $4.25 · 9.5 min
- round 3 (38cc02b0) · 3 artboards · out 74k · write 240k · read 19.1M · $7.22 · 34.1 min

fable 5.1, speak brief v1.2, 2 takes + the blind pill side take each, one line per arm when its spread lands:
- 2026-10-01 · speak · brief v1.2 · full · arm medium (3261de54) · 2 takes + blind pills A/B · 8 artboards · ~245k tokens by the session counter (in+out, the split is on the session footer) + blind lanes 77k (A, FTR, 1.8 min) and 94k (B, PRODUCT, 3.7 min) · 16 wall min (16:30–16:46) · 5 h window 34 → 52 % (shared with the other arm), week 55 → 57 % · pick minutes and rounds: open
- 2026-10-01 · speak · brief v1.2 · full · arm opus 5.5 medium · 2 takes + blind pills A/B + pass 2 · 9 artboards · ~115k tokens by the session counter (in+out; the split is on the session footer) · blind lanes inside it: A (FTR) ~1.5 min, B (PRODUCT) ~1 min · 10 wall min (16:37–16:47) · 5 h window 43 → 55 % (shared with the fable arms), week 56 → 57 % · pick minutes and rounds: open
- 2026-10-01 · speak · brief v1.2 · full · arm high (52d7c203) · 2 takes + blind pills A/B + pass 2 · 13 artboards (per take: admin ideal, admin benched, 1728, 900, pill, stats; one blind-pill board) · ~302k tokens by the session counter (in+out; the job state file reads 128k, the split is on the session footer) · blind lanes inside it: A (FTR) and B (PRODUCT) ~1 min of plan each, frozen before `DESIGN.md` was opened, per-lane tokens not split · 24 wall min (16:30–16:54) · 5 h window 34 → 60 % (shared with the other arms), week 55 → 58 % · pick minutes and rounds: open
- metered at the spread (usage.py, list prices): opus 5.5 medium $4.35 · 11.0 min · out 74k — fable 5.1 medium $13.44 · 15.5 min · out 94k — fable 5.1 high $15.52 · 24.7 min · out 135k (high grew to ~$25 with dima's comment rounds)
- 2026-10-01 · cli (`x`) · brief v1 · quick, blind · fable 5.1 (b554d319) · 2 takes (airy-mono, dense-family) × 3 views + a light 16-colour board each · 8 artboards, generated from one `build.py` (screens as text, widths asserted) · out 48.9k, cache write 159k, read 2.54M, $6.26 (usage.py at the spread) · 9 wall min (18:38–18:47) · 5 h window 82 → 7 % (the window reset mid-run), week 61 → 62 % · pick minutes and rounds: open
- 📌 the blind leaked: the gallery/tab titles named arms («speak opus v1», «high arm v1») before dima looked
- dima's verdict (2026-10-01, unblinded): **fable medium and high beat opus**; medium vs high each wins in some scenarios. 34 canvas comments: opus 5, fable medium 11, fable high 18 — most «best» picks land on the two fable canvases
- friction: each arm titled the same board differently, so the cross-canvas review stalled; fixed in `x:crew-designer` (one board-title scheme from the brief's words)
- «best» tags per arm (dima's canvas comments, 2026-10-01, 39 comments): fable high 13 positive + 7 steers · fable medium 9 positive + 4 steers · opus 2 positive + 3 steers. the merge take (brief v1.3) borrows: page + selected card + waveform + footer stats + popover (fable high) · header + card + popovers + pill shape (fable medium) · order line + detailed stats (opus)
- the review flow, adopted: dima comments on the canvases → cclio hoists every comment + a coverage check of uncommented parts → one merge brief → one designer draws the merged take (`x:crew-designer` step 5)
- 2026-10-01 · speak · brief v1.3 · merge round (dima's 39 comments → one take) · fable 5.1 high · 18 artboards · out 116k · cache write 393k · read 13.2M · $16.96 · 19 min · pick minutes and rounds: open
- 2026-10-01 · cli (x) · brief v1 quick · 2 takes × 3 views + light/16-colour · fable 5.1 medium · 8 artboards · out 53k · $7.23 · 19 min (9 to the spread) · pick: open
