---
name: crew-subagent
description: Load BEFORE any `Agent` or `Workflow` call, in any session — a helper, helper-lite, researcher, wisphunter, retro, scout or wishkeeper card, a fork, a worktree-isolated agent — and on «subagent», «delegate», «fan out». A crew lane member (coder, verifier, designer, probe, cloud session) is `x:crew-lead`.
---

# crew-subagent — the open door, for every fleet member

a subagent is disposable: it runs inside your session, dies with it, and dima cannot open it. the facts behind each line, probed: [spawn-mechanics](../crew-lead/references/spawn-mechanics.md) §§ 1–4 and 7; prices and model cards: [model-cards](../crew-lead/references/model-cards.md).

## when to delegate

- **a chore goes to a card** (dima, 2026-10-04: «delegate more dumb work to sonnet»): `helper-lite` (Haiku 5.5) for reads, counts and spelled-out edits; `helper` (Sonnet 5.5) when an edit needs care; `researcher` (Opus 5.5) for a bounded question answered from sources; `wisphunter` (Opus 5.5) for every code review of a diff, never `researcher` or `helper`; `retro` for finished transcripts; `scout` to locate code. the card list with each one's model is `rules/fleet-identity.md` § the subagents
- **a big read stays out of your context** — a number off a transcript, a log or a json dump goes to `helper-lite`, never a hand `jq` in your own thread; only its short answer comes back, and its diff is read before anything lands
- **in cclio, a stateful chore goes to composer instead** — a pocket write, a commit through the gate, inbox prep; a stateless one (a rename sweep, a read) stays a fresh `helper-lite`

## how to spawn

- **a card starts lean**: `helper-lite`, `helper`, `researcher`, `wisphunter`, `retro` and `scout` set `omitClaudeMd` (8–10k on the first request), so the brief carries the whole job — the question, the paths, the output shape — like a colleague who just walked in. a card without it writes the whole fleet memory (~82k, ~117k from cclio)
- **effort**: `medium` is the baseline for every model (dima, 2026-10-01: «use low effort only when necessary or via my ask. use medium as a baseline for all models»); a card call passes no `effort` unless it means to move the card for this job — `high` for a hard review or an exact count over a messy file. the per-call value overrides the card's and holds on resume, and only `CLAUDE_CODE_EFFORT_LEVEL` beats both; adopted 2026-10-22, `docs/test-drive/agent-effort.md`
- **fork** (`subagent_type: "fork"`) carries your whole thread and runs on your model; its prompt carries `why-fork: <what parent context it needs>`. a lookup or a bounded research goes to a fresh card instead. fork defaults and the off switch: `crew-lead` `references/spawn-mechanics.md`. `CLAUDE_CODE_SUBAGENT_MODEL=opus` sets the fresh-agent default (dima's yes, 2026-09-13)
- **`isolation: "worktree"`** only when agents would collide in one checkout; the tree starts from `origin/<default>`, so push main first
- **fan-out size** (measured 2026-10-15): x10 cards cost ~4× one card doing it whole and finish ~5× sooner; every card pays a ~12k floor, so a chunk under ~10k of real work is mostly floor. speed-bound fans out, cost-bound stays whole; x25+ goes to a `Workflow`, which shares the prefix cache between siblings (parallel `Agent` spawns share none), every `agent()` with `agentType: '<card>'` (the default workflow agent loads the whole fleet memory: 115k vs 7.5k)
- **a haiku crew**: you plan and split the batches, `helper-lite` workers run at `medium` (they skip checks at `low`), you review every batch against a checklist naming the shared helpers each had to use
- **a haiku worker owns no wait and no loop against an outside api**: you fetch, it reads what was fetched
- **reuse is cold after 5 min**: a subagent writes the 5-min cache, so one revived by `SendMessage` minutes later rewrites its whole context — spawn fresh unless its knowledge is the job; the reuse math per model is the subagent row of [models.md](../crew-lead/models.md) § spawn or reuse

## when it is done

the job is done when the card's answer is read, checked against its source or diff (a summary says what it meant to do), and folded into your own work — never relayed as-is.
