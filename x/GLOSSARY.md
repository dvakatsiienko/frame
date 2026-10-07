# x — words

- **verb** — one operation `x` runs, named `<family> <name>` (`lane commit`); the unit an agent calls
- **family** — a group of verbs about one subject (`lane`, `handoffs`); owns a colour in the human view
- **registry** — the one list of verbs and families in `x/go/registry.json`; dispatch, schema, help and completion all read it
- **envelope** — the json every verb prints for a machine: `{verb, ok, status, data}`
- **resident line** — the one line every session holds about x: it exists, `x` lists families, `x schema <family>` the verbs; a per-verb index was cut (2026-10-07)
- **admission rule** — the three tests a verb passes before it joins x (`PRODUCT.md`): a fleet procedure, more than one surface calls it, it hides a hazard or a sequence
- **the human view** — what dima sees on a tty: the T2 dense-family design; a pipe or `--json` gets the envelope instead
- **brief** — the markdown a coder is spawned with; `x brief check` reads its backticked names and its exit lines
- **stamp** — the file a passing `brief check` writes, keyed by the brief's sha256, so a spawn guard can ask «was this brief checked»
- **probe** — a `claude -p` session run from a dir no repo owns, so our setup cannot answer for it: `bare` (no setup at all) or `session` (named, with a settings json, resumable)
- **shelf** — `docs/knowledge/`, the fleet's reference files; each file's verified date is its stamp, a file with none is unstamped
- **held files** — the unstaged and untracked work outside a commit's paths, moved into the git dir while the hooks run, then put back byte for byte
- **trace** — the one json line x writes when a call exits: the verb, flag names (never values), the caller, duration, exit and error kind; `x stats` reads them
- **caller** — who ran a verb, one fixed value per trace line, read from the env: `hook` (`GIT_EXEC_PATH` from git, `CLAUDE_PROJECT_DIR` from a cc hook), `cc` (`CLAUDECODE`), `cw` (Cowork's Desktop Commander passes on a `CLAUDE_PLUGIN_ROOT` under `local-agent-mode-sessions/`), `ssh` (`SSH_CONNECTION`), `dima` (a tty), `other`
- **error kind** — why a traced call failed: `usage` (exit 2), `refused` (x's own check stopped before acting), `external` (a tool ran and failed), `bug` (a panic or an unexpected error)
- **raw door** — a family's traced passthrough to the tool underneath (`x linear api`), the fallback when no verb fits; what it carries ranks the next verbs
