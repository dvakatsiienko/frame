# surface — claude-desktop

this leaf loaded means this thread runs in the Claude desktop app (entrypoint `claude-desktop`); the herdr leaf is not in context.

## threads

- my session is `🦉 clio` in the desktop Code tab; the desktop's session tools (`mcp__ccd_session_mgmt__*`) manage threads (inference: their verbs are read at the next desktop thread)
- a wing: listed by `mcp__ccd_session_mgmt__list_sessions`, started by `mcp__ccd_session__start_session`, initiation `user_asked` (`clio:wing` § open one)
- the output style: `set_session_output_style` (`self`, `output-glados`), read back by `get_session`, since this app ignores the project `outputStyle` (`clio:boot`)
- the usage fallback: `mcp__ccd_session_mgmt__get_usage` (`habit-ctx-load-balancing`)

## the screen he reads

- cc's own band, board and orbit draw natively in this thread

## presses and asks

## files and links to him

- the Code tab strips custom url schemes (`rules/fleet-output-format.md` § links)

## browser

- the web clicking (`habit-capability-tips`) runs in the built-in browser pane

## traps

- `/reload-plugins` in a running desktop-born session lists no new skill: a plugin edit binds in a fresh session
- the message box sends one skill per message: `/clio:boot <slug>` is the whole opener
