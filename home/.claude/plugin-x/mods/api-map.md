# mods api map — every hook event, one line each

read from `.claude-plugin/types/claude-code/index.d.ts` at cc 2.1.312 (refresh-cc-mods run #5, 2026-10-30);
the types file wins on any conflict. 📌 the fleet runs both builds and each rewrites a mod's types on load (stash's
copy flipped twice in a minute), so the file's first line names the build you are reading. find an event by
grepping its quoted name (`'tool.call'`) — names survive a bump, line numbers never did. at a bump, diff three
lists against this file: the quoted names in `EngineEventOf`, the members of `EngineInterface` (the `$` calls;
`rg "^          [a-zA-Z]+: "` lists them), and `ClassicEventOf`.

## ui — drawing and input

- `ui.render` — the engine is about to draw a component; return the tree. the sites (`RenderComponent`): `AbovePrompt` (the band) and `Pane`, plus the engine's own rows a mod may redraw — `AskUserQuestion` `UserMessage` `AssistantMessage` `ToolUse` `ToolResult` `ToolGroup` `ToolProgress` `CommandOutput` `Spinner` `TurnDuration` `InfoNotice` `SessionMode` `PromptHint`; `ToolProgress`, `TurnDuration` and `InfoNotice` draw in the terminal only (reference, «Render sites»)
- `ui.resolve` — once per surface, component and plugin at load (not per draw); `e` names the surface and component, never the props
- `ui.press` — a `Button` a render hook drew was pressed; `element` is its `key`
- `ui.input` — an `Input` changed or was submitted
- `ui.select` — a `Select` was picked from
- `ui.message` — a `Client` this plugin drew posted from its surface module
- `ui.fault` — a `Client` this plugin drew failed on a surface (did not load, failed to draw, or threw after); observe only, the engine redraws the site, so fall back by leaving the `Client` out
- `ui.scroll` — a site's window is about to move: wheel or scroll keys on a `Pane` or the band
- `ui.focus` — a site's focus ring is about to move: Tab, arrows, a click, an `autoFocus`

## tools and agents

- `tool.call` — a tool is about to run; return `{ deny }` to refuse, or rewrite the result and add `context`
- `tool.check` — the engine decides whether a call may run, after `tool.call` and PreToolUse, before the mode settles an ask
- `tool.describe` — once per tool, when its schema is first rendered; rewrite the description or defer it
- `agent.offer` — an agent type is offered to the model, in the listing and at dispatch; `next(e)` resolves `{ isOffered: true }`
- `agent.spawn` — the Agent tool is about to start a subagent, everything decided, its model not resolved yet

## the prompt box and the prompt

- `prompt.submit` — a prompt is submitted, before the turn starts; `e.origin.kind` says who sent it; answer `{ drop: reason }` to stop it. `$.prompt.submit({ text, asUser: true })` sends text as the person's own words
- `prompt.fill` — a text is about to go into the prompt box as the person's draft
- `prompt.suggest` — a dim Tab-to-take suggestion is about to show: the engine's guess or a plugin's `$.prompt.suggest`
- `prompt.edit` — the person edits the prompt box: a key or a paste
- `prompt.change` — the box's text changed without a typed edit: a recalled history entry, a clear, an undo, a plugin's fill (2.1.300)
- `prompt.autocomplete` — the person types in the prompt box; answer `{ suggestions }`, rows joining the typeahead beneath the engine's own
- `prompt.mention` — a prompt names a path after `@`, before the engine reads it; answer `{ deny }` or add `context`. no `tool.call` is raised for this read, so a Bash or Read guard never sees it
- `prompt.section` — once per named system-prompt section; rewrite its text
- `prompt.context` — once per conversation, the context blocks the first user message carries
- `prompt.compose` — the whole system prompt as `{ sections }`, in send order
- `prompt.attachment` — a message the engine injects on its own: a reminder, a mode change, a mentioned file
- `skill.prompt` — a skill's prompt is expanded for the model (`/name`, the Skill tool, a preload)
- `attribution.text` — a git text the model is told to write (`commit`, `pr`, …) is composed

## commands and config

- `command.run` — a slash command is about to run
- `command.describe` — a command is listed for the typeahead and `/help`
- `config.set` — a `/config` row is about to change
- `config.describe` — a `/config` row is listed

## the session

- `session.start` — once per process per plugin, then again on every reload, worker respawn or enable; init here. not after `/clear`, `/resume` or `/branch`: the process goes on under a new session id with no `session.start`, and `session.end` carries the old id (`SessionEndInput`)
- `session.receive` — a delivery reaches the session, before it is queued; `e.origin.kind` is `peer`, `peer-send-message`, `coordinator`, `bridge`, `task-notification`, `scheduled-trigger`, `projects-relay`, `slack-ping` or `unclassified`, a teammate's carrying `isVerified`. a session set to refuse inbound messages refuses before this hook fires, so a sent message may never reach it
- `session.append` — every row the conversation keeps (prompt, response block, tool result, notice), before it is stored
- `session.send` — a plain-text message is about to leave for another agent or session (SendMessage, `$.session.send`)
- `session.compact` — the conversation is about to be compacted; resolves `{ messages }`, or `{ skip: reason }` to leave it as it is; `e.trigger` is `manual` `auto` `plugin` or `precompute` (a `precompute` installs nothing, its result kept for the next compaction)
- `session.attach` — a remote client joins the roster of surfaces
- `session.detach` — a client leaves the roster
- `session.measure` — after each main-thread turn and on a whole-point rate-limit move: context fill, `rateLimits` (`five_hour`, `seven_day`), cost
- `session.end` — once when the session ends: exit, /clear, resume, logout, signal

## turns

- `turn.start` — a model turn begins, main's, a subagent's or a teammate's (`e.agentId`, absent on main; 2.1.299), before its first model call
- `turn.step` — a model request of a turn is about to go out, main's or a subagent's
- `turn.complete` — a model turn ended; `e.agentId` set for a subagent's; answer `{ text }` to show a line under the answer

## the plugin itself and telemetry

- `plugin.register` — a hooks module is about to join the chain, at load and at reload
- `engine.create` — `$` is being built, before any other hook of this plugin
- `telemetry.log` — a record is about to be logged
- `telemetry.mark` — one use of a feature is marked

## `classic.*` — the settings-hook events, seen by a mod

`ClassicEventOf`, 33 events with the settings hooks' input shapes; the ones our mods touch: `classic.Stop` (with
`background_tasks`), `classic.SessionStart` (`source`: `startup` `resume` `clear` `compact` `fork`), `classic.PostCompact`,
`classic.CwdChanged`, `classic.TeammateIdle`, `classic.TaskCompleted`, `classic.Notification`. a hot reload fires
`session.start` only, never `classic.SessionStart`.

## `$` calls that raise an event (not in `OpValueOf`)

every `$` method is also an interceptable event; these are the ones the op list below misses:

- ui: `$.ui.notify(text, { title })` — a native notification through the person's channel, no pane or turn needed, no rate limit; resolves `{ isSent: false, reason }` (`disabled` `no-channel` `no-surface` `refused`) rather than failing silently, and rejects on a hook's `{ deny }` (2.1.295); 📌 it writes only through a terminal: the desktop, `-p` and the SDK answer `no-surface` (types: `UiNotifyResult`), so a desktop session falls back to `osascript` (x-mod-stash's quiet alarm) · `$.ui.ask` — the AskUserQuestion dialog from a mod, rejects in `-p` · `$.ui.scroll` · `$.ui.focus` · `$.ui.close`
- session: `$.session.send` — the one door into another session · `$.session.append` · `$.session.compact`
- prompt: `$.prompt.submit` · `$.prompt.fill` · `$.prompt.suggest` · `$.prompt.compose`
- tools, commands, config, agents: `$.tool.call` · `$.tool.check` · `$.command.run` · `$.config.set` · `$.agent.spawn`
- telemetry: `$.telemetry.log` · `$.telemetry.mark`
- the plugin: `$.plugin.name` · `$.plugin.root`

## props and options a grep finds only by name

- `$.tool.register({ …, isDeferred })` (2.1.293): `false` loads the tool up front; left out, the engine's rule puts it behind ToolSearch
- `Button` takes `Text` children (2.1.295); `Markdown` takes `onLinkPress` / `pressableLinks`, where the surface reports clicks (the fullscreen terminal; the desktop «?»)
- `$.state` is per session, and any plugin may read another's value; only its owner writes it
- `$.session.root()` does not follow a shell `cd`; `$.session.cwd()` does

## limits (reference «Limits», unless a type is named)

- hooks: 10 s each (`HookBudget.ms`), a `.catch` 1 s (`catchMs`), 5 s linger after an abort (`lingerMs`); every `$` call is free of the budget but `$.clock.sleep`, which spends it
- `prompt.edit` ~50 ms — the reference's number, measured live at 2.1.296 (45 ms lands, 60 ms is dropped silently); `HookBudget` names no such budget and the harness does not enforce it
- all `session.end` hooks together 1.5 s; a `drop` or `deny` reason 4,096 chars
- `Link.href` 2,048 chars; `Svg` 131,072 chars (unverified); one tree: the first 100,000 chars drawn, 32 nesting levels, 20,000 elements, 262,144 `Raster` cells, 2 MiB of `Image` bytes; one hooks-module file: 2,000 nested scopes
- toast, status and log lines 2,000 chars in the terminal, 10,000 on a remote surface
- `$.fs.read` / `write` 4 MiB, `write` not atomic; `$.store` 4 MiB in all, read-modify-write not atomic
- `$.http.fetch` 4 MiB, 30 s, 5 redirects; `$.model.complete` 1,024 output tokens by default, up to 64,000; `$.process.run` stdout and stderr 4 MiB each (`isStdoutTruncated`); `$.session.messages()` the newest 4,096; `$.ui.toast` 4 s unless `timeoutMs`; a pane opened unasked placed from 144 columns (110 once opened); command, tool, agent-type and pane names 64 chars of letters, digits, `_` and `-`
- a `context` note (`tool.call`, `prompt.submit`, `prompt.mention`): any length, past 100,000 chars (200,000 together) cut to its head and a path
- a tool description: no cap in `ToolSpec`; cc's MCP caps by build — 2,048 up front until 2.1.296, 4,096 from it, 16,384 through ToolSearch — and that they bind a mod's tool is likely «?» (a 2,371-char notice at 2,048, x-mod-stash FTR)
- cross-session messages ~1 M serialized chars; an inbound queue of 50 accepted, 100 held
- `claude plugin test`: 5 s per test

## ops a hook can answer (`OpValueOf`; inputs `OpEventOf`)

the `$.<noun>.<verb>` calls; the test harness answers them with `on('<op>', …)` mocks.

- agent: `agent.list` `agent.register`
- audio: `audio.play` `audio.speak`
- clock: `clock.now` `clock.after` `clock.every` `clock.sleep`
- command and config: `command.list` `command.register` `config.list` `settings.read` (each read raises it once with `e.layers`; a hook may rewrite the merged answer, 2.1.304)
- env: `env.get` `env.set` (resolves `{}`, or `{ deny }` when the write is not made, 2.1.301; `DISABLE_COMPACT` through it only turns compaction off, 2.1.311)
- fs: `fs.read` `fs.write` `fs.stat` `fs.exists` `fs.list` `fs.ancestors`
- net and processes: `http.fetch` `mcp.call` `mcp.connect` `process.run` `process.spawn`
- model: `model.complete` `model.classify` (weigh it beside jev) `model.fork`
- prompt and turn: `prompt.read` `prompt.paint` (from 2.1.311) `turn.abort`
- session: `session.id` `session.cwd` `session.root` `session.repo` `session.model` `session.messages` (this session's own, or one of its agents') `session.turns` `session.usage` `session.surface` `session.surfaces` `session.version` `session.authorize` `session.identity` (managed mods only, 2.1.299)
- state and store: `state.get` `state.set` `store.get` `store.set` `store.delete` `store.keys`
- tools: `tool.list` `tool.register`
- ui: `ui.open` `ui.close` `ui.panes` `ui.toast` `ui.notice` `ui.status` `ui.copy` `ui.log` `ui.invalidate` `ui.notify` `ui.view` (`$.ui.view({ agentId })` shows an agent's transcript in the main view, `{}` goes back) `ui.blit` `ui.selection` (`undefined` with fullscreen off, in `-p`, and on a surface that reports none)

## fleet ideas — candidates, none built (2026-10-05)

clio folds dima's picks into a ticket; a built idea leaves this list.

- context toast — `session.measure` crosses 85 % context → `$.ui.toast` «offer a handoff»; the same hook already feeds keep-hot's 5h window
- a codie ping you can hear — `session.receive` sees a peer message from codie → `$.audio.speak` reads its first line while dima is away from the screen
- a reset on `/clear` and `/resume` — `command.run { command: ['clear','resume'] }` as the one point x-mod-stash and x-mod-redact drop per-session state; today x-mod-stash notices a new `$.session.id()` at its next poll (borrowed from Charlie0113-T/claude-agent-flow `hooks/register.ts`, FRM-319)
- a «while you were away» digest — when `💨` turns off, each session's «needs you first, then done» (from augbastos/afkswitch's README, FRM-319)
- a pr + ci column on the board — one `gh api graphql` query per pr on a 60 s `$.clock.every`, pr urls caught from prompts, replies and `gh pr create` output (from sezaakgun/cc-pr-tracker `hooks/register.tsx`, FRM-319); its cost is the per-tick `gh` call x-mod-stash's FTR already names
- tabs inside a pane — a row of `Button`s at a pane's top, the picked one `variant='primary'`, each drawing its own body: proven in 🚦 as FRM-391's mock b (dima, 16:20: «very useful knowledge, keep it for future parts of the board if there is not enough space»); the surface also tabs every open pane on its own, which is how 🎛️ sits beside 🚦
- parked: spawn gating — `agent.spawn` refusing or rerouting a spawn the fleet rules forbid; the warn-only hints it grew from were dropped: «0 for 1 on its first real fire, and a toast never reaches the session it corrects» (dima, 2026-10-05)

## comms pieces — what the api gives (refresh-cc-mods, 2026-10-10, cc 2.1.296; «?» = unprobed by us)

- **agent → mod**: a mod-registered tool is the agent's write door (set the plan, add an ask, clear an ask); the mod keeps it in `$.state` per session and the pane redraws, so no reply text is parsed
- **checkbox**: no native checkbox; a `Button` whose label flips ☐ / ☑ stands in (`inline-next-steps` does it); `Input` draws on the desktop (the reference marks it ✓; x-mod-stash's steer fields ship it)
- **joining the prompt**: `prompt.submit` rewrites `e.text` (visible, either end) or appends `e.context` (model-only, after the prompt only)
- **turn state**: a pane is not told whether a turn runs; a lock while mid-turn needs a flag the mod keeps from `turn.start` / `turn.complete`
- **mid-turn join**: `$.session.append` adds a hidden user message without starting a turn (grill, human-in-the-loop use it); a message that lands during the final reply is never read, and human-in-the-loop then starts a turn — our rule forbids that, so a 🤔 piece rides the next prompt «?»
- **peer envelope**: `session.receive` gets a peer message as `<cross-session-message from="…" …>`, and the sender's registry name sits in `from-name="…"` or `name="…"` depending on the surfaces — parse both, `from-name` first (x-mod-stash's peer parse in `hooks/register.tsx`; probe 14:49 read cli → `from-name`, desktop → `name`, yet a desktop clio's message to a desktop codie rendered with `from-name`, 17:18 — unprobed at the hook); the name is whatever the sender wrote, so it never decides a guard (api page)
- **contract**: a `prompt.submit` reminder in `e.context` is the one layer that holds every turn and through compaction; a third-party comment claims the desktop app skips the system-prompt event mods use «?»
- **borrow**: `next-steps` (planned actions), `todo-bar` (lane progress), `where-am-i` (goal · now · waiting on you · next), `pinboard` (a durable list), `blast-radius` (accept / reject buttons), `prompt-drafts` (the user owns the send), `review-inbox` (age and severity)

## undocumented doors (may break on an app bump)

- desktop deep link to a session, found in Claude.app's asar, in no doc (FRM-306, 2026-10-05): `claude://code/continue?session=local_…` for a desktop-born session, `claude://code/session_…` for a bridged bg one; an unbridged bg job has no door — copy `claude attach <jobId>`. re-check at every desktop bump
