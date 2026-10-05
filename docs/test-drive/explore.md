# explore — which model finds code best for the cost: opus, sonnet 5.5, or a jev ranking

Ticket: none
dies-when: the verdict line below is written (2026-10-10) — the winner stays as `home/.claude/agents/explore.md`, the losers leave

dima, 2026-10-01, approving the sonnet test drive: «yes, between steps today»; on adding jev: «maybe a/b test jev vs
sonnet 5.5 explore? what if jev better at ranking? and it is essentially free. sonnet 5.5 still costs. worth to setup
and a/b measure? and test drive side by side?»

the question: the built-in Explore runs on the session model (opus 5.5) since cc 2.1.198. does a cheaper arm find the
right file as well, faster or cheaper?

## setup

- arm A, opus: the built-in Explore, as before 2026-10-01 — reproduce by renaming `explore.md` away for one run
- arm B, sonnet 5.5 at `medium`: `home/.claude/agents/explore.md` (`name: Explore`, `model: sonnet`, `effort: medium`,
  read-only tools), linked to `~/.claude/agents/` on 2026-10-01 — every Explore call fleet-wide now takes this arm
- arm C, jev ranking: `rg` finds the candidate files, jev scores them 20 at a time against the question, the top 3 are
  opened (the video's use case 4: 35 files ranked in 1.6 s). not built yet — a script, built when arm B's first rounds land
  - the video's shape (screenshots from dima, 2026-10-01): a skill, not an agent, «because skills have scripts that
    accompany a skill» — `jev-explore/SKILL.md` + `jev_rank.py` (theirs is python; ours would be a node `.ts` script).
    the description triggers on «where is X handled, defined or enforced»; the flow: one or two keywords → keyword search →
    jev scores 20 files per request → Claude reads only the top 3 (0.96, 0.91, 0.87 in the demo)
- day-0 source: the 2026-10-01 model refresh — sonnet 5.5 wins as a short-lived reader under opus; `low` skips checks
  on code, `xhigh`/`max` cost more than opus

## stress list — 10 real lookups, the same 10 for every arm

- a symbol: where a function is defined (`buildJevRequest`-class)
- a «who uses X» across a monorepo (bytes)
- a config value hidden in a dotfile (`home/`)
- a string that appears in docs and code both
- a swift file in a daemon (`schedule/jobs/`)
- a lookup with no answer (the arm must say «not found»)
- a fuzzy ask («where do we handle sleep/wake in speak»)
- a big tree (bytes `apps/`) with a narrow target
- a recent change (git log is the shortest path)
- a test that covers a named behaviour

## log — date · lookup · arm · seconds · tokens or ¢ · right file in top 3 (y/n) · note

- 2026-10-01 · day-0 probe: «which file in frame/script defines wispr:add» · B · not timed · not counted · y · a fresh `claude -p` session; its subagent transcript reads `claude-sonnet-5-5`, the parent `claude-opus-5-5` — the agent file overrides the built-in. effort `medium` is set but not observable in the transcript

## verdict
