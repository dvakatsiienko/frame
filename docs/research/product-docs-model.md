---
dies-when: the FRM-244 grill settles the shape and the atelier + chords pilot verdict is written into FRM-244
---
Ticket: FRM-244

# product docs model — the 2026-09-26 refresh

three lanes, dima's vectors: v1 does the model stand · v2 neuroarxiv prior art · v3 does each step remove work · v4 design docs.
lanes: opus (impeccable 4.3.1 source read + web), neuroarxiv (20 arXiv papers), parallel-cli core (control, 183 s, ~4¢).

## v1 — impeccable's PRODUCT.md, read from source (4.3.1)

- `init` = repo read + interview (≤3 questions a round) → a fixed template stamped `<!-- impeccable:product-schema 1 -->` (Platform, Stack, Users, Product Purpose, Positioning, Operating Context, Capabilities and Constraints, Brand Commitments, Evidence on Hand, Product Principles, Accessibility) — `reference/init.md:25-98`
- no verb regenerates PRODUCT.md or DESIGN.md unattended: «Never silently overwrite an existing file» (`init.md:15`); `document` asks refresh/overwrite/merge (`document.md:71`); `doctor` migrates schema only (`doctor.md:31`)
- **the hand-edit ban is ours, not impeccable's** — the source bans hand edits only for a locked live-accept file (`live.md:272`) and the hook launcher (`hooks.md:104`). ours: `docs/knowledge/impeccable-refine.md:18-19`, atelier + chords `AGENTS.md`. DESIGN.md keeps a real reason: its sidecar `.impeccable/design.json` regenerates with it (`document.md:255`)
- verbs read the files as prose: `impeccable context` prints PRODUCT.md + DESIGN.md + the matching surface brief, whole. chords measured 37.3 KB (PRODUCT 6.8, DESIGN 23). only `## Platform`, the schema stamp and section presence are parsed. a `product/` dir is never read
- impeccable already has a per-route layer: surface briefs `.impeccable/surfaces/<slug>.md`, loaded per target — design direction, not a feature ledger
- a ledger inside PRODUCT.md would break nothing, but every impeccable session would load it whole as it grows → rejected for bloat
- chords already carries a hand-written ledger in `PRODUCT.md:63-74` — 12 lines of prose for 3 features: the need is real, the home is wrong
- elsewhere: openspec = one `specs/<capability>/spec.md` with GIVEN/WHEN/THEN scenarios, deltas merged at archive; kiro = small always-loaded `product.md` + per-mode files; spec-kit = per-feature folders, no living spec. shared pattern: a small always-loaded character file + per-capability behaviour files on demand
- impeccable skill v4.4.0 shipped 2026-09-25 (parallel lane) — we run 4.3.1

## v2 — neuroarxiv (claims per the lane, abstracts checked by it)

- not a rebuild: no paper has the whole ledger → wireframe → comp → build loop
- the ledger works as a **checkable index for dima**, not as agent context: context files add >20 % cost for no success gain (2602.11988); context strategy had no effect over 288 runs, agents fail on design + wiring (2607.27250)
- anchor every line (route file · component · test id); `verified` = that test passes; invisible rules as contracts → tests (2608.17177, +9.8 pt bug detection)
- deterministic ci gate on anchors (2307.04291: >¼ of top repos carry stale code refs); an llm ledger-vs-code diff only advises (~80 % F1, 2506.16440)
- bloat is the named risk (2511.12884): one line per feature, prune dead features
- unmeasured anywhere: the same-change rule, a design doc derived from the running ui — ours to measure

## v3 — does each step earn its place

- ✅ feature line + its given/when/then lines = the verifier's exit lines → no hand-written exit lines at spawn, the brief shrinks to «build MAP lines x–y», dima reads «what does bake do» in one place
- ✅ status flip in the same commit: coder 🧭 → ✅, cclio 🔎 at close
- 🚫 a «character» section in the map — PRODUCT.md already holds it
- 🚫 a standing svg per view — nothing regenerates it; a wireframe lives in the artifact during a new view's approval round
- 🚫 the pr-review gate — main-lane apps have no pr. cheapest enforcement: the verifier checks the line + flip → cclio diffs at close → a bytes `commit-msg` lefthook job only if the pilot shows drift (freebies and dima-mode coders have no verifier)

## v4 — design docs

- a designer skill is redundant: impeccable's `shape` / `new-work` / `critique` / `audit` / `polish` cover it; the two approval gates go into `impeccable-refine.md`
- `document` stays DESIGN.md's author, after the build («a rulebook written before the build gets defended against reality», `new-work.md:77`); a comp belongs in the surface brief's direction contract (canvas-as-comp: inferred, untested)
- DESIGN.md follows google stitch's open spec — exact headings are parsed

## the shape the lanes converge on

- `PRODUCT.md` — impeccable's, character + durable truth, hand edits allowed
- `product/MAP.md` — never read by impeccable: a 3-line legend, `## <route> — <view>`, `- 🧭|✅|🔎 <feature>`, indented `given/when/then` lines (= exit lines, = the verify skill's checks), indented `decision:` lines. split at ~150 lines into an index + `product/<route>.md` leaves
- per-app AGENTS.md line + one line each in `x:crew-coder` / `x:crew-verifier`; a skill only when a third app adopts it
- pilot: atelier map (live, take, compare, rail, bench; first 🧭 = «bake shows progress»); chords ledger moved out of PRODUCT.md. lives if: zero hand-written exit lines, «what does bake do» answered in one read, zero unmapped changes at the end. dies if the map lags or costs more than it saves
