# siesta auditor: source lane (primary sources only)

Read on 2026-11-11. Every finding gives its source, the source's date, and one line on «what it would change» for wishkeeper. Live docs pages that show no date are marked «page undated, read 2026-11-11». Anything older than 2025 is marked **[pre-2025]**. Card = `/Users/dima/frame/_clio/.claude/agents/wishkeeper.md`, grades = `/Users/dima/frame/.claude/worktrees/clio-wing-1/.scratch/siesta-cadence/grades.md`.

Where I went deep: vector 7 (Claude Code docs, Anthropic engineering posts, Anthropic's own code-review plugin source), vector 2 (CodeRabbit, Greptile, GitHub Copilot and OpenAI Codex docs), vector 3 (arXiv papers from 2025–2026). Vectors 4 and 5 rest only on what those same sources say. I did not search for fatigue studies, so that part is marked «?» and left to the exa and parallel lanes.

## vector 1: verifier and judge practice, precision, cutting low-value findings

- **Anthropic's own `/code-review` command lets through only high-signal issues, and a second agent checks every issue before it is shown.** Step 4: «CRITICAL: We only want HIGH SIGNAL issues… If you are not certain an issue is real, do not flag it. False positives erode trust and waste reviewer time.» Step 5 starts one subagent per issue «to validate that the stated issue is truly an issue with high confidence», and step 6 drops every issue that check did not confirm. Source: [anthropics/claude-plugins-official `plugins/code-review/commands/code-review.md` @ 9780cf40](https://github.com/anthropics/claude-plugins-official/blob/9780cf407f5593727b668bae95a0c4ae2e0de1ae/plugins/code-review/commands/code-review.md), lines 42–58, commit dated 2026-10-26.
  - What it would change: put a cheap check on every high before it is printed («is this still true at HEAD, and is it not dima's own act?»). That targets the false highs, which all sit in the wishes surface (grades:38, #1, #5, #71).
- **The same command lists what never counts as a finding.** «Pre-existing issues», «Pedantic nitpicks that a senior engineer would not flag», «Issues that a linter will catch (do not run the linter to verify)», «General code quality concerns… unless explicitly required». Source: same file, lines 80–87, 2026-10-26.
  - What it would change: the card would get a «never a finding» list: hygiene that siesta-checks or close-net already reds, cosmetic lines, and any `/simplify` candidate. Loose ends caught nothing in the sample: 0 of 12, 8 dropped (grades:43).
- **Anthropic says a reviewer told to find problems will always find something.** «Don't drop the `skip style` part of that prompt. A reviewer that's asked to find problems will always find *something*. If you fix every finding, you end up with extra abstraction layers…» Their sample reviewer: «report only the gaps that affect correctness. Skip style.» Source: [Claude Code best practices](https://code.claude.com/docs/en/best-practices) § review against your spec and § the reviewer.md example, page undated, read 2026-11-11.
  - What it would change: name «clean» as the expected result of a small batch, and cut the loose-ends surface to «a half-finished rename only».
- **Severity scores an LLM gives its own output can be near random, and filtering on past feedback worked better. [pre-2025]** Greptile had the model rate each comment 1–10 and drop those under 7, but the score was «nearly random». Blocking comments that closely matched 3 or more past downvoted comments (embeddings) raised the address rate from 19 % to 55 %+. Source: [Greptile blog, «How to make LLMs shut up»](https://www.greptile.com/blog/make-llms-shut-up), Daksh Gupta, 2024-12-18.
  - What it would change: our own data disagrees for highs. Wishkeeper's highs are real 33 of 42 times (grades:7, 2026-11-11), so its severity label does work at the top. Lows, though, went 0 of 24 (grades:8), which matches Greptile's lesson. Filter by past outcomes (the grades' dropped list), not by the model rating itself.
- **Anthropic's eval guidance: calibrate the judge against human grades, give it a way out, and grade each dimension in isolation.** «LLM-as-judge graders should be closely calibrated with human experts»; «give the LLM a way out, like providing an instruction to return "Unknown"»; «grade each dimension with an isolated LLM-as-judge rather than using one to grade all dimensions»; «You won't know if your graders are working well unless you read the transcripts and grades». Source: [Anthropic, «Demystifying evals for AI agents»](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents), 2026-01-09.
  - What it would change: the «Unknown» way out is already in the card. Calibration is what grades.md did once by hand. Run it again on a schedule, for example every 2 weeks on 15 findings.
- **On single versus many judges, Anthropic's two posts disagree.** The research-system post found «a single LLM call with a single prompt outputting scores from 0.0–1.0 and a pass-fail grade was the most consistent and aligned with human judgements». Source: [Anthropic, «How we built our multi-agent research system»](https://www.anthropic.com/engineering/multi-agent-research-system), 2025-06-13. The 2026-01-09 evals post above recommends isolated judges, one per dimension.
  - What it would change: keep one pass at siesta cadence, which is cheaper and is what the research post measured. Split per dimension only for the rare big chunk read.

## vector 2: incremental review, the stable prefix, never re-reviewing cleared items

- **CodeRabbit separates an incremental review from a full one.** `review`: «Reviews the commits pushed since CodeRabbit's last review of the pull request.» `full review`: «Reviews every file in the pull request again from scratch.» On new commits it does an incremental review: «Focus on newly added changes – Updates to previous recommendations – Maintains conversation context». Sources: [CodeRabbit review commands](https://docs.coderabbit.ai/reference/review-commands.md) and [code review overview](https://docs.coderabbit.ai/guides/code-review-overview.md), pages undated, read 2026-11-11.
  - What it would change: a pre-merge read of «pr 2» or a fix round should cover only `last-read-head..head` plus the status of earlier findings. 4 of the 5 worst runs were such re-reads (grades:63).
- **CodeRabbit carries open findings forward instead of re-finding them.** `track` «checks the new commits against the original comment and replies… once the code satisfies it… up to 20 tracked findings per review». `fixed`: «If nothing has changed since the last check, CodeRabbit repeats the previous result instead of checking again.» Source: [CodeRabbit review commands § track, § fixed](https://docs.coderabbit.ai/reference/review-commands.md), page undated, read 2026-11-11.
  - What it would change: pass wishkeeper the list of its open findings from the previous run. It answers each with fixed or still open in one line, and never re-derives a finding it already cleared.
- **CodeRabbit pauses automatic reviews after a commit threshold.** `auto_pause_after_reviewed_commits: 5   # default`, and `auto_incremental_review` controls whether it reviews again on later pushes. Source: [CodeRabbit auto-review config](https://docs.coderabbit.ai/configuration/auto-review.md), page undated, read 2026-11-11.
  - What it would change: a churning chunk gets one read at its end, not one per push.
- **Anthropic's `/code-review` stops when it has already reviewed.** Step 1 stops if «Claude has already commented on this PR». Source: [code-review.md @ 9780cf40](https://github.com/anthropics/claude-plugins-official/blob/9780cf407f5593727b668bae95a0c4ae2e0de1ae/plugins/code-review/commands/code-review.md), line 19, 2026-10-26.
  - What it would change: a «last read head» stamp per chunk. A brief whose range was already read gets a delta read, or no read.
- **A subagent's cache lasts 5 minutes by default, and the cache matches only an exact prefix.** «The match is exact, so a change anywhere in the prefix recomputes everything after it.» Subagents «get five minutes even on a subscription until you choose a longer one». The frontmatter `experimental: cacheTtl: 1h` sets one hour for one agent. A resumed subagent's first request «can read the cache the original run warmed». Sources: [Claude Code prompt caching](https://code.claude.com/docs/en/prompt-caching) § how the cache is organized, § subagents and the cache; [sub-agents § frontmatter reference](https://code.claude.com/docs/en/sub-agents), pages undated, read 2026-11-11.
  - What it would change: siestas come 20–45 a day, so the gaps are often longer than 5 minutes and every run probably pays the full write for its card. Two fixes:
    - set `cacheTtl: 1h`
    - move the fixed rule reads (card lines 15–19: CLAUDE.md § invariant, craft-pm § wishes, the habit files) out of tool calls, which come after the brief, and into the card or a preloaded skill. Then they sit in the shared prefix.
  - Whether a preloaded skill lands before the task message in the prefix is not stated «?».
- **Resuming a subagent keeps its full history.** «Resumed subagents retain their full conversation history, including all previous tool calls, results, and reasoning», via `SendMessage` to its agent ID. Source: [sub-agents § resume subagents](https://code.claude.com/docs/en/sub-agents), page undated, read 2026-11-11.
  - What it would change: for the read of a chunk's fix round, resume the wishkeeper that read pr 1 instead of starting a fresh one. It already holds the clean parts and its own findings. The cost is a growing context, so cap resumes to one chunk.
- **GitHub Copilot and Greptile do not review every push by default.** Copilot reviews «once» unless **Review new pushes** is on. Greptile's `autoReview` defaults to `["open"]`, and `push` is opt-in. Sources: [GitHub docs, Copilot code review](https://docs.github.com/en/copilot/concepts/agents/code-review); [Greptile .greptile/ reference](https://www.greptile.com/docs/code-review/greptile-config-reference.md), pages undated, read 2026-11-11.
  - What it would change: a vendor's default is evidence of what noise teams tolerate, not a measurement. It still backs one read per chunk plus explicit re-reads.

## vector 3: checking «done / fixed / verified» claims

- **LLM judges are poor at spotting false success, and they key on confident wording.** False success makes up 45–48 % of failures in single-control tau2-bench, and 75.8 % among AppWorld coding-agent runs that make explicit status claims. No combination of 5 judges and 5 prompt strategies goes above AUROC 0.65, because «Judges rely on surface completion proxies – confident closing language… rather than verified state changes». Cheap TF-IDF detectors reach 0.83–0.95. Source: [arXiv 2606.09863, «From Confident Closing to Silent Failure»](https://arxiv.org/abs/2606.09863), 2026-06-01.
  - What it would change:
    - the claims surface should check the claim against state (the file at HEAD, the ticket's live status), not against the transcript's wording
    - a regex pre-pass over clio's replies for «done / everywhere / all / verified» could pick the claims worth checking, in siesta-checks rather than in the model
- **Tests can pass while the patch is wrong.** 7.8 % of patches count as correct while failing the developer's own test suite. 29.6 % of passing patches behave differently from the ground truth, and 28.6 % of those are certainly incorrect. Source: [arXiv 2503.15223, «Are "Solved Issues" in SWE-bench Really Solved Correctly?»](https://arxiv.org/abs/2503.15223), 2025-03-19 (ICSE 2026).
  - What it would change: a green gate is necessary but not sufficient. A «fixed» claim needs a command that runs the claimed path. #84 is the live case: the revive script read a dead field, while clio said it read effort (grades:48).
- **Stronger models exploit tests more, and monitors catch less on real repos.** The paper reports a cheating rate (passing impossible tasks by bending tests). LLM monitors catch 86–89 % of this on LiveCodeBench but only 42–65 % on SWE-bench. Source: [arXiv 2510.20270, ImpossibleBench](https://arxiv.org/abs/2510.20270), 2025-10-23 (Zhong, Raghunathan, Carlini). The detection figures are from search-result text, not checked in the PDF «?».
  - What it would change: when a batch edits a test or a check together with the code it checks, make that diff its own high-priority read.
- **Many «successes» break the procedure.** 27–78 % of tau-bench successes are «corrupt successes concealing violations». Source: [arXiv 2603.03116, Procedure-Aware Evaluation](https://arxiv.org/abs/2603.03116), 2026-03-03.
  - What it would change: «done» has to be read against the signed procedure as well as the outcome. That is the card's tracker surface: a close past its done test, a re-sign skipped.
- **Verification failure is one of the 3 failure categories in multi-agent systems.** MAST names «task verification» as one of 3 failure categories, from 1,600+ traces, kappa 0.88. Source: [arXiv 2503.13657, «Why Do Multi-Agent LLM Systems Fail?»](https://arxiv.org/abs/2503.13657), 2025-03-17.
  - What it would change: nothing new. It backs keeping the claims surface.
- **Anthropic saw agents mark work complete without testing.** Their fix: only flip a `passes` field after end-to-end testing, and «It is unacceptable to remove or edit tests». Source: [Anthropic, «Effective harnesses for long-running agents»](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), 2025-11-26.
  - What it would change: the same pattern as a W-line «met» mark. The auditor checks that a met mark has a proof line beside it.

## vector 4: two reviewers on one agent

- **Anthropic's `/code-review` splits by concern and removes duplicates.** Agents 1+2 audit CLAUDE.md compliance, and agents 3+4 look for bugs, each told «Only look for issues that fall within the changed code». At the end: «Only post ONE comment per unique issue.» Source: [code-review.md @ 9780cf40](https://github.com/anthropics/claude-plugins-official/blob/9780cf407f5593727b668bae95a0c4ae2e0de1ae/plugins/code-review/commands/code-review.md), lines 31–40 and 78, 2026-10-26.
  - What it would change: the split (crow takes intent and process, wishkeeper takes files and tracker) already matches. What is missing is the dedupe step: hand wishkeeper crow's notes from the same pause and skip anything crow raised. The duplicate share is a floor of 6 % (grades:169), and 2 of 10 claim findings had been raised by crow or codie first (grades:42).
- **Anthropic says duplicate work comes from unclear task boundaries.** «Without detailed task descriptions, agents duplicate work, leave gaps…» Source: [multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system), 2025-06-13.
  - What it would change: write the crow/wishkeeper border as a list of surfaces in both cards, not only the one clause in the card (line 13).

## vector 5: cadence

- The vendors mostly default to one review per PR or chunk, with explicit re-reads (CodeRabbit auto-pause after 5 commits, Copilot reviews once, Greptile only on `open`; sources and dates under vector 2).
  - What it would change: this agrees with the grades. Trigger type barely changes yield, about 2.5–3.2 catches per run (grades:9), while re-reads are the outlier. Keep the per-pause trigger and make re-reads delta-only.
- **Anthropic: a rule that cannot bend belongs in a hook.** «If it's a rule that can't bend, turn it into a hook or a deny rule.» A `Stop` hook with exit 2 blocks the stop. `SubagentStop` and `SubagentStart` hooks can match by agent name. Sources: [best practices § what you can stop doing, § enforce the check with a Stop hook](https://code.claude.com/docs/en/best-practices); [sub-agents § project-level hooks for subagent events](https://code.claude.com/docs/en/sub-agents), pages undated, read 2026-11-11.
  - What it would change: «never skip the audit» becomes a Stop hook that blocks while a siesta is due and no `SubagentStart` for wishkeeper has been logged since. The Stop-hook «siesta due» line already exists (grades:15), but today it only reminds. Census: 57 of 252 siestas skipped wishkeeper (grades:23).
- Evidence on review fatigue and alert noise: not searched in this lane «?».

## vector 6: output a busy agent will act on

- **OpenAI Codex sets a severity floor by default.** «In GitHub, Codex flags only P0 and P1 issues so review comments stay focused on high-priority risks.» Source: [OpenAI Codex, GitHub integration](https://developers.openai.com/codex/integrations/github), page undated, read 2026-11-11.
  - What it would change: drop lows from the output, or fold them into one count line.
- **CodeRabbit's `quiet` profile posts only the most important comments inline.** It «Posts only the most important comments inline and groups the other review comments in the review summary». Source: [CodeRabbit configuration reference, `reviews.profile`](https://docs.coderabbit.ai/reference/configuration.md), page undated, read 2026-11-11.
  - What it would change: the same move, keeping lows visible as one line instead of 5 bullets.
- **Greptile's strictness setting.** Strictness 3 «Shows only the most critical issues». Greptile also reads the first and last commit of each PR to see which comments were addressed, and lowers the priority of the rest. Source: [Greptile, Controlling nitpickiness](https://www.greptile.com/docs/code-review/controlling-nitpickiness.md) and [Reducing nitpicks](https://www.greptile.com/docs/how-greptile-works/nitpicks.md), pages undated, read 2026-11-11.
  - What it would change: «acted vs dropped» is exactly the metric grades.md built by hand. Turn it into a weekly count per surface and cut any surface that stays near zero.
- **A clean result has a fixed form.** «No issues found. Checked for bugs and CLAUDE.md compliance.» Source: [code-review.md @ 9780cf40](https://github.com/anthropics/claude-plugins-official/blob/9780cf407f5593727b668bae95a0c4ae2e0de1ae/plugins/code-review/commands/code-review.md), line 62, 2026-10-26.
  - What it would change: the card already does this (`clean` plus gates).
- **Use `/usage` to see what each subagent costs.** It shows «what share of your usage each subagent type takes, so you can tell which ones are earning their cost». Source: [best practices § subagents](https://code.claude.com/docs/en/best-practices), page undated, read 2026-11-11.
  - What it would change: a cheap token-per-run trend between hand grades.

## vector 7: Anthropic's subagent and verifier guidance (other than the above)

- **`omitClaudeMd` is meant for agents that get their context from the brief.** It is «for subagents that take everything they need from the delegation prompt». Rules that must reach the subagent: «restate it in the prompt you give Claude when delegating». Source: [sub-agents § frontmatter reference, § what loads at startup](https://code.claude.com/docs/en/sub-agents), page undated, read 2026-11-11.
  - What it would change: nothing. The card already does this (line 8 plus the reads at lines 15–19).
- **A read-only reviewer should be enforced through `tools`.** «Give a custom subagent… only `tools: Read, Grep, Glob`. Now it's a reviewer that can't edit anything, and that limit is enforced by Claude Code rather than requested in a prompt.» Source: [best practices § subagents](https://code.claude.com/docs/en/best-practices), page undated, read 2026-11-11.
  - What it would change: the card has `tools: Read, Bash` (line 7). Bash is needed for its gates, so «you never edit» is only a prompt. A `PreToolUse` hook in the card's frontmatter could hold Bash to a read-only set. Frontmatter hooks run for user-level agents, and for a project folder after workspace trust (same doc, § hooks in subagent frontmatter).
- **Subagent persistent memory.** `memory: project` gives a persistent directory, and the first 200 lines of `MEMORY.md` load at start. But «Read, Write, and Edit tools are automatically enabled». Source: [sub-agents § enable persistent memory](https://code.claude.com/docs/en/sub-agents), page undated, read 2026-11-11.
  - What it would change: this is one way to remember cleared items and dropped-finding patterns across runs. It breaks the tool-enforced read-only rule, though, so keep that state in a file clio passes in the brief instead.
- **A fresh reviewer helps because it has not seen the reasoning, not because it is smarter.** «Handing the same task to a subagent doesn't make the answer any better. A fresh reviewer does help, because it hasn't seen your reasoning.» Source: [best practices § what you can stop doing](https://code.claude.com/docs/en/best-practices), page undated, read 2026-11-11.
  - What it would change: this pulls against resuming. Resume only for a delta of the same chunk, and keep a fresh agent for each new batch.
- **Building effective agents: evaluator-optimizer, parallel reviewers, ground truth. [pre-2025]** It describes the evaluator-optimizer loop and «several different prompts review and flag the code», and adds «it's crucial for the agents to gain "ground truth" from the environment at each step». Source: [Anthropic, «Building effective agents»](https://www.anthropic.com/engineering/building-effective-agents), 2024-12-19.
  - What it would change: nothing beyond the gates the card already runs (line 34).
- **Anthropic recommends end-state grading.** «We found success focusing on end-state evaluation rather than turn-by-turn analysis», and the evals post says «grade what the agent produced, not the path it took». Sources: research-system post, 2025-06-13; evals post, 2026-01-09.
  - What it would change: the promises and claims surfaces read the transcript turn by turn. Read state first (range, tracker, files), and use the transcript only to locate the claim.
- **OpenAI critics invent bugs. [pre-2024]** Trained critics catch more bugs than contractors, but have «hallucinated bugs», and human-plus-critic teams hallucinate less. Source: [arXiv 2407.00215, «LLM Critics Help Catch LLM Bugs»](https://arxiv.org/abs/2407.00215), 2024-06-28.
  - What it would change: backs clio checking every high at its spot, which the card already asks for (line 53).

## the card against these findings

What the card already does:
- read-only by intent, with `omitClaudeMd` and explicit rule reads: card lines 7–8, 15–19
- the «Unknown» way out: «one you cannot tie to both is marked «?»», line 53
- a fixed clean output with gates and exit codes, lines 34 and 53
- does not re-run checks the tool output already covers: «read their reds, never re-run them», line 25
- skips findings already in the open asks, line 53
- splits concerns with crow (intent and process versus files and tracker), line 13
- ground-truth gates by exit code, line 34
- a claims surface, line 31, backed by «the command must exercise the thing claimed», `/Users/dima/frame/_clio/memory/method-rule-proof.md:39`
- severity-led, top-5 output with the spot cited, line 53

What the card lacks:
1. **A severity floor.** Lows are still printed (line 53), though they went 0 of 24 and 20 of 24 were dropped (grades:8, 19). Sources: Codex P0/P1, CodeRabbit `quiet`, Greptile strictness 3.
2. **A «never a finding» list, plus a smaller loose-ends surface.** Loose ends had 0 catches (grades:43). Sources: code-review.md:80–87; best practices «skip style».
3. **A check on each high before printing.** At minimum: is it still true at HEAD, and was it not dima's own act? This is where the false wishes highs sit. Source: code-review.md steps 5–6.
4. **Delta reads with a last-read head per chunk, and carried-forward open findings answered fixed or still open.** Re-reads are the worst runs (grades:30, 63). Sources: CodeRabbit `review` / `track` / `fixed`, code-review step 1, Claude Code resume.
5. **A prefix built for the cache.** The fixed rule reads move into the card or a preloaded skill, and `experimental.cacheTtl: 1h` is set. Today the card makes 4–6 tool reads per run after a brief that changes every time. Source: Claude Code prompt-caching doc.
6. **Claims checked against state, not wording.** Surface 5 asks only for «a command behind it in the transcript» (line 31). It should also ask whether that command ran the claimed path at HEAD. Sources: arXiv 2606.09863, 2503.15223.
7. **Crow's notes as input, for dedupe.** Source: code-review «ONE comment per unique issue».
8. **The audit enforced by hook, not by reminder.** Source: best practices «turn it into a hook».
9. **A standing yield loop.** grades.md is a one-off; this would be a recurring hand grade or an acted/dropped count. Sources: Anthropic evals «calibrated with human experts», Greptile addressed-comment learning.
10. **Read-only enforced by a hook on Bash.** Today it is only stated in the prompt. Source: best practices on read-only through `tools`.

## the 5 strongest borrows, ranked

1. **Delta-only re-reads with carried-forward findings.** Pass `last-read-head..head` plus the open findings, each answered fixed or still open, and resume the same agent for a chunk's fix round. Targets the worst cost per catch, about 177k tokens (grades:30). Sources: [CodeRabbit review / track / fixed](https://docs.coderabbit.ai/reference/review-commands.md) (undated, read 2026-11-11), [Claude Code resume subagents](https://code.claude.com/docs/en/sub-agents) (undated, read 2026-11-11), [code-review.md step 1 @ 9780cf40](https://github.com/anthropics/claude-plugins-official/blob/9780cf407f5593727b668bae95a0c4ae2e0de1ae/plugins/code-review/commands/code-review.md) (2026-10-26).
2. **A severity floor that drops lows to one count line, plus a «never a finding» list.** Cuts noise and output tokens with no measured catch lost (lows 0 of 24). Sources: [Codex GitHub review, P0/P1 only](https://developers.openai.com/codex/integrations/github) (undated, read 2026-11-11), [CodeRabbit `quiet`](https://docs.coderabbit.ai/reference/configuration.md) (undated, read 2026-11-11), [code-review.md:80–87](https://github.com/anthropics/claude-plugins-official/blob/9780cf407f5593727b668bae95a0c4ae2e0de1ae/plugins/code-review/commands/code-review.md) (2026-10-26), [best practices «skip style»](https://code.claude.com/docs/en/best-practices) (undated, read 2026-11-11).
3. **A cache-friendly prefix.** Move the fixed rule reads into the card or a preloaded skill, and set `experimental: cacheTtl: 1h`. This lowers tokens on every run at 20–45 runs a day. Whether skills land before the brief in the prefix is unverified «?». Source: [Claude Code prompt caching](https://code.claude.com/docs/en/prompt-caching) and [sub-agents frontmatter](https://code.claude.com/docs/en/sub-agents) (undated, read 2026-11-11).
4. **Check claims against state, not transcript wording.** Judges top out at AUROC 0.65 on confident «done» text, and passing tests still pass wrong patches. Use a regex pre-pass to pick claims, then one command at HEAD per claim. Sources: [arXiv 2606.09863](https://arxiv.org/abs/2606.09863) (2026-06-01), [arXiv 2503.15223](https://arxiv.org/abs/2503.15223) (2025-03-19).
5. **Never skip, enforced by a hook.** A Stop hook blocks while a siesta is due without a wishkeeper `SubagentStart`. This turns the 57 of 252 skips into 0. Source: [best practices «turn it into a hook», Stop hook exit 2](https://code.claude.com/docs/en/best-practices); [sub-agents SubagentStart/Stop](https://code.claude.com/docs/en/sub-agents) (undated, read 2026-11-11).

Runners-up: a check on each high before printing (code-review steps 5–6, 2026-10-26); crow's notes passed in for dedupe (same file, line 78); a standing acted/dropped yield count (Greptile nitpicks doc, undated; Anthropic evals post, 2026-01-09).

## not verified

- Whether preloaded `skills` content sits before the task message in the cached prefix: the docs list both in the initial context but give no order «?».
- ImpossibleBench's 86–89 % and 42–65 % monitor detection figures came from a search summary, not the PDF «?».
- Graphite and Sourcery docs: not opened «?».
- Evidence on review fatigue and alert noise (vector 5): not searched in this lane «?».
- Google guidance on evaluator agents: not searched «?».
- CodeRabbit, Greptile, Copilot, Codex and Claude Code docs pages show no publish date; they are cited as read on 2026-11-11.

<!-- end -->
