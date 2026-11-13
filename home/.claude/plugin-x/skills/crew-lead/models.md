# crew-lead — models, efforts, summon or reuse

## summon or reuse

**the order — reuse before summon, sequential by default** (dima, 2026-11-10: «each new summon is not free. it has its resident base memory, so each new summon is costing weekly usage, which we have to use mindfully to accomplish as much as possible of what is planned»; clio's copy: `craft-fleet-flow` § lane init):
- batch: a parked member takes the next chunk by message, in any area; its scope is prepped up front, ideally in a similar area
- under ~20–25 % context it switches in place; above it, it second-winds first; this beats the step grid below
- a finished member stays parked for the next job (its stops: [watching.md](watching.md) § lifetime and stopping)
- chunks run one by one through the reused member; a parallel lane only when it matters, when it is needed, or on dima's ask, its reason in the brief
- a brief-sized code chore goes to the **🐕 strays lane** first (`rules/fleet-vibe.md`): a line in `~/.local/state/x/lanes/strays/queue.md`, then one brief to «⚡ 🐕 strays | chores»; none live → the day's first chore summons it (FRM-586)
- a fresh summon is the last door; its brief names why no parked member fit

**summon or reuse — the grid** (dima, 2026-10-06: «pre-plan these breakpoints … reuse existing sessions, or spawn a new one?»):
- measured 2026-10-06 on 8 implementers: a fresh agent's first request reads ~35k warm (tools + the fixed system prompt, the same bytes in every session) and writes ~102k cold (memory + per-session bits); every later step reads the whole context back. the halt re-measures the base (first-request `cache_read` / `cache_creation` of the day's agents).
- prices, [pricing](https://platform.claude.com/docs/en/about-claude/pricing) read 2026-10-08, per MTok — in · 5m write · 1h write · hit · out: opus 5.5 $4 · $5 · $8 · $0.20 (0.05×) · $20; sonnet 5.5 $2 · $2.50 · $4 · $0.10 (0.05×) · $10; fable 5.1 $10 · $12.50 · $20 · $0.25 (0.025×) · $50; haiku 5.5 (≤100K prompts) $0.10 · $0.125 · $0.20 · $0.01 (0.1×) · $0.50, over 100K ×5. the 1M window bills at standard rates.
- 📌 **two cache lives**: a `--bg` session or the main session writes the 1h cache; a subagent, a fork or a workflow agent writes the **5-min** one, even on a subscription (`subagentPromptCacheTtl` overrides; [prompt caching](https://code.claude.com/docs/en/prompt-caching.md), the 10-07 refresh-crew-coordinator lane).
- **reuse a warm session when its extra context (above the ~102k spawn write) < spawn write ÷ (hit price × steps)**, per door:
  - `--bg` (1h): opus 4.1M ÷ steps · sonnet 4.1M ÷ steps · fable 8.2M ÷ steps · haiku 2.0M ÷ steps
  - subagent (5m): opus 2.6M ÷ steps · sonnet 2.6M ÷ steps · fable 5.1M ÷ steps · haiku 1.3M ÷ steps
  - on an opus `--bg`: ≤10 steps → reuse up to ~410k · ~50 steps (a ticket) → under ~80k · 100+ (a feature) → second-wind it, never a fresh summon for cost alone (inference: a second wind sheds the old context and skips a new session's base write; unmeasured). effort changes the steps, never the prices.
- idle past the cache life → cold, a reuse rewrites the whole context at the write price → second-wind it first when its context is past ~20–25 %; a lane's sixth sense is always reused by message, cold or not. **a `--bg` session goes cold after 1h idle, a subagent after 5 min** — a finished subagent revived by `SendMessage` minutes later is almost always a cold reuse.
- the taxonomy, by cost: clio (one long session, its context is the job) · `--bg` codie (watchable) · implement-spec subagents (bulk) · fork (pays the parent's whole context) · `helper` (sonnet, mechanical) · bare probe (`claude -p --safe-mode`, almost no base) · crow (resident, 🔥 keeps it warm).

**the spec-run balance** (dima, 2026-10-06: «plain --bg coder is better for granular work, where i'd like to see the results in place. and implement-spec looks very good of under the hood work»):
- a `--bg` codie for granular work dima watches: UI, side lanes, anything he steers in place
- `implement-spec` subagents for bulk work under the hood; every code ticket on opus 5.5 until dima decides a sonnet pattern (2026-11-04: not yet); clio runs a run of ≤10 tickets, a `--bg` runner takes it when dima wants to watch
- a `--bg` codie hands its big reads and mechanical edits to subagents, so its own context stays lean (`x:crew-codie`)

## picking the model — Dima's contract, never re-derived

- **opus-5.5** — codie's default since 2026-09-22 (`--model opus` resolves to `claude-opus-5-5` on cc 2.1.280, probed): **`--effort medium` is the standing default** (decided 2026-09-25: dima's call, backed by anthropic's opus 5.5 migration guide — medium beats opus 5 high on coding at ~half the tokens); **`high` for large scaffolding, migrations and cross-cutting refactors** (dima set it for atelier's scaffold); `xhigh`/`max` only after a measured gain — no evidence they beat high, and max is flagged as overthinking-prone. **sixth sense: opus 5.5 `medium`** (dima 2026-09-28: medium is the knee — on the 5.5 launch charts high buys +3.5 to +6.7 points for ~35 % more cost, and on FrontierCode medium scores highest; high only for big sweeps and migrations; was `high` from 09-25), never a sonnet-class model alone — a weaker single overseer catches a stronger generator far less often (Engels et al. 2025, scalable oversight); model diversity, if wanted, comes from the ci reviewer. the research: 2026-09-25, one opus lane
  (measured at only ~+10% weekly usage — do not revert on a hunch). ⚠️ **not a PM**: overlong
  prose, invented jargon, unasked docs.
- **a design spread summons several arms, until the stats settle** (dima, 2026-10-01): fable 5.1 `medium` + `high` by default, an opus arm when fresh ideas matter — fable draws the most beautiful and its burn (~3× opus per spread) is justified because design runs are rare, but it is watched. every spread logs cost per arm and dima's «best» tally per arm in `docs/test-drive/design-run.md`; when one arm keeps winning, the default narrows to it (likely fable high alone).
- **design runs first in the day** (`craft-fleet-flow` stage 3): reviewing canvases tires him most, and an evening design session filled 87 % of the window (2026-10-01). fable comment rounds run in a fresh session per batch (`x:crew-designer`).
- **fable-5.1** — spawned only on his word, at `medium`; for design work «not lower than medium, maybe high, not extrahigh, not max» (dima, 2026-10-01 — the 09-06 «always low» rule is retired); Dima spends that budget
  on his own turns. Anything Dima reads → fable flavour: *«opus picks pragmatically, fable =
  flavour»*.
- **sonnet-5.5** — never a default codie: every codie runs opus 5.5, quick lanes and mods included; no sonnet codie at all, deliberate picks included, until dima decides a pattern; FRM-478's grade alone opens nothing (W706, o55; dima, 2026-10-30: «Sonnet 5.5 is a weak model for mods. Only Opus 5.5 is a coder»; a sonnet-built chunk counts as not verified until an opus review reads it). routine, fully specified work and the `helper` card; no `--bg` thread of any role on sonnet until a pattern for it is decided (dima, 2026-11-01: sonnet has to earn its trust first; the subagent cards stay as agreed); never hard multi-step.
- **haiku-5.5** — the haiku pick since 2026-10-08 (dima): retrieval, extraction, bulk transforms, a sidekick subagent under an opus lead, bare probes. `--model haiku` resolves to `claude-haiku-5-5` on cc 2.1.294 (probed 2026-10-08). 📌 not for complex agentic coding (Terminal-Bench 4.0 39.2 %), not at low effort on long prompts; as a classifier engine it is unmeasured.
- 🎯 the effort baseline, the cards and every subagent rule (fan-out, the haiku crew, the delegate list): `x:crew-subagent`
- Full cards, prices and the evidence: [references/model-cards.md](references/model-cards.md), on demand.
