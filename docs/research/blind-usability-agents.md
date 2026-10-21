---
dies-when: FRM-407 lands and its test drive has a verdict
---

Ticket: FRM-407

# fresh-eyes: prior art (2026-10-21)

## Answer

- **Build, but small, and borrow two pieces.** I found no tool that does "url + 1–3 goals → where does a newcomer get lost". Two things are worth reusing: agent-browser's own `dogfood` skill (report shape, screenshot discipline, severity scale) and agent-browser's `--action-policy` / `--allowed-domains` flags (the sandbox).
- The `tools:` field on a subagent can't hold `Bash(agent-browser:*)` as a restriction. The docs only say that a specifier removes the whole tool in `disallowedTools`. Real enforcement needs a PreToolUse hook that checks `agent_type`.
- Research consistently finds that synthetic users drift from real ones, and persona prompts don't fix it. Use the stuck list as a cheap screen, not as evidence about real users.

## 1. Prior art

| Thing | What it is | Newcomer prompting | Output | Agreement with humans | Source (date) |
|---|---|---|---|---|---|
| agent-browser `dogfood` skill | Ships in the agent-browser CLI (`agent-browser skills get dogfood`). Exploratory QA bug hunt on a URL | None. It says "Never read the target app's source code… testing as a user" (prompt only, no enforcement). It also tells the agent to read `errors`/`console`, which a newcomer never sees | report.md with ISSUE blocks, step screenshots, repro video, severity critical/high/medium/low | none measured | [SKILL.md @fd93075](https://github.com/vercel-labs/agent-browser/blob/fd93075e55a21a47fcb36d7433361daa867a0580/skill-data/dogfood/SKILL.md) L1-5, L207; [issue-taxonomy.md](https://github.com/vercel-labs/agent-browser/blob/fd93075e55a21a47fcb36d7433361daa867a0580/skill-data/dogfood/references/issue-taxonomy.md) L11-18 (commit 2026-10-20) |
| UXAgent (Northeastern/Amazon) | Generates personas, runs LLM agents on a live site through a "Universal Browser Connector" | Persona generator from a demographic distribution. Agent has a fast loop (perceive/plan/act) and a slow loop (reflect, "wonder" mind-drift) over a memory stream. No explicit "act as a newcomer" instruction | action trace, reasoning trace, post-study survey, agent interviews, video | **none**. 16 UX researchers rated it; trust in data M≈0.6, "LLM can replace humans" M=−0.57. A comparison with real users is listed as a limitation | [arXiv 2504.09407 v3](https://arxiv.org/html/2504.09407v3) (v3 2025-09-19); repo [neuhai/UXAgent](https://github.com/neuhai/UXAgent), MIT per README badge, 118★, last commit 4d3b1f1 2025-11-05 |
| AgentA/B | 1,000 persona agents running an A/B test on live Amazon | personas | behavior metrics | Agents averaged 6.05 actions per session vs 15.96 for humans, 1.4 vs 6.4 searches, 1.9 vs 7.0 product clicks. Paper: "agents followed more goal-directed trajectories with fewer actions". Code "upon acceptance" | [arXiv 2504.09723](https://arxiv.org/html/2504.09723) (v1 2025-04-13, v4 2026-03-10) |
| AMUSER | Multimodal user simulation → ranked UX recommendations on commercial sites | ? | prioritized recommendations | Scored against expert annotation and LLM-judge: NDCG@3 0.758 vs 0.359 for text-only, at 89% lower cost. No comparison with a real-user study. No code | [arXiv 2609.22971](https://arxiv.org/abs/2609.22971) (2026-09-19) |
| PerceptUI | Fine-tuned persona model that answers survey questions about UI screenshots (not live tasks) | persona-conditioned plus reflection fine-tuning | answer distributions | claims "human-level realism"; no numbers on the abstract page; no code found | [arXiv 2606.05697](https://arxiv.org/abs/2606.05697) (2026-06-04) |
| Loop11 AI browser agents (commercial) | Agents run the same tasks as a human panel | ? | completion, lostness, SUS | Vendor's own study: agents completed 0–25% of tasks vs 62–95% for humans (project 1) and 5–21% vs 73–87% (project 2). "not yet capable of replacing human testers" | [loop11.com](https://www.loop11.com/ai-vs-human-usability-testing-a-comparative-analysis-using-loop11/) (2025-03-04; vendor claim, older models) |
| Brox.ai, Versive, Synthetic Users Inc. (commercial) | AI-persona site testing; Versive added a SUS score for synthetic users | ? | ? | only secondary roundups found, no measurements opened | [getversive.com](https://getversive.com/help/best-ai-user-research-tools), [aimultiple](https://aimultiple.com/synthetic-users) (2026, not opened) ? |

## 2. Failure modes

- **Too smart / too direct.** Agents take straight paths and explore less: 6 actions vs 16, about 4x fewer searches (AgentA/B, 2026-03). In conversation tasks, simulated users are "excessively cooperative", which creates an "easy mode" that pushes success above the human baseline. Simulated users also give uniformly more positive feedback ([Sim2Real, arXiv 2603.11245](https://arxiv.org/abs/2603.11245), 2026-03-11, COLM 2026). Simulators also misjudge task difficulty ([Lost in Simulation, arXiv 2601.17087](https://arxiv.org/html/2601.17087v1), ACL 2026, from search snippet only ?).
- **Stuck where humans aren't.** Loop11 agents failed most tasks that humans completed (2025-03, vendor). A Hawaii thesis reports agents "often fail to recognize task completion" and wander beyond the goal ([scholarspace](https://scholarspace.manoa.hawaii.edu/server/api/core/bitstreams/5b5d5e9a-62e4-4d0d-bf7b-7106f08a318e/content), search snippet only ?). UXAgent participants: "Some behaviors are abnormal—not what real users would do" (2504.09407).
- **The two sources disagree on direction.** AgentA/B (2026) shows agents more efficient than humans. Loop11 (2025) shows agents far worse. Inference: this depends on the model, the harness and the site (placeholder prototypes vs Amazon). So expect both false positives and misses.
- **Persona prompts don't fix it.** On 12 first-click tests (n=3,431 humans), GPT's click distributions differed significantly in 53% of tasks. Personas, chain-of-thought and sampling settings "did not meaningfully improve fidelity" and mainly made the outputs look more believable ([arXiv 2605.18302](https://arxiv.org/abs/2605.18302), 2026-05-18). PerceptUI only gets alignment by fine-tuning, not by prompting (2026-06).
- **Severity inflation.** In a GenderMag study, agents rated issues as more severe than humans did. There was broad overlap on non-gender issues; humans found more "Expectation" issues, agents more "Not seen" ([ACM 10.1145/3801978](https://doi.org/10.1145/3801978); dl.acm.org returned 403, so this is from the search snippet only ?).
- Inference for fresh-eyes: (a) list each stuck point with the agent's own expectation, so a human can reject the false ones; (b) don't trust the agent's severity labels as is; (c) consider a step or retry budget per goal ("gave up after N tries" is a real signal). A memory-poor or "skim" persona has no evidence that it helps ?.

## 3. Restricting a Claude Code subagent (docs fetched 2026-10-21)

- `tools` field: "Tools the subagent can use, as a comma-separated string such as `Read, Grep, Bash` or a YAML list" ([sub-agents#supported-frontmatter-fields](https://code.claude.com/docs/en/sub-agents), table row `tools`).
- `disallowedTools`: "An entry with a specifier, such as `Bash(git push *)`, still removes the whole tool from the subagent, not only the matching commands. To keep Bash and block specific commands, add a Bash deny rule … to `permissions.deny` in your settings. The rule applies to the main conversation and to subagents." ([sub-agents#restrict-which-tools-a-subagent-can-use](https://code.claude.com/docs/en/sub-agents#restrict-which-tools-a-subagent-can-use))
- **The docs say nothing about a specifier like `Bash(agent-browser:*)` inside `tools`.** The only parenthesized form they document for `tools` is `Agent(type)`, and that is "ignored" in a subagent definition (it applies only with `claude --agent`). Inference: `tools: Bash(agent-browser:*)` would at best grant all of Bash, not limit it. Verify with a dry run ?
- Permission rules (`permissions.allow/deny`) apply to the whole session and can't be scoped to one subagent (docs: plugin agents note, "these rules apply to the entire session, not only the plugin subagent").
- **Plugin subagents ignore the `hooks`, `mcpServers` and `permissionMode` frontmatter.** The docs tell plugin authors to ship hooks in the plugin's `hooks/hooks.json` instead, where they "apply whenever the plugin is enabled" (sub-agents, plugin scope note).
- **Hooks can see which agent made the call.** "When a subagent calls a tool, tool events such as `PreToolUse` and `PostToolUse` fire … and the input carries the `agent_id` and `agent_type` common input fields" ([hooks](https://code.claude.com/docs/en/hooks), common input fields). `agent_type` is the frontmatter name, or `plugin:name` for plugin agents. A hook returns `permissionDecision: "deny"` to block a call.
- Workable design (inference): set `tools: Bash` (plus Write only if the stuck list is written to disk). Add a plugin `hooks.json` PreToolUse hook on `Bash|Read|Grep|Glob|...`. When `agent_type == "<plugin>:fresh-eyes"`, deny anything that isn't a single `agent-browser …` command with no `;`, `&&`, `|`, `$(` or redirects. Frontmatter hooks would also work for a non-plugin agent in `~/.claude/agents/`.

## 4. Restricting agent-browser itself (code @fd93075, 2026-10-20)

- No single "read-only mode". The relevant opt-in controls ([README L870-889](https://github.com/vercel-labs/agent-browser/blob/fd93075e55a21a47fcb36d7433361daa867a0580/README.md); [security.mdx L221-268](https://github.com/vercel-labs/agent-browser/blob/fd93075e55a21a47fcb36d7433361daa867a0580/docs/content/docs/security.mdx)):
  - `--action-policy policy.json` (or `AGENT_BROWSER_ACTION_POLICY`): `default` allow/deny plus `allow`/`deny`/`confirm` lists of categories, enforced by the daemon (struct in `cli/src/native/policy.rs` L20-31). Categories: navigate, click, fill, eval, download, upload, snapshot (includes screenshot/pdf), scroll, wait, read, get, interact, network, state.
  - `--allowed-domains` restricts navigation and subresources to the listed domains. It also rejects CDP, profiles and state replay.
  - `--allow-file-access` (lets file:// pages read other files) is off by default.
  - `--content-boundaries`, `--max-output`.
- Suggested policy (inference): `{"default":"deny","allow":["navigate","click","fill","scroll","wait","snapshot","get","interact"]}`. That blocks eval, upload (reads local files), download, state (reads/writes files) and network. Add `--allowed-domains <target host>`.
- Not verified: whether `--allowed-domains` blocks `open file:///…` at the top level ?. Whether `screenshot <path>` can write anywhere on disk; the path is caller-chosen, so assume yes ?.

## Build-or-reuse call

- **Reuse:** agent-browser (driver plus action policy) and the dogfood report shape and severity scale.
- **Build:** the goal-driven newcomer card, which none of the found tools do. It needs: goals in, a stuck list out with an "expected vs saw" field, no console/errors access (a newcomer can't see them), and a hook that enforces the no-code rule. UXAgent's persona and memory machinery is not worth adopting: it's Python, its last commit was 2025-11, and it shows no measured gain over a plain prompt.

## Searched with no find

- Any open-source Claude Code subagent or plugin for "first-time user" testing. Searched GitHub for "usability testing llm agent" and "synthetic users browser agent ux": 0 hits.
- Agreement numbers from a live-task human study for UXAgent, PerceptUI and AMUSER: none on the pages I opened.

<!-- end -->
