# mods api map — every hook event, one line each

read from `.claude-plugin/types/claude-code/index.d.ts` at cc 2.1.289; the types file wins on any
conflict; re-read at a cc bump. line ranges point into that file (any mod's copy; the engine
regenerates it on reload). the events live in `EngineEventOf` (3838–4320); a hook may also answer
an op (`store.get`, `session.id`, `ui.copy` …), listed at the end.

## ui — drawing and input

- `ui.render` — the engine is about to draw a component; return the tree (3871–3879). the sites (`RenderComponent`, 8841): `AbovePrompt` (the band) and `Pane`, plus the engine's own rows a mod may redraw — `AskUserQuestion` `UserMessage` `AssistantMessage` `ToolUse` `ToolResult` `ToolGroup` `ToolProgress` `CommandOutput` `Spinner` `TurnDuration` `InfoNotice` `SessionMode` `PromptHint`
- `ui.resolve` — once per surface, component and plugin at load (not per draw); `e` names the surface and component, never the props (3880–3888)
- `ui.press` — a `Button` a render hook drew was pressed; `element` is its `key` (3889–3897)
- `ui.input` — an `Input` changed or was submitted (3898–3906)
- `ui.select` — a `Select` was picked from (3907–3915)
- `ui.message` — a `Client` this plugin drew posted from its surface module (3916–3929)
- `ui.fault` — a `Client` this plugin drew failed on a surface (did not load, failed to draw, or threw after); observe only, the engine redraws the site, so fall back by leaving the `Client` out (3930–3941)
- `ui.scroll` — a site's window is about to move: wheel or scroll keys on a `Pane` or the band (3942–3953)
- `ui.focus` — a site's focus ring is about to move: Tab, arrows, a click, an `autoFocus` (3954–3964)

## tools and agents

- `tool.call` — a tool is about to run; return `{ deny }` to refuse, or rewrite the result and add `context` (3847–3858)
- `tool.check` — the engine decides whether a call may run, after `tool.call` and PreToolUse, before the mode settles an ask (3859–3870)
- `tool.describe` — once per tool, when its schema is first rendered; rewrite the description or defer it (4078–4089)
- `agent.offer` — an agent type is offered to the model, in the listing and at dispatch; `next(e)` resolves `{ isOffered: true }` (3965–3973)
- `agent.spawn` — the Agent tool is about to start a subagent, everything decided, its model not resolved yet (3974–3982)

## the prompt box and the prompt

- `prompt.submit` — a prompt is submitted, before the turn starts; `e.origin.kind` says who sent it (3983–3994)
- `prompt.fill` — a text is about to go into the prompt box as the person's draft (3995–4006)
- `prompt.suggest` — a dim Tab-to-take suggestion is about to show: the engine's guess or a plugin's `$.prompt.suggest` (4007–4018)
- `prompt.edit` — the person edits the prompt box: a key or a paste (4019–4030)
- `prompt.section` — once per named system-prompt section; rewrite its text (4031–4042)
- `prompt.context` — once per conversation, the context blocks the first user message carries (4043–4051)
- `prompt.compose` — the whole system prompt as `{ sections }`, in send order (4052–4063)
- `prompt.attachment` — a message the engine injects on its own: a reminder, a mode change, a mentioned file (4064–4077)
- `skill.prompt` — a skill's prompt is expanded for the model (`/name`, the Skill tool, a preload) (4160–4170)
- `attribution.text` — a git text the model is told to write (`commit`, `pr`, …) is composed (4171–4182)

## commands and config

- `command.run` — a slash command is about to run (4090–4101)
- `command.describe` — a command is listed for the typeahead and `/help` (4102–4113)
- `config.set` — a `/config` row is about to change (4114–4125)
- `config.describe` — a `/config` row is listed (4126–4137)

## the session

- `session.start` — once per process per plugin, then again on every reload, worker respawn or enable; init here (4183–4194)
- `session.receive` — a delivery reaches the session (a peer's message, a relay event, a Remote Control prompt), before it is queued (4195–4206)
- `session.append` — every row the conversation keeps (prompt, response block, tool result, notice), before it is stored (4207–4218)
- `session.send` — a plain-text message is about to leave for another agent or session (SendMessage, `$.session.send`) (4219–4230)
- `session.compact` — the conversation is about to be compacted; resolves `{ messages }` (4231–4242)
- `session.attach` — a remote client joins the roster of surfaces (4243–4250)
- `session.detach` — a client leaves the roster (4251–4262)
- `session.measure` — after each main-thread turn and on a whole-point rate-limit move: context fill, `rateLimits` (`five_hour`, `seven_day`), cost (4263–4274)
- `session.end` — once when the session ends: exit, /clear, resume, logout, signal (4275–4286)

## turns

- `turn.start` — a model turn begins, before its first model call (4292–4300)
- `turn.step` — a model request of a turn is about to go out, main's or a subagent's (4301–4309)
- `turn.complete` — a model turn ended; `e.agentId` set for a subagent's (4310–4318)

## the plugin itself and telemetry

- `plugin.register` — a hooks module is about to join the chain, at load and at reload (4287–4291)
- `engine.create` — `$` is being built, before any other hook of this plugin (4319–4320)
- `telemetry.log` — a record is about to be logged (4138–4148)
- `telemetry.mark` — one use of a feature is marked (4149–4159)

## ops a hook can answer (`OpValueOf`, 6869 on; inputs 6530 on)

the `$.<noun>.<verb>` calls; the test harness answers them with `on('<op>', …)` mocks.

- agent: `agent.list` `agent.register`
- audio: `audio.play` `audio.speak`
- clock: `clock.now` `clock.after` `clock.every` `clock.sleep`
- command and config: `command.list` `command.register` `config.list` `settings.read`
- env: `env.get` `env.set`
- fs: `fs.read` `fs.write` `fs.stat` `fs.exists` `fs.list` `fs.ancestors`
- net and processes: `http.fetch` `mcp.call` `mcp.connect` `process.run` `process.spawn`
- model: `model.complete` `model.classify` (2554 — weigh it beside jev) `model.fork`
- prompt and turn: `prompt.read` `turn.abort`
- session: `session.id` `session.cwd` `session.root` `session.repo` `session.model` `session.messages` `session.turns` `session.usage` `session.surface` `session.surfaces` `session.version` `session.authorize`
- state and store: `state.get` `state.set` `store.get` `store.set` `store.delete` `store.keys`
- tools: `tool.list` `tool.register`
- ui: `ui.open` `ui.close` `ui.panes` `ui.toast` `ui.notice` `ui.status` `ui.copy` `ui.log` `ui.invalidate` `ui.blit` `ui.selection` (2478 — `undefined` with fullscreen off, in `-p`, and on a surface that reports none)

## fleet ideas — candidates, none built (2026-10-05)

cclio folds dima's picks into a ticket; a built idea leaves this list.

- context toast — `session.measure` crosses 85 % context → `$.ui.toast` «offer a handoff»; the same hook already feeds keep-hot's 5h window
- a coder ping you can hear — `session.receive` sees a peer message from a coder → `$.audio.speak` reads its first line while dima is away from the screen
- a reset on `/clear` and `/resume` — `command.run { command: ['clear','resume'] }` as the one point stash and redact drop per-session state; today stash notices a new `$.session.id()` at its next poll (borrowed from Charlie0113-T/claude-agent-flow `hooks/register.ts`, FRM-319)
- a «while you were away» digest — when `💨` turns off, each session's «needs you first, then done» (from augbastos/afkswitch's README, FRM-319)
- a pr + ci column on the board — one `gh api graphql` query per pr on a 60 s `$.clock.every`, pr urls caught from prompts, replies and `gh pr create` output (from sezaakgun/cc-pr-tracker `hooks/register.tsx`, FRM-319); its cost is the per-tick `gh` call stash's FTR already names
- parked: spawn gating — `agent.spawn` refusing or rerouting a spawn the fleet rules forbid; the warn-only hints it grew from were dropped: «0 for 1 on its first real fire, and a toast never reaches the session it corrects» (dima, 2026-10-05)

## undocumented doors (may break on an app bump)

- desktop deep link to a session, found in Claude.app's asar, in no doc (FRM-306, 2026-10-05): `claude://code/continue?session=local_…` for a desktop-born session, `claude://code/session_…` for a bridged bg one; an unbridged bg job has no door — copy `claude attach <jobId>`. re-check at every desktop bump
