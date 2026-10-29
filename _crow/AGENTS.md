# crow — clio's parked adviser

a long-lived session «🐦‍⬛ crow» that reads clio's thread on a wake and returns one note or `none`, in either of two modes: a `--bg --remote-control` session clio starts, or a desktop tab dima opens. built for FRM-327. **this file is the mechanics only**: the seat's contract (hunts,
silence bar, note shape, timing, the consult) is the `x:crew-adviser` skill, which
`readCharter` sends as the boot prompt with its frontmatter cut — crow loads no plugins, so the
skill reaches it as text. a contract change goes there, never here.
<!-- why --bg works (o150): mods' hooks load under --bg (mods/engine.md); only a --bg board goes undrawn, and crow's 👀 line draws on clio's card -->

## how it runs

- crow lives one clio session, in one of two modes, both first-class (dima, 2026-10-21):
  - **`--bg`** — clio's boot runs `pnpm crow:start opus` (opus 5.5 medium; refuses while one is live): settings `project,local`, the stash mod only, so x-mod-guard is absent; wakes go over her socket
  - **desktop tab** — dima opens a Code tab in `~/.local/state/crow/` named «🐦‍⬛ crow» and sends the opener; clio's boot runs `pnpm crow:keep-cache-hot` (finds the tab, writes its 🔥 key): settings `user,project,local`, so every user hook, mod and rule loads, x-mod-guard included; wakes go through `relay.json` (facts that bite)
  - the halt runs `pnpm crow:stop` for `--bg` (FRM-335); a tab is closed by dima
  - `pnpm crow:stop` — `claude stop <jobId>`, switches 🔥 off, waits until the process is gone.
    it harvests nothing; the halt reads `notes.jsonl` and `verdicts.jsonl` itself.
- a start is `--bg --remote-control` from `~/.local/state/crow/`. that home is
  outside frame, so the global `CLAUDE.md` loads and frame `AGENTS.md` does not; the global
  `rules/` are copied into the home's `.claude/rules/` at each start (see facts that bite).
- 🔥 keep-hot is stash's own: once the registry lists crow, the start writes `hot:<sessionId>`
  into stash's store file. stash reads it again after `session.start` too (`register.tsx`, the `hot:` reads), so 🔥 turns on
  once the key lands.
- `pnpm crow:wake --transcript <clio jsonl> [--mode day|systematic] [--precompact]` — gates
  (no `~/.local/state/crow/paused` file — clio's checkpoint holds it; 30 min since the last wake, ≥10 clio steps; `--precompact` waives the steps), copies the
  leaves named in `~/.local/state/crow/leaves.txt` plus the transcript delta into
  `packets/<id>/`, writes one line to crow's inbox socket, and leaves a detached `harvest.ts`
  to log the note. live from day 1 (dima, 2026-10-06; the 3 silent days were cut after day 1 proved the notes worth reading live); a silent phase would have the other arm answer the same
  packet as a `claude -p` one-shot.
- `pnpm crow:decision` — clio's `PreToolUse` hook on Bash, filtered by `if` to `gh pr merge*` and `claude *`
  (FRM-380). a merge or a `claude --bg` summon gets a `mode decision` wake outside the gates (no 30-min gap, no step
  count, `lastWakeAt` untouched); a push to main gets none. the merge line carries `merge <repo>#<n> · verified · head ·
  note <path>`, the verified sha read from `~/.claude/shelf/pr-verified.json` (sixth sense writes it through
  `pr-watch.sh --verified`). a `--bg` crow gets the line on its socket and the merge waits ≤ 90 s for the note file;
  a tab gets none, so the first merge is denied with the line for clio to send with SendMessage by crow's registry name, and a rerun within 10 min
  (`decisions/<repo>-<n>-<head>.json`) waits for the note instead. a summon never waits. every failure exits 0 with
  a context line: a PreToolUse exit 2 or timeout would block the merge.
  the same script is clio's `PostToolUse` hook on `Write|Edit` (FRM-396): a write to `.scratch/**/*-proposal.md` gets a
  `mode decision` wake ending `proposal <path>`, the file whole under a `## proposal ·` block in the packet; it never
  waits, like a summon, and any other file wakes nothing. one wake per proposal file per turn (o178): `decisions/proposal-<hash>.json` keys the
  turn by clio's last prompt line, so a draft's later Edits stay quiet until her next prompt.
- every packet opens with crow's ledger line: notes sent today, the last send's time, today's ok verdicts — `ledgerLine` in `lib.ts`
- every packet whose delta lost older blocks or capped a tool output opens with one `cut:` line naming the
  transcript; crow reads its tail only then.
- `pnpm crow:plan-critique <plan file>` — the plan review at `clio:shape-idea` step 4 (FRM-336, the
  FRM-287 template). never crow's own session, which has read
  clio's thread: two fresh `claude -p` one-shots on opus,
  effort high, cwd a fresh `plans/<run>/` in the home. pass 1 gets only the sections whose heading
  says want, constraints, not or done test; pass 2 gets the whole plan plus pass 1's take and a
  `--json-schema` for the template. both run with `--tools ''`: a one-shot that can read reaches
  clio's transcripts and the earlier verdicts through the `~` extra dir. each finding is one
  `channel: plan` line in `notes.jsonl` (id `plan-<run>-<n>`, `-0` for a clean run) with the arm,
  the model, the run's cost, and `located` — whether its quote is really in the plan. accepted is a
  `crow:note-vet` on that id; the full review sits in `plans/<run>/review.json`.
- `pnpm crow:note-vet ok|miss <note-id> <why>` — appends the verdict to `verdicts.jsonl`, keyed by
  note id, waiting ≤60 s for a note harvest.ts has not logged yet; `pnpm crow:unvetted`, clio's Stop hook,
  blocks her turn end once per «🔴 sent» note still without a verdict, naming the command; `notes.jsonl` is append-only, so a harvester writing mid-vet loses nothing.
- `pnpm crow:reconcile <note-id> <evidence>` — clio's answer when her evidence contradicts a note (FRM-396): sends
  `reconcile <note-id>: <evidence>` to a `--bg` crow, or prints it for clio to send with SendMessage by her registry name (a tab or a terminal resume), and leaves a
  harvester (`harvest.ts reconcile <id> <evidence>`) that logs crow's one answer as `<note-id>-reconcile`, with
  `reconciles` and `evidence`, in `notes.jsonl`. an unknown id, a reconciled note, or one whose reconcile is still
  pending (`reconciles/<id>.json`, younger than the harvester's 15 min) exits 2; a timeout logs no row, only a
  `harvest.log` line, so the line can be sent again.
- `leaves.txt`: one glob per line, `{today}` → `YYYY-MM-DD`, a `latest ` prefix keeps the newest
  match only. clio owns it; the builder never reads under `_clio/`.

## facts that bite

- **a fixture run sets `CROW_STATE_DIR`** to a temp dir: `lib.ts` reads every path from it, so no note, verdict or
  run reaches the real `~/.local/state/crow/`. a script that spends runs gets a stub `claude` on `PATH` (`state-dir.test.ts`)
- **the inbox socket takes newline-delimited json.** a frame with no `from_mode` is «no mode
  asserted», and a bypass session holds it unless `crossSessionInbound` is `accept` (probed
  2.1.291: the control logged «Held peer message … not delivered»).
- **`disableAllHooks` blocks mods too** — cc answers «hooks module not loaded: only managed
  plugins and built-in plugins run» (haiku probe, 2026-10-06). so crow starts with
  `--setting-sources project,local`: no user hooks, plugins or mods. the global `CLAUDE.md`
  still loads, the global `rules/` do not. `--settings` adds back what crow needs: the bypass mode and `~` as an
  extra dir (without them Bash is denied), `crossSessionInbound`, and `CLAUDE_CODE_PLUGIN_DIRS`
  holding the stash mod only. under `--bg`, `true &` still runs, because `x-mod-guard` is not loaded; a tab loads it and refuses `true &`.
- **`--settings` hooks merge with the user hooks** — `{"hooks":{}}` blanks nothing, so the user
  source must go to shed them (probed 2026-10-06).
- **a project `.claude/rules/` loads only real files** — a symlinked dir, symlinked files and
  `@`-imports from outside the project all loaded nothing, so the start copies the rules in.
  a rule deleted upstream lingers there until removed by hand.
- **`claude --bg` ignores `--session-id`** — the session id is known only from the registry
  after the summon. its stdout also colours the job id, so the parse strips ansi first.
- **the registry entry goes ~2 s before the process** — `crow:stop` waits on the pid.
- **the stash mod is found by its plugin name** (`stash` or `x-mod-stash`) in the user
  `CLAUDE_CODE_PLUGIN_DIRS`, never by its dir. its store is `~/.claude/plugins/store/<name>_inline-<hash>.json`,
  one file shared by every session running stash; the hash is cc's own, so the newest matching file wins.
- **the registry stores the name with its zero-width joiner as a space** («🐦 ⬛ crow»), so
  `findSession` matches the bare name, never a job id: a desktop tab has none, and a stored one outlived its session and sent the 10-09 16:18 wake to a stopped `--bg` crow.
- **a desktop tab takes no socket line** (probed 10-09: a live tab with `crossSessionInbound: accept` let a line sit 60 s unseen); only the desktop's own `send_message` reaches it. so `wake.ts` sends to the socket only for a `--bg` crow (it has a job id); for a tab it parks the wake in `relay.json`; x-mod-stash in clio's thread sends the line to crow's session id within a poll (`$.session.send`, no model) and marks it `isSent`, and clio's `UserPromptSubmit` hook (`crow:relay`) then starts the harvester; an unsent wake stays parked and the next poll sends it
- **the harvester polls the newest transcript in crow's project dir** (a `/clear` starts a new one) for the turn end after the wake line: `turn_duration` in a terminal, `stop_hook_summary` in a desktop tab, which writes no `turn_duration` (5 s,
  15 min deadline, a `timeout` note past it); `harvest.log` in the home records each run.
  any other session opened in the home (a misplaced clio boot, 2026-10-21) becomes the newest transcript and the harvester reads it — such a session is closed, and crow's transcript is the newest again
- **a `claude -p` transcript has no `turn_duration`**: the one-shot's model id is read from its
  assistant entries, found by the run's `session_id`. `runOneShot` and `oneShotModel` in
  `lib.ts` are the one path for both the silent arm and `crow:plan-critique`.
- **`claude -p --json-schema` answers in `structured_output`** beside `result` in the json output
  (haiku probe, 2026-10-06); `total_cost_usd` is there too.
- **a compaction can re-append the old chain** under its own `uuid`s and old stamps, past the wake's line offset; `transcriptDelta` skips a `uuid` already read before or inside the delta (`lib.test.ts`, «replays the old chain»)
- dates (`{today}`, the wake id) are local time; `wake.lock` keeps two hooks firing in one second
  from both passing the 30-min gate.

<!-- CROW_STATE_DIR: FRM-336's codie left 10 fixture notes in the real state dir; FRM-339 made it overridable, state-dir.test.ts holds it. -->
<!-- compaction replay: clio's 10-22 19:48 compact wrote 2,047 copies of lines 3+ before its boundary; the head-cut kept them and dropped the real 19:21–19:47 blocks from the 19:50 packet (PK-254). -->
