---
name: crew-lead
description: Load BEFORE any spawn, brief, watch or stop of a crew member — a coder, verifier, designer, probe, cloud session or subagent — «spawn», «brief a coder», «verifier yes/no», a stalled or idle member, «stop the coder». the coordinator's spawn craft: doors, models, preflight, briefing, watching, the shared tree.
---

# crew-lead — spawning and running the crew

you are the coordinator of a crew: cclio today, a standalone squad lead later ([FRM-368](https://linear.app/x-com/issue/FRM-368)). «cclio» below means whoever coordinates. this skill loads on demand, never resident: a question answered before anyone is spawned needs none of it.

a spawn reads all four files below before its first brief: spawns are a few a day, and a lesson missed at spawn time costs a round. a later step (an idle notice, a stop, a commit beside a peer) re-reads the one file it needs. after a compaction this body comes back whole; the four files do not, so a step after one re-reads them:
- picking a model, an effort, or spawn-vs-reuse → [models.md](models.md)
- writing a brief, relaying a steer, watching a pr → [briefing.md](briefing.md)
- an idle notice, a hang, a member to stop → [watching.md](watching.md)
- two members in one checkout, a worktree, a commit beside a peer → [shared-tree.md](shared-tree.md)
- the exit lines a brief carries → `cclio:shape-lane`

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
- **a pick-up is a spawn** (dima, 2026-10-10, after a restarted mods coder got a brief with no `plugin-authoring`): when dima reinits a member (a big context, a Code-tab restart so he sees its mods) or opens a thread and says «pick it up», the first message inits it by role, the same as a fresh brief — the handoff ingest never replaces it. per role:
  - mods coder: `x:crew-coder`, the bundled `plugin-authoring` skill, `home/.claude/plugin-x/mods/AGENTS.md` whole, `mods/api-map.md`
  - cli coder: `x:crew-coder`, `x:guide-go`, `x/AGENTS.md`, `x/PRODUCT.md`
  - bytes coder: `x:crew-coder`, `x:guide-typescript` + `x:guide-react`, the app's essentials (preflight 0.7)
  - ccrow: her boot from `ccrow/AGENTS.md` and the `x:crew-adviser` charter
- **`/fork [prompt]`** — a third door (dima, 2026-09-05): copies THIS conversation into a new
  background session, no brief, the coder starts knowing everything cclio knows. reach for it
  when the job needs the session's context (a design bundle discussed here → `theme.css`, a
  grill's outcome → the build); `--bg` when it needs a clean one. dima may say «fork it»; cclio
  suggests it when the brief would be longer than the context it replaces. unmeasured yet:
  whether the fork inherits the Code-tab pane and the desktop channel — probe on first use.
`isolation: "worktree"` gives a real git worktree — expensive, only when agents would collide. 📌 its tree starts from `origin/<default>`, never from a local branch ahead of it (4 of 4 on 2026-10-06, while main was unpushed): push main before the spawn, and the brief needs no line about it (FRM-343 retro: dead weight once main was pushed).

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
   **the verifier is dima's call, asked before EVERY coder spawn** (dima 2026-09-20): the spawn ask carries the sealed exit lines as a count with the ticket link (cclio writes and preflights them, never his to review — dima, 2026-10-09; `cclio:shape-lane`) and the question «verifier: yes/no?»; a coder spawned without the ask was the miss on DOT-254. **a pr-lane coder spawns with its verifier** (dima 2026-09-18, spec = `x:crew-verifier`): the ticket carries an `exit` section (given/when/then, 3–6 lines, written and sealed by cclio before the spawn — no exit lines, no spawn); after the coder's pr exists:
   `cd <repo> && claude --bg -n '☕️ 🔎 BYT-N verify: #<pr>' --model opus --effort medium '/x:crew-verifier BYT-N <pr url> <coder registry name> <cclio registry name>' --remote-control`
   **the loop runs coder ↔ verifier; cclio hears nothing per round (dima, 2026-10-08), arbitrates a dispute or a round-3 stop, and gets the coder's single report on `clean`** (dima 2026-09-20 — the DOT-254 phase-0/2 rounds came to cclio because my spawn note said «report to me only», which overrode the skill and cost a hop plus a page per round; never write that note again). the coder's brief names the verifier by its registry name (`☕️ 🔎 BYT-N verify: #<pr>` — one pattern for every member: mode · role emoji · ticket · role word: what; dima 2026-10-05, the sidebar showed `🔎 verify: FRM-268` beside `🔧 FRM-268 code:`), never a session id — the verifier is spawned after the pr opens, and a session id was unreachable by `SendMessage` on 2026-09-18 while the name resolved; freebies and `dima`-mode coders get no verifier. model tier is decided: the verifier is opus 5.5 medium (2026-09-28). model diversity, if wanted, comes from the ci reviewer, not the verifier.
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
