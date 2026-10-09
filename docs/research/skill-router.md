---
dies-when: dima flips the router on or drops it on these numbers, and the kept lessons land in cclio's `sys-jev` memory — then delete
---

Ticket: FRM-305

# skill router — what v2 built from three research lanes, and what the replay said

three lanes on 2026-10-05 (exa, parallel, an opus source lane) agreed on one thing: the misses
came from **what the router sees**, not from how it is built. v2 changes the inputs and keeps
FRM-268's two-call shape. every number below comes from `node script/jev-test.ts skill-router`
(r4, `RUNS=3`, jev `jev-1.13.0`): 221 fixtures, thresholds swept on two thirds, rates read on the
held-out third (71 prompts, 32 of them real).

## the verdict first

- **on the 32 real held-out prompts, no arm meets the bar to turn on** (precision ≥ 90 %, wrong
  loads ≤ 5 %). the best there is `+context`: precision **69 → 75 %**, wrong **22 → 15 %**,
  critical recall **50 → 71 %** against FRM-268 as shipped.
- **on the whole held third, full roster + memory reads 94 % / 2 %** — but 132 of 221 fixtures are
  synthetic, written from skill descriptions, and they carry that number. on real prompts the
  same arm reads 67 % precision with 73 % of wanted loads missed.
- **the router stays OFF.** the live hook runs `+context` (dima's pick): x + cclio plus the last
  reply, at fits 0.3 / margin 0.4. the full roster, memory and the gate ship in the replay; the
  turn-on call waits for a re-measure on ~100 real prompts.
- **jev is the right tool, not haiku** (arm 5: `claude -p --model haiku`, a json schema, the same
  roster, context and memory). on real held-out prompts haiku reads 27 % precision / 53 % wrong
  loads against `+context`'s 75 % / 15 %; it misses less (14 % vs 61 % on all) because it loads
  more (needless 29 %). p50 6.6 s / p95 9.6 s — past the hook's 8 s timeout — and $10.37 per 1k
  prompts against jev's $0.22.
- **one full jev replay costs ~5,060 requests, ~27M input tokens, ~$1.13** (4 arms × 221 × 3,
  two calls each). four of them took the typesafe balance below zero on 10-05; the free credit is
  $5 a month, so the next run must fit it — [FRM-308](https://linear.app/x-com/issue/FRM-308) gates it:
  every paid call lands in `~/.claude/shelf/jev/spend.log`, and past $4.00 since the 18th (or on a
  402) `judge()` sends nothing and every caller fails soft. `JEV_SPEND_LOG` points a probe elsewhere.

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

## what was built, and the measured effect (held third; real prompts where it differs)

- **recent context** — the last agent reply (tail 1500 chars) goes in as `recent_context`, read
  off the hook's `transcript_path`. on FRM-268's roster: verdict misses 60 → 30 %, critical recall
  50 → 64 %, needless loads 0 → 11 %. the one part that helps on real prompts too (above).
- **the full roster** — the session's own skill listing, read off the same transcript (the
  `skill_listing` attachment: exactly what the model was shown, built-ins included). 32 → 106 in
  a cclio session. `x` and `cclio` come from the tree so a worktree measures its own edits, kept
  only when the session lists them (no `cclio:*` in a coder session); `x-cw:*` mirrors are dropped.
- **session memory** — a skill already loaded, slash-invoked or suggested this session is not
  loaded again; a compaction clears the list. a seen skill keeps competing in the Choice and is
  dropped only from the loads — dropped from the Choice, a neighbour took its probability.
- **full roster + memory**: held precision 54 → 94 %, wrong 31 → 2 %. most of FRM-268's wrong
  loads on the synthetic lines were the right skill missing from its roster. on real prompts:
  69 → 67 %, misses 50 → 73 % — 106 options spread the Choice, and fits 0.75 (swept on a
  synthetic-heavy tune split) drops what is left.
- **the must-not-miss gate** — one noul per critical skill rides the wide request (no extra call);
  it fires only on a skill stage 1 also shortlisted, never past a veto. critical recall 33 → 78 %
  (real: 0 → 80 %, n=5), precision 94 → 77 %, wrong 2 → 13.5 %. the shortlist rule cut false
  fires about 3× at equal recall (15.3 → 4.3 per run at 0.5, r2 raws).
- **`needs_skill`** in stage 2, as hermes does it. measured only together with the gate.
- **stage 2 always runs** unless a veto fires; `none` beating the top skill became a swept
  `margin`. verdicts ranked the right skill first and still lost to `none` (30 of 84).
- **per-stage reasons** — `decide` returns one trace line per stage (`veto _later 0.89`,
  `none 0.94 ≥ x 0.03 + 0`, `need 0.20 < 0.5`, `fits … < …`, `seen …`, `gate …`), in `route.log`
  and the replay.
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
- **one positive per skill, written from its description** — it proved the roster gap and then
  inflated the headline. real labels are the missing input, not more synthetic ones.

## the exit lines

- the table per slice: printed (held, verdict, substantive, real prompts, single, multi, all) for
  four jev arms and haiku, FRM-268 shown both swept and as shipped; `REPLAY_RAW` re-scores a saved
  run, roster pinned, with no call.
- critical recall ≥ 95 %: **not met.** best held 78 % (gate arm); the gate noul's own spread is
  the limit — at 0.3 it reaches 78 % with 7 false fires a run (r2 raws). 9 critical positives
  held out, 5 of them real.
- router OFF: `node script/jev-router.ts status` prints `router: OFF`; the bar is not met on
  real prompts.
- a non-x skill can be picked by the full-roster arms: «do a grill about the raycast setup» →
  `mattpocock-skills:grilling` 0.96. the live `+context` arm routes x + cclio only.
- the four side-effect skills keep «⚠ read first» (`loadLine`, unit-tested).

## latency (the hook's budget is 8 s)

- both jev calls, 4 in flight: FRM-268 p50 546 / p95 658 ms; the live `+context` 557 / 688 ms;
  the full-roster arms 630–655 / 722–769 ms. haiku through `claude -p`: 6,577 / 9,576 ms.
- fixed cost before any call: ~900 ms, of which `op-run` (the 1Password read) is ~750 ms, node
  start 20 ms, router import + reading a 30 MB transcript ~150 ms.
- so a v2 prompt costs ~1.7 s at p95 — inside the budget. `op-run` is the cost to cut, in v1 too.

## left open

- **more real labels** before any turn-on: the vet's miss lines now carry whole prompts, and the
  replay's `held · real prompts` row is the one to read. 32 real held-out prompts is too few to
  pick thresholds on.
- recall vs precision, once real numbers exist: the gate lifts critical recall, at a cost in
  wrong loads. the code ships in the replay; the hook runs `+context`, without it.
- the critical list is the ticket's nine. per-skill gate spread says `x:guide-ui-ux` (wanted
  median 0.25) and `x:ftr` (0.37) are where the gate is weakest.
- multi-skill has 4 fixtures; its rows are noise until more land.
- the raws behind every number here sit at `~/.claude/shelf/jev/replays/skill-router-2026-10-05.json`
  (local, gitignored): `REPLAY_RAW=<a copy> node script/jev-test.ts skill-router` re-scores all
  five arms with zero calls; a changed fixture file refuses it.

## prior art the lanes found

- last run's finds (hunt already built to borrow): kerpopule/hermes-jev-skills, diet103/claude-code-infrastructure-showcase, juew/Skill-Routing-Kit, zhengyanzhao1997/SkillRouter, aurelio-labs/semantic-router
