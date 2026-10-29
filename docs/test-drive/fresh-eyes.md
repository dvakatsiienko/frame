---
status: live
until: 2026-11-06
dies-when: the verdict line below is written
fits: verifier
---

# fresh-eyes — the blind first-time-user subagent card 🐠

Ticket: FRM-407

**built:** 2026-10-21, [FRM-407](https://linear.app/x-com/issue/FRM-407) (the shape lives in the ticket); `until:` is 14 days from the build. until moved 2026-10-29 (dima o36): the trial resumes on speak v2's first screen PR, the next web lane. open: the planted-confusion run and a first real app run.

**test card:** we believe fresh-eyes finds where a first-time user gets lost that the verifier and dima's own look miss · we test it by on-demand runs on apps without a login (chords, speak, atelier) whenever a screen changes · we measure per goal: stuck spots, true or false by dima's call, the 2-of-3 agreement rate, the control run's false spots, tokens and dollars for the 3 parallel runs, wall time · we're right if at least 1 true stumble the verifier missed turns up per 3 goals, at most 1 in 3 reported spots is false, and one goal costs under 10 minutes of wall time
**kill rule:** 3 goals in a row with no true spot, or the control run flags a false spot twice
**at the verdict:** adopted → rethink the code-review card's name, wisphunter vs sharp-eyes as fresh-eyes' pair (dima, 2026-10-29, FRM-455)

## stress list
- the blind door (a PreToolUse hook on `agent_type`) — its first run — `cat`, the Read tool off its shots dir, `view-source:`, `/src/…`, a source map, `file://`: each refused, yes or no
- 3 parallel runs + the 2-of-3 rule — every goal — agreement rate, wall time against one run
- reading its own screenshots — a contrast or hidden-button case — does a spot cite what only the image shows
- outcome goals + the label check — the spawner's goals for 3 apps — labels caught, goals rewritten
- the control run on a clean screen — every round — false spots
- the production build — every round — any dev-only leak met
- a planted confusion (a button whose label says nothing) — the first round — found in 2 of 3, yes or no
- the patience budget (5 dead ends, borrowed from `ux-testers`, run #6 of `refresh-crew-coordinator`) — every goal — the action and dead-end count where it gave up, compared across the 3 runs

## day 0
- the users and the docs: `docs/research/blind-usability-agents.md` (UXAgent, AgentA/B, AMUSER, PerceptUI, Loop11; agent-browser's `dogfood` skill, `--action-policy`, `--allowed-domains`; the cc hook input's `agent_type`) — read 2026-10-21

## rounds
- 2026-10-21 · the blind door, first run: the card as a one-shot `claude -p --agent fresh-eyes` (haiku) tried `cat`, the Read tool, view-source, file://, `eval` · 5 of 5 refused by its frontmatter hook, the reason printed each time · the usual door had no fence at all · built here, no lane: card + `shelf/hooks/fresh-eyes-blind.ts` (11 tests) + `fresh-eyes-goal-check.ts` (3 tests, caught 2 real atelier labels; strict — a one-word label like «motion» counts). agent-browser has no `--allowed-domains` / `--action-policy` in our version, so the hook is the whole fence
- 2026-10-21 · the cli surface added on dima's word (o94: try it on the next cli lane): the hook lets through bare `x`, `x <family>`, `x schema`, `x … --help` and nothing that acts; 12 tests, red-proven · first cli run: the next cli lane
- 2026-10-22 · first cli run, FRM-403 #96 (bb7019ff) · goal «as a coder whose branch fell behind main, bring it up to date without a merge commit» · 3 of 3 found `x lane rebase-main --apply`, 3–4 actions, 0 dead ends, ~11 s and ~12k tokens each · spots hit by 2+ of 3: `--apply` unexplained in help (3/3, x-wide: `pr-body` reads the same), `merge-main` nearly picked (3/3, its purpose line rescued them), the guard's 94 s foreground hint firing on help calls (3/3), what happens off a `coder/*` branch (2/3) · true or false: dima's call · none owned by the pr, so no refute; no control run this round

## verdict
