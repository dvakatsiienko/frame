# ccrow — cclio's parked adviser

a long-lived `--bg` session «🐦‍⬛ ccrow» that reads cclio's thread on a wake and returns one note
or `none`. built for FRM-327; the charter is `charter.md`, its boot prompt.

## how it runs

- `pnpm ccrow:start opus|fable` — `--bg --remote-control` from `~/.local/state/ccrow/`, effort
  medium. that home is outside frame, so the global `CLAUDE.md` + `rules/` load and frame
  `AGENTS.md` does not.
- `pnpm ccrow:wake --transcript <cclio jsonl> [--mode day|systematic] [--precompact]` — gates
  (30 min since the last wake, ≥10 cclio steps; `--precompact` waives the steps), copies the
  leaves named in `~/.local/state/ccrow/leaves.txt` plus the transcript delta into
  `packets/<id>/`, writes one line to ccrow's inbox socket, and leaves a detached `harvest.ts`
  to log the note. days 1–3 after the first wake are silent: the other arm answers the same
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
- **hooks and mods are off via `--settings`**: `disableAllHooks` plus an empty
  `CLAUDE_CODE_PLUGIN_DIRS` env, because the mods load from that env in the user settings. probed:
  `true &` runs where `guard` refuses it elsewhere.
- **the registry stores the name with its zero-width joiner as a space** («🐦 ⬛ ccrow»), so
  `findSession` matches a bare name or the saved `jobId`.
- **the harvester polls ccrow's transcript** for the `turn_duration` after the wake line (5 s,
  15 min deadline, a `timeout` note past it); `harvest.log` in the home records each run.
- **a `claude -p` transcript has no `turn_duration`**: the one-shot's model id is read from its
  assistant entries, found by the run's `session_id`.
- dates (`{today}`, the wake id) are local time; `wake.lock` keeps two hooks firing in one second
  from both passing the 30-min gate.
