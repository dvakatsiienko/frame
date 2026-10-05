# mods api map — every hook event, one line each

read from `.claude-plugin/types/claude-code/index.d.ts` at cc 2.1.289; the types file wins on any
conflict; re-read at a cc bump. line ranges point into that file (any mod's copy; the engine
regenerates it on reload). the events live in `EngineEventOf` (3660–4135); a hook may also answer
an op (`store.get`, `session.id`, `ui.copy` …), listed at the end.

## ui — drawing and input

- `ui.render` — the engine is about to draw a component (`AbovePrompt` band, `Pane`, …); return the tree (3684–3692)
- `ui.resolve` — once per surface, component and plugin at load (not per draw); `e` names the surface and component, never the props (3693–3701)
- `ui.press` — a `Button` a render hook drew was pressed; `element` is its `key` (3702–3710)
- `ui.input` — an `Input` changed or was submitted (3711–3719)
- `ui.select` — a `Select` was picked from (3720–3728)
- `ui.message` — a `Client` this plugin drew posted from its surface module (3729–3737)
- `ui.scroll` — a site's window is about to move: wheel or scroll keys on a `Pane` or the band (3738–3749)
- `ui.focus` — a site's focus ring is about to move: Tab, arrows, a click, an `autoFocus` (3750–3761)

## tools and agents

- `tool.call` — a tool is about to run; return `{ deny }` to refuse, or rewrite the result and add `context` (3660–3671)
- `tool.check` — the engine decides whether a call may run, after `tool.call` and PreToolUse, before the mode settles an ask (3672–3683)
- `tool.describe` — once per tool, when its schema is first rendered; rewrite the description or defer it (3875–3888)
- `agent.offer` — an agent type is offered to the model, in the listing and at dispatch; `next(e)` resolves `{ isOffered: true }` (3762–3772)
- `agent.spawn` — the Agent tool is about to start a subagent, everything decided, its model not resolved yet (3773–3781)

## the prompt box and the prompt

- `prompt.submit` — a prompt is submitted, before the turn starts; `e.origin.kind` says who sent it (3782–3790)
- `prompt.fill` — a text is about to go into the prompt box as the person's draft (3791–3802)
- `prompt.suggest` — a dim Tab-to-take suggestion is about to show: the engine's guess or a plugin's `$.prompt.suggest` (3803–3814)
- `prompt.edit` — the person edits the prompt box: a key or a paste (3815–3826)
- `prompt.section` — once per named system-prompt section; rewrite its text (3827–3838)
- `prompt.context` — once per conversation, the context blocks the first user message carries (3839–3850)
- `prompt.compose` — the whole system prompt as `{ sections }`, in send order (3851–3862)
- `prompt.attachment` — a message the engine injects on its own: a reminder, a mode change, a mentioned file (3863–3874)
- `skill.prompt` — a skill's prompt is expanded for the model (`/name`, the Skill tool, a preload) (3960–3970)
- `attribution.text` — a git text the model is told to write (`commit`, `pr`, …) is composed (3971–3981)

## commands and config

- `command.run` — a slash command is about to run (3889–3900)
- `command.describe` — a command is listed for the typeahead and `/help` (3901–3912)
- `config.set` — a `/config` row is about to change (3913–3924)
- `config.describe` — a `/config` row is listed (3925–3936)

## the session

- `session.start` — once per process per plugin, then again on every reload, worker respawn or enable; init here (3982–3993)
- `session.receive` — a delivery reaches the session (a peer's message, a relay event, a Remote Control prompt), before it is queued (3994–4005)
- `session.append` — every row the conversation keeps (prompt, response block, tool result, notice), before it is stored (4006–4017)
- `session.send` — a plain-text message is about to leave for another agent or session (SendMessage, `$.session.send`) (4018–4029)
- `session.compact` — the conversation is about to be compacted; resolves `{ messages }` (4030–4041)
- `session.attach` — a remote client joins the roster of surfaces (4042–4053)
- `session.detach` — a client leaves the roster (4054–4061)
- `session.measure` — after each main-thread turn and on a whole-point rate-limit move: context fill, `rateLimits` (`five_hour`, `seven_day`), cost (4062–4073)
- `session.end` — once when the session ends: exit, /clear, resume, logout, signal (4074–4085)

## turns

- `turn.start` — a model turn begins, before its first model call (4098–4102)
- `turn.step` — a model request of a turn is about to go out, main's or a subagent's (4103–4111)
- `turn.complete` — a model turn ended; `e.agentId` set for a subagent's (4112–4120)

## the plugin itself and telemetry

- `plugin.register` — a hooks module is about to join the chain, at load and at reload (4086–4097)
- `engine.create` — `$` is being built, before any other hook of this plugin (4121–4129)
- `telemetry.log` — a record is about to be logged (3937–3948)
- `telemetry.mark` — one use of a feature is marked (3949–3959)

## ops a hook can answer (`OpValueOf`, 6618 on; inputs ~6380–6670)

the `$.<noun>.<verb>` calls; the test harness answers them with `on('<op>', …)` mocks.

- agent: `agent.list` `agent.register`
- audio: `audio.play` `audio.speak`
- clock: `clock.now` `clock.after` `clock.every` `clock.sleep`
- command and config: `command.list` `command.register` `config.list` `settings.read`
- env: `env.get` `env.set`
- fs: `fs.read` `fs.write` `fs.stat` `fs.exists` `fs.list` `fs.ancestors`
- net and processes: `http.fetch` `mcp.call` `mcp.connect` `process.run` `process.spawn`
- model: `model.complete` `model.classify` `model.fork`
- prompt and turn: `prompt.read` `turn.abort`
- session: `session.id` `session.cwd` `session.root` `session.repo` `session.model` `session.messages` `session.turns` `session.usage` `session.surface` `session.surfaces` `session.version` `session.authorize`
- state and store: `state.get` `state.set` `store.get` `store.set` `store.delete` `store.keys`
- tools: `tool.list` `tool.register`
- ui: `ui.open` `ui.close` `ui.panes` `ui.toast` `ui.notice` `ui.status` `ui.copy` `ui.log` `ui.invalidate` `ui.blit`

## fleet ideas — candidates, none built (2026-10-05)

cclio folds dima's picks into a ticket; a built idea leaves this list.

- holds sees Bash writes — `tool.check` (or `tool.call` on `Bash`) parses the common write shapes (heredoc `>`, `sd`, `sed -i`, python `open(…,'w')`) and takes or refuses the hold; closes the 37 % gap measured in `docs/test-drive/mods.md`
- the next ➡️ as a suggestion — `turn.complete` reads the reply's ➡️ line, `$.prompt.suggest` puts it in the box dim, Tab takes it; one key instead of typing «go»
- context toast — `session.measure` crosses 85 % context → `$.ui.toast` «offer a handoff»; the same hook already feeds keep-hot's 5h window
- a coder ping you can hear — `session.receive` sees a peer message from a coder → `$.audio.speak` reads its first line while dima is away from the screen
- the fleet board — `session.receive` and `session.send` log every member message into the stash store, and the band draws one row per member (FRM-303 item 4)
- spawn gating — `agent.spawn` refuses or reroutes a spawn the fleet rules forbid (a subagent for a one-pass job, a mechanical job not on `chore-helper`)
