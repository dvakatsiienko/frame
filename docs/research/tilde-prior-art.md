---
dies-when: its findings are distilled into x:crew-tilde and FRM-368, or the tilde trial is dropped
---

# tilde research — prior art, the source lane of the 2026-11-04 run

Ticket: FRM-368

Read 2026-11-04. Tilde = the per-lane coordinator in `focus.md`.

**Headline.** The sources back the layer for one reason only: it keeps lane traffic out of the main agent. They do not promise better code, and they put its cost well above the trial's 30 % line. The five events hold up. Three things do not: tilde as a relay, tilde with no disk state, and watching that lives only in model turns.

**How far to trust this file**
- `verified` = I checked the text against the raw page or the code. Other quotes from web pages came through a fetch summarizer, so the wording may be off by a little «?».
- `inference` = my reasoning, not the source's claim.
- Issue threads are user reports, not vendor statements. Some were written by an agent.
- `Piebald` = Claude Code prompts extracted from the binary by a third party, [commit 8b74d896, 2026-10-14](https://github.com/Piebald-AI/claude-code-system-prompts/commit/8b74d89610820202ec89dbd948dbbd17318928ce). I did not check them against the binary «?».
- `gastown` code = [sha 466aa41c](https://github.com/gastownhall/gastown/tree/466aa41c83ee73b1fa0eb79eb9d172fb1eca9476). `autogen` code = [sha d07c667a, 2026-10-28](https://github.com/microsoft/autogen/tree/d07c667a3239ea4ab7af62a53b0f4ff205a1f23d).
- Undated docs pages are dated by the read, 2026-11-04.

---

## 1. What stays out

**Findings**
- **A prompt rule does not hold.** Gastown: «"Witness doesn't implement" is enforced by CLAUDE.md instructions. Agents can and do violate this under pressure.» The fix it wants: «the constraint is in the machinery, not in the instructions.» ([witness-at-team-lead.md](https://github.com/gastownhall/gastown/blob/466aa41c83ee73b1fa0eb79eb9d172fb1eca9476/docs/design/witness-at-team-lead.md), 2026-02-08, marked not implemented, `verified`)
- **CrewAI enforces this in code.** A manager with non-delegation tools raises `Exception("Manager agent should not have tools")`. ([crew.py `_create_manager_agent`](https://github.com/crewAIInc/crewAI/blob/main/lib/crewai/src/crewai/crew.py), main, 2026-11-04, `verified`)
- **Claude Code's own lead drifts.** «Sometimes the lead starts implementing tasks itself instead of waiting for teammates.» «The lead can stop early too.» ([agent-teams](https://code.claude.com/docs/en/agent-teams.md), 2026-11-04, `verified`)
- **Too many roles on one agent failed.** Cursor's continuous executor was «given too many roles and objectives simultaneously», and doing work itself is listed among its pathologies. The root planner «does no coding itself». ([self-driving-codebases](https://cursor.com/blog/self-driving-codebases), 2026-02-05)
- **Gastown's never-do list for its per-rig coordinator**: «Write code or fix bugs», «Spawn polecats (Mayor/Deacon does that)», «Close issues for work you didn't do», «Skip mol steps or hallucinate completion». ([witness.md.tmpl:69-74](https://github.com/gastownhall/gastown/blob/466aa41c83ee73b1fa0eb79eb9d172fb1eca9476/internal/templates/roles/witness.md.tmpl), `verified`)
- **Reading code is also contested as coordinator work.**
  - Against: «Every file you read, every function you trace, every test you run burns context». Anti-pattern: «Reading code "to understand the issue"». ([mayor.md.tmpl:70-74](https://github.com/gastownhall/gastown/blob/466aa41c83ee73b1fa0eb79eb9d172fb1eca9476/internal/templates/roles/mayor.md.tmpl), `verified`)
  - For: «you must understand them before directing follow-up work» and «check the actual diff before relaying success to the user». ([Piebald, coordinator mode](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/system-prompt-coordinator-mode-orchestration.md), ccVersion 2.1.299, `verified` against the extract)
- **Planner apart from coordinator: mature setups split three ways.**
  - Magentic-One's orchestrator does both. It holds facts and a plan, and re-plans after stalls. ([_magentic_one_orchestrator.py:394-405](https://github.com/microsoft/autogen/blob/d07c667a3239ea4ab7af62a53b0f4ff205a1f23d/python/packages/autogen-agentchat/src/autogen_agentchat/teams/_group_chat/_magentic_one/_magentic_one_orchestrator.py), `verified`)
  - Gastown splits them: the Mayor files and slings, the Witness only watches. (same templates)
  - Anthropic's harness keeps a planner, a generator and an evaluator, with «sprint contracts» agreed between generator and evaluator. ([harness design](https://www.anthropic.com/engineering/harness-design-long-running-apps), 2026-03-24)
- **Prescription backfires.** «Managers trained on small-scoped delegation default to being overly prescriptive, which backfires when the manager lacks deep codebase context.» ([Cognition](https://cognition.com/blog/multi-agents-working), 2026-04-22, `verified`)
- **Plan approval is automatic by default in Claude Code.** «Claude Code approves the plan as soon as the request arrives, without the lead reviewing it.» ([agent-teams](https://code.claude.com/docs/en/agent-teams.md), 2026-11-04, `verified`)
- **Writes stay with one owner.** «multi-agent systems work best today when writes stay single-threaded». (Cognition, 2026-04-22, `verified`)

**Against the design**
- Right: no code, no tracker bodies, no change to the want or exit lines, main keeps the merge.
- Wrong: «writes no code» as a prompt rule alone.
- Contested: «starts the coder and verifier». Witness refuses that, while Claude Code's coordinator and team lead do it.
- Contested: «checks the spec against the code» and «greenlights the plan». Sources disagree. Plan review is where the design most risks a coordinator judging code it has not read deeply (inference).

**One change.** Give tilde a tool allowlist and a PreToolUse deny hook: no Edit, no Write outside its lane file, no merge, no tracker write. Narrow «greenlight» to one check: does each exit line map to a plan step? Send the spec-against-code read to a subagent or the verifier, so the file reads never enter tilde's context. (inference, built on the sources above)

---

## 2. Two levels against flat

**Numbers**

| Source | Number | Note |
|---|---|---|
| [Google et al., scaling agent systems](https://arxiv.org/abs/2512.08296), v3 2026-04-08 | Messages per task over single-agent: centralized +285 %, hybrid +515 %, independent +58 % | `verified`. It counts messages, not tokens |
| same | Turns: single 7.2, centralized 27.7 (3.8×), hybrid 44.3 (6.2×) | `verified` |
| same | Success per 1K tokens: single 67.7, centralized 21.5, hybrid 13.6 | 260 configurations, 6 benchmarks |
| same | Centralized against single: finance +80.8 %, PlanCraft (sequential) −50.3 %, SWE-bench Verified −3.1 %, BrowseComp +0.2 % | Coding comes out about flat |
| same | Turns fit `T = 2.72 × (n + 0.5)^1.724`. «prohibitively thin beyond 3–4 agents» | `verified` |
| same | Trace-level error amplification: centralized 4.4, independent 17.2 | `verified`. In favour of a central checker |
| [Anthropic, when to use](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them), 2026-01-23 | «3-10x more tokens». Some teams «spent more tokens coordinating than executing» | Vendor |
| [Anthropic research system](https://www.anthropic.com/engineering/built-multi-agent-research-system), 2025-06-13 | About 15× a chat turn. Opus lead over Sonnet workers beat single Opus by 90.2 % | Vendor, parallel research task |
| [Anthropic harness](https://www.anthropic.com/engineering/harness-design-long-running-apps), 2026-03-24 | Solo 20 min, $9. Full harness 6 h, $200 | One app, Opus 4.5 |
| [Claude Code costs](https://code.claude.com/docs/en/costs.md), 2026-11-04 | Teams about 7× «when teammates run in plan mode» | `verified`. Gastown's spike also says ~7× per teammate (2026-02-08) |
| [SupervisorAgent](https://arxiv.org/abs/2510.26585), v2 2026-03-02 | Supervisor is 15.45 % of tokens, net saving 29.68 %, latency +37.27 % (under 1.5 min per task), pass@1 unchanged at 50.91 % | `verified`. Fires only on an LLM-free filter. Not a lane setup |
| [LangChain benchmark](https://www.langchain.com/blog/benchmarking-multi-agent-architectures), 2025-06-10 | Supervisor uses more tokens than swarm in every case and scores slightly lower. Single-agent score falls sharply at 2+ distractor domains while supervisor and swarm tokens stay flat | gpt-4o, 100 τ-bench examples, chart values not in text |
| [Cursor](https://cursor.com/blog/self-driving-codebases), 2026-02-05 | «20 agents would slow to the throughput of 1-3» on self-coordination. Integrator: «an obvious bottleneck» | Hundreds of workers, not one lane |

**When a supervisor loses**
- Sequential tasks (PlanCraft −50.3 %).
- Tool-heavy tasks (hybrid collapses to 0.21 on Workbench).
- Strong single-agent baselines: «diminishing returns». (all Google, v3 2026-04-08)
- Outside three cases, «the coordination costs typically exceed the benefits». The three: context pollution, parallel work, specialization. (Anthropic, 2026-01-23)

**Against the design**
- Right on purpose: context pollution is Anthropic's first named case, and LangChain's flat tokens under load fit it.
- Silent on quality: a lane is sequential (spec, code, verify). Expect no quality gain and possibly a small loss (inference from −3.1 % and −50.3 %).
- Probably wrong on the kill line. The turns fit gives 23.6 turns at n=3 and 36.4 at n=4, which is +54 % (inference; the fit comes from small fixed-budget benchmarks, not long-lived sessions). Nothing supports a coordinator staying under +30 % except SupervisorAgent's 15.45 %, and that one wakes only on a trigger.
- `open`: no source measures adding one coordinator per lane above an existing two-worker crew. There is no direct number for this design.

**One change.** Measure the kill line per lane with a baseline, and wake tilde only on a trigger. Each idle wake is costly: a cross-session message starts a new turn «sending your full context each time» ([costs](https://code.claude.com/docs/en/costs.md), 2026-11-04, `verified`).

---

## 3. Escalation filters

**What swallows a real ask**
- **Paraphrase.** LangChain blames «the "translation" the supervisor is doing», and compares it to telephone. (2025-06-10)
- **Compaction.** It «preserves "what was decided" but loses "what's still pending"». ([claude-code#44778](https://github.com/anthropics/claude-code/issues/44778), opened 2026-04-07, open on 2026-11-04, `verified`, user report)
- **The transport itself.**
  - A send returned success, the message was never delivered, and the session sat idle for 11.3 hours. «The message queue lives only in memory.» ([#78338](https://github.com/anthropics/claude-code/issues/78338), 2026-07-17, closed; which version fixes it «?»)
  - The teammate-to-lead direction was silently dropped too. ([#43706](https://github.com/anthropics/claude-code/issues/43706), 2026-04-05, closed)
- **Workers do not ask.**
  - Upward messages do not «happen by default». (Cognition, 2026-04-22, `verified`)
  - Claude Code's worker prompt says «If the task is ambiguous, pick the most likely interpretation and note your assumption». ([Piebald, worker instructions](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/agent-prompt-coordinator-worker-instructions.md), ccVersion 2.1.271, `verified` against the extract)
- **Failure rates.** [MAST](https://arxiv.org/abs/2503.13657) (v3 2025-10-26, 1,600+ traces, kappa 0.88): fail to ask for clarification 6.80 %, information withholding 0.85 %, ignored input 1.90 %, no or incomplete verification 8.20 %, incorrect verification 9.10 %, premature termination 6.20 %. A false «ready» looks more common than a withheld ask (inference, different domain).

**What forwards too much**
- Agents «distracting each other with excessive updates». (Anthropic, 2025-06-13)
- Prompt fatigue: users accept 93 % of manual prompts. ([auto mode](https://www.anthropic.com/engineering/claude-code-auto-mode), 2026-03-25)

**The opposite danger: a push read as the operator's word**
- In #44778, a system event arriving while the model waited for the user produced a fabricated «go ahead and merge» (near-miss PR merge) and «fix them both» (unauthorized edit). CLAUDE.md rules against it were violated too. (2026-04-07, `verified`, user report)
- The docs say otherwise for one narrower thing: a message from another session «can't approve anything» on a permission prompt. ([cross-session messaging](https://code.claude.com/docs/en/cross-session-messaging.md), 2026-11-04, `verified`) Both stand: that rule guards the prompt, not the model's own reading of the conversation (inference).

**What measurably fixed it**
- `forward_message` plus removing handoff messages from worker state: «nearly 50%» better on the benchmark. (LangChain, 2025-06-10; tool in [langgraph-supervisor README](https://github.com/langchain-ai/langgraph-supervisor-py), read 2026-11-04)
- A two-stage filter drops false alarms from 8.5 % to 0.4 %. **The price: misses on real overeager actions rise from 6.6 % to 17 %.** (auto mode, 2026-03-25) A tighter filter trades noise for swallowed cases, and this is the only measured curve I found.
- That classifier never sees the agent's narration: «We strip assistant text so the agent can't talk the classifier into making a bad call.» (same)
- An LLM-free trigger filter: 29.68 % fewer tokens, pass@1 held. (SupervisorAgent, v2 2026-03-02, `verified`)
- `open`: no source measures a fix for a real ask swallowed in a hierarchy. The closest structures are unmeasured:
  - Gastown routes «bead» first and always, then mail. Its defaults are `stale_threshold: 4h` and `max_reescalations: 2`, with an `acknowledged` label. ([escalation.md](https://github.com/gastownhall/gastown/blob/466aa41c83ee73b1fa0eb79eb9d172fb1eca9476/docs/design/escalation.md), `verified`)
  - Gastown's test for mail against a nudge: «If the recipient dies and restarts, do they need this message?» ([witness.md.tmpl:209](https://github.com/gastownhall/gastown/blob/466aa41c83ee73b1fa0eb79eb9d172fb1eca9476/internal/templates/roles/witness.md.tmpl), `verified`)
  - Its unbuilt category table sends `emergency` straight to the human, past all tiers. (escalation.md)
  - Claude Code tells a coordinator to «quote their exact words» when passing approval on. A reply to a coordinator's option list approves nothing. (Piebald, [coordinator mode](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/system-prompt-coordinator-mode-orchestration.md) and [reply consent](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/system-prompt-project-coordinator-reply-consent.md), ccVersion 2.1.299)

**Against the design**
- The five events are a closed list, which fits the sources.
- Wrong: a push has no durable copy and no acknowledgement, so the kill line «one lost ask» cannot be detected at all (inference).
- Silent: urgent cases that should bypass tilde, and worker assumptions made instead of asks.

**One change.** Every push is first a line in the lane file: `id, event, verbatim text or path, ack: none`. Main writes the ack. A script re-pings an unacked line once, then raises it to the operator. Tilde forwards worker words verbatim and adds only its own one-line routing note. Workers log each assumption to the same file, so main can audit asks that never got asked. Any merge needs the operator's quoted words or a standing rule, never a turn that follows a ping.

---

## 4. State and recovery

**What survives compaction** ([context-window](https://code.claude.com/docs/en/context-window.md), 2026-11-04, `verified`)
- Re-injected from disk: root CLAUDE.md, auto memory, the plan-mode plan.
- Skill bodies come back capped at 5,000 tokens each and 25,000 in total, oldest dropped first.
- `SessionStart` hooks matching `compact` run and add their output.
- Up to five recent files are re-read. A file over 5,000 tokens comes back as a path only.
- Path-scoped rules are summarized away.
- «compaction isn't sufficient». ([effective harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), 2025-11-26)

**How long-lived coordinators recover**
- Durable log outside the harness: «nothing in the harness needs to survive a crash», recovered by `wake(sessionId)`. ([managed agents](https://www.anthropic.com/engineering/managed-agents), 2026-04-08)
- Gastown:
  - «Run `gt prime` after compaction, clear, or new session.»
  - «next session discovers state from beads».
  - Boot is «always fresh - no persistent state between invocations». ([witness.md.tmpl](https://github.com/gastownhall/gastown/blob/466aa41c83ee73b1fa0eb79eb9d172fb1eca9476/internal/templates/roles/witness.md.tmpl), [mol-boot-triage](https://github.com/gastownhall/gastown/blob/466aa41c83ee73b1fa0eb79eb9d172fb1eca9476/internal/formula/formulas/mol-boot-triage.formula.toml), `verified`)
- OpenAI Symphony: restart recovery is «tracker-driven and filesystem-driven», and retry timers and live worker state do not survive. ([SPEC.md §7, §14.3](https://github.com/openai/symphony/blob/main/SPEC.md), main, 2026-11-04, `verified`)
- Magentic-One saved state is exactly `facts, plan, n_rounds, n_stalls`. ([orchestrator:230-233](https://github.com/microsoft/autogen/blob/d07c667a3239ea4ab7af62a53b0f4ff205a1f23d/python/packages/autogen-agentchat/src/autogen_agentchat/teams/_group_chat/_magentic_one/_magentic_one_orchestrator.py), `verified`)
- Anthropic harness: progress file plus JSON feature list plus git. JSON because the model «is less likely to inappropriately change or overwrite» it. (2025-11-26)
- Cursor: «`scratchpad.md` should be frequently rewritten versus being appended to». (2026-02-05)

**What must never live only in context or transport**
- Pending asks and authorization state (#44778, 2026-04-07).
- Mid-turn messages. They «are never written to the agent's transcript», and the queue dies with the process (#78338, 2026-07-17; fix state «?»).
- Round counters (inference from the Magentic state above).
- Team membership: `/resume` does «not restore in-process teammates», and the lead may then message teammates that no longer exist. ([agent-teams limits](https://code.claude.com/docs/en/agent-teams.md), 2026-11-04, `verified`). Separate sessions, as tilde plans, avoid this. Background session state «persists on disk» with a supervisor process. ([agent-view](https://code.claude.com/docs/en/agent-view.md), 2026-11-04, `verified`)

**Cost of compacting**
- Warm compaction is cheap. Cold compaction reprocesses the history uncached. ([prompt-caching](https://code.claude.com/docs/en/prompt-caching.md), 2026-11-04, `verified`)
- Main-conversation TTL is 1 hour on a subscription and 5 minutes on API or credits. (same)
- A long-idle tilde can also compact while idle, unless `idleCompaction` is false. (same)

**Against the design**
- Wrong: «tilde writes no memory» with no other state store. As written, the three-round count and open asks live in context.
- Right: spec on disk, separate sessions, main keeps the tracker.

**One change.** Add one exception: tilde owns one lane file, and nothing else.
- Fields: spec path and sha, phase, review round, coder and verifier session ids, open pushes with ack state, last relay.
- Keep it short and rewritten, not a growing log. Keep the push lines as the only append part.
- A `SessionStart` hook on `compact` and `resume` prints it, so tilde can be killed and restarted from disk at any time.
- Test it in the trial by killing tilde once mid-lane.

---

## 5. The seat

**Findings**
- **Mechanical patrol decisions show no tier gap.** [gt-model-eval](https://github.com/gastownhall/gastown/tree/466aa41c83ee73b1fa0eb79eb9d172fb1eca9476/gt-model-eval), [run of 2026-02-16](https://github.com/gastownhall/gastown/discussions/1542) (91 tests, one reporter, `verified`):
  - Haiku 4.5: 82 passed (90 %), $0.001 per test.
  - Sonnet 4.5: 81 passed (89 %), $0.003 per test.
  - Opus 4.6: 83 passed (91 %), $0.006 per test.
  - Latency in that run is cached and useless.
  - On the 12 no-hints reasoning tests: Haiku 7, Sonnet 7, Opus 6 by my count. All are weak, so tests and prompts matter before tier does (inference).
  - Edge misses: Haiku and Sonnet on «Nudge-worthy: idle 20min». Haiku on «mass death». Sonnet and Haiku on a branch deleted before merge.
- **Community mix, not measured**: opus for polecats and crew, sonnet for witness, refinery and mayor, haiku for deacon. ([issue #1545](https://github.com/gastownhall/gastown/issues/1545), 2026-02-16, `verified`)
- **Vendor default**: «Use Sonnet for teammates. It balances capability and cost for coordination tasks.» ([costs](https://code.claude.com/docs/en/costs.md), 2026-11-04, `verified`)
- **Vendor's cheap seats in the product**:
  - Agent-view row summaries use a Haiku-class model. ([agent-view](https://code.claude.com/docs/en/agent-view.md), 2026-11-04)
  - `/goal` sends each check to your «small fast model» as a separate evaluator. ([goal](https://code.claude.com/docs/en/goal.md), 2026-11-04)
  - The auto-mode classifier runs on Sonnet 4.6. (2026-03-25)
- **Heavy tiers trip the stall watchdog.** Stalls at the 600 s limit on one machine: fable 10.2 % (5/49), opus 2.5 % (4/158), sonnet 0 % (0/114), haiku 0 % (0/4). ([#85265](https://github.com/anthropics/claude-code/issues/85265), 2026-08-09, `verified`, one user, subagents only)
- **Weaker over stronger.**
  - Direct evidence on coding coordinators: `open`.
  - Nearest: [Scaling Laws for Oversight](https://arxiv.org/abs/2504.18530) (v3 2025-10-27) at a 400 Elo gap gets 13.5 % Mafia, 51.7 % Debate, 10.0 % Backdoor Code, 9.4 % Wargames. These are adversarial games. Tilde reads an honest coder, so the numbers set a worst case and do not carry over (inference).
  - The working pattern runs the other way: cheap executor with a strong advisor. Sonnet plus Opus advisor gains 2.7 points on SWE-bench at 11.9 % less cost. Haiku plus Opus scores 41.2 % against 19.7 % on BrowseComp. ([advisor strategy](https://claude.com/blog/the-advisor-strategy), 2026-04-09, vendor)
  - Cognition: «A clean-context reviewer catches bugs the coder can't see. A frontier-level smart friend catches subtleties a weaker primary» misses. (2026-04-22, `verified`, sentence cut in my read)
  - No source supports a cheap model approving a stronger coder's design. Claude Code's lead sits on the session's model, not a cheaper one. (agent-teams, 2026-11-04)
- **A script can hold the plan.** Dynamic workflows: «A script holds the plan instead of Claude's turn-by-turn judgment». ([agents](https://code.claude.com/docs/en/agents.md), 2026-11-04, `verified`). The trigger-only supervisor of §2 is the measured version.

**Which rounds need a model** (all inference; the sources above support the split in general, not row by row)

| Round | Seat |
|---|---|
| Spawn coder and verifier from a template | script |
| Wait, notice worker done or failed, stall timer | script |
| Count review rounds, fire the three-round stop | script |
| Exit-line coverage in the plan, spec path and sha match | script or small fast model |
| Classify a worker message into the five events or «spec answers it» | small fast model, escalating when unsure |
| Solve a blocker the spec answers | Sonnet-class tilde |
| Decide a dispute settles or goes up | Sonnet-class tilde |
| Spec against code, plan quality | not tilde: verifier or a subagent |

**Against the design**
- Silent on tier.
- Right: a mechanical coordinator should not sit on the top tier.
- Risk: a Haiku tilde with «greenlights the plan» in scope, which no source supports.

**One change.** Start at Sonnet, with effort held low. Run a copy of `gt-model-eval`'s harness against 30 real tilde decisions from the trial before going to Haiku. Ask a strong advisor only on a dispute.

---

## 6. Watching

**Events that cost no polling** (all 2026-11-04, `verified`)
- [`notify_when_idle`](https://code.claude.com/docs/en/cross-session-messaging.md): subscribes «without starting a turn or spending tokens in the watched session».
  - One notice per subscription; it drops after 12 hours.
  - «Only the Claude in your main conversation can subscribe», on this machine only.
  - It costs a turn in the asking session when delivered.
- [Hooks](https://code.claude.com/docs/en/hooks.md): `Stop`, `StopFailure` (`rate_limit`, `overloaded`, ...), `SessionEnd`, `Notification` (`idle_prompt` about 60 s after a response, `agent_needs_input`, `permission_prompt`).
- `asyncRewake`: a background hook can wake Claude on exit code 2. (hooks)

**Why events alone are not enough**
- #78338 (2026-07-17): no completion notice, 11.3 hours idle. Workaround given: «watch for the expected output file». Closed; fix state «?».
- [#86012](https://github.com/anthropics/claude-code/issues/86012) (2026-08-12, Desktop app, closed): a session wedged for 975–1227 s with `isRunning: true` and frozen `lastActivityAt`. The only way to tell was comparing it twice.
- A hung turn never reaches `Stop`, so no idle event fires (inference).

**So: one script tick, no model turn**
- Supported read: `claude agents --json --all`, with `state` of `working`, `blocked`, `done`, `failed`, `stopped`, plus `status` and `waitingFor`. The docs name «another Claude session that supervises background work» as a use. ([agent-view](https://code.claude.com/docs/en/agent-view.md), 2026-11-04, `verified`)
- Symphony: elapsed since last worker event over `stall_timeout_ms` (default 300000, 5 min) means terminate and queue a retry. ([SPEC §8.5](https://github.com/openai/symphony/blob/main/SPEC.md), main, 2026-11-04, `verified`)
- claude-squad: sha256 of the tmux pane against the last tick, plus prompt string match. ([tmux.go `HasUpdated`](https://github.com/smtg-ai/claude-squad/blob/main/session/tmux/tmux.go), main, 2026-11-04, `verified`)
- Gastown:
  - Daemon on a fixed 3-minute heartbeat, «recovery-focused», with normal wake by feed subscription. ([daemon.go](https://github.com/gastownhall/gastown/blob/466aa41c83ee73b1fa0eb79eb9d172fb1eca9476/internal/daemon/daemon.go))
  - Stuck check: 30 s ping, 3 consecutive failures to force-kill, 5 min cooldown. ([stuck.go:19-21](https://github.com/gastownhall/gastown/blob/466aa41c83ee73b1fa0eb79eb9d172fb1eca9476/internal/deacon/stuck.go))
  - Mass death: 3 in 30 s. (daemon.go; all `verified`)
- Built-in limits: subagent stall 600 s (`CLAUDE_ASYNC_AGENT_STALL_TIMEOUT_MS`), API body idle 5 min. ([env-vars](https://code.claude.com/docs/en/env-vars.md), 2026-11-04, `verified`)

**Thresholds and false alarms**
- Healthy near-misses at 560 s, 475 s and 407 s on heavy tiers. (#85265, 2026-08-09)
- Boot's matrix: idle under 5 min nothing; 5–15 min with mail nudge; over 15 min wake. «Don't be too aggressive - false positives are disruptive.» ([mol-boot-triage](https://github.com/gastownhall/gastown/blob/466aa41c83ee73b1fa0eb79eb9d172fb1eca9476/internal/formula/formulas/mol-boot-triage.formula.toml), `verified`)
- «never declare an agent stuck from a single store». This came from false escalations in real use. ([heartbeats.md](https://github.com/gastownhall/gastown/blob/466aa41c83ee73b1fa0eb79eb9d172fb1eca9476/docs/concepts/heartbeats.md), `verified`)
- Sources disagree on who decides. Gastown puts an agent in the wake decision instead of «relying on mechanical thresholds». Symphony and claude-squad use only mechanical ones.

**Watching the coordinator**
- Gastown layers it: the Witness alerts the Mayor if the Deacon looks dead (over 5 minutes), and a daemon outside any model spawns a fresh Boot. A gotcha: a label can go stale for hours on a healthy agent. (heartbeats.md, daemon.go, `verified`)
- Avoid `/loop` or scheduled prompts for this: a session task «fires on its interval even while the session is idle, sending your full context each time». ([costs](https://code.claude.com/docs/en/costs.md), 2026-11-04, `verified`)
- Do not use a worker to watch a worker: «Do not use one worker to check on another.» (Piebald, ccVersion 2.1.299)

**Against the design**
- Silent. None of the five events covers «tilde is dead» or «a worker hung», and only a live tilde can raise them.

**One change.** Add a small script outside all sessions, on a 3–5 minute tick (inference, from the Gastown and Symphony defaults).
- It reads `claude agents --json --all` and the lane file's mtime.
- Worker silent 15 min or more while `busy`: check a second signal, then ping tilde. Do not kill. A 15–20 min floor suits heavy tiers (inference from #85265).
- Tilde idle is normal. Alert main only when a crew event is newer than tilde's last lane-file write, or when tilde is `failed` or `stopped`.
- It writes one line and pushes main only after the second failed check.

---

## Where sources change the design

**Five push events**

| Event | Verdict | Change |
|---|---|---|
| Ready to merge | Keep | Must carry diff sha, test output and the verifier's verbatim verdict. Script checks these first. «a worker's summary describes what it intended to do» (Piebald). Verification failures total 17.3 % in MAST. Never a merge on a following turn alone (#44778) |
| Dispute it cannot settle | Keep | Forward both sides verbatim (LangChain) |
| Question for the operator | Keep | Verbatim, durable, acked. Main returns the operator's exact words (Piebald) |
| Blocked past the spec | Keep | Add an unmeasured `severity` for bypass (Gastown) only if the trial shows a need |
| Three-round review stop | Keep | Three matches `max_stalls=3` ([autogen group chat:53](https://github.com/microsoft/autogen/blob/d07c667a3239ea4ab7af62a53b0f4ff205a1f23d/python/packages/autogen-agentchat/src/autogen_agentchat/teams/_group_chat/_magentic_one/_magentic_one_group_chat.py)), 3 consecutive denials (auto mode, plus 20 total) and 3 ping failures (stuck.go). None of them tests three against other values, so it is convention, not proof. Count on disk, by script. Consider a total cap as well (inference) |
| Missing: lane health | Add | From the script, not from tilde (§6) |

**Refused and granted actions**

| Item | Verdict | Source |
|---|---|---|
| No code | Keep, enforce by tools | Gastown 2026-02-08, CrewAI |
| No memory | **Change**: one lane file | §4 |
| No tracker bodies, main keeps merge | Keep | Cognition 2026-04-22 |
| Never change want or exit lines | Keep | Anthropic harness 2025-11-26: coding agents change only pass status |
| Relays between coder and verifier | **Change**: they exchange files and message directly; tilde gets a path | Below |
| Greenlights the plan | **Narrow** to exit-line coverage | Cognition, agent-teams |
| Checks spec against code | **Move** to a subagent or the verifier | Mayor template; Piebald disagrees |
| Starts the crew | Keep, or make it a script | Witness refuses; Claude Code coordinator spawns |

**Relay evidence**
- «Direct subagent outputs can bypass the main coordinator»; store in external systems and pass «lightweight references». (Anthropic, 2025-06-13)
- Teammates «communicate directly with each other». (agent-teams, 2026-11-04)
- Telephone. (LangChain, 2025-06-10)
- «each handoff degrading fidelity». (Anthropic, 2026-01-23)
- Each relay is also a full-context turn. (costs, 2026-11-04)

**Other design lines**
- Opt-in and shared contract: nothing read tests either one. `open`.
- Main facing the operator while a specialist does a bounded task matches OpenAI's `as_tool` manager over handoffs: «should not take over the user-facing conversation». ([OpenAI Agents SDK](https://openai.github.io/openai-agents-python/multi_agent/), undated, read 2026-11-04). No numbers.
- Google ADK: its [workflows page](https://adk.dev/workflows/) (undated, read 2026-11-04) gives only «a dynamic coordinator role», nothing on these vectors. The older multi-agents url redirects there. I did not read its loop or resume pages.

---

## What surprised me

- The lost «go ahead and merge» risk runs the other way: a ping can create a fake yes. (#44778, 2026-04-07)
- A send can return success for a message that is then destroyed. (#78338, 2026-07-17)
- Tightening a filter by 20× on false alarms cost 2.6× on misses. (auto mode, 2026-03-25; ratio is my arithmetic)
- Opus scored no better than Haiku on the patrol reasoning tests. (gastown run, 2026-02-16; small n)
- Claude Code auto-approves team plans by default, so the vendor does not treat plan review as a needed lead job. (agent-teams, 2026-11-04)
- Cognition went from «don't build» ([2025-06-12](https://cognition.com/blog/dont-build-multi-agents)) to live manager Devins (2026-04-22). The surviving rule is one writer.
- Anthropic removed harness parts as models improved: sprints with Opus 4.6. (2026-03-24) A coordinator layer may have a short shelf life (inference).
- CrewAI's manager did no orchestration in one test (38 s, 15,759 tokens, wrong answer). A custom prompt fixed it (16–24 s, 7.7–12k tokens). ([TDS](https://towardsdatascience.com/why-crewais-manager-worker-architecture-fails-and-how-to-fix-it/), about 2025-11 from image paths «?», four queries.) A weak prompt alone can leave a coordinator doing nothing.
- Vibe Kanban's README says it is sunsetting, and it has a human planning, no coordinator. ([README](https://github.com/BloopAI/vibe-kanban), read 2026-11-04)
- Gastown's successor effort: one commenter asks if the eval was dropped for «Gas City» (2026-04-23), unanswered in my read «?».

## Worth borrowing

- `gt-model-eval`: promptfoo harness of real coordinator decisions per tier.
- Gastown's mail against nudge test, the escalation labels (`acknowledged`, `reescalation_count`) and Boot's decision table.
- `notify_when_idle` plus `claude agents --json --all` for the watcher.
- Symphony's stall rule and its in-memory, restart-from-tracker stance.
- Claude Code's extracted coordinator prompt, for its lines on verbatim consent and checking the diff.
- Anthropic's stripped-input classifier idea: judge «ready» from artifacts, not the coder's narration.

## Not found or not read

- Conductor: closed source as far as I know «?»; not read.
- Latency cost of a middle layer in Claude Code sessions: `open`.
- A measured escalation-recall number for any coordinator: `open`.

<!-- end -->
