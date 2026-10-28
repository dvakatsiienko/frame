---
name: crew-lead
description: Load BEFORE a lane spawn, brief, watch or stop — a coder, verifier, designer, probe or cloud session — «spawn», «brief a coder», «dispatch», a stalled or idle member, «stop the coder». Not for a subagent (`x:crew-subagent`) or cclio's sidecars ccrow and composer (`cclio:boot`).
---

# crew-lead — spawning and running a lane crew

you are the coordinator of a lane crew: cclio today, a standalone squad lead later ([FRM-368](https://linear.app/x-com/issue/FRM-368)). «cclio» below means whoever coordinates. this skill loads on demand, only when a lane member is spawned or run: a question, a subagent, or a sidecar needs none of it.

**the boundary** — this skill owns the watchable members a lane runs: a coder, a verifier, a designer, a probe, a cloud session, each a real session. a subagent of any card, a fork and a worktree-isolated agent are `x:crew-subagent`, open to every member and read first here too. ccrow and composer are cclio's sidecars: their start and revive commands live in `cclio:boot`.

a spawn reads the four files below before its first brief: spawns are a few a day, and a lesson missed at spawn time costs a round. a later step (an idle notice, a stop, a commit beside a peer) re-reads the one file it needs. after a compaction this body comes back whole and the files do not, so a step after one re-reads them:
- picking a model, an effort, or spawn-vs-reuse → [models.md](models.md)
- writing a brief, relaying a steer, watching a pr → [briefing.md](briefing.md)
- an idle notice, a hang, a member to stop → [watching.md](watching.md)
- two members in one checkout, a worktree, a commit beside a peer → [shared-tree.md](shared-tree.md)

read only when the job names it:
- a design lane (a canvas, a spread, the pick) → [design.md](design.md)
- impeccable named in a brief → [impeccable-refine.md](impeccable-refine.md)
- the exit lines a brief carries → the lane's spec, written by `cclio:shape-lane-dispatch`
- a price, a model card, a probed spawn fact → [references/model-cards.md](references/model-cards.md), [references/spawn-mechanics.md](references/spawn-mechanics.md)
- writing or sharpening a subagent card → [references/card-craft.md](references/card-craft.md)

**one coder by default, two with a stated reason, never three.** parallelism goes across repos, not into headcount.

## the doors

the split is **disposable vs watchable**, never research vs code.

- **subagent, fork, worktree agent** — disposable, inside the coordinator: `x:crew-subagent`.
- **background session** (`claude --bg`) — real, survives a coordinator reset, takes `--model` and `--effort`, spawned with `--remote-control` so dima can join it. the default door for coding.
- **the Code-tab door** — dima opens a session in the app dir (root when the job crosses apps) and pastes a one-line pointer to a brief file in cclio's scratchpad; the member pings back by `SendMessage` (or `mcp__ccd_session_mgmt__send_message`). a steer cclio relays is never dima's grant to the member, who confirms with him.
  - 📌 desktop auto-archive ends a Code-tab session the moment its pr merges or closes; `--bg` and `--cloud` sessions stay. a job that may need rounds after its merge spawns `--bg`.
- **a mods coder runs as a desktop-native thread, every other member as `--bg`** (dima, 2026-10-28):
  - why: a `--bg` session draws no mods in the desktop app (ccrow's tab checked by dima, 2026-10-28), and he watches mods live in the coder's own tab
  - start: cclio starts it with `mcp__ccd_session__start_session` — proven on FRM-427, 2026-10-28
    - `initiation: user_asked`, `context: fresh`, `cwd: ~/frame`, `use_worktree: false`
    - the title `⚡ 🔧 <ticket> code: <what>`
    - the prompt a one-line pointer to the brief file
  - close: at the lane's end it closes with `mcp__ccd_session_mgmt__archive_session`, since `stop_session` only interrupts a turn and leaves the tab open (inference until FRM-427's lane end)
  - a mods lane is always a quick lane, on main in dima's checkout, never a worktree or a pr, so he sees each mod change live; its verifier is optional, his call per lane (dima, 2026-10-27)
- **cloud** (`claude --cloud`) — a coder on an anthropic vm: survives the mac sleeping, the cloud credit pays first, carries nothing of ours, cannot message back. the procedure is `x:crew-cloud`.
- **`/fork [prompt]`** (dima's door, his side research too) copies this conversation into a new background session; reach for it when the job needs this thread's context and the brief would be longer than the context it replaces. the desktop's **side chat** (`/btw`) opened from cclio's tab is a live fork, fork-guard's banner and all; opened from a fork's tab it is a read-only copy that fires no hooks and sends nothing, its keepers reaching the main by dima's paste (both proven 2026-10-27).

### pick-ups and refreshes

- **a pick-up is a spawn** (dima, 2026-10-10): when dima reinits a member or opens a thread and says «pick it up», the first message inits it by role, the same as a fresh brief; a handoff ingest never replaces it. per role:
  - mods coder: `x:crew-coder`, the bundled `plugin-authoring` skill, `home/.claude/plugin-x/mods/AGENTS.md` whole, `mods/engine.md` by section when a probe or a test bites, `mods/api-map.md`
  - cli coder: `x:crew-coder`, `x:guide-go`, `x/AGENTS.md`, `x/PRODUCT.md`
  - bytes coder: `x:crew-coder`, `x:guide-typescript` + `x:guide-react`, the app's essentials (§ preflight, app essentials)
  - verifier: `x:crew-verifier` with its four arguments
- **a session claiming a lane** (a fork, a resumed twin) is checked against who started it before anyone moves; a member is addressed by the uds path from its last message, which always delivers.
- **a refresh without dima's hands**: a member cclio did not start clears itself (`clear_session` with `"self"` as its turn's last act; cclio's clear is refused on a tab dima opened); its registry name stops resolving after the clear, so the pick-up goes by its `local_…` session id.

## preflight — every spawn, in order

- **reuse or spawn** — an idle member revives by message with its context intact; the grid in [models.md](models.md) § spawn or reuse decides.
- **trust key** — a `--bg` spawn reads its exact folder in `~/.claude.json` (`projects[<path>].hasTrustDialogAccepted`), never a trusted parent; a new spawn home gets the key in one command, `jq … ~/.claude.json > tmp && mv tmp ~/.claude.json`, since every live session writes that file; never a `cp` from an older copy.
- **spare age** — every `--bg` spawn claims a pre-warmed `claude bg-spare`, and a day-old spare once booted a coder without the repo's root `AGENTS.md`. `ps -o pid,lstart,command -ax | grep '[b]g-spare'`; older than a day → `claude daemon stop --keep-workers`, then spawn. the brief's «name your loaded AGENTS.md paths» line is the belt.
- **app essentials** — the target app passes `node ~/projects/bytes/script/apps-essentials.ts --app <app>` (`x:app-setup-essentials`); a red row is filled before the spawn, or the brief says which row the coder fills first. a 🟡 row rides the brief too, after the app's wisps.
- **tier and cwd** — code, a repo, a real filesystem ⇒ a real session, launched as `cd <target repo> && claude --bg …` in one command: the only door that derives its stack from cwd.
- **the spawn word** — dima's pick of signed chunks in `cclio:shape-lane-dispatch` is the spawn; no second ask (the contract: cclio's `craft-fleet-flow` § lane init). no sealed exit lines in the spec, no spawn. a coder gets a verifier by default; a quick lane's pick says verifier yes or no, and dima says himself when he wants none elsewhere. freebies and dima-mode coders get no verifier.
- **the brief file** — written to cclio's scratchpad, opening `/x:crew-coder BYT-N <job> coordinator: <cclio registry name>`; `x brief check --repo <repo> <file>` passes before the spawn; its `wish:` line (or `wish: none`) sits in the first 10 lines. the brief names every live trial whose `fits:` matches the member (`script/test-drive-list.ts --spawn-hook`): each with how the lane uses it, or «trial skipped: <name> — <why>»; a verifier's argv carries the same names after its four arguments, behind the word `trials:`.
- **the pr mode** — a side-lane or shift brief says `pr mode: plain` or `pr mode: stacked`; stacked only while the stacked-prs trial runs, for 2+ dependent parts, its brief naming `docs/test-drive/stacked-prs.md`
- **the argv** — literal, `-n` before the prompt, the prompt before `--remote-control` (the flag once ate a 1.5 kB brief as its rc label):
  - side lane: `cd <repo> && claude --bg -n '🌗 🔧 BYT-N code: <what>' --model opus --effort medium "$(cat <brief file>)" --remote-control`
  - quick lane on main: `cd <repo> && claude --bg -n '⚡ 🔧 BYT-N code: <what>' --model sonnet --effort medium --settings '{"worktree":{"bgIsolation":"none"}}' "$(cat <brief file>)" --remote-control`
  - side-lane verifier, once the pr exists: `cd <repo> && claude --bg -n '🌗 🔎 BYT-N verify: #<pr>' --model opus --effort medium '/x:crew-verifier BYT-N <pr url> <coder registry name> <cclio registry name> spec: <spec path> trials: <names>' --remote-control`
  - quick-lane verifier, on the coder's «final»: the same line with `-n '⚡ 🔎 BYT-N verify: main'` and `main:<base sha>` in place of the pr url
  - `spec:` is the lane's spec path, so the verifier grades the spec's exit lines; it comes after the four arguments, before `trials:`
  - the loop is `x:crew-dna` § the pr pair; a spawn note never says «report to me only», which overrides that loop
- **names** — `<mode> <role emoji> <ticket> <role word>: <what>`. the mode leads: `🌗` a side lane, `⚡` a quick lane, `🌘` a shift (`cclio:shift`). role words: `🔧 code:` `🔬 research:` `🧪 probe:` `⏰ area:` `🔎 verify:` `☁️ cloud:`. a lane's unit is its ticket, a shift's its shift name, and a shift member pings only when fully done or blocked. `-n` is the registry name, typed for every child, probes and cloud sessions included; `--remote-control <name>` labels only the rc card. a brief names a member by its registry name, never a session id. a rename is a typed `/rename` inside that session; the `Agent` tool's `name` bans emoji, colons and spaces.
- **ticket** — pass the id; the id rides the branch name and the pr body, never a closing keyword. cclio verifies, then proposes the close by `cclio:pm` `references/closing.md`; dima's word closes it, with the closing word in the body.
- **identity** — the brief carries what `x:crew-coder` names: the coder token, the done-comment cap of § 6. dima on uncapped ones: «comments are poems for me».
- **the glide** — the lane's 🛼 glide card links the member the turn it spawns (orbit op `glide`, act `link`, role `coder` or `verifier`, `session` = the id `claude --bg` prints); the next siesta or the halt ends it ([watching.md](watching.md)).

<!-- failure: DOT-254 (2026-09-20), a spawn note «report to me only» overrode the loop; phase-0/2 rounds came to cclio, a hop plus a page per round. -->
<!-- failure: 2026-09-22 ccbee7b0, a day-old spare booted a coder without the root AGENTS.md; upstream #95589. -->
