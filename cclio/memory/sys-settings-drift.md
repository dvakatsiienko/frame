# settings-json drift

`~/.claude/settings.json` is **not static** — CC writes it at runtime (plugin toggles, `autoMode`
learning), so the symlink into frame is the only thing keeping repo and live equal.

The drift traced to commit `d03f3da`, which placed a real file where the link belonged; the repo
copy froze while live kept moving, surfacing only at a pre-push refusal months later.

- **Watch:** a real file where the symlink belongs means an app replaced it on write — cc itself,
  or a third party: `usage` (aqua5230) did it 2026-09-04, injecting http hooks to `127.0.0.1:19847`;
  `ECONNREFUSED` hook noise in a session is the tell —
  `boot-prefetch.sh` checks this every boot; a real file there is the early warning.
- **a plugin on/off change checks every settings layer** — user, project, project-local; a project `false` beats a
  user `true`, and impeccable stayed off in every frame session for a day behind one (2026-09-29).
- ⚠️ **Before any future merge of this file, verify the `permissions` blocks byte-identical and
  say so** — Dima was once storm-hit by a permission change and is rightly wary.

Related: [[sys-boundaries]]
