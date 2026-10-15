---
name: crew-lead
description: Load BEFORE any spawn, brief, watch or stop of a crew member — a coder, verifier, designer, probe, cloud session or subagent — «spawn», «brief a coder», «verifier yes/no», a stalled or idle member, «stop the coder». the coordinator's spawn craft: doors, models, preflight, briefing, watching, the shared tree.
---

# crew-lead — spawning and running the crew

you are the coordinator of a crew: cclio today, a standalone squad lead later ([FRM-368](https://linear.app/x-com/issue/FRM-368)). «cclio» below means whoever coordinates. this skill loads on demand: a question answered before anyone is spawned needs none of it.

a spawn reads the four files below before its first brief: spawns are a few a day, and a lesson missed at spawn time costs a round. a later step (an idle notice, a stop, a commit beside a peer) re-reads the one file it needs. after a compaction this body comes back whole and the files do not, so a step after one re-reads them:
- picking a model, an effort, or spawn-vs-reuse → [models.md](models.md)
- writing a brief, relaying a steer, watching a pr → [briefing.md](briefing.md)
- an idle notice, a hang, a member to stop → [watching.md](watching.md)
- two members in one checkout, a worktree, a commit beside a peer → [shared-tree.md](shared-tree.md)

read only when the job names it:
- a design lane (a canvas, a spread, the pick) → [design.md](design.md)
- impeccable named in a brief → [impeccable-refine.md](impeccable-refine.md)
- the exit lines a brief carries → `cclio:shape-lane`
- a price, a model card, a probed spawn fact → [references/model-cards.md](references/model-cards.md), [references/spawn-mechanics.md](references/spawn-mechanics.md)

**one coder by default, two with a stated reason, never three.** parallelism goes across repos, not into headcount.

## the doors

the split is **disposable vs watchable**, never research vs code.

- **subagent** (`Agent` tool) — runs inside cclio and dies with it; dima cannot open it. it takes `model` and a per-call `effort` (2.1.292; the per-call one overrides a card's `effort:`). any type but `fork` starts with no thread but with the whole fleet memory (a generic agent writes ~82k on its first request, ~117k spawned from cclio, against 8–10k for an `omitClaudeMd` card; measured 2026-10-15) unless its card sets `omitClaudeMd`, and is briefed like a colleague who just walked in; a bulk read-only job goes to `sifter` or `researcher`, which skip that memory.
- **fork** (`subagent_type: "fork"`) — carries this whole thread (~220k) and always runs on the parent model; every fork prompt carries `why-fork: <what parent context it needs>` or `x-mod-guard` refuses it. a lookup, a test drive or a bounded research goes to a fresh agent instead.
- **background session** (`claude --bg`) — real, survives a coordinator reset, takes `--model` and `--effort`, spawned with `--remote-control` so dima can join it. the default door for coding.
- **the Code-tab door** — dima opens a session in the app dir (root when the job crosses apps) and pastes a one-line pointer to a brief file in cclio's scratchpad; the member pings back by `SendMessage` (or `mcp__ccd_session_mgmt__send_message`). a steer cclio relays is never dima's grant to the member, who confirms with him.
  - 📌 desktop auto-archive ends a Code-tab session the moment its pr merges or closes; `--bg` and `--cloud` sessions stay. a job that may need rounds after its merge spawns `--bg`.
- **a mods coder is spawned by dima, never by cclio** (dima, 2026-10-10): he watches mods live in the coder's own tab, and a `--bg` session shows no mods in the desktop app. the lane ends with the brief file, the ask «open a Code tab in `~/frame` and paste: <pointer>», and a second fence holding the tab name (`☕️ 🔧 <ticket> code: <what>`); then the pick-up below.
- **cloud** (`claude --cloud`) — a coder on an anthropic vm: survives the mac sleeping, the cloud credit pays first, carries nothing of ours, cannot message back. the procedure is `x:crew-cloud`.
- **`isolation: "worktree"`** on an `Agent` call — a real git worktree, only when agents would collide. its tree starts from `origin/<default>`, so main is pushed before the spawn.
- **`/fork [prompt]`** (dima's door) copies this conversation into a new background session; reach for it when the job needs this thread's context and the brief would be longer than the context it replaces. the desktop's **side chat** is a fork parked beside the thread for dima's questions; real work stays in the main thread.

### pick-ups and refreshes

- **a pick-up is a spawn** (dima, 2026-10-10): when dima reinits a member or opens a thread and says «pick it up», the first message inits it by role, the same as a fresh brief; a handoff ingest never replaces it. per role:
  - mods coder: `x:crew-coder`, the bundled `plugin-authoring` skill, `home/.claude/plugin-x/mods/AGENTS.md` whole, `mods/engine.md` by section when a probe or a test bites, `mods/api-map.md`
  - cli coder: `x:crew-coder`, `x:guide-go`, `x/AGENTS.md`, `x/PRODUCT.md`
  - bytes coder: `x:crew-coder`, `x:guide-typescript` + `x:guide-react`, the app's essentials (§ preflight, app essentials)
  - verifier: `x:crew-verifier` with its four arguments
  - ccrow: her boot from `ccrow/AGENTS.md` and the `x:crew-adviser` charter
  - composer: `x:crew-composer`
- **a session claiming a lane** (a fork, a resumed twin) is checked against who started it before anyone moves; a member is addressed by the uds path from its last message, which always delivers.
- **a refresh without dima's hands**: a member cclio did not start clears itself (`clear_session` with `"self"` as its turn's last act; cclio's clear is refused on a tab dima opened); its registry name stops resolving after the clear, so the pick-up goes by its `local_…` session id.

## preflight — every spawn, in order

- **reuse or spawn** — an idle member revives by message with its context intact; the grid in [models.md](models.md) § spawn or reuse decides.
- **trust key** — a `--bg` spawn reads its exact folder in `~/.claude.json` (`projects[<path>].hasTrustDialogAccepted`), never a trusted parent; a new spawn home gets the key in one command, `jq … ~/.claude.json > tmp && mv tmp ~/.claude.json`, since every live session writes that file; never a `cp` from an older copy.
- **spare age** — every `--bg` spawn claims a pre-warmed `claude bg-spare`, and a day-old spare once booted a coder without the repo's root `AGENTS.md`. `ps -o pid,lstart,command -ax | grep '[b]g-spare'`; older than a day → `claude daemon stop --keep-workers`, then spawn. the brief's «name your loaded AGENTS.md paths» line is the belt.
- **app essentials** — the target app passes `node ~/projects/bytes/script/apps-essentials.ts --app <app>` (`x:app-setup-essentials`); a red row is filled before the spawn, or the brief says which row the coder fills first. a 🟡 row rides the brief too, after the app's wisps.
- **tier and cwd** — code, a repo, a real filesystem ⇒ a real session, launched as `cd <target repo> && claude --bg …` in one command: the only door that derives its stack from cwd. a subagent inherits cclio's brain whatever the cwd.
- **the verifier ask** — dima's call before every coder spawn: one orbit ask carrying the sealed exit lines as a count with the ticket link, «spawn <ticket> now? verifier: yes/no» (`cclio:shape-lane` § 5). no exit lines, no spawn. freebies and dima-mode coders get no verifier.
- **the brief file** — written to cclio's scratchpad, opening `/x:crew-coder BYT-N <job> coordinator: <cclio registry name>`; `x brief check --repo <repo> <file>` passes before the spawn. an inline brief is refused by `x-mod-guard`.
- **the argv** — literal, `-n` before the prompt, the prompt before `--remote-control` (the flag once ate a 1.5 kB brief as its rc label):
  - pr lane: `cd <repo> && claude --bg -n '☕️ 🔧 BYT-N code: <what>' --model opus --effort medium "$(cat <brief file>)" --remote-control`
  - quick lane on main: `cd <repo> && claude --bg -n '☕️ 🔧 BYT-N code: <what>' --model sonnet --effort medium --settings '{"worktree":{"bgIsolation":"none"}}' "$(cat <brief file>)" --remote-control`
  - pr-lane verifier, once the pr exists: `cd <repo> && claude --bg -n '☕️ 🔎 BYT-N verify: #<pr>' --model opus --effort medium '/x:crew-verifier BYT-N <pr url> <coder registry name> <cclio registry name>' --remote-control`
  - quick-lane verifier, on the coder's «final»: the same line with `-n '☕️ 🔎 BYT-N verify: main'` and `main:<base sha>` in place of the pr url
  - the loop is `x:crew-dna` § the pr pair; a spawn note never says «report to me only», which overrides that loop
- **names** — `<mode> <role emoji> <ticket> <role word>: <what>`. the mode leads: `☕️` a lane (dima present), `🎯` a shift (`cclio:shift`). role words: `🔧 code:` `🔬 research:` `🧪 probe:` `⏰ area:` `🔎 verify:` `☁️ cloud:`. a lane's unit is its ticket, a shift's its shift name, and a shift member pings only when fully done or blocked. `-n` is the registry name, typed for every child, probes and cloud sessions included; `--remote-control <name>` labels only the rc card. a brief names a member by its registry name, never a session id. a rename is a typed `/rename` inside that session; the `Agent` tool's `name` bans emoji, colons and spaces.
- **ticket** — pass the id; the id rides the branch name and the pr body, never a closing keyword. cclio verifies, then closes, with the closing word in the body.
- **identity** — the brief carries what `x:crew-coder` names: the coder token, the done-comment cap of § 6. dima on uncapped ones: «comments are poems for me».
- **the glide** — the lane's 🛼 glide card links the member the turn it spawns (orbit op `glide`, act `link`, role `coder` or `verifier`, `session` = the id `claude --bg` prints); the next siesta or the halt ends it ([watching.md](watching.md)).

<!-- failure: DOT-254 (2026-09-20), a spawn note «report to me only» overrode the loop; phase-0/2 rounds came to cclio, a hop plus a page per round. -->
<!-- failure: 2026-09-22 ccbee7b0, a day-old spare booted a coder without the root AGENTS.md; upstream #95589. -->
