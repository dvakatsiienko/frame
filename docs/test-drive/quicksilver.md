---
dies-when: the test drive closes with adopted or dropped (by 2026-10-14)
---

# quicksilver — test drive

Ticket: none

## what

- [quicksilver](https://github.com/UditAkhourii/quicksilver) v0.2.0 @ `5d6fe5c` — a cc skill plus one script (`qs.mjs`, no deps) that sends bulk judgment calls to jev (`POST api.typesafe.ai/v1/systemone`) and prints a compact shortlist back to claude.
- verbs: `filter` (yes/no per item or per line), `classify` (one-of-n labels), `rank` (top-k vs a query), `find` (lines in a huge file), `ask` (one question over one big doc), `status`.
- vendored at `home/.claude/skills/quicksilver/`; every call runs as `~/frame/script/op-run.sh node ~/.claude/skills/quicksilver/scripts/qs.mjs <cmd> …` (key from 1password, never `qs setup`).
- 📌 the question this test drive answers: what does it add over our own jev lanes (`script/lib/jev.ts`, the skill router, inbox lanes)? those are fixed rubrics wired into code; quicksilver is the ad-hoc door for a one-off bulk read mid-task.

## window

- 2026-09-28 → 2026-10-12.
- 📌 the vendored `SKILL.md` header says «on a test drive to 2026-10-05»; this file says 10-12 — one of the two gets corrected.

## the meter

every round runs the same ask twice, the usual door and the qs door, and logs one line under rounds.

- **baseline** — what claude would have done anyway (grep / `rg` / `jq`, an Explore agent, a plain read). a baseline that uses a free exact tool is fair: that is the real competitor.
- **hit** — the qs shortlist contains everything claude ended up needing (recall on the thing acted on). a miss that claude would have caught is a loss, whatever the tokens.
- **tokens saved** — chars ÷ 4 of what entered claude's context, baseline minus qs (qs side = command + stdout + reading the survivors). never the qs footer's «~N not read», which assumes claude would have read all input.
- **seconds** — wall clock both sides.
- **extras** — the `?` band size (claude reads those anyway), jev $ from the footer, and the model id jev answered with.

## day-0 research

**the bench (the −86 % claim)** — read from the repo's `bench/` (README, `prompts.md`, `score.mjs`, `results/`); the results are the author's, not rerun here.

- measured by the author: 12 tasks, one run each; claude side = a sonnet subagent, qs side = scripted `qs` calls. total claude tokens 313.9k → 45.5k (−86 %, median −82 %), 2.9× faster, jev $0.45 for all 12.
- measured: avg quality 90 % vs 94 % for claude alone; qs matched on 8 of 12.
- measured: the real-log task (S01, BGL) collapsed, f1 23 % vs 54 %. spam 92 vs 97, security twins 89 vs 100, commit types 76 vs 83.
- measured: on the big-input tasks (S02 log, S09 lodash `find`, S10 ranking) qs was no faster (0.9–1.1×); the speedups (8–20×) came from small classification sets.
- what it does NOT prove:
  - the baseline was forbidden Bash and scripts — no `grep | awk`, no `jq`; our agents use those freely.
  - token accounting is asymmetric: claude = measured usage minus a 68.5k floor, qs = chars ÷ 4 of its own output.
  - it scores the shortlist, never the downstream task — nothing checks whether the survivors were enough to finish the job.
  - sonnet baseline, not opus 5.5; n = 1 per task, no variance.
  - 4 of 12 sets were written by the author; nothing ran on a real monorepo the size of `bytes`.
  - dollars, not the 5-hour window: our real cost is context and quota, where cached reads are cheap.

**the tool itself** — read from `qs.mjs`:

- measured: `qs status` → `ready · key from env TYPESAFE_API_KEY · model jev-latest`.
- measured: the model falls back to `jev-latest` unless `--model` or `QUICKSILVER_MODEL` is set; our lanes pin `jev-1.13.0` (`script/lib/jev.ts:4`).
- measured: the secret guard is a filename regex (`.env*`, keys, certs, `credentials*`), never a content scan; `.gitignore` is respected, git-crypt files are not (they are tracked).
- measured: default concurrency is 16 in code; the skill text says 8.
- measured: lifetime stats land in `~/.quicksilver/stats.json`.

**jev itself** — the [docs](https://docs.typesafe.ai/llms.txt):

- [models](https://docs.typesafe.ai/models.md): $0.042 / Mtok input, output free, 1,200 req/min and 250k tok/s per account, 32k tokens for state plus the longest question, `jev-latest` = `jev-1.13.0` today and moves on release.
- [jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13.md): literal reading, no counting, no math, no date comparison, weak on indirection, accuracy drops as state fills with irrelevant detail, can be steered by adversarial content in state.
- [legal](https://docs.typesafe.ai/legal.md): not trained on requests; zero retention only on enterprise plans — ours retains per the DPA.
- cookbooks worth a borrow: [line-by-line search](https://docs.typesafe.ai/cookbooks/semantic_find.md) (what `find` does), [re-ranking](https://docs.typesafe.ai/cookbooks/rerank_typesafe.md), [skill suggestion](https://docs.typesafe.ai/cookbooks/skill_suggestion.md) (already on our router's list), [classifying rag passages](https://docs.typesafe.ai/cookbooks/classifying_rag_passages.md).

**what others say** — little exists; the repo is 3 days old.

- [the repo](https://github.com/UditAkhourii/quicksilver): 79 stars, 4 forks, 0 issues, one commit (checked via `gh api`, 2026-09-28). no independent benchmark or critique found.
- adopters, claims only: [qveys/agent-skills#29](https://github.com/qveys/agent-skills/pull/29) vendored it and flagged the third-party send; [#35](https://github.com/qveys/agent-skills/pull/35) uses `qs filter - --lines` on long local output only, «never on a remote pane (content goes to a third-party api)»; [bubble-ops-loop#515](https://github.com/Bubble-invest/bubble-ops-loop/pull/515) ported the ux (probability-first lines, `?` band) into their own `jev.py`, not the code.
- sibling tools, claims: [jev-pilot](https://github.com/Akramovic1/jev-pilot) (jev picks effort, model and skill per turn, 3 stars); [decision-first](https://www.reddit.com/r/ClaudeWorkflows/comments/1wjthli/workflow_claude_code_skill_for_robust) (logs every jev attempt, self-reports 9/10 fires on 20 self-written prompts); a [r/PromptEngineering plugin](https://www.reddit.com/r/PromptEngineering/comments/1wjmhj0/a_jev_claude_code_plugin_that_saves_30_token_usage) claiming −30 % context.
- jev reviews: [eesel](https://www.eesel.ai/blog/typesafe-jev-review) — speed and price real, «can't hallucinate» oversold (confidently wrong still happens), the accuracy chart puts jev near a mid-tier reasoning model; its 93 % triage number is a vendor trial. the [langchain jev-as-judge post](https://www.langchain.com/blog/jev-agent-evals-langsmith) is exploratory.
- same author as `adhd`, also on a test drive here; same launch shape: a self-built bench and a headline percentage.

**verdict at day 0** — plausibly useful in a narrow band (needle lines in a big log, «which files touch X», bulk labels that are clear), backed by one self-benchmark only. evidence is weak; the vet is the first independent measurement.

## stress list

1. **`filter` repo files** — a coder asks «which of the ~190 files in `bytes/apps/atelier/src` touch take selection?». win: survivors ⊇ files the coder later edits, ≥70 % fewer tokens than an Explore agent. risk: literal reading misses an indirect file (a hook that re-exports).
2. **`rank` where-is-X** — «where is the npsso refresh handled in trophy-sys?», top 5. win: the real file at rank 1–3 in <10 s. risk: an `rg` on a good identifier ties it for free.
3. **`filter --lines` ci log** — a verifier on a 3,000-line github actions log («does this line report the root failure, not a cascade?»). win: the real cause in the top 3. risk: 📌 expected to lose to `gh run view --log-failed` plus a grep, which is free and exact.
4. **`classify` knip findings** — the 73 findings into `dead`, `false-positive`, `keep-exported`. win: ≥90 % agreement with claude's own labels on a 20-item sample. risk: 📌 expected loss — deciding «dead» needs cross-file reasoning jev cannot do.
5. **`classify --labels-json` evergreen changelog** — which release-note entries are borrowable for us (`borrow`, `irrelevant`, `watch`). win: claude reads only `borrow` + `?`, nothing borrowable dropped. risk: subjective labels, the bench's weak spot.
6. **`rank` flawlog vs rules** — per flawlog line, the top-3 rule chunks from `rules/` that already state it. win: dupes found that the flush agreed with. risk: paraphrase and indirection.
7. **`classify` inbox items** — the same items through qs and through our pinned inbox lane. win: parity, which settles «qs adds nothing here». risk: redundant by design; it measures the wrapper.
8. **`filter --lines --fast` daemon logs** — a crash or tcc-deny line in a `schedule/jobs/*` stderr log. win: needle found in seconds on 10k+ lines. risk: `--fast` trades accuracy; grep for `error` may already do it.
9. **`find` in the chords press log** — «the press where a chord was dropped» in the jsonl. win: the right line in the top 5. risk: 📌 expected loss — the needle is structured (timestamps, keycodes); `jq` on fields is exact and free, and jev is weak on numbers.
10. **`classify` linear staleness** — 100+ open tickets as `live`, `stale`, `dupe-ish`. win: matches a `board-sweep` verdict on ≥85 % at a fraction of its cost. risk: 📌 expected loss — staleness is dates plus repo state, jev's documented blind spots.
11. **`ask` over a big doc** — «does this cc release note fix spares booting without AGENTS.md?» (the [#95589](https://github.com/anthropics/claude-code/issues/95589) watch) or «does this renovate changelog name a breaking change to X?». win: correct yes/no, claude opens only the positives. risk: a large irrelevant state lowers accuracy (jaggedness #5).
12. **`filter` a coder transcript** — «is this turn dima steering the coder?» over a long session jsonl, for the retro. win: every steer found. risk: transcripts carry secrets and his words — see weak sides.

## weak sides

- **accuracy** — 90 vs 94 % on the author's own bench, and a real log at 23 vs 54 %; the `?` band is where the errors sat, so claude still reads it. literal reading punishes a loose question.
- **model pin** — defaults to `jev-latest`, which moves on release, and a moved model shifts thresholds silently. pin it: `QUICKSILVER_MODEL=jev-1.13.0` in `op.env`, or `--model jev-1.13.0` on every call (not done yet — this test drive wrote only this file).
- **shared rate limit** — 1,200 req/min per account, shared with the skill-router hook, which is synchronous. a big qs run at concurrency 16 can 429 the router and make dima's prompts wait.
- **cost** — negligible in dollars (the bench spent $0.45 for 12 tasks, the most on `find`: $0.21); the real spend is claude reading the survivors.
- **data leaves the machine** — every item's text goes to `api.typesafe.ai`, retained per the dpa (no zero retention on our plan). the secret guard reads filenames only: a token inside a log line is sent. a git-crypt file in an unlocked tree is sent as plaintext. never point it at the vault, `gmail/`, transcripts with keys, or encrypted paths.
- **latency** — ~1 s per request, but the big-input tasks ran 38–64 s, no faster than claude; the win is tokens, not time, there.
- **redundancy** — for fixed, repeated rubrics our pinned `jev.ts` lanes already exist; qs only earns a place on one-off bulk reads.

## rounds

<!-- one line per round: date · feature · ask · hit · tokens saved · seconds -->
- 2026-09-30 · `qs filter` «user-visible change?» over 47 speak commit subjects (drift agent) · miss: 1.0 s, 16.5k jev tokens, $0.0007, 19 of 47 borderline, `cdc19aaa` (quota cards) scored 0.49 and the react admin 0.37 · the input was already in context, and terse subjects are the weak band the skill warns about — wrong fit, not a broken tool
