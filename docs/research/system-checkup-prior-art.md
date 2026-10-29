---
dies-when: recipes/refresh-system-checkup is retired — until then it is that recipe's artifact, rewritten whole each run
---

Ticket: none (pocket PK-203)

three lanes ran 2026-10-19 on _clio/.scratch/system-checkup/brief.md: this file is the opus source-reading lane; the exa and parallel lanes agreed on the checklist and split on the shape (parallel: user-only skill; opus: user-only blocks scheduled runs, so the cadence needs a model-invocable skill or a script).

# system checkup — the source lane (opus)

read 2026-10-19. Undated doc pages are marked «read 10-19». Anything I worked out myself rather than read is tagged **[inferred]**. A claim I could not verify ends in «?».

## ranked checklist

How I ranked it **[inferred]**: practitioners say failure analysis pays off most ([Hamel, evals FAQ, 2026-09-18](https://hamel.dev/blog/posts/evals-faq/): «the most important activity in evals»; [Anthropic, 2026-01-09](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents): «20-50 simple tasks drawn from real failures»). Context weight comes next, because it is a measured cost (papers below). Below those, I put the categories Claude Code's own `/doctor` checks ([skills.md, read 10-19](https://code.claude.com/docs/en/skills.md)) above the ones only third-party linters check.

| # | category | what to check | how | source |
|---|---|---|---|---|
| 1 | failure logs | sample recent transcripts and flaw entries, tag each failure, count the tags; re-run after a model switch or a prompt change, every 2–4 weeks | script samples, judgment tags | [Hamel 2026-09-18](https://hamel.dev/blog/posts/evals-faq/) (≥100 traces, 2–4 week cycles); [Anthropic 2026-01-09](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) («read the transcripts») |
| 2 | resident context weight | bytes and tokens per always-loaded file; total at boot; files over 200 lines | script | [memory.md, read 10-19](https://code.claude.com/docs/en/memory.md) («target under 200 lines»); [arXiv 2602.11988, 2026-02-12](https://arxiv.org/abs/2602.11988) (context files: no general gain, >20 % cost); [Chroma, 2025-07-14](https://www.trychroma.com/research/context-rot) (18 models, «increasingly unreliable as input length grows») |
| 3 | stale or contradictory instructions | rules written for older models, conflicts between files, dead-weight rules | judgment (`/doctor prompt-audit`, cc ≥2.1.283) | [memory.md § audit your instruction files, read 10-19](https://code.claude.com/docs/en/memory.md); [AgentLint D1–D3, pushed 2026-10-10](https://github.com/0xmariowu/AgentLint) |
| 4 | dead pointers and imports | `@imports` that resolve, import depth ≤4, no circular imports, links and paths, command references | script | [agnix CC-MEM-001..004, REF-001/002, rules.json 2026-10-17](https://github.com/agent-sh/agnix/blob/main/knowledge-base/rules.json); [AgentLint F5/F7](https://github.com/0xmariowu/AgentLint); [memory.md](https://code.claude.com/docs/en/memory.md) (four hops max) |
| 5 | skill trigger accuracy | does each skill fire on its prompts, stay quiet on the others, and beat a run without it | script plus model (`claude plugin eval`, 3 runs a case, `--threshold`, `--max-cost-usd`) | [plugin-evals.md, read 10-19](https://code.claude.com/docs/en/plugin-evals.md); [skills.md § evaluate](https://code.claude.com/docs/en/skills.md) («seeing a skill trigger tells you Claude found it, not that it did what you intended») |
| 6 | unused skills, plugins, MCP servers | never-invoked skills ranked by context cost; plugins not used recently | script (`/skill-doctor` prints text under `-p`, ≥2.1.252; `claude plugin details <p>` gives always-on tokens) | [skills.md § find unused skills](https://code.claude.com/docs/en/skills.md); [plugins/measure.md, read 10-19](https://code.claude.com/docs/en/plugins/measure.md) |
| 7 | skill listing over budget | descriptions dropped from the listing once it passes its character budget | script (`--debug` log warning; the Skills row in `/context`) | [skills.md § skill descriptions are cut short](https://code.claude.com/docs/en/skills.md); [agnix CC-SK-025](https://github.com/agent-sh/agnix/blob/main/knowledge-base/rules.json) |
| 8 | config validity | hook event names, matchers, timeouts, missing scripts; settings keys that are invalid or ignored at their scope; skill frontmatter | script (`claude doctor` from the shell, read-only; a linter) | [debug-your-config.md, read 10-19](https://code.claude.com/docs/en/debug-your-config.md) (a hook matcher given as an array stops that file's other hooks loading); [agnix CC-HK-*, CC-SET-*, CC-SK-*](https://github.com/agent-sh/agnix/blob/main/knowledge-base/rules.json) (702 rules); [AgentLint H1–H3](https://github.com/0xmariowu/AgentLint) |
| 9 | hook health and latency | slow hooks, hook errors, Stop hooks without a circuit breaker | script (OTel `claude_code.hook_execution_complete`; `/doctor` lists slow hooks) | [monitoring-usage.md, read 10-19](https://code.claude.com/docs/en/monitoring-usage.md); [skills.md § /doctor](https://code.claude.com/docs/en/skills.md); [AgentLint H3](https://github.com/0xmariowu/AgentLint) |
| 10 | permissions drift | allow rules with ineffective syntax, broad code-execution allows, secret files not denied, `*` auto-approve | script | [agnix CC-SET-035/036/039](https://github.com/agent-sh/agnix/blob/main/knowledge-base/rules.json); [AgentLint H4/H5](https://github.com/0xmariowu/AgentLint); `/doctor` covers permissions ([skills.md](https://code.claude.com/docs/en/skills.md)) |
| 11 | cost and usage trend | cost and tokens per session and per role, week over week; usage share per plugin | script (OTel `cost.usage`, `token.usage`, `/usage`) | [monitoring-usage.md](https://code.claude.com/docs/en/monitoring-usage.md); [plugins/measure.md](https://code.claude.com/docs/en/plugins/measure.md) |
| 12 | secrets exposure | `.env` ignored, hardcoded `sk-`/`ghp_`/`AKIA` keys, secret scanning switched on, Actions pinned to a SHA | script | [AgentLint S1–S6](https://github.com/0xmariowu/AgentLint); [agnix CC-SET-039](https://github.com/agent-sh/agnix/blob/main/knowledge-base/rules.json) |
| 13 | eval regressions | a regression suite that sits near 100 %; a capability task graduates into it; a suite that always passes gets retired | script plus model | [Anthropic 2026-01-09](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents); [Hamel 2026-09-18](https://hamel.dev/blog/posts/evals-faq/) («should be run less often or retired») |
| 14 | dependency staleness | pending bumps, reachable vulnerabilities | script | covered locally, see below. I opened no external source for this lane «?» |
| 15 | orphaned processes, worktrees, daemons | sessions left running, stale warm spares, leftover worktrees, launchd jobs with a non-zero last exit, MCP servers disconnected | script (`launchctl list`, `/mcp`) | [debug-your-config.md](https://code.claude.com/docs/en/debug-your-config.md) (`/mcp` status); the rest is **[inferred]**, I found no external checklist for it «?» |
| 16 | flaky checks | how often each check failed and then passed on retry; checks that never fire | script | [SRE book, monitoring ch.](https://sre.google/sre-book/monitoring-distributed-systems/) (rules exercised «less than once a quarter» are up for removal); applying that to checkup checks is **[inferred]** |

## already covered here

Each line pairs a check with the local file that runs it. All files were read 2026-10-19.

- 2 context weight → `~/frame/recipes/nurture-memory/scripts/memory-lint.ts` (a size budget per file, at commit, via `~/frame/lefthook.yaml:42`). `~/frame/_clio/.claude/hooks/boot-prefetch.sh:297-318` logs the spawn ctx to `shelf/barrel-probe.log`. The sweep ranks files resident × never-used (`recipe.md:110`).
- 3 stale or contradictory → `~/frame/recipes/nurture-memory/recipe.md:113` (prompt-audit, step 7's cruft pass). This only runs during a sweep, not on a schedule.
- 4 dead imports → the barrel probe proves the import chain loads in a fresh process (`boot-prefetch.sh:297-318`). Dead paths at commit are still open as pk-169.
- 5 trigger accuracy → `~/frame/script/skill-route.ts` plus `script/jev-test.ts` fixtures; `~/frame/script/memory-load-replay.py` measures the lazy-rule hit rate. `claude plugin eval` is not run anywhere; pk-10 and pk-119 are open.
- 6 unused skills → the census in `recipe.md:143` (sweep step 9; `/skill-doctor` or duckdb over transcripts, `docs/test-drive/memory-sweep.md:104`). This is also sweep-only.
- 8 config validity → `~/frame/home/.claude/plugin-x/mods/skew.ts` checks mod events against each live engine; the mods typecheck runs at commit (`lefthook.yaml` `mods`). `~/frame/script/shift-checkup.ts` proves every guard red and green before a shift.
- 9 hooks (one path only) → `~/frame/home/.claude/plugin-x/mods/quiet-canary.ts` (stash delivery). `~/frame/script/reply-check-report.ts` counts Stop-hook rule hits.
- 11 usage → `boot-prefetch.sh:127-138` (weekly and 5 h window, pace). `~/frame/recipes/refresh-fleet-ops/recipe.md` (`x fleet ops`, 7-day measures, `docs/knowledge/fleet-ops.md`).
- 12 secrets (one path only) → `~/frame/script/git-crypt-rename-check.ts`, at commit.
- 13 eval regressions → `jev-test.ts`; `boot-prefetch.sh:320` `test-drive:check`; `shift-checkup.ts`.
- 14 dependencies → `boot-prefetch.sh:108-125` (renovate counts, the evergreen apps lane, `govulncheck`); `~/frame/script/skill-evergreen-apps.ts`.
- 15 processes and worktrees → `boot-prefetch.sh:94-106` (live sessions, bytes worktrees, coder PRs) and `:284-295` (stale warm spare); `~/frame/_clio/script/halt-sweep.ts`.
- other drift → `boot-prefetch.sh:270` (settings symlink), `:139-168` (repos vs origin), `:170` (CI reds), `:176-187` (n8n tables), `:331` (pocket-check); `~/frame/script/fleet-hazards-check.ts` (a hazard line names its guard); `~/frame/script/x-cli-census.ts` (raw Bash heads no x verb covers).
- the boot's own rule → `boot-prefetch.sh:5-6`: «a check that cannot run prints FAIL, never silence». That is the right base for a checkup.

## gaps (nobody here runs these)

1. **hook latency and errors**: the OTel tap already captures hook events (`docs/test-drive/otel.md:31`, `~20 hook_registe…`). An `rg` for `hook_execution` finds no reader outside that test-drive file.
2. **settings, permissions and frontmatter validity**: no lint for settings keys, permission rule syntax, broad allows, or hook schema beyond the mods. agnix's CC-SET, CC-HK and CC-SK families cover these.
3. **skill listing over budget**: there are 53 skill dirs across the two plugins (`ls`, 10-19). Nothing checks whether their descriptions get dropped from the listing.
4. **secrets scan**: only the git-crypt rename case is guarded. There is no gitleaks-style scan and no deny rule for secret files (the `rg` over lefthook and workflows was empty).
5. **daemon and MCP health**: launchd jobs are only kickstarted after a pull (`boot-prefetch.sh:162-167`). Nothing checks their last exit status. `/mcp` connection status is never read.
6. **trigger accuracy against a no-skill baseline**: there is no `claude plugin eval` run (pk-10, pk-119 open).
7. **flaky-check stats, the checkup of the checkup**: `barrel-probe.log` keeps attempts for one probe. No check carries a «last red» date.
8. **recurring instruction audit**: prompt-audit, the unused-skill census and dead paths run only inside a memory sweep (months apart, `recipe.md:78`) or are still open (pk-169).

## shape

- **built-in precedent**: `/doctor` is a bundled, prompt-based skill. It «reports its findings first and asks for confirmation before changing anything». `claude doctor` in the shell is the read-only twin ([skills.md](https://code.claude.com/docs/en/skills.md), [debug-your-config.md:44](https://code.claude.com/docs/en/debug-your-config.md), read 10-19).
- **trap for "user-invocable only + scheduled"**: `disable-model-invocation: true` «also prevents… running when a scheduled task fires with the skill as its prompt» ([skills.md, frontmatter table](https://code.claude.com/docs/en/skills.md)). **[inferred]**: put the deterministic half in a script on a schedule (launchd or the boot). Keep the judgment half as a skill he types, and give that skill the flag.
- **scriptable inputs**: `/skill-doctor` prints text under `-p` ([skills.md](https://code.claude.com/docs/en/skills.md)). `claude plugin details` runs in the shell and prints always-on tokens ([plugins/measure.md](https://code.claude.com/docs/en/plugins/measure.md)). `claude plugin eval` exits non-zero below a threshold, meant for CI ([plugin-evals.md](https://code.claude.com/docs/en/plugin-evals.md)).
- **linters ship three ways**: agnix is a CLI, a GitHub Action and pre-commit hooks ([README](https://github.com/agent-sh/agnix)). AgentLint runs its core checks deterministically and makes Deep (subagents) and Session (log reading) opt-in ([README](https://github.com/0xmariowu/AgentLint)). Both point to the same split as the local setup: a script for the mechanical checks, a model for the judgment.
- **sharpen cadence**: Hamel says 2–4 weeks, plus after every model switch ([2026-09-18](https://hamel.dev/blog/posts/evals-faq/)). Anthropic calls an eval suite «a living artifact» with an owner ([2026-01-09](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)). agnix runs a monthly review plus a weekly spec-drift cron ([MONTHLY-REVIEW.md](https://github.com/agent-sh/agnix/blob/main/knowledge-base/MONTHLY-REVIEW.md), [spec-drift.yml](https://github.com/agent-sh/agnix/blob/main/.github/workflows/spec-drift.yml)). Locally, the `refresh-*` recipes already follow a research → distill → findings loop (`~/frame/recipes/refresh-fleet-ops/recipe.md`), so a `refresh-system-checkup` fits that pattern **[inferred]**.

## failure modes

- **noise gets ignored**: «When pages occur too frequently, employees second-guess, skim, or even ignore incoming alerts» ([SRE book](https://sre.google/sre-book/monitoring-distributed-systems/)).
- **dead checks pile up**: config exercised «less than once a quarter» should be up for removal (same source).
- **false confidence**: «Generic evaluations waste time and create false confidence»; a suite where everything passes should be retired ([Hamel](https://hamel.dev/blog/posts/evals-faq/)). A saturated eval «provides no signal for improvement» ([Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)).
- **report-only**: both `/doctor` and AgentLint attach a proposed fix to each finding ([skills.md](https://code.claude.com/docs/en/skills.md); AgentLint's «Fix Plan», [README](https://github.com/0xmariowu/AgentLint)). **[inferred]**: they do this because a bare report stalls.
- **scope creep**: a public personal setup deleted 8 audit and authoring skills plus their coordinator in one commit ([philoserf 6ab0a977, 2026-02-03](https://github.com/philoserf/claude-code-setup/commit/6ab0a977)). The commit gives no reason, so the cause is **[inferred]**.
- **the fix makes it worse**: auto-generated context lowered success and raised cost ([arXiv 2602.11988](https://arxiv.org/abs/2602.11988)). A 288-run ablation found context strategy does not measurably move correctness ([arXiv 2607.27250, 2026-07-28](https://arxiv.org/abs/2607.27250)). A checkup that adds memory needs its own eval.
- **a skipped check looks like a pass**: the local rule is at `boot-prefetch.sh:5-6`. AgentLint reports a dimension that did not run as «n/a», «never as 0/10» ([README](https://github.com/0xmariowu/AgentLint)).
- **the limits disagree**: AgentLint says files over 40,000 chars are «silently» truncated (vendor claim, README, 10-10). The cc docs say «Claude Code skips a file over 4 MiB» and set a 200-line target, with MEMORY.md capped at 200 lines / 25 KB ([memory.md](https://code.claude.com/docs/en/memory.md), read 10-19). I did not verify the 40k figure «?».
- **dropped**: the Google static-analysis paper on CACM returned 403, and the Medium «30-day skills audit» returned 403.

## 5 borrowable bits

1. **a spec-drift sentinel**: agnix hashes upstream docs on a weekly cron and opens an issue when one changes. That is a checkup of the checkup ([spec-drift.yml](https://github.com/agent-sh/agnix/blob/main/.github/workflows/spec-drift.yml)). Every rule also carries `evidence.verified_on` and source URLs ([rules.json](https://github.com/agent-sh/agnix/blob/main/knowledge-base/rules.json)).
2. **a «last red» date per check**: borrow SRE's once-a-quarter rule. A check that has not been red in 90 days goes up for removal ([SRE book](https://sre.google/sre-book/monitoring-distributed-systems/)); the threshold is **[inferred]**.
3. **the hook telemetry is already flowing**: `hook_execution_complete`, `skill_activated` and `mcp_server_connection` are OTel events ([monitoring-usage.md](https://code.claude.com/docs/en/monitoring-usage.md)), and the local tap already writes jsonl (`docs/test-drive/otel.md`). One duckdb query covers gaps 1 and 5.
4. **graduate, then retire**: a capability task that keeps passing moves to the regression suite ([Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)). A suite that always passes runs less often ([Hamel](https://hamel.dev/blog/posts/evals-faq/)). The checkup applies this to its own checks.
5. **`npx agnix --target claude-code .` as a seed**: 702 rules, each linked to its evidence (`agnix explain <id>`) ([README](https://github.com/agent-sh/agnix)). It covers gaps 2–4 without writing a script. I did not run it (read-only lane), so how noisy it is on this tree is unknown «?».

<!-- end -->
