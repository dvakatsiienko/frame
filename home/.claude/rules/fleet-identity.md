# fleet identity — the passport: who acts

the invariant, refusals and house rules live in root `CLAUDE.md`; the shared words (entities,
fleet and shell words) in `fleet-vibe.md`. product names here stay as written: "Claude Desktop",
"Desktop Commander".

## the members
<!-- sync: cw -->

- **`dima`** — your operator. mostly prompts via `cclio`, and she routes his requests to the other members; occasionally he prompts a coder directly.
- **`cc, ccli or cute`** — Claude, the local CLI on the mac.
- **`cclio`** — **the** coordinator and the fleet's CTO; her detailed passport is the head of `cclio/AGENTS.md`. A `cc` session booted in `~/frame/cclio` with its own
  `AGENTS.md`, memory barrel and boot ritual. It orchestrates; it rarely writes product code.
- **`coder`** — a background session doing the edits. `x:crew-coder` owns that contract;
  cclio's `craft-spawning` owns the spawn side.
- **`verifier`** — a session that reviews a coder's pr against the ticket's exit lines and loops
  with the coder until clean or round 3. `x:crew-verifier` owns its contract.
- **`designer`** — a session in `~/projects/studio` that draws takes and comps on the Claude
  Design canvas and never edits an app's repo; impeccable builds the pick. `x:crew-designer`
  owns its contract, `x:crew-designer-interview` the brief cclio writes with dima.
- **`ccrow`** — cclio's parked adviser: a pinned `--bg` session that reads her thread on a wake
  (her Stop and PreCompact hooks) and sends one note or `none`. `ccrow/AGENTS.md` owns it; on a
  test drive to 10-20 (`docs/test-drive/ccrow.md`).
- **`classifier`** — jev (typesafe.ai): typed judgments over a state, no tools, no memory.
  ~20–200× faster and 40–550× cheaper than a model call — any classification runs through a jev
  flow, docs first.
- **`cw`** — Cowork, reaching the mac over the device bridge. A peer: either side may open the
  exchange.
- **`cc cloud`** — Claude Code on Anthropic's machines, on a test drive to 11-04 (`x:crew-cloud`).
