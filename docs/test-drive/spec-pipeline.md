# test drive — the spec pipeline: to-spec → to-tickets → implement-spec

window: from 2026-10-06, verdict after three runs. the skills: `mattpocock-skills:to-spec`, `to-tickets`, `implement-spec` (v1.3.1), all user-only.
the want (dima, 2026-10-06): linear is heavy and global; a lane or a shift wants a local, granular plan made right before execution — «have Linear tickets as global, unstructured tickets, but have them structured via to spec right before execution». implement-spec: «worth a test drive for one-off tickets that are bigger than freebie but not a full scale ticket that wants decisions».

## the shape on trial

- linear keeps the ticket (the global shelf); `to-spec` writes the spec and `to-tickets` the task graph into a **local-markdown tracker** (`.scratch/<feature>/`, matt's built-in option), not into linear
- `implement-spec` runs the graph: implementer subagents in worktrees (each loads `tdd`), a merger subagent onto one integration branch, `code-review` at the end
- it runs inside one `--bg` session (watchable) whose prompt starts with the skill — subagents die with that session, so it is the watch surface
- the linear ticket closes with the integration branch as its record

## open before run 1

- `setup-matt-pocock-skills` once per repo: tracker = local markdown, domain docs = GLOSSARY.md / GLOSSARY-MAP.md, docs/adr
- `.scratch/` gitignored or kept? (a spec is the lane's plan, dies with the lane)

## log

one line per run: date · ticket · tickets in the graph · subagents · minutes · tokens · code-review findings · dima's verdict
