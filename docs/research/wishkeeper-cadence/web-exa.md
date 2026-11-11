# Research brief: building a frequent self-audit agent for an AI coordinator

## Executive recommendation

Keep the audit at every pause, but make the **audit unit event- and risk-driven rather than transcript-driven**. Give it a durable review ledger, a narrow delta, cached stable context, deterministic evidence checks, and a strict output contract: **zero findings is valid; at most three actionable findings; only high-confidence, material findings are emitted**. Retain a slower full review as a backstop after rebases, instruction changes, large or cross-cutting changes, and on a periodic schedule.

The central design principle is to separate three questions that are currently likely being mixed together:

1. **Intent:** did the coordinator understand and preserve the operator's wishes and signed decisions?
2. **Artifact:** did the claimed change actually land in the named file, path, ticket, commit, test, or memory entry?
3. **Process/evidence:** does the evidence support the coordinator's claim, and was the relevant scope actually reviewed?

A finding should normally require both a concrete counterexample and a material consequence. Otherwise, emit nothing.

## Vector 1 — LLM-as-judge/verifier practice: rubrics, precision, and severity

### 1. Use criterion-specific rubrics, not a broad “review everything” instruction

AgentJudgeBench (2026-08-27) reports that structured rubrics improved judge alignment by up to 6.5 percentage points, but not uniformly; performance also fell as task difficulty rose and when ground truth was absent. [AgentJudgeBench](https://doi.org/10.18653/2026.emnlp-main.659) (2026-08-27).

**What it would change:** define three separate checks—operator-intent fidelity, claim/evidence validity, and rule violation—each with explicit pass/fail evidence requirements. Do not ask one vague judge to assess “quality.”

### 2. Calibrate against hard negatives, not overall agreement

A 2025 study of validator bias found true-positive rates above 96% but true-negative rates usually below 25%; majority voting did not solve the problem, while a minority-veto strategy and calibration against a small human-labeled set helped. [Beyond Consensus](https://arxiv.org/html/2510.11822v1) (2025-10-13).

**What it would change:** maintain a deliberately enriched set of plausible-but-wrong coordinator actions and claims. Track precision, recall, false-alarm rate, and high-finding yield separately; do not optimize aggregate agreement.

### 3. Test the judge and rubric for instability

RU-VERBENCH (2026-01-01) found substantial noise even in frontier judges; prompt variation mattered, and batching traded accuracy for efficiency. [RU-VERBENCH](https://doi.org/10.18653/2026.emnlp-main.2192) (2026-01-01). A separate 2026 audit found verdicts could change with repeated temperature-zero runs or candidate order, so consistency alone was not trustworthy. [All Verdicts are Not Equal](https://doi.org/10.48550/arxiv.2610.12083) (2026-10-08).

**What it would change:** periodically replay a calibration slice with randomized evidence order and duplicate rescoring. If the verdict is unstable, downgrade it or route it to a second, more expensive check instead of emitting a high.

### 4. Longer rubrics are not automatically better

“Evaluating the Evaluator” (2025-04-11) found that granular rubric instructions improved correlation with humans only modestly in aggregate—about 4% at most—and that non-LLM baselines sometimes aligned better for particular dimensions. [Evaluating the Evaluator](https://doi.org/10.1609/aaai.v39i18.34157) (2025-04-11).

**What it would change:** A/B-test each rubric criterion against a simpler baseline and keep only wording that improves the target metric. Treat rubric complexity as a cost and failure surface.

## Vector 2 — Incremental/delta review and caching

### 1. Persist a review ledger and send only new evidence

Ellipsis reports that production review agents re-process only files changed since the prior review and cache repository metadata, style guides, and common file contents, reducing token use by 40–50% on iterative PRs. [Ellipsis](https://www.ellipsis.dev/blog/lessons-from-building-llm-agents) (2025-01-30).

**What it would change:** store the last reviewed commit/base, file and ticket hashes, instruction-version hash, finding IDs, and finding states. Pass only new or changed commits, ticket edits, replies, and evidence; never resend a stable transcript chunk merely because another pause occurred.

### 2. Separate stable prefix from volatile suffix

OpenSWE's four-tier caching design separates tool definitions, static system instructions, dynamic context, and code-review context, and monitors cache hits and cost. [OpenSWE prompt-caching PR](https://github.com/langchain-ai/open-swe/pull/439) (2025-07-17; merged 2025-07-22). KVFlow (2025-07-10) likewise reports gains from workflow-aware retention of shared prefixes rather than ordinary recency-only eviction. [KVFlow](https://arxiv.org/html/2507.07400v1) (2025-07-10).

**What it would change:** order the auditor prompt from stable to volatile: rules and rubric → operator wishes and signed decisions → compact ledger → current delta → targeted evidence. Version and invalidate the cache whenever rules or wishes change.

### 3. Make incremental and full review explicit modes

CodeRabbit documents incremental review of commits added since its prior review, a “no changes to review” result, and a full-review escape hatch; it also pauses after a configurable number of commits to avoid redundant reviews. [CodeRabbit automatic review](https://docs.coderabbit.ai/configuration/auto-review) (documentation accessed 2026-11-11; page undated). Its local-review guidance warns that rebases, resets, amended history, or a moved base invalidate prior review state. [CodeRabbit local review](https://docs.coderabbit.ai/ide/review) (documentation accessed 2026-11-11; page undated).

**What it would change:** use immutable commit/content identities, detect history rewrites, and force a fresh review on invalidation. Otherwise, use delta review at each pause and schedule a full review after a configurable number of deltas or after cross-cutting changes.

### 4. Review changed scope while retrieving impact context

Greptile describes a pre-built graph of functions, imports, callers, dependencies, and related patterns so a changed file can be reviewed with targeted whole-codebase impact context. [Greptile graph-based context](https://www.greptile.com/docs/how-greptile-works/graph-based-codebase-context) (documentation accessed 2026-11-11; page undated).

**What it would change:** do not choose between “review the whole repository” and “ignore dependencies.” Review changed hunks, then retrieve only affected callers, referenced instructions, ticket links, and decision records from an indexed graph.

## Vector 3 — Verifying “done”, “fixed”, and “verified” claims

### 1. Treat completion language as an assertion, not evidence

“PASS Is a Claim, Not an Observation” mechanically re-verified 10 self-asserted code-fix claims (2026-10-24). Only 60% passed the claimed-file/identifier/call-site check; among sufficiently specified claims, half failed the claimed-location check. [PASS Is a Claim, Not an Observation](https://arxiv.org/abs/2610.35950) (2026-10-24).

**What it would change:** every “done/fixed/verified” claim must name the artifact, exact location or identifier, verification command/test, and resulting evidence. The auditor should independently check those—not merely judge the prose.

### 2. Distinguish implementation evidence from linkage evidence

A 2026 verification ledger separated VERIFIED by merged-PR linkage, VERIFIED-CODE by a targeted probe without PR linkage, NO-CODE-CHANGE, and UNVERIFIED. It explicitly warned that current capability does not prove which change shipped it. [Evidence Audit DR-915](https://github.com/CleanExpo/DR-NRPG/blob/main/docs/EVIDENCE_AUDIT_DR-915_LEDGER.md) (2026-07-17).

**What it would change:** replace binary done/not-done with evidence grades: `implemented+linked+tested`, `artifact-present but linkage missing`, `not applicable/administratively closed`, and `unverified`. Only the first should support an unqualified “done.”

### 3. Check the claimed path, not merely a nearby or semantically similar path

A 2026 verification ledger demonstrates the useful pattern of checking declared models against both ORM schema and production DDL, rather than trusting the ticket. [Evidence Audit DR-914](https://github.com/CleanExpo/DR-NRPG/blob/main/docs/DR-914-verification-ledger.md) (2026-07-17).

**What it would change:** require a path-and-pattern proof object: expected path, observed path, expected symbol/text, observed symbol/text, and command output. A proof that touches a different file or a similarly named identifier is a high-severity evidence failure.

### 4. Separate closure from sustained effectiveness

The U.S. Government Publishing Office OIG tested recommendations closed as far back as 2022 and checked whether corrective actions remained in use. [GPO OIG](https://www.gpo.gov/docs/default-source/inspector-general/oig-25-06-report-closedrecommendationtesting.pdf) (2025-03-17).

**What it would change:** for durable memory, policy, or process changes, add a later sampling check. “The coordinator edited the file” proves implementation, not that later runs still obey it.

## Vector 4 — Two reviewers: intent critic plus artifact auditor

### 1. Split the semantic question from the physical question

The DR-914 ledger explicitly cross-checked ticket intent against ORM schema and production DDL, verifying both that the requirement was right and that the artifacts existed. [DR-914](https://github.com/CleanExpo/DR-NRPG/blob/main/docs/DR-914-verification-ledger.md) (2026-07-17).

**What it would change:** let the adviser/intent critic ask “what should have happened?” and let the auditor ask “what actually changed and what evidence proves it?” Give the auditor the critic's compact intent digest, not the full duplicate context.

### 2. Independent reassessment is stronger than owner self-attestation

Security reassessments by Cure53 and Mandiant report a familiar control: the owner implements remediation, then an independent party retests it before closure. [Cure53/Psono](https://psono.com/blog/security-audit-2025) (2025-03-29); [Mandiant/3CX](https://www.3cx.com/blog/news/mandiant-security-report/) (2025-05-30).

**What it would change:** the coordinator may propose “fixed,” but only the artifact auditor can close the finding after rerunning the relevant test or inspecting the exact changed artifact.

### 3. Prevent reviewer overlap with explicit contracts

Anthropic's multi-agent research system says specialized workers need detailed objectives, output formats, source guidance, and boundaries to prevent duplication and gaps; it also reports that one rubric-based judge was more consistent than multiplying judges in its tests. [Anthropic multi-agent research](https://www.anthropic.com/research/multi-agent-research-system) (2025-06-13).

**What it would change:** define non-overlapping schemas: adviser outputs operator-intent deltas and expected outcomes; auditor outputs evidence-backed artifact discrepancies. Deduplicate by canonical claim/finding ID, not by wording. Add a second judge only when measured incremental recall justifies its token cost.

## Vector 5 — Cadence, triggering, and review fatigue

### 1. Keep the pause hook mandatory, but make the work conditional

Anthropic's guidance recommends ground truth from the environment, checkpoints or blockers for feedback, and explicit stopping conditions; it also warns of autonomy's cost and compounding-error risks. [Building effective AI agents](https://www.anthropic.com/research/building-effective-agents) (2024-12-19; **older than 2025**).

**What it would change:** invoke the auditor on every pause, but allow a cheap gate to return “no material delta” before loading the frontier model. The hook cannot be skipped; the expensive reasoning is conditional.

### 2. Trigger expensive review on risk, not merely elapsed time

Anthropic's 2025 multi-agent system scales effort by task complexity and reports that agents can continue after sufficient results or duplicate subagent work. [Anthropic multi-agent research](https://www.anthropic.com/research/multi-agent-research-system) (2025-06-13).

**What it would change:** assign delta risk points for instruction/memory edits, signed-decision edits, “done/fixed/verified” language, destructive commands, broad file scope, failed tests, and operator-facing claims. Run the full auditor when a threshold is crossed; otherwise run a small deterministic gate.

### 3. Use traces and macro metrics to decide where to spend review budget

OpenAI recommends traces for debugging model calls, tools, guardrails, and handoffs, then repeatable datasets and evaluation runs for regression measurement. [OpenAI agent evals](https://developers.openai.com/api/docs/guides/agent-evals) (2026 page accessed 2026-11-11). Google similarly separates final-response evaluation from trajectory evaluation—action order, precision, recall, and tool use. [Google Vertex agent evaluation](https://cloud.google.com/blog/products/ai-machine-learning/introducing-agent-evaluation-in-vertex-ai-gen-ai-evaluation-service) (2025-01-24).

**What it would change:** measure which event types produce real highs, and retune triggers from observed yield. Audit tool trajectory and evidence, not only the coordinator's final reply.

## Vector 6 — Output design and yield measurement

### 1. Make “no finding” a first-class, successful result

The incremental-review pattern explicitly returns “No changes to review” when nothing new exists. [CodeRabbit local review](https://docs.coderabbit.ai/ide/review) (documentation accessed 2026-11-11; page undated).

**What it would change:** require the auditor to return either `NO_MATERIAL_FINDING` or a short list of findings. Do not force a low-level observation merely to fill the output.

### 2. Enforce a severity floor and a small top-N

The judge literature shows weak negative discrimination and instability under difficult, ground-truth-poor cases. [Beyond Consensus](https://arxiv.org/html/2510.11822v1) (2025-10-13); [All Verdicts are Not Equal](https://doi.org/10.48550/arxiv.2610.12083) (2026-10-08).

**What it would change:** emit only high findings by default, or medium findings only when they include a concrete artifact, a violated rule/wish, and a plausible material consequence. Cap output at three findings, ordered by expected operator value; keep low observations in internal telemetry, not the coordinator's action queue.

### 3. Measure yield per run and per token

OpenAI's macro-evaluation guidance distinguishes individual trace diagnosis from population-level evaluation and recommends using aggregate patterns to decide where humans should inspect next. [OpenAI macro evals](https://developers.openai.com/cookbook/examples/partners/macro_evals_for_agentic_systems/macro_evals_for_agentic_systems) (2025).

**What it would change:** dashboard: high precision, acted-on rate, reopen rate, duplicate rate, median tokens per true high, false-alarm rate, time-to-action, and percentage of runs correctly returning no finding. Optimize for **acted-on true highs per 100k tokens**, not findings per run.

### 4. Use sequential escalation when false alarms are costly

E-valuator (2025-12-02) applies sequential hypothesis testing to black-box verifier scores, controlling false alarms over long trajectories and terminating problematic trajectories early. [E-valuator](https://doi.org/10.48550/arxiv.2512.03109) (2025-12-02).

**What it would change:** let a cheap first pass abstain; escalate only when evidence accumulates past a calibrated threshold. This is better suited to 20–45 daily audits than making every run do maximum-depth reasoning.

## Vector 7 — Anthropic, OpenAI, and Google guidance

### 1. Use subagents for focused context, then return a compact digest

Anthropic's context-engineering guidance (2025-09-29) describes specialized subagents with clean contexts that return condensed summaries, often around 1,000–2,000 tokens, rather than transferring all exploration to the lead agent. [Effective context engineering](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents) (2025-09-29).

**What it would change:** have the adviser emit a bounded intent digest and the auditor emit a bounded evidence ledger. Never pass the adviser’s full reasoning transcript into the auditor.

### 2. Evaluate both outcome and trajectory

Google ADK guidance (2025-04-09) supports evaluation of final response quality and step-by-step execution trajectory against test cases. [Google ADK](https://developers.googleblog.com/en/agent-development-kit-easy-to-build-multi-agent-applications/) (2025-04-09). OpenAI's AgentKit (2025-10-06) likewise emphasizes datasets, trace grading, automated graders, and human annotations. [OpenAI AgentKit](https://openai.com/index/introducing-agentkit/) (2025-10-06).

**What it would change:** test not only whether the coordinator's report sounds right, but whether it used the right evidence, touched the right files, respected handoffs, and stopped when the work was complete.

### 3. Prefer a simple verifier with explicit stopping rules

Anthropic recommends pairing an evaluation prompt with a verifiable response or outcome, using exact comparison where possible and a judge where necessary, while avoiding over-strict rejection of valid alternatives. [Writing effective tools for AI agents](https://www.anthropic.com/research/writing-tools-for-agents) (2025-09-11). Google describes generator/critic loops with specific failure feedback, quality gates, maximum iterations, and early exit. [Google ADK multi-agent patterns](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/) (2025-12-16).

**What it would change:** prefer deterministic checks for paths, hashes, tests, and ticket state; reserve semantic judgment for operator intent and materiality. Give every escalation a maximum evidence/tool budget and stop immediately on a decisive pass or fail.

## Five strongest borrows overall, ranked

1. **Persistent delta ledger plus stable-prefix caching.** This directly attacks your costliest failure mode—re-reading already reviewed material—while preserving a full-review escape hatch. Store immutable review identities, content hashes, finding lifecycle, instruction version, and invalidation reasons. [Ellipsis](https://www.ellipsis.dev/blog/lessons-from-building-llm-agents) (2025-01-30); [OpenSWE](https://github.com/langchain-ai/open-swe/pull/439) (2025-07-17).

2. **Evidence-first claim verification.** Make “done/fixed/verified” an untrusted claim requiring exact artifact/path/test evidence. This targets one of your proven high-yield catch classes and is amenable to cheap deterministic checks. [PASS Is a Claim, Not an Observation](https://arxiv.org/abs/2610.35950) (2026-10-24).

3. **Mandatory hook, conditional expensive audit.** Never let the coordinator skip the pause event; let a deterministic delta/risk gate decide whether the frontier model runs deeply. This preserves coverage while reducing no-op runs and review fatigue. [Building effective AI agents](https://www.anthropic.com/research/building-effective-agents) (2024-12-19; **older than 2025**); [Anthropic multi-agent research](https://www.anthropic.com/research/multi-agent-research-system) (2025-06-13).

4. **Two non-overlapping contracts: intent versus artifact.** Have the adviser state the expected intent and the auditor verify the concrete artifact; share only a compact intent digest and canonical claim IDs. [Anthropic multi-agent research](https://www.anthropic.com/research/multi-agent-research-system) (2025-06-13); [DR-914](https://github.com/CleanExpo/DR-NRPG/blob/main/docs/DR-914-verification-ledger.md) (2026-07-17).

5. **High-only, top-three, abstaining output with a yield dashboard.** Return no finding when the evidence is insufficient; emit only material, reproducible, actionable findings; optimize acted-on true highs per token, not raw finding volume. [Beyond Consensus](https://arxiv.org/html/2510.11822v1) (2025-10-13); [E-valuator](https://doi.org/10.48550/arxiv.2512.03109) (2025-12-02); [OpenAI macro evals](https://developers.openai.com/cookbook/examples/partners/macro_evals_for_agentic_systems/macro_evals_for_agentic_systems) (2025).

### Minimal operational contract

```text
Every pause: invoke auditor_hook(delta_manifest, risk_score, ledger_version).

If no new material delta: return NO_MATERIAL_FINDING.
Else:
  1. Check exact artifact claims deterministically.
  2. Retrieve only changed items plus targeted dependency/decision context.
  3. Judge intent fidelity, evidence validity, and rule violations separately.
  4. Emit at most 3 findings, only high or well-supported medium.
  5. Each finding must include: violated wish/rule, exact evidence, consequence,
     confidence, owner action, and deduplication key.
  6. If evidence is insufficient: abstain or request a targeted check; do not guess.

Force full review after rebase/history rewrite, instruction or signed-decision edits,
large/cross-cutting deltas, and on a periodic backstop. Measure true highs and acted-on
rate per token; demote or delete rules that produce repeated unacted findings.
```
