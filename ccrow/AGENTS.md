# ccrow — cclio's parked adviser

a long-lived `--bg` session «🐦‍⬛ ccrow» that reads cclio's thread on a wake and returns one note
or `none`. built for FRM-327; the charter is `charter.md`, its boot prompt.

## how it runs

- ccrow lives one cclio session: cclio's boot runs `pnpm ccrow:ensure`, its halt runs
  `pnpm ccrow:stop` (FRM-335).
  - `pnpm ccrow:ensure` — starts ccrow on the day's arm unless one is live; a live one is left alone.
  - `pnpm ccrow:start opus|fable` — the same start on a named arm; refuses while one is live.
  - `pnpm ccrow:stop` — `claude stop <jobId>`, switches 🔥 off, waits until the process is gone.
    it harvests nothing; the halt reads `notes.jsonl` and `verdicts.jsonl` itself.
- a start is `--bg --remote-control` from `~/.local/state/ccrow/`, effort medium, under a session
  id it picks. that home is outside frame, so the global `CLAUDE.md` + `rules/` load and frame
  `AGENTS.md` does not.
- 🔥 keep-hot is stash's own: the start writes `hot:<sessionId>` into stash's store file before the
  spawn (stash reads it once, at `session.start`), so stash pings ccrow 50 min after its last
  turn and the cache stays warm. the start reads the key back once ccrow is up and prints
  `🔥 on` or `🔥 lost`.
- `pnpm ccrow:wake --transcript <cclio jsonl> [--mode day|systematic] [--precompact]` — gates
  (no `~/.local/state/ccrow/paused` file — cclio's checkpoint holds it; 30 min since the last wake, ≥10 cclio steps; `--precompact` waives the steps), copies the
  leaves named in `~/.local/state/ccrow/leaves.txt` plus the transcript delta into
  `packets/<id>/`, writes one line to ccrow's inbox socket, and leaves a detached `harvest.ts`
  to log the note. live from day 1 (dima, 2026-10-06; the 3 silent days were cut after day 1 proved the notes worth reading live); a silent phase would have the other arm answer the same
  packet as a `claude -p` one-shot. live days alternate the arm (day 4 opus, day 5 fable, …);
  `wake` prints the restart line when the running arm is the wrong one, it never restarts ccrow.
- `pnpm ccrow:vet ok|miss <note-id> <why>` — appends the verdict to `verdicts.jsonl`, keyed by
  note id; `notes.jsonl` is append-only, so a harvester writing mid-vet loses nothing.
- `leaves.txt`: one glob per line, `{today}` → `YYYY-MM-DD`, a `latest ` prefix keeps the newest
  match only. cclio owns it; the builder never reads under `cclio/`.

## facts that bite

- **the inbox socket takes newline-delimited json.** a frame with no `from_mode` is «no mode
  asserted», and a bypass session holds it unless `crossSessionInbound` is `accept` (probed
  2.1.291: the control logged «Held peer message … not delivered»).
- **`disableAllHooks` blocks mods too** — cc answers «hooks module not loaded: only managed
  plugins and built-in plugins run» (haiku probe, 2026-10-06). so ccrow starts with
  `--setting-sources project,local`: no user hooks, plugins or mods, while the global `CLAUDE.md`
  and `rules/` still load. `--settings` adds back what ccrow needs: the bypass mode and `~` as an
  extra dir (without them Bash is denied), `crossSessionInbound`, and `CLAUDE_CODE_PLUGIN_DIRS`
  holding the stash mod only. `true &` still runs, because `guard` is not loaded.
- **the stash mod is found by its plugin name** (`stash` or `x-mod-stash`) in the user
  `CLAUDE_CODE_PLUGIN_DIRS`, never by its dir. its store is `~/.claude/plugins/store/<name>_inline-<hash>.json`,
  one file shared by every session running stash; the hash is cc's own, so the newest matching file wins.
- **the registry stores the name with its zero-width joiner as a space** («🐦 ⬛ ccrow»), so
  `findSession` matches a bare name or the saved `jobId`.
- **the harvester polls ccrow's transcript** for the `turn_duration` after the wake line (5 s,
  15 min deadline, a `timeout` note past it); `harvest.log` in the home records each run.
- **a `claude -p` transcript has no `turn_duration`**: the one-shot's model id is read from its
  assistant entries, found by the run's `session_id`.
- dates (`{today}`, the wake id) are local time; `wake.lock` keeps two hooks firing in one second
  from both passing the 30-min gate.
