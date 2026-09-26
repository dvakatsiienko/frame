# refresh-spawn-mechanics — recipe

Keeps the spawn evidence base true against the current claude code build. Recipe entity per
[_spec.md](_spec.md).

## the want (dima's, 2026-08-27)

> i want you, coordinator, to coordinate with spawns (subagents) efficiently and precisely.
> should work for now, with only you occasionally spawning a coder. the wants for this will
> grow when we add verifiers and the rest of the zoo.

## research vectors (re-groomed with dima 2026-08-31 for run #2)

- re-verify every [verified] row against the current cc build — the standing mechanical pass
- workflow per-call `effort` — the one open flag question left
- 🆕 the cclio-stack bleed (§11 of the evidence base): a designed probe for why a
  `cwd: ~/frame` `--bg` session once loaded the coordinator's stack — non-deterministic,
  trigger unknown, cost is a session quietly wearing cclio's brain
- new spawn surfaces or flags in the cc changelog since 2.1.251
- orchestrator best-practices sweep — BOUNDED: one pass, findings land as evidence-base rows
  or die
- ✂️ closed at this groom: worktree-safety (the `EnterWorktree` hook automated the guard,
  proven live) · earlier cuts stand: cloud row · `claude attach` · `notify_when_idle`
- dima's standing word: cclio doing the spawning is fine for now

## analysis vectors (local evidence — the running agent is the instrument)

- which [verified] rows did live sessions contradict since last run? a contradiction outranks
  the row's age as a refresh trigger.
- did any spawn incident this period reveal a gap the evidence base has no row for — a flag
  nobody measured, a failure shape nobody named?
- is the doc still ~claim-tagged throughout, or have untagged assertions crept in?
- which bundled skills does this cc build ship, gated ones included? a skill with model invocation
  gated off never appears in the session's list (`/verify` sat unseen until 2026-09-26) — list them
  from the build's bundled-skills dir or the binary, and name any new one to dima.

## artifacts (pointed at, never housed)

- `docs/knowledge/spawn-mechanics.md` — the pristine evidence base: claim-tagged, and its
  «the test suite» section IS this recipe's test suite. sits beside `models.md` because its
  readers are any session that spawns, not the coordinator alone.
- `cclio/memory/craft-spawning.md` — the resident distillate; check it still agrees after
  every refresh

📌 run #1 corrected a spec violation: this section used to name `cclio/docs/spawn-mechanics-research.md`,
the RAW research doc, as its own artifact — which is why the doc never died. `_spec.md` is explicit
that raw research is distilled and then deleted. the raw doc is gone; the artifact above replaces it.

## the run

1. re-groom the research vectors with Dima
2. execute the artifact's «the test suite» section against the current build (a probe run while a
   human or a peer edits the system is not controlled — the doc's own lesson; say so and re-run if
   the environment moved). stop every probe session spawned, and verify by the registry file
   vanishing.
3. distill: update claim tags and rows in place; a falsified row is corrected, never deleted
   silently — the retraction pattern in the doc shows the shape
4. eval + print findings: any row flipped? craft-spawning drifted? new lever worth adopting?
5. resolve with Dima by outcome; noop is first-class

## cadence

Event-driven: a cc minor version change (the doc's own `refresh-when`), or a spawn behaving
against a [verified] row.

## last run

**run #2 — 2026-09-02, cc 2.1.258** (previous: 2.1.251). all five groomed vectors executed: 2 bg
probes, 3 subagents, 2 one-agent workflows, both stop routes.

- 🚨 **the subagent stack flipped AGAIN: a subagent inherits the parent's whole stack, whatever
  its cwd.** two cclio subagents at `~/frame/docs` and `~/frame` both carried
  `cclio/CLAUDE.md` + every memory leaf. tagged [volatile] in §7 — three builds, three answers.
- **the bleed is explained for subagents** (inheritance) and **unreproduced for `--bg`**: 2/2
  clean on this build. the §11 row stays as a watch, not a rule.
- **subagent cwd = the parent's BASH SHELL cwd**, mutable by any earlier `cd` — sharper than
  «parent's cwd».
- ✅ **workflow per-call `effort` is honoured** — `high` under a session at `low`. the last
  open flag question closed.
- bg-spare pool anatomy recorded: a transient `claude daemon` (ppid 1) owns the slots, born at
  the first `--bg`, one spare stays warm.
- re-verified unchanged: `--bg` runs its prompt · `--model` + `--effort` on every record ·
  registry + `respawnFlags` · worktree branches from `origin/main`, auto-cleans · `claude stop`
  and `kill <pid>` both remove the registry file · `ListAgents`/`Workflow` absent in a subagent ·
  `CLAUDE_EFFORT` inherited by an opus child.
- vectors closed by this run: workflow effort · the bleed (as far as it can be) · changelog
  sweep and orchestrator best-practices produced nothing new worth a row (the build changes
  were the flips above).

**run #1 — 2026-08-30, cc 2.1.251** (previous evidence: cc 2.1.239, 2026-08-22). every
[verified] row re-executed with real spawns. the raw research doc was distilled into
`docs/knowledge/spawn-mechanics.md` and deleted.

**what contradicted a [verified] row** — four, three of them load-bearing:

- 🚨 **a subagent starts in the PARENT'S CWD, not the workspace root.** discriminated from
  `~/frame/docs`: parent and child both landed there. the old rule said repo root.
- 🚨 **`claude --bg '<prompt>'` DOES run the prompt.** the transcript carries the prompt as a user
  record and the answer as the first assistant text. the old rule said it comes up idle and needs
  a follow-up `SendMessage` — a wasted round trip on every coder spawn since.
- 🚨 **a subagent re-derives its CLAUDE.md stack from its own cwd instead of inheriting the
  parent's.** a subagent of a session holding `cclio/CLAUDE.md` did not receive it; 2.1.239
  recorded the opposite.
- **`claude stop <jobId>` works from a non-tty shell**, so «`kill <pid>` is the ONLY reliable
  stop» is over-strong. both routes verified; `kill` stays the fallback.

**what closed** — `--effort` on `--bg` with an effort-capable model is now [verified]
(`--model opus --effort low` → `effort=low` on every record); the earlier `effort: null` was the
haiku pairing, not the flag. worktree isolation is [verified] end to end, and brought a new
load-bearing fact: **it branches from `origin/<default-branch>`, not local `HEAD`**.

**gaps the evidence base had no row for** — three, all now rows:

- **how a session gets its name.** the `-n` vs `--remote-control <name>` confusion (a live session
  named itself on 2026-08-30) had no row; §5 now carries it, plus the contrast with the `Agent`
  tool's regex.
- **how to learn a session's launch flags.** `~/.claude/jobs/<jobId>/state.json` carries
  `respawnFlags` and is the only place argv survives. §8.
- **the bg-spare pool.** a `--bg` session is claimed from a pre-warmed spare, not spawned fresh —
  the process argv changed shape since 2.1.239. §5.

**tag hygiene** — the retired doc was still tagged throughout; no untagged assertions had crept
in. Its weak spot was different: ~25 lines of retraction narrative about a 2026-08-22 mid-run
environment flip, which is a method lesson (already resident in `method-report-verify`) rather
than spawn evidence. dropped to a pointer. the 9-column matrix was replaced by one bullet block
per door, per `rules/fleet-output-format.md`.

📌 **research vectors need dima's re-groom before run #2** — vector 2's list is now mostly closed
(`--bg` + `--effort` ✅, worktree ✅, `notify_when_idle` ✅ end to end). what survives: workflow
per-call effort, the cloud row, `claude attach` (needs a tty). one new candidate: the unexplained
cclio-stack bleed recorded in §11 of the artifact.
