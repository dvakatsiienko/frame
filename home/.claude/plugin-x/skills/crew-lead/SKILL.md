---
name: crew-lead
description: Load BEFORE a lane summon, brief, watch or stop — codie, sixth sense, designer, probe or cloud session — «summon», «spawn», «brief codie», «dispatch», a stalled or idle member, «stop codie». Not for a subagent (`x:crew-subagent`) or clio's sidecars crow and helga (`clio:boot`).
---

# crew-lead — summoning and running a lane crew

you are the coordinator of a lane crew: any clio today, a squad lead later ([FRM-368](https://linear.app/x-com/issue/FRM-368)). «clio» below means whoever coordinates. this skill loads on demand, only when a lane member is summoned or run: a question, a subagent, or a sidecar needs none of it.

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
- **a seat** — a real cc session, on whichever surface runs it. the base is cc native and holds on every surface: the `claude` line in § preflight, the argv; a surface only puts its head before that line and its tab, find and stop steps after it
- **`claude --bg`**, cc native, no surface: survives a coordinator reset, herdr shows it only by an attach pane; head `cd <repo> && claude --bg`, a quick lane adds `--settings '{"worktree":{"bgIsolation":"none"}}'` before the prompt; facts: [spawn-mechanics.md](references/spawn-mechanics.md) § 5
- **the surfaces**, one file each, read before a summon on it:
  - **herdr desktop, the default**: [references/surface-herdr-desktop.md](references/surface-herdr-desktop.md) (dima, 2026-11-10: «Herdr's native way is first»; «I want you to summon everyone in Herdr's native way»)
  - **claude desktop, the backup**: [references/surface-claude-desktop.md](references/surface-claude-desktop.md), the desktop thread; a summon there says why to dima
  - a new harness: its own `surface-<name>.md` and a line here, which also names the default
- **everyone is summoned in herdr, the mods codie and clio's wings too** (dima, 2026-11-11: «Everyone gets summoned in Herdr. The desktop app fallback was when I was running everyone in the Claude desktop app but now we're in Herdr so everyone is in Herdr»)
  - a mods lane is a quick lane, on main in dima's checkout, never a worktree or a pr, so he sees each mod change live, unless he asks for a stack (it needs prs); its sixth sense is optional, his call per lane (dima, 2026-10-27)
- **cloud** (`claude --cloud`) — codie on an anthropic vm: survives the mac sleeping, the cloud credit pays first, carries nothing of ours, cannot message back. the procedure is `x:crew-cloud`.
- **`/fork [prompt]`** (dima's door) copies this conversation into a new background session; reach for it when a brief would be longer than the context it replaces. the desktop's **side chat** (`/btw`) opened from clio's tab is a live fork, fork-guard's banner and all; opened from a fork's tab it is a read-only copy that fires no hooks and sends nothing, its keepers reaching the main by dima's paste (both proven 2026-10-27).

### pick-ups and refreshes

- **a pick-up is a summon** (dima, 2026-10-10): when dima reinits a member or opens a thread and says «pick it up», the first message inits it by role, the same as a fresh brief; a handoff ingest never replaces it. per role:
  - mods codie: `x:crew-codie`, the bundled `plugin-authoring` skill, `home/.claude/plugin-x/mods/AGENTS.md` whole, `mods/engine.md` by section when a probe or a test bites, `mods/api-map.md`
  - cli codie: `x:crew-codie`, `x:guide-go`, `x/AGENTS.md`, `x/PRODUCT.md`
  - bytes codie: `x:crew-codie`, `x:guide-typescript` + `x:guide-react`, the app's essentials (§ preflight, app essentials)
  - sixth sense: `x:crew-sixth-sense` with its four arguments
- **a «resume» to a parked member** reads the 5h window in the same turn first (`get_usage`, or `~/.claude/shelf/cc-usage-window.json`); clio's Stop gate warns on one that did not
- **a session claiming a lane** (a fork, a resumed twin) is checked against who started it before anyone moves; a member is addressed by the uds path from its last message, which always delivers.
- **a refresh without dima's hands**: a member clio did not start clears itself (`clear_session` with `"self"` as its turn's last act; clio's clear is refused on a tab dima opened); its registry name stops resolving after the clear, so the pick-up goes by its `local_…` session id.

## preflight — every summon, in order

the mechanical steps run as one: `x brief summon "<command>"` refuses a skipped one, names its fix.

- 🚫 **a running member's model never switches** (it re-reads the history uncached, model-cards' `/model` line); only on dima's word for that session (2026-10-30: «It is a banned move»); a repeat earns a deny rule
- **reuse or summon** — an idle member revives by message, context intact; [models.md](models.md) § summon or reuse holds the order; a summon or a parallel lane says why in its brief; one sixth sense a lane, reused; next side lane at «final», a trial
- **trust key** — a summon reads its exact folder in `~/.claude.json` (`projects[<path>].hasTrustDialogAccepted`), never a trusted parent; a new summon home gets the key in one command, `jq … ~/.claude.json > tmp && mv tmp ~/.claude.json`, since every live session writes that file; never a `cp` from an older copy.
- **spare age**, `--bg` only — a `--bg` summon claims a pre-warmed `claude bg-spare`; a day-old one booted codie without the root `AGENTS.md`, so a day old → `claude daemon stop --keep-workers`; the brief's «name your loaded AGENTS.md paths» line is the belt.
- **app essentials** — the target app passes `node ~/projects/bytes/script/apps-essentials.ts --app <app>` (`x:app-setup-essentials`); a red row is filled before the summon, or the brief says which row codie fills first. a 🟡 row rides the brief too, after the app's wisps.
- **tier and cwd** — code, a repo, a real filesystem ⇒ a real session in a herdr pane, `--cwd <target repo>`: its stack derives from that cwd. a side-lane codie makes its tree by `x:crew-dna` (inference for a pane codie: its first reply names its `pwd`).
- **the summon word** — dima's pick of signed chunks in `clio:shape-lane-dispatch` is the summon; no second ask (the contract: clio's `craft-fleet-flow` § lane init). no sealed exit lines in the spec, no summon. codie gets a sixth sense by default; a quick lane's pick says sixth sense yes or no, and dima says himself when he wants none elsewhere. freebies and dima-mode codies get no sixth sense.
- **the brief file** — written to clio's scratchpad, opening `/x:crew-codie BYT-N <job> coordinator: <clio registry name>`; `x brief check --repo <repo> <file>` passes before the summon; its `wish:` line (or `wish: none`) sits in the first 10 lines. the brief names every live trial whose `fits:` matches the member: each with how the lane uses it, or «trial skipped: <name> — <why>»; sixth sense's argv carries the same names after its four arguments, behind the word `trials:`.
- **the pr mode** — a side-lane or shift brief says `pr mode: plain` or `pr mode: stacked`; stacked only while the stacked-prs trial runs, for 2+ dependent parts, its brief naming `docs/test-drive/stacked-prs.md`; once a lower layer is verified clean, the next ones go as plain prs on main
- **the argv** — the base `claude` line, literal, `-n` before the prompt, the prompt before `--remote-control` (the flag once ate a 1.5 kB brief); each runs through `x brief summon '<line>'` first:
  - the surface's head comes first (`hc run … --` on herdr, its file)
  - side lane: `… claude -n '🌗 🔧 codie: <scope> | BYT-N' --model opus --effort medium "$(cat <brief file>)" --remote-control`
  - quick lane on main: the same line with `-n '⚡ 🔧 codie: <scope> | BYT-N'`
  - a lane's first chunk only; later chunks get a `next:` message (`x:crew-sixth-sense` § the next chunk)
  - side-lane sixth sense, once the pr exists: `… claude -n '🌗 🔎 sixth sense: <scope> | #<pr>' --model opus --effort medium '/x:crew-sixth-sense BYT-N <pr url> <codie registry name> <clio registry name> spec: <spec path> trials: <names>' --remote-control`
  - quick-lane sixth sense, on codie's «final»: the same line with `-n '⚡ 🔎 sixth sense: <scope> | main'` and `main:<base sha>` in place of the pr url, plus `final: <head sha>` before `spec:`
  - `spec:` is the lane's spec path, so sixth sense grades the spec's exit lines; it comes after the four arguments, before `trials:`
  - the loop is `x:crew-dna` § the pr pair; a summon note never says «report to me only», which overrides that loop
- **names** — `<mode> <role emoji> <member name>: <scope> | <ticket or what>` (`⚡ 🔧 codie: mods lane 3 | FRM-467`, `🌗 🔎 sixth sense: cli lane | #12`; dima, 2026-10-30); the scope is optional, and without it the bar goes too (`🌗 🔧 codie: BYT-86`). the mode leads: `🌗` a side lane, `⚡` a quick lane, `🌘` a shift (`clio:shift`). member names: `🔧 codie` `🔎 sixth sense` `🎨 designer`; a session with no member name takes its kind: `🔬 research` `🧪 probe` `⏰ area` `☁️ cloud`. a lane's unit is its ticket, a shift's its shift name, and a shift member pings only when fully done or on a 🪜 escalate. `-n` is the registry name, typed for every child, probes and cloud sessions included; `--remote-control <name>` labels only the rc card. a brief names a member by its registry name, never a session id. a rename is a typed `/rename` inside that session; the `Agent` tool's `name` bans emoji, colons and spaces.
- **ticket** — pass the id; the id rides the branch name and the pr body, never a closing keyword. clio verifies, then closes it at its land (`craft-fleet-flow` stage 8) by `clio:pm` `references/closing.md` (landed), the closing word in the body, named to dima.
- **identity** — the brief carries what `x:crew-codie` names: the codie token, the done-comment cap of § 6. dima on uncapped ones: «comments are poems for me».
- **the glide** — the lane's 🛼 glide card links the member the turn it is summoned (orbit op `glide`, act `link`, role `codie` or `sixth-sense`, `session` = the member's session id, `x:herdr`'s recipe; a `--bg` one prints it); the next siesta or the halt ends it ([watching.md](watching.md)).

<!-- failure: DOT-254 (2026-09-20), a spawn note «report to me only» overrode the loop; phase-0/2 rounds came to clio, a hop plus a page per round. -->
