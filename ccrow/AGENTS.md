# ccrow — cclio's parked adviser

a long-lived session «🐦‍⬛ ccrow», a desktop Code tab dima opens in `~/.local/state/ccrow/` (mods load there, not under `--bg`; pk-39), that reads cclio's thread on a wake and returns one note
or `none`. built for FRM-327. **this file is the mechanics only**: the seat's contract (hunts,
silence bar, note shape, timing, holdout, the consult) is the `x:crew-adviser` skill, which
`readCharter` sends as the boot prompt with its frontmatter cut — ccrow loads no plugins, so the
skill reaches it as text. a contract change goes there, never here.

## how it runs

- ccrow lives one cclio session: cclio's boot runs `pnpm ccrow:keep-cache-hot`, its halt runs
  `pnpm ccrow:stop` (FRM-335).
  - `pnpm ccrow:keep-cache-hot` — finds the live tab by name and writes its 🔥 key; no tab → one line asking dima to open it (cclio cannot open a desktop tab).
  - `pnpm ccrow:start opus|fable` — the old `--bg` start, a fallback when no tab can be opened; refuses while one is live.
  - `pnpm ccrow:stop` — `claude stop <jobId>`, switches 🔥 off, waits until the process is gone.
    it harvests nothing; the halt reads `notes.jsonl` and `verdicts.jsonl` itself.
- a start is `--bg --remote-control` from `~/.local/state/ccrow/`, effort medium. that home is
  outside frame, so the global `CLAUDE.md` loads and frame `AGENTS.md` does not; the global
  `rules/` are copied into the home's `.claude/rules/` at each start (see facts that bite).
- 🔥 keep-hot is stash's own: once the registry lists ccrow, the start writes `hot:<sessionId>`
  into stash's store file. 📌 stash reads that key only at `session.start`, which has already
  run by then, so 🔥 stays off until stash reads the key later too (FRM-335 open).
- `pnpm ccrow:wake --transcript <cclio jsonl> [--mode day|systematic] [--precompact]` — gates
  (no `~/.local/state/ccrow/paused` file — cclio's checkpoint holds it; 30 min since the last wake, ≥10 cclio steps; `--precompact` waives the steps), copies the
  leaves named in `~/.local/state/ccrow/leaves.txt` plus the transcript delta into
  `packets/<id>/`, writes one line to ccrow's inbox socket, and leaves a detached `harvest.ts`
  to log the note. live from day 1 (dima, 2026-10-06; the 3 silent days were cut after day 1 proved the notes worth reading live); a silent phase would have the other arm answer the same
  packet as a `claude -p` one-shot. live days alternate the arm (day 4 opus, day 5 fable, …);
  `wake` prints the restart line when the running arm is the wrong one, it never restarts ccrow.
- `pnpm ccrow:decision` — cclio's `PreToolUse` hook on Bash, filtered by `if` to `gh pr merge*` and `claude *`
  (FRM-380). a merge or a `claude --bg` spawn gets a `mode decision` wake outside the gates (no 30-min gap, no step
  count, `lastWakeAt` untouched); a push to main gets none. the merge line carries `merge <repo>#<n> · verified · head ·
  note <path>`, the verified sha read from `~/.claude/shelf/pr-verified.json` (the verifier writes it through
  `pr-watch.sh --verified`). a `--bg` ccrow gets the line on its socket and the merge waits ≤ 90 s for the note file;
  a tab gets none, so the first merge is denied with the line for cclio to `send_message`, and a rerun within 10 min
  (`decisions/<repo>-<n>-<head>.json`) waits for the note instead. a spawn never waits. every failure exits 0 with
  a context line: a PreToolUse exit 2 or timeout would block the merge.
- every packet whose delta lost older blocks or capped a tool output opens with one `cut:` line naming the
  transcript; ccrow reads its tail only then.
- `pnpm ccrow:plan-critique <plan file>` — the plan review at `x:shape-idea` step 4 (FRM-336, the
  FRM-287 template). never ccrow's own session, which has read
  cclio's thread: two fresh `claude -p` one-shots on the day's arm (the `ccrow:keep-cache-hot` pick),
  effort high, cwd a fresh `plans/<run>/` in the home. pass 1 gets only the sections whose heading
  says want, constraints, not or done test; pass 2 gets the whole plan plus pass 1's take and a
  `--json-schema` for the template. both run with `--tools ''`: a one-shot that can read reaches
  cclio's transcripts and the earlier verdicts through the `~` extra dir. each finding is one
  `channel: plan` line in `notes.jsonl` (id `plan-<run>-<n>`, `-0` for a clean run) with the arm,
  the model, the run's cost, and `located` — whether its quote is really in the plan. accepted is a
  `ccrow:note-vet` on that id; the full review sits in `plans/<run>/review.json`.
- `pnpm ccrow:note-vet ok|miss <note-id> <why>` — appends the verdict to `verdicts.jsonl`, keyed by
  note id; `notes.jsonl` is append-only, so a harvester writing mid-vet loses nothing.
- `leaves.txt`: one glob per line, `{today}` → `YYYY-MM-DD`, a `latest ` prefix keeps the newest
  match only. cclio owns it; the builder never reads under `cclio/`.

## facts that bite

- **the inbox socket takes newline-delimited json.** a frame with no `from_mode` is «no mode
  asserted», and a bypass session holds it unless `crossSessionInbound` is `accept` (probed
  2.1.291: the control logged «Held peer message … not delivered»).
- **`disableAllHooks` blocks mods too** — cc answers «hooks module not loaded: only managed
  plugins and built-in plugins run» (haiku probe, 2026-10-06). so ccrow starts with
  `--setting-sources project,local`: no user hooks, plugins or mods. the global `CLAUDE.md`
  still loads, the global `rules/` do not. `--settings` adds back what ccrow needs: the bypass mode and `~` as an
  extra dir (without them Bash is denied), `crossSessionInbound`, and `CLAUDE_CODE_PLUGIN_DIRS`
  holding the stash mod only. `true &` still runs, because `x-mod-guard` is not loaded.
- **`--settings` hooks merge with the user hooks** — `{"hooks":{}}` blanks nothing, so the user
  source must go to shed them (probed 2026-10-06).
- **a project `.claude/rules/` loads only real files** — a symlinked dir, symlinked files and
  `@`-imports from outside the project all loaded nothing, so the start copies the rules in.
  a rule deleted upstream lingers there until removed by hand.
- **`claude --bg` ignores `--session-id`** — the session id is known only from the registry
  after the spawn. its stdout also colours the job id, so the parse strips ansi first.
- **the registry entry goes ~2 s before the process** — `ccrow:stop` waits on the pid.
- **the stash mod is found by its plugin name** (`stash` or `x-mod-stash`) in the user
  `CLAUDE_CODE_PLUGIN_DIRS`, never by its dir. its store is `~/.claude/plugins/store/<name>_inline-<hash>.json`,
  one file shared by every session running stash; the hash is cc's own, so the newest matching file wins.
- **the registry stores the name with its zero-width joiner as a space** («🐦 ⬛ ccrow»), so
  `findSession` matches the bare name, never a job id: a desktop tab has none, and a stored one outlived its session and sent the 10-09 16:18 wake to a stopped `--bg` ccrow.
- **a desktop tab takes no socket line** (probed 10-09: a live tab with `crossSessionInbound: accept` let a line sit 60 s unseen); only the desktop's own `send_message` reaches it. so `wake.ts` sends to the socket only for a `--bg` ccrow (it has a job id); for a tab it parks the wake in `relay.json`, and cclio's `UserPromptSubmit` hook (`ccrow:relay`) hands the line to cclio's next turn, which forwards it and starts the harvester
- **the harvester polls the newest transcript in ccrow's project dir** (a `/clear` starts a new one) for the turn end after the wake line: `turn_duration` in a terminal, `stop_hook_summary` in a desktop tab, which writes no `turn_duration` (5 s,
  15 min deadline, a `timeout` note past it); `harvest.log` in the home records each run.
- **a `claude -p` transcript has no `turn_duration`**: the one-shot's model id is read from its
  assistant entries, found by the run's `session_id`. `runOneShot` and `oneShotModel` in
  `lib.ts` are the one path for both the silent arm and `ccrow:plan-critique`.
- **`claude -p --json-schema` answers in `structured_output`** beside `result` in the json output
  (haiku probe, 2026-10-06); `total_cost_usd` is there too.
- dates (`{today}`, the wake id) are local time; `wake.lock` keeps two hooks firing in one second
  from both passing the 30-min gate.
- **a retro, when dima or cclio asks for one** (≤12 lines, ranked by cost): the standing focus is
  what cclio missed and when your note landed late, plus one line on what a better adviser would
  have said; an ask's `focus:` line replaces it for that retro (dima, 2026-10-08).
