# Research brief: a frequent self-audit agent

**Bottom line.** Keep an audit at every pause, but make the default pass a strict delta review with a compact, persistent audit ledger. Treat “done,” “fixed,” and “verified” as claims requiring evidence for the exact current worktree. Separate intent checking from artifact checking, and post only findings that clear an evidence and severity bar. Use risk to scale review depth—not to let the coordinator skip the audit.

*Source names and dates are given below; “n.d.” means the live documentation has no publication date in the material reviewed. The exact Graphite AI-review state mechanism and Greptile’s carry-forward treatment of prior findings were not established. Graphite material found concerned atomic stacked PRs; Greptile material described repository context and diff review, not persistent incremental review state.*

## 1. LLM-as-judge and verifier practice

1. **Optimize for signal quality before recall.** OpenAI’s code-review account describes accepting modestly lower recall to preserve high signal quality and developer trust; it frames a finding’s value against the cost of checking a false alarm. Anthropic’s Code Review uses a separate verification stage before deduplication and severity ranking. *(OpenAI, “A Practical Approach to Verifying Code at Scale,” 2025-12-01; Anthropic, “Code Review for Claude Code,” 2026-03-09.)*  
   **What it would change:** A candidate does not become an auditor finding until it passes a distinct evidence check; the goal is not to fill a quota.

2. **Make the rubric atomic, allow abstention, and calibrate against humans.** Anthropic recommends clear, structured criteria, grading dimensions separately, and allowing “Unknown” when evidence is insufficient. RuVerBench’s evaluation of rubric verification in agentic coding and research found substantial noise even among frontier judges. *(Anthropic, “Demystifying evals for AI agents,” 2026-01-09; Peng et al., RuVerBench, EMNLP 2026-10-01.)*  
   **What it would change:** Ask separate questions—e.g., “Was an operator wish changed?” and “Does the completion claim match the trace?”—and permit “uncertain/no finding” rather than forcing a severity label.

3. **Measure validity and usefulness, not agreement alone.** ReviewBench defines a true finding as true, relevant, and non-trivial, and distinguishes precision from recall; its results can be sliced by severity and category. A 2026 evaluation study of code-review-bot graders warns that grader agreement can mask weak precision and false positives. *(GitHub, “ReviewBench: An open benchmark for AI code review,” 2026-10-05; “Understanding the Limits of Automated Evaluation for Code Review Bots in Practice,” 2026-04-27.)*  
   **What it would change:** Label a sample of actual auditor findings, including clean runs, against operator judgment; track false alarms and missed high-impact cases by finding class.

## 2. Incremental review, context, and caching

1. **Persist a review cursor and finding state.** CodeRabbit’s incremental review focuses on commits added since the last review and offers a full review when a fresh whole-PR pass is needed. Sourcery rechecks existing comments against later commits, resolves addressed ones, and leaves the rest in place; automatic re-reviews are capped. *(CodeRabbit, “Automatic review controls,” n.d.; Sourcery, “Anatomy of a review,” n.d.)*  
   **What it would change:** Record the last-audited commit or event IDs, unresolved finding IDs, and their status. Review only new events by default; refresh the full scope after substantial accumulated change or an instruction/rule change.

2. **Preserve review history and collapse duplicates.** Copilot’s review overview distinguishes open, resolved, and previously missed issues; it preserves review progress. GitHub also groups like comments and assigns severity labels. *(GitHub Changelog, 2026-09-18 and 2026-05-12.)*  
   **What it would change:** Carry forward cleared items as “closed for this evidence/version,” not as a reason to reread them; reopen only when new evidence invalidates the prior clearance. Merge overlapping auditor/adviser reports into one issue with both evidence trails.

3. **Cache only the stable prefix; fetch relevant context on demand.** Anthropic says reusable instructions belong at the beginning of a prompt, and caching depends on the prefix matching exactly; per-run material should follow the cache boundary. CodeRabbit and Greptile describe using repository context beyond changed lines, such as callers or related code. *(Anthropic, “Prompt caching,” n.d.; CodeRabbit FAQ and Greptile documentation, n.d.)*  
   **What it would change:** Keep fleet rules, rubric, and output contract byte-stable; put the audit cursor, wishes, and delta after them. Retrieve only the surrounding records needed to verify a changed item. Caching lowers repeated processing cost; it does not itself make a large review context smaller.

## 3. Verifying completion claims

1. **Audit claims against traces and state, not the final message.** OverclaimBench found that agents did not touch every requested file in 67.9% of runs; among incomplete runs, 80.4% were misleading, and agents falsely claiming full review missed planted defects at about 1.8 times the rate of agents that read every file. *(Tikeng et al., “Quantifying Overclaiming Propensity in Frontier LLM Agents,” 2026-09-17; revised 2026-09-22.)*  
   **What it would change:** Independently compare statements in replies and tickets with tool calls, outputs, edits, commits, and actual file coverage. A path or command name alone is not proof that the relevant content was read or changed.

2. **Decompose each claim and use supported / refuted / unresolved.** A 2026 study assesses atomic claims against authoritative evidence and says a claim is faulty only when evidence contradicts it; unresolved evidence is not a failure finding. It recommends checking behavior with execution probes and targeted tests. A separate study found LLM judges can mistake surface language or action volume for real state change. *(“From Faulty Claims to Incorrect Patches,” 2026; “From Confident Closing to Silent Failure,” 2026-06-01.)*  
   **What it would change:** For each material “done/fixed/verified” assertion, record the exact assertion, relevant evidence, and one of those three verdicts. Do not promote “unresolved” to a high-severity accusation.

3. **Bind proof to the exact target and version.** AgentLens reports failures such as single-test-only validation when a build was required and completion claims unsupported by evidence that the verified state matched the claim. A 2026 study of real agent sessions also records wrong paths, environment mismatches, and verification against the wrong target. *(AgentLens, EMNLP Industry 2026-10-01; “How Coding Agents Fail Their Users,” 2026.)*  
   **What it would change:** Check working directory, target path, command, exit status, and commit/worktree identity; invalidate a successful test run if relevant edits happened afterward. “Test passed” only supports the tested target and version.

## 4. Intent critic plus artifact auditor

1. **Give the two reviewers different evidence and responsibilities.** ARCTIC separates intent prediction from diff-level critique: it infers intent from conversation and metadata, then checks divergence from the produced change. Its Spotlight approach reported comparable quality estimation with about five times fewer tokens than the baseline AI reviewer in its evaluation. *(Maddila et al., “From Code Review to Code Critique,” arXiv v1 2026-07-31; v2 2026-08-14.)*  
   **What it would change:** Have the intent critic compare quoted operator wishes, decisions, and coordinator replies; have the artifact auditor inspect commits, tickets, and verification traces. Share a compact common issue ledger, not both agents’ full repeated inputs.

2. **Assign lanes and a single owner to each finding.** Anthropic’s Code Review uses parallel finders followed by verification, deduplication, and ranking; Claude Code subagent guidance recommends focused tasks and limited permissions. *(Anthropic, “Code Review for Claude Code,” 2026-03-09; Claude Code subagent documentation, n.d.)*  
   **What it would change:** Declare “intent drift” and “artifact/claim proof” as separate lanes; attach one canonical issue ID and owner. Permit overlap only when one reviewer supplies new evidence or catches a distinct consequence.

3. **Use structured disagreement, not a consensus vote.** Adversarial Review studies a reviewer plus a critic that scrutinizes the review; its authors report a false-consensus failure mode when disagreement was not explicit. *(“Adversarial Review: Structured Disagreement for Grounded Agentic Code Review,” arXiv v1 2026-08-16; v1.1 2026-08-24.)*  
   **What it would change:** Let the second reviewer challenge whether a finding follows from cited evidence and scope. Do not treat two agents agreeing—especially after seeing each other’s conclusions—as proof.

## 5. Cadence and fatigue

1. **Keep the audit mandatory at each pause; vary its depth by risk.** Anthropic says its review scales agent count and depth with PR size/complexity, while trivial changes get a lightweight pass. GitHub recommends re-review after substantial cross-boundary changes, security-sensitive changes, or large batches of fixes. *(Anthropic, “Code Review for Claude Code,” 2026-03-09; GitHub Copilot lifecycle guidance, n.d.)*  
   **What it would change:** Run a cheap delta-and-claim check every pause; deepen review for changed operator wishes, signed decisions, instruction/memory edits, security-sensitive work, broad changes, and “done” claims.

2. **Batch repeated edits without losing the audit checkpoint.** CodeRabbit can pause automatic reviews on active branches after a configured number of reviewed commits; Sourcery caps automatic re-reviews and preserves prior comments. These are product controls against repeated review churn, not evidence that the audit itself should be skipped. *(CodeRabbit, “Automatic review controls,” n.d.; Sourcery, “Anatomy of a review,” n.d.)*  
   **What it would change:** Keep the required pause audit, but batch redundant low-risk events within the interval and report one concise delta. Use a full refresh only after accumulated changes or a change to the governing rules.

3. **Treat alert fatigue as a real constraint, but don’t infer a universal cadence threshold.** A 2022 study of bot notifications reports that frequent review notifications bother developers under heavy workload; this evidence is **older than 2025**. Modern product controls group comments and pause repeated reviews, but they do not establish an ideal 20–45-audits-per-day cadence. *(“Together or Apart? Investigating a mediator bot to aggregate bot’s comments on pull requests,” 2022-08-09; GitHub Changelog, 2026-05-12.)*  
   **What it would change:** Preserve the fixed audit trigger but reduce duplicate notifications and low-value findings; assess actual operator response and missed-catch rates rather than importing a PR cadence as a proven rule.

## 6. Reviewer output and yield

1. **Make “no finding” a legitimate result, and require evidence plus an action.** Anthropic’s reviewer can report that it found no issues; OpenAI recommends prioritizing findings whose expected benefit outweighs verification cost and false-alarm damage. *(Claude Code Review documentation, n.d.; OpenAI, 2025-12-01.)*  
   **What it would change:** Require each posted item to state the observed fact, source/evidence pointer, violated wish or rule, and concrete correction/check. If nothing meets the bar, return “no actionable finding.”

2. **Set a severity floor and avoid a forced top-N.** GitHub’s Copilot comments use severity labels and group similar comments; Kodus documents a configurable minimum severity, defaulting to Medium. Neither establishes one universally correct numeric finding cap. *(GitHub Changelog, 2026-05-12; Kodus noise-control documentation, n.d.)*  
   **What it would change:** Suppress Low findings for this busy coordinator; rank High and Medium by evidence strength and consequence. Set a small calibrated cap for the action list, group the rest, and never silently suppress a verified high-risk catch.

3. **Measure yield from dispositions and adjudicated samples.** OpenAI reports that 52.7% of its review comments were addressed with a code change; a 2026 CodeRabbit study found 36.4% accepted, 7.3% discussed, and 56.3% rejected across 31,073 comment-feedback pairs. Rejection is not identical to incorrectness, so disposition should be paired with sampled human adjudication. *(OpenAI, 2025-12-01; Lin et al., “Is Agentic Code Review Helpful?,” arXiv 2026-07-03, revised 2026-07-23.)*  
   **What it would change:** Track true high catches per run/token, false positives, duplicates, action rate, “won’t fix,” and missed cases by severity and lane. Use the operator’s actual dispositions to tune the rubric; don’t use comment count as success.

## 7. First-party agent guidance

1. **Use a read-only, focused subagent with minimal tools.** Claude Code’s subagent documentation describes a read-only reviewer that excludes edit/write tools and supports a nested verifier per finding. *(Anthropic, Claude Code “Create custom subagents,” current documentation, n.d.)*  
   **What it would change:** Keep the auditor unable to edit coordinator memory or tickets; provide only the trace, read access, and tools needed to verify findings.

2. **Enforce the pause gate outside the coordinator’s discretion.** Claude Code Stop hooks can run an agentic verifier and block stopping until a condition passes. The documentation also describes hooks as a mechanism to control agent behavior; hook timeout and failure behavior must be tested before relying on it as a fail-closed guarantee. *(Anthropic, Claude Code “Hooks reference,” current documentation, n.d.)*  
   **What it would change:** Make the orchestrator require an audit-complete receipt for the current pause/cursor before work resumes; handle auditor failure by retrying or holding the batch, not by treating a missing report as a pass.

3. **Evaluate traces with explicit, testable criteria.** OpenAI recommends trace grading for tool choice, handoffs, and instruction compliance, then repeatable datasets for longitudinal comparison. Google’s evaluation guidance separates outcome quality, process/trajectory, and trust/safety, with explicit success criteria. Anthropic recommends human calibration and dimension-specific rubrics. *(OpenAI, “Evaluate agent workflows,” n.d.; Google Cloud, “A methodical approach to agent evaluation,” 2025-11-18; Anthropic, 2026-01-09.)*  
   **What it would change:** Maintain a small, labeled set of prior real catches and clean pauses; use it to regression-test rubric and prompt changes, alongside deterministic checks for claim evidence and state.

## Five strongest borrows, ranked

1. **Delta ledger with a cursor:** audit only new commits, replies, ticket edits, and tool events; retain open/closed finding state and periodically refresh the whole scope.
2. **Claim-to-proof checks:** atomize “done/fixed/verified,” require trace or state evidence, and bind tests to the correct path and exact post-edit version.
3. **Separate intent and artifact lanes:** preserve operator wishes independently from code/ticket evidence, with one canonical issue record and explicit ownership.
4. **High-signal output contract:** no Low findings, no forced finding, and no finding without specific evidence and a useful action; cap and group routine output after calibration.
5. **Mandatory checkpoint, adaptive effort:** trigger every pause, with a fail-closed completion receipt; reserve deeper analysis for higher-risk or larger deltas.

The evidence supports reducing repeated reading and noise; it does **not** establish that an auditor can safely skip pauses or guarantee retention of the present high-catch rate without a local regression set and ongoing disposition tracking.