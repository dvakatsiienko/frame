---
dies-when: distilled into the cclio:shift skill and the crew briefs, then delete
---
Ticket: none

# long-running context — keeping precision across compaction

**verdict: the fear is right, and the fix is not a bigger window.** Compaction drops standing
constraints far more often than facts. In the papers, a constraint that is only in the
conversation survives a summary 17 % of the time on average. A constraint pinned outside the
summary and re-injected after it keeps violations at 0 %. Claude Code already has the door for
that: a `SessionStart` hook with the `compact` matcher. The fleet uses the door for boot only, and
it has never auto-compacted: all 25 compactions on this mac were manual. Keep the window at the
max. Pin each member's job, exit lines and forbidden paths in a file, and re-inject that file on
every compaction. Treat a compaction as an event the coordinator checks, never as a silent one.

observed 2026-09-27, cc 2.1.283 on disk. lanes: parallel core (274 s), my own reading of the
docs plus a local transcript measurement, neuroarxiv (5 papers, isolated reads).

## 1. what claude code's auto-compact keeps and drops

All from [what survives compaction](https://code.claude.com/docs/en/context-window#what-survives-compaction)
unless marked otherwise.

- **re-injected from disk**: the system prompt and output style, project-root `CLAUDE.md` and
  unscoped rules, auto memory, the plan-mode plan file, and a fresh git status.
- **task list**: tasks persist across compactions
  ([interactive mode](https://code.claude.com/docs/en/interactive-mode)).
- **reloaded lazily**: nested `CLAUDE.md` files and `paths:` rules come back only when a matching
  file is read again. Until then they are gone.
- **files**: up to five recently modified files are re-read. A file over 5,000 tokens comes back
  as a path only.
- **skills**: invoked skill bodies are re-injected, but capped at 5,000 tokens per skill and
  25,000 in total. The oldest skill is dropped first. Truncation keeps the top of `SKILL.md`.
  - 📌 `x:crew-coder` is 22,313 chars, so about 5.6k tokens (an estimate at 4 chars per token,
    not counted). If the estimate holds, its tail is cut after a compaction. The tail is
    «identity and reporting»: the done-report and «report back where you were briefed».
- **summarised away**: the conversation, including the spawn prompt, a brief typed later, and
  context that hooks added earlier. Background commands and subagents keep running, and Claude is
  reminded of them.
- **the summary** ([how claude code works](https://code.claude.com/docs/en/how-claude-code-works#when-context-fills-up)):
  older tool outputs are cleared first, then the conversation is summarised. «Detailed
  instructions from early in the conversation may be lost.»
  - measured on this mac, 2026-09-26 cclio session: a 9-section summary. It covers intent,
    concepts, files, errors, problem solving, «all user messages» (condensed), pending tasks,
    current work and the next step. The session went from 639,820 to 35,496 tokens in 57 s. 11
    recent messages were kept verbatim (`compactMetadata.preservedMessages`).
  - the full pre-compact transcript stays on disk at `transcript_path`. Nothing is lost there;
    it is only out of the window.
- **the threshold** ([model config](https://code.claude.com/docs/en/model-config#default-auto-compact-thresholds)):
  - on native 1M models (Opus 4.7+ on the Anthropic API), compaction runs at about **967k** by
    default.
  - `/autocompact <n>`, `--autocompact`, `autoCompactWindow` and `CLAUDE_CODE_AUTO_COMPACT_WINDOW`
    (plain integer, 100k–1M) move the window.
  - `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` can only lower it.
  - `DISABLE_AUTO_COMPACT=1` leaves manual `/compact` available. `DISABLE_COMPACT=1` turns off both.
- **the hooks** ([hooks reference](https://code.claude.com/docs/en/hooks#precompact)):
  - `PreCompact` (matcher `manual`/`auto`): it gets `trigger` and `custom_instructions`, which is
    null on auto. It can **block** with exit 2 or `{"decision":"block"}`. A blocked proactive auto
    compaction is skipped. A block during recovery from a context-limit error fails the request.
    It cannot inject context.
  - `PostCompact`: it gets `compact_summary`, the generated summary text. It has no decision
    control, so it is good for logging and for checking the summary.
  - `SessionStart` with the `compact` matcher runs after every compaction. Its stdout or
    `additionalContext` lands in the compacted context. This is the documented way to re-inject
    critical context
    ([hooks guide](https://code.claude.com/docs/en/hooks-guide#re-inject-context-after-compaction)).
- **steering the summary**: `/compact <instructions>` for a manual compaction, and a «Compact
  Instructions» section in project-root `CLAUDE.md` for every compaction
  ([costs](https://code.claude.com/docs/en/costs#reduce-token-usage)). Auto compaction receives no
  `custom_instructions`, so the `CLAUDE.md` section is the only steer on an unattended night.
- **fleet measurement** (every `compact_boundary` in `~/.claude/projects`): 25 compactions, all
  manual, 170k–918k before and 11k–39k after, 34–190 s each. **The fleet has never auto-compacted.**
  The first night shift will be the first time.

## 2. how long-running harnesses keep state outside the window

- **anthropic, [effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)**
  (2025-11-26):
  - compaction alone fails in two ways. An agent tries too much at once and runs out of context
    mid-feature, or a later instance sees some progress and declares the job done.
  - the fix splits the work between an **initializer** and a **coding agent**. The initializer runs
    once and writes `init.sh`, `claude-progress.txt`, a `feature_list.json` with `"passes": false`
    per feature, and a first commit.
  - each coding session starts the same way: `pwd`, read the git log and the progress file, pick
    one unfinished feature, run a smoke test, then build. It ends with a commit and a progress
    update.
  - the feature list is JSON because the model is «less likely to inappropriately change or
    overwrite» it than markdown. The prompt says in so many words that removing or editing tests
    is unacceptable.
- **anthropic, [harness design for long-running apps](https://www.anthropic.com/engineering/harness-design-long-running-apps)**
  (2026-03-24):
  - planner, generator and evaluator agents talk through files and sprint contracts.
  - context resets were needed for Sonnet 4.5 («context anxiety»: it wraps up early near the
    limit). Opus 4.5 «largely removed that behavior», so resets were dropped and one continuous
    session ran on SDK auto-compaction.
  - runs: 6 h and $200 (Opus 4.5), 3 h 50 min and $124.70 (Opus 4.6).
- **anthropic, [effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)**
  (2025-09-29):
  - context rot: recall falls as tokens grow.
  - tune a compaction prompt for recall first, then for precision.
  - tool-result clearing is the lightest form of compaction.
  - structured notes (a `NOTES.md`) carried the Pokémon agent through resets with exact tallies.
  - subagents return 1–2k-token summaries.
- **anthropic, [context management](https://claude.com/blog/context-management)**: context editing
  cut token use by 84 % on a 100-turn web-search eval, and let runs finish that otherwise failed.
- **manus, [context engineering lessons](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus)**
  (2025-07-18):
  - the file system is memory, used as «restorable compression»: drop the content, keep the path
    or the url.
  - a `todo.md` rewritten at every step keeps the goal in recent attention. A task averages about
    50 tool calls.
  - errors stay in context so the model updates on them.
- **openai codex, from the parallel lane only (not opened)**:
  - one run lasted about 25 h, 13M tokens and 30k lines.
  - it kept a spec with «done when» checks, a milestone plan with validation commands, a runbook
    and a status/decision log.
- **the common shape**: the repo, git and a few small files are the source of truth, and the
  window is a cache. Each step re-reads state from files and ends by writing state to files.

## 3. measured precision loss — papers (5 read, isolated)

- **[Lost in Compaction, 2608.11242](https://arxiv.org/abs/2608.11242)** (2026-07-31):
  - session constraints («do not delete until I confirm») survive a compaction **17 %** of the
    time on average. No compactor passes 36 %. Process-type rules fare worst.
  - labelling a constraint «important» adds only about 1.3 points.
  - a small extractor that reads only the user turns and appends a running constraint list lifts
    survival to **90–96 %**.
  - limit: tested only to about 100–220k tokens.
- **[Governance Decay, 2606.22528](https://arxiv.org/abs/2606.22528)** (2026-06-21), 7 models × 4
  compaction strategies:
  - with the policy in full context, violations are 0 %. After one compaction, the pooled rate is
    **30 %**. A constraint that survived the summary is violated 0 % of the time; a dropped one,
    38 %.
  - **repeated compaction compounds**: from 0 to 4 rounds, violations rose from 0 % to 78 %.
  - head-tail compaction, which keeps the start and the end verbatim, gave 0 %.
  - **constraint pinning** (quarantine the constraints from compaction, re-inject them verbatim,
    integrity-check every turn) gave **0 % on all 7 models** for about 47 tokens.
  - limit: a forged in-stream «rescind» breaks pinning (17 %).
- **[Slipstream, 2605.08580](https://arxiv.org/abs/2605.08580)** (2026-05-09):
  - validates a summary against the agent's next k steps before adopting it: up to +8.8 points
    over synchronous compaction.
  - 88–100 % of compaction-caused errors show up **within 3 steps**, so a check right after the
    compaction catches most of them.
  - limit: a loss that shows up later escapes the check.
- **[CliffCompaction, 2609.26779](https://arxiv.org/abs/2609.26779)** (2026-09-22):
  - rule-based compaction beat LLM summarisation on Terminal-Bench 2.0 (61.4 % vs 55.5 %). It
    keeps the system prompt and task in full plus the K most recent turns verbatim, truncates old
    tool results, and never nests summaries.
  - compact late and rarely.
  - limit: tested to 45k only.
- **[Harness design study, 2609.20804](https://arxiv.org/abs/2609.20804)** (2026-09-17):
  - context management matters most at small windows. At 128k its gain shrinks to about 2.7
    points.
  - staged elision then summary was the best trade.
  - models almost never called the recall tool: **do not rely on «it can look it up»**. A plan
    file helped.
  - limit: no Claude models.
- 📌 no paper tests near 1M tokens or on Claude 5-era models. The direction is consistent across
  all five, but the size of the loss at 967k is an inference.

## 4. gap check against what the fleet has

- **CST** (`home/.claude/plugin-x/CST-SPEC.md`): already built as «an upgraded compaction». R and
  S are lossless and there is an E section. It covers a handoff to a fresh session well.
  - gap: it is manual. Nothing produces one when an unattended member hits 967k.
- **`cclio:checkpoint`** (`cclio/plugin-cclio/skills/checkpoint/SKILL.md`): a keep/drop round, a
  CST, then a steered `/compact` plus `/x:handoff-ingest`.
  - its probe (ten facts after resume) is the right shape.
  - gap: every step needs dima's hands, so it cannot run at night.
- **the shift plan file**: the right home for the pinned state. Steps, exit lines and gates are
  exactly what the papers say must live outside the summary.
  - gap: nothing re-injects a member's slice of the plan after its compaction.
  - gap: the crew briefs carry exit lines in the spawn prompt and the ticket. The prompt is summarised away; the
    ticket survives, but only if the member re-reads it.
- **hooks**:
  - user scope has no `PreCompact`, `PostCompact` or compact-matched `SessionStart`.
  - cclio's project `SessionStart` runs `boot-prefetch.sh` with no matcher, so it fires on compact
    too. That covers the coordinator's board, not a crew member's task.
- **`x:crew-coder`**: nothing on compaction. It likely sits over the 5k skill re-inject cap (see §1).
- **no «Compact Instructions» section** in any fleet `AGENTS.md` (grep over `frame` and
  `projects`, none found), so an auto compaction runs on the default prompt.

## what the fleet should do

- **pin file per member + a compact-matched `SessionStart` hook** (user scope, one script). At spawn, cclio writes
  `~/.claude/shelf/shift/<ticket>.pin.md`: the job, the exit lines, forbidden paths, decisions,
  and the report-to line. Keep it JSON-strict or short, since anthropic found JSON gets
  overwritten less. On `source=compact`, the hook finds the ticket in the session's first user
  message (`transcript_path`), prints the pin verbatim, and adds «re-read the ticket and `git log`
  before the next edit». This is the papers' constraint pinning plus the head half of head-tail.
  - proof: in a throwaway session spawned with a canary pin, run `/compact`, then ask for the
    canary and the forbidden path with no tools. Both must come back.
- **a `PostCompact` audit hook**: append `ts · session · trigger · pre→post tokens` to
  `~/.claude/shelf/compact.log`, and grep `compact_summary` for each exit-line id from the pin.
  A missing id writes a 🚨 line. This is a cheap summary check in the spirit of Slipstream.
  - proof: `tail ~/.claude/shelf/compact.log` after the canary `/compact` shows the line, and
    deleting the pin's id makes it print 🚨.
- **cclio treats a member's compaction as an event**: the shift loop reads `compact.log`. When a
  member compacts, cclio asks it to restate its exit lines and forbidden paths within 3 steps,
  then compares the answer with the plan file. Errors show up within 3 steps (Slipstream).
  - proof: the night's shift log has one «restated ✅/🚨» line per `compact.log` entry.
- **keep `x:crew-coder` under the 5k re-inject cap, or move the load-bearing part to the top**:
  the reporting contract and the lane rules, since truncation keeps the top.
  - proof: count it with the token-count api (`count_tokens`) and read the result under 5,000.
    Or run `/compact` in a probe coder, then grep the transcript for the skill's last heading.
- **a «Compact Instructions» section** in the repo-root `AGENTS.md` of `frame` and `bytes`. It
  keeps verbatim: every user constraint, exit lines, forbidden paths, open decisions, commit
  hashes. It never nests an old summary. It is the only steer an auto compaction gets.
  - 📌 the docs name this section for `CLAUDE.md`, and neither repo has one; that `AGENTS.md`
    steers the summary the same way is an inference.
  - proof: after the canary `/compact`, the summary's pending-tasks section quotes the exit lines
    word for word (`jq` the `isCompactSummary` line).
- **one step = one fresh session where the plan allows; the window stays at the max.**
  - compaction is the fallback, never the plan. Governance Decay measured 0 → 4 compactions going
    from 0 % to 78 % violations.
  - dima's «no auto-compact below the max» holds.
  - run one daytime drill with a pinned canary coder before the first night, since the fleet has
    never auto-compacted.
  - proof: `grep -c compact_boundary` over the night's member transcripts, aiming for 0, with
    each non-zero case matched by a ✅ restate line.

## parallel core vs my own lane

- parallel got vector 1 almost fully right: the 967k threshold, the hook fields, the skill caps,
  the env vars, the task list persisting. It added the OpenAI Codex case and the cookbook numbers.
- parallel was wrong on one point: it said the docs define no «Compact Instructions» section in
  `CLAUDE.md`. Two doc pages do.
- parallel missed:
  - the model-specific context-anxiety finding from the 2026 harness post.
  - Manus.
  - all papers.
  - every fleet-specific fact: the 25 manual compactions, the crew-coder size against the cap,
    the preserved-messages tail.
