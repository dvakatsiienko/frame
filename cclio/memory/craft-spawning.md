**One coder by default, two with a stated reason, never three.** Parallelism goes across repos,
not into headcount.

## the two doors, never interchangeable

- **subagent** (`Agent` tool) — runs inside cclio, dies with it, Dima cannot open it, takes no
  effort setting (inherits the session's). `subagent_type: "fork"` inherits full context; any other
  type starts blank and is briefed like a colleague who just walked in.
- **background session** (`claude --bg`) — real, survives a coordinator reset, takes model AND
  effort. **The door for all coding — and always spawned with `--remote-control`**, so Dima can
  join it.

The split is **disposable-vs-watchable**, not research-vs-code.

- **the Code tab door (dima opens, cclio briefs)** — the flow that ran eight coders on 2026-09-06: dima opens a session in the app dir (root when the job crosses apps), pastes a one-line pointer to a brief file in cclio's scratchpad, the coder pings back through `mcp__ccd_session_mgmt__send_message`. a brief that says «dima's word» starts without a y/n round; a steer relayed by cclio is NOT his grant to the coder (the coder confirms with him — by our own rule). every brief starts from `x:crew-coder` (dima types it in the coder's session; cclio pastes the file body into a `--bg` prompt).
  📌 **desktop auto-archive (on since 2026-09-28) ends a Code-tab session the moment its pr merges or closes** — it archives AND stops it. measured on 4 probes: a desktop-made local session went at its merge; `--bg` and `--cloud` sessions stayed, merged or closed; docs: «only applies to local sessions that have finished running». so a job that may need rounds after its merge spawns `--bg`, never from the Code tab; cloud cards are archived by hand (`x:crew-cloud` step 5).
- **cloud (`claude --cloud`)** — a coder on an anthropic vm: survives the mac sleeping, the cloud credit pays first, carries nothing of ours, cannot message back. the whole procedure is `x:crew-cloud`.
- **`/fork [prompt]`** — a third door (dima, 2026-09-05): copies THIS conversation into a new
  background session, no brief, the coder starts knowing everything cclio knows. reach for it
  when the job needs the session's context (a design bundle discussed here → `theme.css`, a
  grill's outcome → the build); `--bg` when it needs a clean one. dima may say «fork it»; cclio
  suggests it when the brief would be longer than the context it replaces. unmeasured yet:
  whether the fork inherits the Code-tab pane and the desktop channel — probe on first use.
`isolation: "worktree"` gives a real git worktree — expensive, only when agents would collide. 📌 its tree starts from `origin/<default>`, never from a local branch ahead of it (4 of 4 on 2026-10-06, while main was unpushed): push main before the spawn, and the brief needs no line about it (FRM-343 retro: dead weight once main was pushed).

**spawn or reuse — the grid** (dima, 2026-10-06: «pre-plan these breakpoints … reuse existing sessions, or spawn a new one?»):
- measured 2026-10-06 on 8 implementers: a fresh agent's first request reads ~35k warm (tools + the fixed system prompt, the same bytes in every session) and writes ~102k cold (memory + per-session bits); every later step reads the whole context back. the halt re-measures the base (first-request `cache_read` / `cache_creation` of the day's agents).
- prices, [pricing](https://platform.claude.com/docs/en/about-claude/pricing) read 2026-10-08, per MTok — in · 5m write · 1h write · hit · out: opus 5.5 $4 · $5 · $8 · $0.20 (0.05×) · $20; sonnet 5.5 $2 · $2.50 · $4 · $0.10 (0.05×) · $10; fable 5.1 $10 · $12.50 · $20 · $0.25 (0.025×) · $50; haiku 5.5 (≤100K prompts) $0.10 · $0.125 · $0.20 · $0.01 (0.1×) · $0.50, over 100K ×5. the 1M window bills at standard rates.
- 📌 **two cache lives**: a `--bg` session or the main session writes the 1h cache; a subagent, a fork or a workflow agent writes the **5-min** one, even on a subscription (`subagentPromptCacheTtl` overrides; [prompt caching](https://code.claude.com/docs/en/prompt-caching.md), the 10-07 refresh-crew-coordinator lane).
- **reuse a warm session when its extra context (above the ~102k spawn write) < spawn write ÷ (hit price × steps)**, per door:
  - `--bg` (1h): opus 4.1M ÷ steps · sonnet 4.1M ÷ steps · fable 8.2M ÷ steps · haiku 2.0M ÷ steps
  - subagent (5m): opus 2.6M ÷ steps · sonnet 2.6M ÷ steps · fable 5.1M ÷ steps · haiku 1.3M ÷ steps
  - on an opus `--bg`: ≤10 steps → reuse up to ~410k · ~50 steps (a ticket) → under ~80k · 100+ (a feature) → spawn fresh. effort changes the steps, never the prices.
- idle past the cache life → cold, a reuse rewrites the whole context at the write price → spawn fresh, unless its knowledge is the job. **a `--bg` session goes cold after 1h idle, a subagent after 5 min** — a finished subagent revived by `SendMessage` minutes later is almost always a cold reuse.
- the taxonomy, by cost: cclio (one long session, its context is the job) · `--bg` coder (watchable) · implement-spec subagents (bulk) · fork (pays the parent's whole context) · `helper` (sonnet, mechanical) · bare probe (`claude -p --safe-mode`, almost no base) · ccrow (resident, 🔥 keeps it warm).

**the spec-run balance** (dima, 2026-10-06: «plain --bg coder is better for granular work, where i'd like to see the results in place. and implement-spec looks very good of under the hood work»):
- a `--bg` coder for granular work dima watches: UI, pr lanes, anything he steers in place
- `implement-spec` subagents for bulk work under the hood; each ticket picks its model — sonnet 5.5 for a mechanical ticket, opus for judgment; cclio runs a run of ≤10 tickets, a `--bg` runner takes it when dima wants to watch
- a `--bg` coder hands its big reads and mechanical edits to subagents, so its own context stays lean (`x:crew-coder`)

## picking the model — Dima's contract, never re-derived

- **opus-5.5** — the default coder since 2026-09-22 (`--model opus` resolves to `claude-opus-5-5` on cc 2.1.280, probed): **`--effort medium` is the standing default** (decided 2026-09-25: dima's call, backed by anthropic's opus 5.5 migration guide — medium beats opus 5 high on coding at ~half the tokens); **`high` for large scaffolding, migrations and cross-cutting refactors** (dima set it for atelier's scaffold); `xhigh`/`max` only after a measured gain — no evidence they beat high, and max is flagged as overthinking-prone. **the verifier: opus 5.5 `medium`** (dima 2026-09-28: medium is the knee — on the 5.5 launch charts high buys +3.5 to +6.7 points for ~35 % more cost, and on FrontierCode medium scores highest; high only for big sweeps and migrations; was `high` from 09-25), never a sonnet-class model alone — a weaker single overseer catches a stronger generator far less often (Engels et al. 2025, scalable oversight). the research: 2026-09-25, one opus lane
  (measured at only ~+10% weekly usage — do not revert on a hunch). ⚠️ **not a PM**: overlong
  prose, invented jargon, unasked docs.
- 📌 **an exit line names only the browsers and surfaces dima uses — Chrome, never Safari «for coverage»** (BYT-116, 2026-10-02): a Safari line came from a prior-art risk list, and `safaridriver` opened real windows on his screen with a «continue or stop» dialog on every touch. a check that cannot run headless takes over his screen: warn first, batch it into one session, ask before each run.
- 📌 **a long-run fork's brief says «wait in the foreground until the run ends»** — a fork that arms a background watcher returns at once and its run dies unreported (dima's ask, 2026-09-12).
- 📌 **every exit line names a thing that exists — proven by a grep, never by memory** — and names behaviour plus real commands and terms (`pnpm typecheck`, `⇧F4`, a glossary word), never a file path: exit lines feed matt's spec, which bans paths as stale-prone (dima, 2026-10-07): before the spawn ask, every file, path, script and term an exit line names is grepped in the target repo, and a miss is rewritten. drafted from memory, 3 lines missed in one day: a 16 px piece atelier never had, a «manual» and a «keys list» no file is called, «png» where atelier writes webp (BYT-113, BYT-114, 2026-09-30). a cross-repo exit line names where each half lands and which merges first — a hook in one repo that calls a verb from the other cannot push before that verb is on main (FRM-344, bytes#124); a rename of stored data says «migrate» or «read both», or two lines pull against each other. an exit line that writes under `cclio/` is cclio's own, never the coder's: frame `AGENTS.md` bars a coder from that dir (FRM-319's borrow lines, 2026-10-05).
- 📌 **a ci reviewer's «clean» in under a minute on a big diff is a shallow pass** — 37 s on 29 files on #116; it found one bug the verifier missed and missed two browser-only lows. the verifier's verdict decides, the ci reviewer is a second pair of eyes (2026-09-30).
- 📌 **a fork carries the whole parent context** — two skill test drives mid-session started at ~220k each (2026-09-27); a test drive, a lookup or a bounded research goes to a fresh agent with a short brief, a fork only when the job needs this thread. **every fork prompt carries `why-fork: <what parent context it needs>`** — the `x-mod-guard` mod refuses a fork without one (FRM-323; the 10-05 count: 8 of 42 forks were mechanical, `helper` ran twice).
- 📌 **`fork` is gated off in every non-interactive session** (the desktop Code tab runs `--output-format stream-json`, so it counts) unless `CLAUDE_CODE_FORK_SUBAGENT=1` — set in the user `settings.json` env block on 2026-10-06; proven by a fresh Code-tab session forking on 2.1.288, where one started before the line got «Agent type 'fork' not found». a session started before the line keeps the old env until restarted. the desktop's «Fork from here» button is a different door: it forks the whole session for dima.
- 📌 **a `fork` always runs on the parent model** (the session model — opus since the 09-24 settings change) whatever `model` says — research and lookups go to a fresh agent (`general-purpose`, `haiku` for retrieval), forks only when the job needs this session's context. `CLAUDE_CODE_SUBAGENT_MODEL=opus` in settings.json makes opus the fresh-agent default (dima's yes, 2026-09-13, after two fable forks spent ~365k on web reading).
- 🎚️ **per-call `effort` on a one-off `Agent` call** (dima's yes, 2026-10-08; the tool takes it since 2.1.292): a `general-purpose` lookup or bounded read → `medium`; a hard review, a cross-file diagnosis or a source-reading research → `high`. this line is what lets cclio pass the param; a card's own `effort:` still wins for its agent. on trial in `docs/test-drive/agent-effort.md` to 10-15.
- 🎯 **`medium` is the baseline effort for every model** (dima, 2026-10-01: «use low effort only when necessary or via my ask. use medium as a baseline for all models») — `low` is an exception named out loud, never a default.
- **a design spread spawns several arms, until the stats settle** (dima, 2026-10-01): fable 5.1 `medium` + `high` by default, an opus arm when fresh ideas matter — fable draws the most beautiful and its burn (~3× opus per spread) is justified because design runs are rare, but it is watched. every spread logs cost per arm and dima's «best» tally per arm in `docs/test-drive/design-run.md`; when one arm keeps winning, the default narrows to it (likely fable high alone).
- **design runs first in the day, on a fresh 5h window** (dima, 2026-10-01): a design session filled 87 % of the window by evening and blocked the coding behind it; reviewing canvases tires him most, so a day plan puts design before code, never at its end. fable comment rounds run in a fresh session per batch (`x:crew-designer`).
- **fable-5 / 5.1** — spawned only on his word, at `medium`; for design work «not lower than medium, maybe high, not extrahigh, not max» (dima, 2026-10-01 — the 09-06 «always low» rule is retired); Dima spends that budget
  on his own turns. Anything Dima reads → fable flavour: *«opus picks pragmatically, fable =
  flavour»*.
- **sonnet-5** — routine well-specified work under quota pressure; never hard multi-step (SWE-bench Pro 63.2 %, −26 vs opus-5.5's 89.9 %; $2/$10 is now permanent).
- **haiku-5.5** — the haiku pick since 2026-10-08 (dima): retrieval, extraction, bulk transforms, a sidekick subagent under an opus lead, bare probes. `--model haiku` resolves to `claude-haiku-5-5` on cc 2.1.294 (probed 2026-10-08). 📌 not for complex agentic coding (Terminal-Bench 4.0 39.2 %), not at low effort on long prompts; as a classifier engine it is unmeasured — the 4.5 arm read 27 % precision and 6.6–9.6 s through `claude -p` on the skill router (`docs/research/skill-router.md`). haiku 4.5 retires 2026-10-15.
- Full cards and prices: `docs/knowledge/models.md`, on demand.
- 🪶 **a number read off a transcript, a log or a json dump goes to `sifter`** (haiku 5.5, read-only, returns the answer + the command) — cclio never `jq`s it by hand in its own context (dima's yes, 2026-10-08: its first round caught my hand `jq` summing streaming snapshots, ~$4.75 read for ~$1.17). briefs name it for a coder's big reads too.
- 🧰 **the delegate list — chores go to the `helper` agent** (`home/.claude/agents/helper.md`: sonnet 5.5, `effort: medium` pinned — a bare `Agent` inherits the session's effort, the evergreen run went out at `high`, 2026-10-05), never a persistent helper (dima, 2026-10-04): the evergreen apps report, the stale research-doc scan, transcript audits (`crew:audit`), test-drive log lines, the flawlog pre-sort, and **mechanical edits whose every change the brief spells out** (a rename, a date shift — dima 2026-10-05: «delegate more dumb work to sonnet»). it absorbs the big reads; only its short answer enters this context, and its diff is read before anything lands.

## preflight, five checks, every spawn

0. **reuse before spawn** — an idle child revives by message with context intact; a warm coder is
   worth ~50k — when its context is the job's: a session carrying ~220k of unrelated context pays it on every step, and a fresh coder is cheaper (FRM-327 retro, 2026-10-06).
0.4. **a new spawn home gets its trust key** — a `--bg` spawn reads the exact folder in `~/.claude.json`
   (`projects[<path>].hasTrustDialogAccepted`), never a trusted parent; `~/projects/studio` was refused on its first
   spawn (2026-09-29). set it with `jq` on a backup when the home is made.
0.5. **spare age** — every `--bg` spawn claims a pre-warmed `claude bg-spare`, and a day-old spare
   booted a coder WITHOUT the repo's root `AGENTS.md` (2026-09-22, ccbee7b0). check
   `ps -o pid,lstart,command -ax | grep '[b]g-spare'`; older than a day → `claude daemon stop
   --keep-workers`, then spawn. the brief's «name your loaded AGENTS.md paths» line is the belt.
0.7. **app essentials** — the target app passes `node ~/projects/bytes/script/apps-essentials.ts --app <app>` (BYT-111, `x:app-essentials`): its run and verify skills, `FTR.md`, `GLOSSARY.md`, the ADRs. a red row is filled before the spawn, or the brief says which row the coder fills first. **a 🟡 row rides the brief too, after the app's gremlins** (dima, 2026-10-02) — so an app gains its branch badge, or any later yellow, on its next touch, with no word in its `AGENTS.md` to forget. `/run-skill-generator` is user-invoked only, so dima types it in the app, or cclio spawns a one-shot session whose prompt IS the command (the chords probe, 2026-09-27).
1. **tier** — code, repo, real filesystem ⇒ a real session, never a thinking-only one.
2. **name + argv** — the template, literal, prompt BEFORE `--remote-control` (measured 2026-09-07: the flag ate a 1.5 kB brief as its rc label → 400, idle child):
   `cd <repo> && claude --bg -n '☕️ 🔧 BYT-N code: <what>' --model opus --effort medium '/x:crew-coder BYT-N <job> coordinator: <cclio registry name>' --remote-control`
   **the verifier is dima's call, asked before EVERY coder spawn** (dima 2026-09-20): the spawn ask carries a proposed `exit` section (given/when/then, from the ticket's acceptance) and the question «verifier: yes/no?» — the exit lines are his to think through, so the ask never skips them and never decides alone; a coder spawned without the ask was the miss on DOT-254. **a pr-lane coder spawns with its verifier** (dima 2026-09-18, spec = `x:crew-verifier`): the ticket carries an `exit` section (given/when/then, 3–6 lines, written at spawn, approved in the same ⏳ block — no exit lines, no spawn); after the coder's pr exists:
   `cd <repo> && claude --bg -n '☕️ 🔎 BYT-N verify: #<pr>' --model opus --effort medium '/x:crew-verifier BYT-N <pr url> <coder registry name> <cclio registry name>' --remote-control`
   **the loop runs coder ↔ verifier; cclio reads one round line per round, arbitrates a dispute or a round-3 stop, and gets the coder's single report on `clean`** (dima 2026-09-20 — the DOT-254 phase-0/2 rounds came to cclio because my spawn note said «report to me only», which overrode the skill and cost a hop plus a page per round; never write that note again). the coder's brief names the verifier by its registry name (`☕️ 🔎 BYT-N verify: #<pr>` — one pattern for every member: mode · role emoji · ticket · role word: what; dima 2026-10-05, the sidebar showed `🔎 verify: FRM-268` beside `🔧 FRM-268 code:`), never a session id — the verifier is spawned after the pr opens, and a session id was unreachable by `SendMessage` on 2026-09-18 while the name resolved; freebies and `dima`-mode coders get no verifier. model tier is decided: the verifier is opus 5.5 medium (2026-09-28). model diversity, if wanted, comes from the ci reviewer, not the verifier.
   type-first (`🔧 code:` · `🔬 research:` · `🧪 probe:` · `⏰ area:` · `🔎 verify:` · `☁️ cloud:`); **the mode leads, then the role** (dima, 2026-09-28): `☕️` a lane (dima present), `🎯` a shift (`cclio:shift`, presence `near` or `away`) — `☕️ 🔧 BYT-88 code: journal polish`, `🎯 🔎 sys verify: #114`. a shift's unit is its shift name, a lane's is its ticket; shift members ping only when fully done or blocked. the sidebar groups by repo and sorts by time, so the name is what makes one mode read as one block. `-n` typed BEFORE the prompt, every child, probes and cloud sessions included. `-n` is the registry name; `--remote-control <name>` labels only the rc card, and an unnamed session names itself (measured: `da9590aa` → «git hook dispatcher diagnosis»). a rename is a typed `/rename` inside that session (`claude attach <id>`); a coder has no tool for it. the `Agent` tool's `name` regex bans emoji/colons/spaces. dima steers running sessions by name in the desktop Code tab.
3. **cwd** — a coder is launched as `cd <target repo> && claude --bg …` in one command: the only
   door that derives its stack from cwd (2/2 clean on 2.1.258). a subagent inherits the
   coordinator's brain whatever the cwd — fine for a probe, wrong for a coder. the brief asks the
   coder to name its loaded AGENTS.md paths in its first reply — the bleed detector.
4. **ticket** — pass the id; a `- ticket:` line on every commit, never a close marker —
   **cclio verifies, then closes**, with the closing word in the body.
5. **identity** — the coder token and the done-comment mechanics live in `x:crew-coder`; check the
   brief carries them. 📌 **cap the comment at ~12 lines** — what shipped, what is left, measured
   numbers, one line per defect; the essay stays in the coder's transcript. dima on the uncapped
   ones: «comments are poems for me».

## measured, not read from a schema

- **`--effort` is honoured** on `claude --bg` — pass it every time, it is a flag, never inherited.
  a `Workflow` `agent()` call honours its per-call `effort` too (2.1.258).
- ❗ **a plugin bump does not reach a running desktop-born session** — `/reload-plugins` + `/reload-skills` in a Code-tab coder left it on x 0.11.167 with 0 LSP servers while the cache held 0.11.175 (2026-09-30, the speak coder). a skill or LSP change is tested in a FRESH session; the probe is the session reporting its loaded version, never «i reloaded».
- ✅ **a user-only skill runs when the spawn prompt starts with it** — `claude --bg '/run-skill-generator <app> …'` generated 9 run skills with no hands (2026-09-27, cc 2.1.283). the same door as `/x:crew-coder`: a skill a model cannot load is typed by the spawn instead; a `SendMessage` carrying the slash text still does not expand.
- ❌ **a prompt runs ONE slash command: everything after it is that command's args, by design** — a `claude -p --model haiku` probe with two matt skills on two lines: line 1 expanded, line 2 became line 1's argument (cc 2.1.289, 2026-10-07; ccrow read the mechanic right, a typed prompt does the same). re-probed on 2.1.292: two skills stacked on ONE line deliver only the first body too, though the skills docs say up to six stack at the start. mid-message, a `/name` is only a hint the model may act on. a second user-only skill is read from its `SKILL.md` (`sys-skills`).
- ✅ **`claude --bg '<prompt>'` RUNS the prompt** (re-verified 2.1.258; it came up idle on 2.1.239).
  `SendMessage` is still how you brief it later, and the only way to attach `notify_when_idle`.
- ⚠️ **a peer answering in plain prose reaches nobody** — only a message call travels; say so
  in any brief expecting an answer. a Code-tab-born session has cc `SendMessage` + `ListAgents` too (probed 2026-10-04 on cc 2.1.289: a desktop-born sonnet answered cclio's message through its own `SendMessage`, deferred until loaded); the desktop's `mcp__ccd_session_mgmt__send_message` is a second, one-way door. **both, always:** the ping for timing, the transcript (`list_events`)
  for the picture — dima also steers the coder in its own chat, and only the transcript shows that.
- 🚨 **a hang is mine to break** (dima 2026-09-20, after a whole loop stood still — coder, verifier and coordinator all idle): the coordinator is the only member that sees every session, so it is the detector. every member is subscribed (`notify_when_idle`, re-armed on every send); an idle notice with an open assignment → ping the idle member in the same turn with the next concrete step; no reply within ~5 min (a `Monitor` on the registry status, deadline stated) → ping dima if he is around, otherwise re-brief from the member's CST or respawn; a stall is reported the moment it is seen, never folded into a later summary
- 🚨 **a step a member waits on is announced to it in the same turn** (2026-10-02): i re-labeled #120 for its review and told no one; the coder said «the re-label is your call» and waited while i waited on the review. the action and its `SendMessage` go out in one tool batch.
- 🚨 **an idle notice is a check, never a «nothing new»** (dima 2026-09-20, after a coder stalled twice within minutes): on every idle notice read the member's last assistant text (`jq` on its transcript, `~/.claude/projects/*/<sessionId>.jsonl`) — a ⏳ or a question there is a stall, whoever it is addressed to (frame-1b sat 11 min on two asks to dima, 2026-10-06) — then run `git -C <worktree> status --short` + `git log -1` against the coder's last ping; a dirty tree, an unpinged commit or an open assignment → nudge in the same turn. the stall then lasts seconds, unattended
- ⚠️ **`notify_when_idle` subscriptions die on a coordinator restart, silently** — re-subscribe
  after every restart; an empty `SendMessage` costs nothing.
- ⏱️ **a coder idle on its own timer needs no re-arm** — its report message is the signal; three re-arms fired at once on 10-05
- ⏱️ **the idle notice is QUEUED, not immediate** — it drains at your next tool round, so it can
  land after the session it reports was stopped. read the timestamp it carries, never its arrival
  time (2.1.251).
- 🚨 **remote control has ONE owner per session** (loser prints 4090). Start in the terminal, treat
  the desktop Code tab as join-only. 📌 handover direction untested — assert no cause.
- 🚫 **the desktop Browser pane (`mcp__Claude_Browser__*`) exists ONLY in a session the Code tab itself created** — injected via `--mcp-config` at creation, never on resume, never for `claude --bg` or remote-control (sources in `docs/knowledge/fleet-claude-capabilities.md`). a browser-needing coder is a handoff dima opens in a fresh Code-tab session; a terminal-born cclio has no pane. `x:browser-headless` works from either.

## briefing and watching — write freely, read on a leash

**The coder contract is `x:crew-coder`** (`plugin-x/skills/crew-coder/SKILL.md`; model-loadable since x 0.11.211, its description fires only on a brief that names it — `crew-verifier` the same): skill set, lane, identity, done-comment cap, ping-back. ✅ **the `--bg` prompt expands it** (measured 2026-09-07). a reused, already-running session gets it by a `SendMessage` that says «load the `x:crew-coder` skill» — raw slash text in a message never expands (2026-09-07: the coder posted its comment as dima). proven 2026-10-06: `frame-1b`, a running session, loaded it on a plain message for FRM-327 (x 0.11.211). cclio adds only the job, the ticket, its own session id, and any skill the work drifts into — a complete brief suppresses the skill router (measured on DOT-233: guide-code never loaded), so an unnamed skill is an unloaded one.

🖼️ **visual iteration runs in an artifact; main gets the pick** — six hero versions in an hour with no commits, against three takes plus a jar hero shipped to main and replaced the same day (2026-09-24). and **one sample before the set**: five app jars built from a relayed spec were all turned down; one jar in the artifact would have caught it. an Artifact `read` without `path` costs ~15k tokens; `list scope=files` + `read path=` is the route, the full read is only the republish gate.

🎨 **comp first** — a design job opens with a `design` canvas dima approves in the artifact, then `impeccable` builds the code from that comp: its finish-reviewer judges the build against the comp, its documenter derives `DESIGN.md` from the shipped code. one coder, both skills in sequence (measured 2026-09-06: the two halves ran in two sessions and composed; impeccable's `PostToolUse`/`Stop` hooks are user-scope and fire in every session — a clean a/b needs the competing plugin disabled per lane). the canvas lane touches no files; the build lane starts only after his word on the boards. 📌 **the impeccable plugin stays ON, user scope, no toggling** (dima, 2026-09-28: «i'd like to keep it enabled, do not like the hassle of toggling it»). the toggle never held in bytes anyway: bytes' own `.claude/settings.json` enables it at project scope, so every bytes session ran its hooks whatever the user toggle said (the sys shift, 2026-09-28). its cost is a slower Stop after `.ts`/`.js` edits (a design deep pass), never a block.

A research brief asks for a **structured summary, never a file dump** — paths with line ranges, who owns what, footguns, and «what is NOT in the area» (borrowed from g2i's spec skill, 2026-09-03). **A project-approach question (a stack, build-or-not, a vendor pick, a process design) runs `advise-project-approach` — adopted 2026-09-29, a standing habit**: reach for it whenever a plan is about to be chosen; it ran blind in a fresh agent, it caught the one trap every other lane missed (Claude Design's design-system import breaking the blinding). **An architecture question names `neuroarxiv` as a lane** (plugin `neuroarxiv@neuroarxiv`, cclio scope, auto-updated): a vendor-only research on the verifier missed the two papers that reshaped its spec (2026-09-18).

🚧 **every brief carries a `not yours: …` line** — what another member owns, written as a fence («crossing it is a stop and a question»), so a coder never duplicates or crosses it (the refresh-crew-coordinator run, 2026-10-08: anthropic's research system fixed duplicate subagent work with exactly this line; MAST puts task-spec and termination failures at ~24 % of 1,600+ traces). the exit lines are the termination half, already ours.

🧭 **context pointers, never restatement** (borrowed from matt's chief-of-staff, dima's yes 2026-10-07: «both are very useful ideas»): a brief or a `SendMessage` names the spec (`.scratch/<feature>/`), the pocket item, the commit or the research doc, and adds only what none of them holds — «don't duplicate information already available via pointers». a restated ticket drifts from its source the moment either changes.

Message the coder whenever; it answers **once** per assignment, blocked or done. `git diff` in its
cwd beats any message. Doneness is a **written marker** (final commit + report), never transcript
archaeology. Subscribe, never poll. Budget three round trips — more means the brief was wrong.

**Every «please test» carries the exact port link, and a screenshot's url is read before its report is relayed** — two rounds of #96 went to dima's reports from `:5180` (main, v1) while the pr lived on `:5190` (2026-09-25).
**A pr cclio opens for a coder is opened as the coder app, never as dima** — a frame coder pushes itself with `x lane push` (it pushes through the main checkout) and opens its pr with `x lane pr-open`; when cclio opens one for it: `GH_TOKEN=$(node script/github-agent-token.ts) gh pr create …` renders as `x-coder[bot]`; a plain `gh` made #50 dima's own pr (2026-09-28).
**A watch lives until its PR merges or closes, never until its coder stops, and a cloud launch arms a status watch in the same turn.** 2026-09-28: I stopped the #112 watch when the coder finished and asked for a 3rd review round with nothing to wake me; #112 sat green for 30 minutes, and the finished cloud Browserbase round sat unread beside it. the mechanism is `📡 pr-watch`, a session-long plugin monitor (`.claude/hooks/pr-watch.sh`): every open coder pr in frame + bytes wakes cclio on a new commit and once per head when all checks are green. a cloud session sends no idle notice and no cli lists it, so its brief ends by pushing its report to a `cloud/<slug>` branch, which the same monitor sees.
**One coder with two prs in sequence gets one verifier that takes them in turn**, not one per pr — it keeps the context it built on the first (dima's question on #113/#114, 2026-09-28).
**A pr-lane spawn arms a pr watch in the same turn** — a `Monitor` at the 30-min max, re-armed on every expiry notice (no watch outlives 30 min since cc 2.1.271; an unattended night goes blind without the re-arm), polling `gh pr list --search '<ticket> in:title'` (the branch name differs by door: `EnterWorktree` makes `worktree-<ticket>-…`, the brief template says `coder/<ticket>-…` — a `head:coder/` search watched #67 for 30 min and saw nothing, 2026-10-08) and the pr's commit count once a minute; it wakes me when the pr exists and when it gains commits, so the verifier spawns within a minute. the coder pings only when done or blocked: #102 opened silently and the verifier started an hour late, then idled on a pr whose commits were still local (2026-09-26).
**A verifier's cap stop ends like `clean` for the handoff** — the coordinator adds dima as reviewer the same turn; on #94 the cap path skipped it and dima had no approve button.
**A research pick is checked against the spec's own rules and dima's past verdicts before it enters a ticket or a reply** — leva was a research lane's default r3f panel and broke «every control is a kit component»; the coder caught it, dima's A/B killed it. a research brief carries `decided against: …` lines for what he already rejected (2026-09-26: a ci lane re-proposed builds on github actions, rejected two weeks earlier, and it reached him as a recommendation).
**A taste reference dima names goes into the ticket as a link the same day** — the rzpp demo he liked was missing, so the spec's «plain scroll pans» fought it for a decision round.
**Exit lines are checked against main at planning time, claim cross-view things as equalities, and name a dependency on another pr** — «ignoreBuildErrors gone» was already true on main; «the count is the headline everywhere» became checkable only as «the same number on every view», and that is where the bug was; an exit line that holds only after #111 merged never said so (2026-09-28). **A brief that points at files fetches main first** — two briefs named files that lived only on an open pr.
**A baseline in an exit line names its repo pairing and its filter; a time window names today-inclusive and local** — «beside 25 / 36 min» shipped swapped and renovate's 0-min merges were in nobody's spec (FRM-316 retro, 2026-10-06; until: FRM-311). **An exit line built on a data field carries its one-command live count in the ticket, and a parser line is tried against shapes counted from real data, never only the example it names** — FRM-346's «-dirty build» line held literally while 665 of 665 trace lines were dirty and 73 % of real calls hid behind it; `J=…;` was named and `S=$(…)` fell through (FRM-346 coder + verifier retros, 2026-10-08). **A rate bar in an exit line names its minimum n** — «critical recall ≥ 95 %» on 9 critical prompts meant 9 of 9 (FRM-305). **The spawn ask's exit lines state rules, name surfaces, and cover every list item** — one example string, «any bake», and a standing list with no lines each cost a round (BYT-103/104/105).
**A comparison brief names the question it answers and the cheapest artifact that answers it** — dima asked the cli a/b/c «which stack gives the look»; three full builds (~2.5 h) showed no difference, one showcase screen per arm (~30 min) flipped the pick (2026-10-06, a `#dima-caught`). **A tui brief asks for vhs pngs, never freeze** (freeze cannot replay ink or bubbletea), **and says «the shots are the test for redraws»** — bubbletea's ghost rows took 3 rounds, caught only by shots. **Parallel arms share one shooter and one registry** — said up front, it saves two rounds of relays. **A no-pr lane still gets a local `code-review` before its report** — a fork's review found 9 real defects the tests and shots missed (FRM-284 retros).
**A visual spec names the artifact to match, never the recipe** — «22 % corner mask» cost three probe rounds; «match `handoffs.png`» would have been right and cheaper (2026-09-22).
**A ui-shaped ask gets its data measured before anything is drawn** — «the history view reads them as one chain» named a view that did not exist; dima's real rows (7, 5 zero-length) shrank it to a writer seam (2026-09-22).
**A script that narrows a shared file to HEAD reads HEAD at write time, never before the work** — a coder's package.json reset read HEAD before cclio's rename landed and shipped the pre-rename key (2026-09-22).
**An AGENTS.md imperative about WHEN acts at read time** — «start `ray develop` first» was read, then recalled after the whole edit; dima caught it (2026-09-22).
**A guess in a brief comes with the one log query that would test it** — «cmd+tab eats the tab» was wrong; one query on the neighbour log lines found the real leak, release order (2026-09-28). **Exit lines are checked against the real surface before the spawn** — `del` on a board with no del key and «no scroll» on a page with a footer each cost a decision round.
**A verify-kit brief for an app that navigates in-page says «cold open and in-page move»** — loupe moves by pushState, `loads` was built for a cold open only and cost 3 verifier findings (BYT-117, 2026-10-02). **A research fact in a brief carries «?» until it is measured** — parallel's unmeasured «eleven v4 rides text-to-dialogue» went into a speak brief as fact and cost the coder 15 min to disprove (2026-09-29). **A latency-bound tool measures each stage before the stack is chosen** — the node design (raycast → node → op-run → ffplay) was built, shipped and deleted for a swift daemon once its 0.8 s op-run and 0.3 s player spawns were timed. **A blind run gets a cwd outside the repo and «do not read ~/frame» in its brief** — a «blind» advisor read the built code through its cwd and graded the plan, not the problem. **A bug brief says «check the timeline first»** — the keep-hot brief led with my reload theory; transcript timestamps disproved it in 2 minutes, after a 15-minute tty probe had already failed (FRM-302, 2026-10-05). **A capability is chosen after grepping its word across the whole types file** — the coder took the `Svg` `<title>` route from one line while the working `Box` hover recipe sat 40 lines away, two look rounds lost (FRM-303). **A brief carries the symptom + the evidence; a guessed cause says «guess»** — the job-6 brief asserted «a per-command key still exists» as the cause of a 401, and three curl calls found an empty header instead (2026-09-18).
**A move is proven by executing every moved entrypoint** — a grep for the moved names missed a second relative import and the move died at runtime with typecheck green (2026-09-19).
**Every word a brief carries is checked before it is typed** — a grep done-criterion is run once before it enters a brief («old name absent» can never be empty when the new name contains the old); every verb, function name and file list gets `--help` and one grep (a brief named a cli verb that did not exist and a function by the wrong name, 2026-09-15).
**A brief that adds a field names its value set or its default**, and **enumerates every writer of that field, not only the readers** — the coder invented the lane vocabulary and found the feature shipped dead without its writers.
**A brief whose proof needs dima's hands says so at the TOP** and asks up front — the rcmd count needed three of his presses, discovered one at a time at the end (2026-09-19).
**A coder's report is a candidate, not a finding** — check its claims before relaying.
**A relay to a coder names the source it was read from** — and a claim about a repo's behaviour
opens that repo's `AGENTS.md` first: «gitignore handler.js, the build regenerates it» was
reasoned from `vercel.json` alone; the repo's own docs said vercel picks functions at clone time,
and the coder held (2026-09-04).
**A message stating a result goes after the command's output, never in the same batch** — «keychain item deleted» reached the coder while the guard was refusing the delete (2026-10-07).
**A timeout is not proof of failure** — verify with `ListAgents` before respawning; a blind retry
double-runs the work.

## the shared working tree

**One agent per repo where possible; parallelism goes ACROSS repos.** When two share:

- **at boot, `ListAgents` for a peer cclio in the same repo** — one found → one ownership message
  before the first edit (the files you will touch, pathspec commits). a hold on a peer is released
  by an explicit message, never an implied one (2026-09-26: a whole sweep ran beside `cclio-ef`,
  found through `git status` surprises; dima had to ask whether she was released).

- state file ownership at spawn; staging and pathspec commits follow `x:cmt` §7. two coders
  live at once: the second brief names the first's files, or cclio holds the first's merge until
  the second's pr is open (a merge mid-flight broke a rebase, 2026-09-11). **the split is stated at spawn, both coders spawned in one turn, and the second brief carries «tree as of HH:MM, done: …»** — a brief written against a moved tree cost the second coder its first stretch (2026-09-24). a shared `<area>/LANES.md` (who owns what, last touch) replaces about half of the coordinator's relays; it is deleted in the same step that stops the coders.
- **a rename of a name a live session uses** (a label, a github app, a branch) is relayed to
  that session the same minute — a coder cannot infer it from its own tool output; every review
  request failed for an hour after `x-coder-bot` → `x-coder-cc` (2026-09-11).
- **a cap is real only if something reads the counter before acting** — the actor never keeps
  the tally from memory; the brief names the api call and the moment (#76: the coder tracked
  rounds by recall, i counted a workflow-wide list; both wrong, 2026-09-11).
- **known items go in ONE batched brief** — ten items dripped over a session re-shaped the same
  predicate four times; hold a pr ten minutes rather than drip.
- the merge monitor's «coder idle» guard reads the live session cwds against the worktree path,
  never a session name (a name-wired guard pruned under a live coder, 2026-09-11).
- `git status` before staging; anything modified that is not yours stays untouched.
- 🚨 **a worktree is pruned only when no live session sits in it** — `jq -r .cwd ~/.claude/sessions/*.json` lists every live cwd; a match means hands off, whatever `git status` says (two prunes under a live push, 2026-09-08; the merge monitor now waits for the coder to be idle, this is the check for a hand-run `scout`).
- `index.lock` means a peer is committing — wait, retry, **never delete a lock**.
- 🚨 **verify the hash after every commit** (`git log -1`) — the real risks are a silent no-op and
  a silent sweep, both observed.
- 🚨 **bytes is ONE shared checkout: a coder's `git switch` moves every session's tree** (measured 2026-09-07 — the prettify branch took the dev servers with it). the PR lane makes every coder concurrent, so **a `coder/*` branch lives in its own worktree** (`git worktree add .claude/worktrees/BYT-N-<slug> -b coder/BYT-N-<slug> main` — `<repo>/.claude/worktrees/` is the one location, cc's own default and where `EnterWorktree` puts its trees; dima's call 2026-09-08 after two locations produced drift); the main checkout stays on `main`. `pnpm worktree:seed` makes a fresh tree runnable (`CI=1` install, env copies, port offset).
- 🎯 **dima's «no worktree» means «on `main`, no branch, no pr»** (2026-09-18: a coder read it as «branch in the shared checkout» and its `git switch` parked cclio's tree for an hour). the brief says «default lane: commit on main, cclio pushes»; a branch appears only when he says «pr».
- 📌 **a quick-lane coder on main spawns with `--settings '{"worktree":{"bgIsolation":"none"}}'`** (before the prompt, like `-n`) — without it the bg-isolation guard refuses `Edit`/`Write` in the shared checkout and the git-text guard rides along; the FRM-306 mods coder lost ~15 calls editing scratch copies. proven 2026-10-05: a haiku `--bg` probe with the flag wrote a file to frame main, cc 2.1.289. only the pr lanes (feature, app/redesign) get a worktree; with `"none"` main has no protection, so two coders on main still need disjoint files (wayfinder FRM-312). `bgIsolation` has no per-path exemption; a main-lane bg session that started without the flag edits through `scratch-edit pull <paths>` → Edit/Write the printed copies → `scratch-edit push` (plugin-x bin; push refuses a file the repo changed since the pull).
- Worktrees at ~5+ agents or genuine concurrent edits, not before. a worktree brief's step 0 is
  `CI=1 pnpm install` (inline, that command only) — kills the shared-hooks rewrite
  (`rules/fleet-hazards.md`, git hooks).
- ⚠️ a frame worktree pushes only through `x lane push` (a plain `git push` dies on the mirror gate) and runs `pnpm` only as `CI=1 pnpm install` (`rules/fleet-hazards.md`, git hooks); dima or cclio merges. 📌 before a frame pr-lane spawn, push main first — a coder's `x lane merge-main` merges origin, and a local main ahead of origin stalled the v1.1 coder 17 min (retro run 1, 2026-10-06).

## lifetime and stopping

Per-case judgment: keep a coder warm when its context is expensive and the next assignment is
nearby; respawn when the work is unrelated or the context is polluted. **Always stop probes.**

- 🚨 **stop with `claude stop <jobId>`, never `kill <pid>`** — four rc sessions killed by pid came
  back with new pids (2026-08-30, cause unconfirmed). the registry file removes itself on exit,
  so `ls` is the whole verification. never pattern-kill.
- `TaskStop` reaches only subagents *this* session spawned.
- ⚠️ **deleting the session in the desktop Code ui does NOT stop it** — measured: card gone,
  process alive. Never report a coder stopped because a ui said so.
- 📌 before closing a spawn, ask what it is still evidence for — «finished its work» and «finished
  being useful» are different states.

**Context size is a cost, not a precision cliff — until our own probe says otherwise**: no
long-context number exists for the 5 family, the last measured knee (opus 4.6) sits past 256k, a
90k boot on a warm 1h cache is ~2 cents a turn. what does cost: a cache gone cold after a >1h gap.
the probe (10-needle recall + one edit at 100k / 400k / 800k) rides `refresh-crew-coordinator` at
every model bump — the curve is per-release.
📌 **the top of the cost curve is measured, not capped**: a coder at 250–460k context, 638 steps in 75 min, took ~85 % of a 5-hour window (2026-09-12). dima's call: no ceiling, no auto-compact below the max — a coder that compacts mid-task forgets the task. cases log in `docs/test-drive/ctx-burn.md`; dig in when the pattern repeats.

**Cost of a reading agent = bodies × size, never agents × a flat number** — the board-sweep
workflow was guessed at ~150k and spent 1.27M for 82 ticket bodies + comments.

**a coder's last act is a retro** (dima, 2026-09-08, after a test that surfaced nine ranked findings): ≤20 lines to the coordinator, ranked by cost, with the WHY stated in the ask — the fleet improves itself only from what its members saw. the shape of the ask matters: name the angles (the brief, the steers, the lane, the reporting, what nobody asked), ask for blunt, name-the-moment specifics. cclio folds it into the flawlog flush. the contract line lives in `x:crew-coder`.

Full evidence base: `docs/knowledge/spawning-mechanics.md`, on demand.

Related: [method-report-verify](method-report-verify.md)
