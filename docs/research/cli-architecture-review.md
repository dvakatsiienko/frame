---
dies-when: the cli lane acts on its verdicts
---
Ticket: FRM-284

# x — architecture review, 2026-10-09

**Verdict: the core is built as planned. The next lanes, as sealed, drift inward.** The registry-as-data, the envelope, `--apply`, telemetry and the charm look match `x/PRODUCT.md`. cli 2–4 spend most exit lines on tools for building x (`registry add`, `linear fake`, `go gate --run`, `verify-tree`) and on an interactive frame for a verb nobody calls. The fleet's real raw traffic (`gh`, raw `linear api`, `claude plugin`) still has no verb. On this course x grows wide and its fleet coverage stays narrow.

## plan fit — dima's want, item by item

- **«~60 verbs, every member reaches for x first»** — partly. 37 visible verbs. Only `x lane` reaches the census's top Bash heads (154). Raw calls outside x: `gh api` 72, `gh pr` 44, `linear api` 60, `claude plugin` 129 (`.scratch/x-stats-truth/census-2026-10-08.md`).
- **«an always-up-to-date schema saves turns»** — met. Usage, flags, completion and schema are derived from `registry.json`, and a test fails a verb missing from `impls`. Partly on the cost side: bare `x --json` is **5 KB** (every verb plus its purpose). The plan said bare `x` lists families, with verbs on `x schema <family>`. At 60 verbs that is ~8 KB per discovery.
- **«automate repeatable fleet ops»** — partly. lane, handoff and linear are done. The planned order after `fleet` (mods → research → design → jev) has not started.
- **«only verbs that truly deserve a CLI» (admission rule)** — drifting. `go gate` is package lifecycle, the thing the rule sends to pnpm/turbo, and it duplicates `pnpm x-go:test`. cli 2 adds four more inward verbs.
- **the family map (~12 families)** — drifted. 5 of 13 families sit outside the map: `go`, `as`, `brief`, `probe`, `knowledge`. Five families have one verb each. None of the map's mods / design / jev / research / app / frame / tool exist yet.
- **telemetry from day one, `x stats` names dead weight** — met in the build. The data was polluted by tests until c0c19076. The 30-day «dead» test cannot fire before 2026-11-07.
- **«a verb is done when its old door is dead»** — partly. `replaces:` plus its test works per verb. But the root `package.json` still holds 82 scripts, and raw `linear api` outside x (60) outnumbers `x linear api` (15).
- **the look, pretty for dima** — met: the a/b/c, T2 boards, pager, completion. Dima made **15** calls in 3 days.
- **«interactive driving only when dima starts driving x»** — contradicted by FRM-360 as sealed. It builds the frame on `x knowledge read`, which has **0** traced reads. His 2026-10-06 ask may outrank the rule, but then `PRODUCT.md` should say so.
- **one resident line** — partly. `rules/fleet-doors.md` says «bare `x` lists every verb», not the families line. FTR still marks it 🧭.

## keep / merge / cut, per family

- `lane` (9) — **keep**. The hottest family, and it does the job of the admission rule. Merge `unlock` into `seed .`, since seed already unlocks.
- `handoff` (5) — **keep**. One store, one door, and `x-cw` shells to it.
- `linear` (9 + hidden `push`) — **keep**. `body`/`read`/`set` are hot. `update` failed **5 of 7** (the initiative bug). Point an x-mod-guard hint at raw `linear api`.
- `as` (1) — **keep** for `gh`; 71 calls. It overlaps `--as` on the linear verbs: two ways to pick an actor, so the docs should name one per tool.
- `brief` (2) — **keep**. It is cclio's spawn guard; it refuses half its calls by design.
- `fleet` (3) — **keep, cold**. 1–4 calls each: reports that run on a halt.
- `schema` / `completion` / `stats` — **keep**.
- `probe` (2) — **cut candidate**: 0 verb calls traced. Fleet docs still teach raw `claude -p --safe-mode`. Give it 14 days of traces, then cut.
- `knowledge` (2) — **cut candidate**: 3 `list` calls, all failed; 0 reads; `knowledge-reads.jsonl` was last written 2026-10-06.
- `go` (1) — **cut**. Move it to `pnpm x-go:gate`; it serves x's builders, not the fleet.

## build quality — top 5

1. **Two argv parsers and global exit state.** `detect`/`optionsOf`/`wordsOf` (`main.go:106,437,444`) parse argv beside cobra; `RunE` returns nil and passes the code through the `exitCode` global. FRM-345's review found «a flag value equal to `--board` flips the mode». The registry already owns help and completion, so cobra + fang only parse. **Pick one parser.**
2. **Side effects live in prose, not data.** `needsApply` has 3 carve-outs written in `AGENTS.md` (handoff, the linear writes, `lane review`). So `x schema linear set` shows `needsApply:false` for a write. Add an `effect: read|local|publish|destroy` field, keep `needsApply` derived, and print it in the schema (aclif's pattern, `docs/research/cli-agent-facing.md`).
3. **The startup tax is creeping.** 13.1 ms median direct, 17.1 ms via the shim; 7 ms is init, **4.3 ms** of it glamour's chroma, on every json call. Binary 14.4 → **18.0 MB**, source 2.3k → 9.2k lines in 3 days. Fine today; a startup-budget test would surface the trend.
4. **Tests are contract-shaped, but slow.** One binary built in `TestMain`, a fake graphql server, `calls.json` on pipe and pty. The gate takes **42 s** before every commit; split a fast `-short` tier from the full one.
5. **Envelope gaps.** Error recovery is strong (probed: a typo verb lists siblings, a bad flag or state lists the valid ones, a missing id gets `next: linear list --search`). Gaps: no envelope version (additive fields break strict consumers), bare `x` emits `verb:""` with no `next`, and `errors.As` where the guide says `errors.AsType`.

**What the data proves.** 4,253 polluted lines, 2,781 from `hook`. Dropping `-dirty` is the wrong filter (main reads dirty on any uncommitted file; today's real calls are all dirty), so filter `x.dev` instead: 1,364 lines. Dropping test bursts (≥4 calls per session within ±3 s, a heuristic) leaves **834**.
- It can prove a ranking (`lane commit` 216, `lane push` 131, `linear body` 107, `as` 71, `linear read` 49) and near-zero use of probe, knowledge, `fleet audit`/`ops`, `linear link`/`archive`, `handoff peek`.
- It cannot prove a verb dead (3 days of span against the 30-day rule), dima's needs (15 calls), or per-member splits.

## what the next cli lanes should NOT build

- `x registry add`. Make the registry test print the exact fix instead; a hand edit plus a red test is the door.
- `x linear fake` as a verb. `newFakeLinear` already exists in the tests; export it as a fixture script.
- `x go gate --run`, and the `go` family itself. Use `pnpm x-go:test -- -run X`.
- `x frontmatter`. Two internal callers make a lib function, not a fleet verb.
- `x run`, unless FRM-341 is proven not to cover it (cli 2's own line 8).
- The interactive frame on every screen (FRM-360 line 5) before traces show dima driving x. Prove it on a verb he calls.
- Any new one-verb family. Build `gh` (pr/api) and `mods` next instead, per the census.

Sources: [Anthropic — writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) («more tools don't always lead to better outcomes», namespacing, actionable errors); [12 factor CLI apps](https://jdxcode.medium.com/12-factor-cli-apps-dd3c227a0e46); [clig.dev](https://clig.dev); `docs/research/cli-agent-facing.md` (gh's agent detection, aclif side effects, envelope versioning).
