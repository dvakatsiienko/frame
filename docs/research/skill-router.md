---
dies-when: dima flips the router on or drops it on these numbers, and the kept lessons land in cclio's `sys-jev` memory — then delete
---

Ticket: FRM-305

# skill router — what v2 built from three research lanes, and what the replay said

three lanes on 2026-10-05 (exa, parallel, an opus source lane) agreed on one thing: the misses
came from **what the router sees**, not from how it is built. v2 changes the inputs and keeps
FRM-268's two-call shape. every number below is the held-out third of 221 fixtures, `RUNS=3`,
jev `jev-1.13.0` (`node script/jev-test.ts skill-router`, r3).

## what the lanes agreed on

- **the latest turn alone is not enough.** a bare «go» or «1. yes 2. later» names its work only
  through the reply it answers. dialogue-intent study: 85.3 % prompt-only, 86.6 % with the last
  system turn, 66.5 % with all history — the last turn helps, everything hurts (parallel lane).
  QReCC: raw questions R@10 6.1 vs rewritten 26.5 (exa lane).
- **names and descriptions hide the routing signal.** SkillRouter: dropping skill bodies costs
  31–44 points of Hit@1 on an 80k-skill pool; listwise rerank beat pointwise by 30.7 points.
- **hard negatives beat «not for» wording.** no study measures «not for» lines; hard-negative OOS
  work does (Banking77 AUROC 0.996). so look-alike fixtures, not more description text.
- **a must-not-miss subset wants its own high-recall check**, unioned with the normal pick
  (large-catalog routing study; risk-aware retrieval). no paper gives a threshold for our size.
- **stage 2 earns its call** (hermes-jev-skills scorecard): stage 1 alone picked `dogfood` at 0.96
  for a browser task; its `needs_skill` noul withheld all 4 spurious loads on a 10-skill catalog.

## what was built, and the measured effect

- **recent context** — the last agent reply (tail 1500 chars) goes in as `recent_context`, read
  off the hook's `transcript_path`. alone, on FRM-268's roster: verdict misses 75 → 48 %,
  critical recall 53 → 67 %, but needless loads 0 → 11 % — context also tempts a load.
- **the full roster** — the session's own skill listing, read off the same transcript (the
  `skill_listing` attachment: exactly what the model was shown, built-ins included). 32 → 106 in
  a cclio session. `x` and `cclio` come from the tree so a worktree measures its own edits; the
  `x-cw:*` mirrors of `x:*` are dropped — two names for one procedure split the Choice.
- **session memory** — a skill already loaded, slash-invoked or suggested this session is not
  routed again (Skill tool calls, `<command-name>`, the router's own past `hook_success` lines).
- **full roster + memory together** is the jump: held precision **55 → 94 %**, wrong loads
  **30 → 2 %**, needless 4 %. most of FRM-268's wrong loads were the right skill missing from its
  roster (`writing-for-agents` for an AGENTS.md line, `claude-api` for a models doc).
- **the must-not-miss gate** — one noul per critical skill rides the wide request (no extra call);
  it fires only on a skill stage 1 also shortlisted, never past a veto. critical recall
  **33 → 78 %**, but precision **94 → 78 %** and wrong loads 2 → 13.5 %. the shortlist rule cut
  false fires about 3× at equal recall (15.3 → 4.3 per run at 0.5).
- **`needs_skill`** in stage 2, as hermes does it. measured only together with the gate.
- **stage 2 always runs** unless a veto fires; `none` beating the top skill became a swept
  `margin`. verdicts ranked the right skill first and still lost to `none` (30 of 84).
- **per-stage reasons** — `decide` returns one trace line per stage (`veto _later 0.89`,
  `none 0.94 ≥ x 0.03 + 0`, `need 0.20 < 0.5`, `fits … < …`, `gate …`), in `route.log` and the replay.
- **fixtures 79 → 221** — every roster skill has a positive; 35 observed prompts with the reply
  they answer; 14 look-alikes for the critical skills; a hash-held-out third that thresholds never
  see. `route.log` keeps the whole prompt now, so a vet miss filed with `--last` is a label.

## what did not work

- **a verdict carve-out in the `none` wording** — «a short verdict is not an acknowledgement».
  `none` still beat the top skill on 28 of 84 verdicts against 30 before: inside the wobble, so
  the wording was reverted.
- **a hard «critical ≥ 95 %» wall in the threshold sweep** — nothing on the tune split reached it,
  every candidate paid the same penalty, and the sweep switched the gate off. critical misses are
  now priced into the sweep's cost instead.

## the exit lines

- 4-arm table per slice: printed (held, verdict, substantive, single, multi, all).
- critical recall ≥ 95 %: **not met.** best held 78 % (gate arm); the gate noul's own spread is
  the limit — at 0.3 it reaches 78 % with 7 false fires a run (r2 raws). n is small: 9 critical positives
  held out.
- router OFF: `node script/jev-router.ts status` prints `router: OFF`. the hook now runs the one
  arm that met the bar (precision ≥ 90 %, wrong ≤ 5 %): full roster + context + memory at fits
  0.75 — 94.1 % / 2.1 %.
- a non-x skill can be picked: «do a grill about the raycast setup» → `mattpocock-skills:grilling` 0.96.
- the four side-effect skills keep «⚠ read first» (`loadLine`, unit-tested).

## latency (the hook's budget is 8 s)

- both jev calls, 4 in flight: FRM-268 p50 538 / p95 645 ms; v2 p50 612–634 / p95 729–738 ms.
- fixed cost before any call: ~900 ms, of which `op-run` (the 1Password read) is ~750 ms, node
  start 20 ms, router import + reading a 30 MB transcript ~150 ms.
- so a v2 prompt costs ~1.6 s at p95 — inside the budget. `op-run` is the cost to cut, in v1 too.

## left open

- recall vs precision is dima's call: the live arm (94 % precision, 33 % critical recall on n=9)
  or the gate arm (78 % / 78 %). the code for both ships; the hook runs the first.
- the critical list is the ticket's nine. per-skill gate spread says `x:guide-ui-ux` (wanted
  median 0.25) and `x:ftr` (0.37) are where the gate is weakest.
- multi-skill has 4 fixtures; its rows are noise until more land.
