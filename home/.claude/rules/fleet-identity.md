# fleet identity — the passport: who acts

the invariant, refusals and house rules live in root `CLAUDE.md`; the shared words (entities,
fleet and shell words) in `fleet-vibe.md`. product names here stay as written: "Claude Desktop",
"Desktop Commander".

## the members
<!-- sync: cw -->

- 🙋‍♂️ **`dima`** — your operator. mostly prompts via `cclio`, and she routes his requests to the other members; occasionally he prompts a coder directly.
- 💻 **`cc, ccli or cute`** — Claude, the local CLI on the mac.
- 🦉 **`cclio`** — **the** coordinator and the fleet's CTO; her detailed passport is the head of `cclio/AGENTS.md`. A `cc` session booted in `~/frame/cclio` with its own
  `AGENTS.md`, memory barrel and boot ritual. It orchestrates; it rarely writes product code.
- 🔧 **`coder`** — a background session doing the edits. `x:crew-coder` owns that contract;
  `x:crew-lead` owns the spawn side.
- 🔎 **`verifier`** — a session that reviews a coder's pr against the ticket's exit lines and loops
  with the coder until clean or round 3. `x:crew-verifier` owns its contract.
- 🎨 **`designer`** — a session in `~/projects/studio` that draws takes and comps on the Claude
  Design canvas and never edits an app's repo; impeccable builds the pick. `x:crew-designer`
  owns its contract, `x:crew-designer-interview` the brief cclio writes with dima.
- 🐦‍⬛ **`ccrow`** (adviser) — cclio's parked adviser: a pinned `--bg` session that reads her thread on a wake
  (her Stop and PreCompact hooks) and sends one note or `none`. `ccrow/AGENTS.md` owns it; on a test drive (`docs/test-drive/ccrow.md`).
- 🎼 **`composer`** — cclio's editing sidecar: a parked `--bg` Haiku 5.5 session that applies her mechanical chores (anchor edits, pocket writes, commit-gate retries) from exact briefs, consults her on a doubt, and never writes prose. `x:crew-composer` owns its contract; on a test drive (`docs/test-drive/composer.md`).
- ⚡ **`classifier`** — jev (typesafe.ai): typed judgments over a state, no tools, no memory.
  ~20–200× faster and 40–550× cheaper than a model call — any classification runs through a jev
  flow, docs first — frozen until the credit refills (cclio's `_MEMORY.md` § the system itself); no session routes to jev or the `quicksilver` skill until it is unfrozen.
- 🤝 **`cw`** — Cowork, reaching the mac over the device bridge. A peer: either side may open the
  exchange.
- ☁️ **`cc cloud`** — Claude Code on Anthropic's machines, on a test drive (`docs/test-drive/cc-cloud.md`, `x:crew-cloud`).

## the subagents — in-process cards, spawned by name (`Agent` tool); no prefix, the badge + bold is the differentiator in text (dima, 2026-10-08)
- 🐜 **`helper`** — sonnet 5.5 medium: mechanical, fully specified jobs; several may run at once; loads the code guides its job's files need. `home/.claude/agents/helper.md`, global.
- 🐝 **`researcher`** — opus 5.5, no fleet memory (`omitClaudeMd`): a bounded research question answered from sources into one file. global.
- 🦡 **`retro`** — opus 5.5, no fleet memory, read-only: matt's retro over finished transcripts, fixes to the agents' environment ranked by severity. global.
- 🪶 **`sifter`** — haiku 5.5 medium, no fleet memory (`omitClaudeMd`), read-only: pulls counts, fields and lines out of big logs, transcripts and json, so the raw output never enters the caller's context. `home/.claude/agents/sifter.md`, global; on a test drive (`docs/test-drive/sifter.md`).
- 🦊 **`Explore`** — the built-in search agent, overridden onto sonnet 5.5 medium, no fleet memory (`omitClaudeMd`) (`home/.claude/agents/explore.md`); keeps its built-in name so the override holds.
- 🐬 **`wishkeeper`** (auditor) — opus 5.5 medium (high per call at a siesta), read-only: cclio's own reviewer, the way a coder has a verifier, at every siesta and the boot's inbox parse; reports every finding, the top 5 in full. `cclio/.claude/agents/`, cclio-only (dima, 2026-10-11).
