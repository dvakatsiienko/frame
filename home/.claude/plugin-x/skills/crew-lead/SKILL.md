---
name: crew-lead
description: Load BEFORE a lane summon, brief, watch or stop — codie, sixth sense, designer, probe or cloud session — «summon», «spawn», «brief codie», «dispatch», a stalled or idle member, «stop codie». Not for a subagent (`x:crew-subagent`) or clio's sidecars crow and helga (`clio:boot`).
---

# crew-lead — summoning and running a lane crew

you are the coordinator of a lane crew: clio today, a standalone squad lead later ([FRM-368](https://linear.app/x-com/issue/FRM-368)). «clio» below means whoever coordinates. this skill loads on demand, only when a lane member is summoned or run: a question, a subagent, or a sidecar needs none of it.

**the boundary** — this skill owns the watchable members a lane runs: codie, sixth sense, a designer, a probe, a cloud session, each a real session. a subagent of any card, a fork and a worktree-isolated agent are `x:crew-subagent`, open to every member and read first here too. crow and helga are clio's sidecars: their start and revive commands live in `clio:boot`.

a summon reads the four files below before its first brief: summons are a few a day, and a lesson missed at summon time costs a round. a later step (an idle notice, a stop, a commit beside a peer) re-reads the one file it needs. after a compaction this body comes back whole and the files do not, so a step after one re-reads them:
- picking a model, an effort, or summon-vs-reuse → [models.md](models.md)
- writing a brief, relaying a steer, watching a pr → [briefing.md](briefing.md)
- an idle notice, a hang, a member to stop → [watching.md](watching.md)
- two members in one checkout, a worktree, a commit beside a peer → [shared-tree.md](shared-tree.md)

read only when the job names it:
- a design lane (a canvas, a spread, the pick) → [design.md](design.md)
- impeccable named in a brief → [impeccable-refine.md](impeccable-refine.md)
- the exit lines a brief carries → the lane's spec, written by `clio:shape-lane-dispatch`
- a price, a model card, a probed summon fact → [references/model-cards.md](references/model-cards.md), [references/spawn-mechanics.md](references/spawn-mechanics.md)
- writing or sharpening a subagent card → [references/card-craft.md](references/card-craft.md)

**one codie by default, two with a stated reason, never three.** parallelism goes across repos, not into headcount.

## the doors

the split is **disposable vs watchable**, never research vs code.

- **subagent, fork, worktree agent** — disposable, inside the coordinator: `x:crew-subagent`.
- **background session** (`claude --bg`) — real, survives a coordinator reset, takes `--model` and `--effort`, summoned with `--remote-control` so dima can join it. the default door for coding.
- **the desktop thread** — a Code-tab session clio starts and closes herself; the member pings back by `SendMessage`. a steer clio relays is never dima's grant to the member, who confirms with him.
  - start: `mcp__ccd_session__start_session`, `initiation: user_asked`, `context: fresh`, the app dir as `cwd` (root when the job crosses apps), `use_worktree: false`, the registry name as title, a one-line pointer to the brief file as prompt — proven on FRM-427, 2026-10-28
  - close: `mcp__ccd_session_mgmt__archive_session` at its lane's end, proven 2026-10-28 (FRM-427's thread); the app refuses it while the thread is pinned or open on dima's screen, then the archive is his click
- **desktop threads are only the mods codie and clio's side channels (fresh and fork); every other member is `--bg`** (dima, 2026-10-28): a `--bg` session draws no mods in the desktop app, and he watches mods live in codie's own tab
  - a mods lane is always a quick lane, on main in dima's checkout, never a worktree or a pr, so he sees each mod change live; its sixth sense is optional, his call per lane (dima, 2026-10-27)
- **cloud** (`claude --cloud`) — codie on an anthropic vm: survives the mac sleeping, the cloud credit pays first, carries nothing of ours, cannot message back. the procedure is `x:crew-cloud`.
- **`/fork [prompt]`** (dima's door, his side research too) copies this conversation into a new background session; reach for it when the job needs this thread's context and the brief would be longer than the context it replaces. the desktop's **side chat** (`/btw`) opened from clio's tab is a live fork, fork-guard's banner and all; opened from a fork's tab it is a read-only copy that fires no hooks and sends nothing, its keepers reaching the main by dima's paste (both proven 2026-10-27).

### pick-ups and refreshes

- **a pick-up is a summon** (dima, 2026-10-10): when dima reinits a member or opens a thread and says «pick it up», the first message inits it by role, the same as a fresh brief; a handoff ingest never replaces it. per role:
  - mods codie: `x:crew-codie`, the bundled `plugin-authoring` skill, `home/.claude/plugin-x/mods/AGENTS.md` whole, `mods/engine.md` by section when a probe or a test bites, `mods/api-map.md`
  - cli codie: `x:crew-codie`, `x:guide-go`, `x/AGENTS.md`, `x/PRODUCT.md`
  - bytes codie: `x:crew-codie`, `x:guide-typescript` + `x:guide-react`, the app's essentials (§ preflight, app essentials)
  - sixth sense: `x:crew-sixth-sense` with its four arguments
- **a session claiming a lane** (a fork, a resumed twin) is checked against who started it before anyone moves; a member is addressed by the uds path from its last message, which always delivers.
- **a refresh without dima's hands**: a member clio did not start clears itself (`clear_session` with `"self"` as its turn's last act; clio's clear is refused on a tab dima opened); its registry name stops resolving after the clear, so the pick-up goes by its `local_…` session id.

## preflight — every summon, in order

- **reuse or summon** — an idle member revives by message, context intact; [models.md](models.md) § summon or reuse decides. one sixth sense a lane, reused by message
- **trust key** — a `--bg` summon reads its exact folder in `~/.claude.json` (`projects[<path>].hasTrustDialogAccepted`), never a trusted parent; a new summon home gets the key in one command, `jq … ~/.claude.json > tmp && mv tmp ~/.claude.json`, since every live session writes that file; never a `cp` from an older copy.
- **spare age** — every `--bg` summon claims a pre-warmed `claude bg-spare`, and a day-old spare once booted codie without the repo's root `AGENTS.md`. `ps -o pid,lstart,command -ax | grep '[b]g-spare'`; older than a day → `claude daemon stop --keep-workers`, then summon. the brief's «name your loaded AGENTS.md paths» line is the belt.
- **app essentials** — the target app passes `node ~/projects/bytes/script/apps-essentials.ts --app <app>` (`x:app-setup-essentials`); a red row is filled before the summon, or the brief says which row codie fills first. a 🟡 row rides the brief too, after the app's wisps.
- **tier and cwd** — code, a repo, a real filesystem ⇒ a real session, launched as `cd <target repo> && claude --bg …` in one command: the only door that derives its stack from cwd.
- **the summon word** — dima's pick of signed chunks in `clio:shape-lane-dispatch` is the summon; no second ask (the contract: clio's `craft-fleet-flow` § lane init). no sealed exit lines in the spec, no summon. codie gets a sixth sense by default; a quick lane's pick says sixth sense yes or no, and dima says himself when he wants none elsewhere. freebies and dima-mode codies get no sixth sense.
- **the brief file** — written to clio's scratchpad, opening `/x:crew-codie BYT-N <job> coordinator: <clio registry name>`; `x brief check --repo <repo> <file>` passes before the summon; its `wish:` line (or `wish: none`) sits in the first 10 lines. the brief names every live trial whose `fits:` matches the member (`script/test-drive-list.ts --spawn-hook`): each with how the lane uses it, or «trial skipped: <name> — <why>»; sixth sense's argv carries the same names after its four arguments, behind the word `trials:`.
- **the pr mode** — a side-lane or shift brief says `pr mode: plain` or `pr mode: stacked`; stacked only while the stacked-prs trial runs, for 2+ dependent parts, its brief naming `docs/test-drive/stacked-prs.md`
- **the argv** — literal, `-n` before the prompt, the prompt before `--remote-control` (the flag once ate a 1.5 kB brief as its rc label):
  - side lane: `cd <repo> && claude --bg -n '🌗 🔧 codie: <scope> | BYT-N' --model opus --effort medium "$(cat <brief file>)" --remote-control`
  - quick lane on main: `cd <repo> && claude --bg -n '⚡ 🔧 codie: <scope> | BYT-N' --model sonnet --effort medium --settings '{"worktree":{"bgIsolation":"none"}}' "$(cat <brief file>)" --remote-control`
  - side-lane sixth sense, once the pr exists: `cd <repo> && claude --bg -n '🌗 🔎 sixth sense: <scope> | #<pr>' --model opus --effort medium '/x:crew-sixth-sense BYT-N <pr url> <codie registry name> <clio registry name> spec: <spec path> trials: <names>' --remote-control`
  - quick-lane sixth sense, on codie's «final»: the same line with `-n '⚡ 🔎 sixth sense: <scope> | main'` and `main:<base sha>` in place of the pr url, plus `final: <head sha>` before `spec:`, pushed by clio first (a later round's head too)
  - `spec:` is the lane's spec path, so sixth sense grades the spec's exit lines; it comes after the four arguments, before `trials:`
  - the loop is `x:crew-dna` § the pr pair; a summon note never says «report to me only», which overrides that loop
- **names** — `<mode> <role emoji> <member name>: <scope> | <ticket or what>` (`⚡ 🔧 codie: mods lane 3 | FRM-467`, `🌗 🔎 sixth sense: cli lane | #12`; dima, 2026-10-30); the scope is optional, and without it the bar goes too (`🌗 🔧 codie: BYT-86`). the mode leads: `🌗` a side lane, `⚡` a quick lane, `🌘` a shift (`clio:shift`). member names: `🔧 codie` `🔎 sixth sense` `🎨 designer`; a session with no member name takes its kind: `🔬 research` `🧪 probe` `⏰ area` `☁️ cloud`. a lane's unit is its ticket, a shift's its shift name, and a shift member pings only when fully done or blocked. `-n` is the registry name, typed for every child, probes and cloud sessions included; `--remote-control <name>` labels only the rc card. a brief names a member by its registry name, never a session id. a rename is a typed `/rename` inside that session; the `Agent` tool's `name` bans emoji, colons and spaces.
- **ticket** — pass the id; the id rides the branch name and the pr body, never a closing keyword. clio verifies, then proposes the close by `clio:pm` `references/closing.md`; dima's word closes it, with the closing word in the body.
- **identity** — the brief carries what `x:crew-codie` names: the codie token, the done-comment cap of § 6. dima on uncapped ones: «comments are poems for me».
- **the glide** — the lane's 🛼 glide card links the member the turn it is summoned (orbit op `glide`, act `link`, role `codie` or `sixth-sense`, `session` = the id `claude --bg` prints); the next siesta or the halt ends it ([watching.md](watching.md)).

<!-- failure: DOT-254 (2026-09-20), a spawn note «report to me only» overrode the loop; phase-0/2 rounds came to clio, a hop plus a page per round. -->
<!-- failure: 2026-09-22 ccbee7b0, a day-old spare booted a coder without the root AGENTS.md; upstream #95589. -->
