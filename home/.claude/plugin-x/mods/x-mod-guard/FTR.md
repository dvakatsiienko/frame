# x-mod-guard — features

- 🧭 asked, not built yet (a new ask, an experiment) · ⬜ built, not checked yet · 🐞 built, its check fails · ✅ passes in the app's verify recipe · 🔎 dima used it and it holds
- given/when/then lines are the verifier's exit lines
- makes: lines name what a feature leaves behind — a file, a take, a clipboard item
- decision: lines record a choice and its reason

## every Bash call

- ✅ a floor command is refused with its door
  - given a Bash call runs one of: `rm` or `unlink` (also `xargs rm`, `find -delete`, `find -exec rm`); a kill by pattern (`pkill`, `killall`, a `kill` fed by `pgrep`, `ps`, `grep` or `awk`); `git reset --hard`, `git checkout --`, `.` or `-f`, `git restore` of the worktree, `git clean -f`, `git stash drop|clear`; `git push --force|-f|--force-with-lease|--delete` or a `+ref` / `:ref` refspec, `git branch -D` or `-d -f`, `git worktree remove|prune`; `--no-verify` or `--no-gpg-sign` on `git` or `x`, `git commit -n`, `-c commit.gpgsign=false`, `-c user.name|user.email`, `git config user.name|user.email <value>`; a `mv` in the obsidian vault; a `HOME=` override; `npm -g` or `--location=global`; `pip install`
  - and wherever it sits: behind `sudo -u <user>`, `env`, `timeout`, `nice`, `xargs`; inside `if`, `for`, `while`, `{ … }`; inside a `$( … )` or backticks, quoted or not; in a `bash -c` / `-lc` script or an `eval`
  - when x-mod-guard reads it
  - then that one command is refused, and the reason opens with the door: `trash`, `claude stop <id>`, `git stash -u`, the `obsidian` cli, `uv pip install`, `brew` / `pnpm add -g`, a run without the flag — and «ask cclio» only for a force-push or a remote branch delete, a local branch delete, `git worktree remove|prune` and a x-mod-stash drop, where no safe door exists
  - proven live 2026-10-05: a headless `claude -p --plugin-dir x-mod-guard` was told to `rm` a scratch file; the call was refused with the trash door, the file stayed, the event landed in x-mod-guard's store
  - decision: a refusal stops one command, never the session — no dialog, so a missed click can never stall a coder; the coder finds its own way around (dima, FRM-321)
  - decision: quoted text, heredoc bodies and comments are never read as commands — a commit message may name `rm -rf`
  - 📌 not read: a script piped into a shell (`curl … | sh`, `cat x | bash`); `rmdir`, `truncate`, `git worktree` moves
- ✅ a hazard shape is refused with its fix, and its near miss runs
  - given a Bash call holds: an `sd` replacement with `$` in double quotes; an `sd` find led by `-` with no `--`; an unbraced `$var` before `:<letter>` (a zsh modifier) or a non-ascii character; `sd`, or `sed -i`, on `.github/workflows/*`; a trailing `&` with no `wait` or `sleep` after it; a gate (`typecheck`, `test`, `check`, `tsc`, `vitest`, a `family:test` script) piped into `head` or `grep`; a `git push` piped into `grep`; a `git commit` with no `--` paths, `git add -A` / `--all` / `.`; `pnpm -s`
  - then it is refused with its fix; `$HOST:8080`, `$HOST:/tmp`, `pgrep -l x; kill <pid>`, `kill $(cat x.pid)` and a search for `--no-verify` run; the shape one step away (single quotes, `--`, `${var}`, `sed -n`, a `sleep` after the `&`, an unpiped gate, `git ls-remote`, `-- <paths>`, `--silent`) runs
- ✅ a git add of a missing path is refused before git runs
  - given a `git add` that names a path not on disk (`git add a b`, `b` gone), resolved from the dir its `cd` or `-C` left
  - then it is refused, the reason names the missing path, and the door is «stage only paths that exist; a deleted file stages with git rm <path>»
  - given every named path exists, then it runs; a glob, a `:(magic)` pathspec or a word holding a `$` is left to git
  - decision: git aborts the whole add on one unmatched pathspec, and a commit after it lands partial — the old path after a `git mv` was the case (fleet-hazards, the bash tool)
  - 📌 a tracked file already deleted is refused too; `git rm <path>` stages it. a `git add` inside `bash -c` or `eval` is not looked up
- ✅ a job's own scratch clone runs its local git
  - given a git discard, a local rewrite (`branch -D`, `worktree remove|prune`) or a sweep (`add -A`, a bare `commit`) whose dir and every path resolve under `$CLAUDE_JOB_DIR/tmp`, spelled out or as `$CLAUDE_JOB_DIR` / `${CLAUDE_JOB_DIR}`, through `cd` or `-C`
  - then it runs; the same command anywhere else, in the job dir itself, in another job's tmp or climbing out with `..` is refused as before
  - then a push, a gate bypass and every non-git floor command stay refused inside the tmp too — a push reaches a real remote, a bypass a real gate
- ✅ an escape lets one refused command run
  - given dima said yes to a refused command
  - when the command ends with `# dima-ok: <targets>`, naming every target the refusal named (split by spaces or commas)
  - then it runs, and the escape is logged in the transcript and kept as a guard event
  - when the marker names another target, or only some of them (`rm -rf ~/keep tmp.txt # dima-ok: tmp.txt`)
  - then the command is refused as before
  - decision: the target is the command's own — its paths, pattern or branch; the rule's own word when it names none (`HEAD`, `&`, `-s`) — and the refusal prints the exact marker, so a coder never guesses it
- ✅ a guard that fails refuses the command
  - given x-mod-guard throws or runs past its 10 s budget (the throw is tested; the overrun is the same `.catch` by the engine's types, unprobed)
  - then the command is refused with «x-mod-guard: the check failed or ran out of time … (fail closed)»
  - decision: `.catch` answers `{ deny }` — a hook without one is skipped and the command would run
- ✅ every refusal and escape is kept as a guard event
  - makes: one `event:<at>:<session>` key in x-mod-guard's `$.store` (`~/.claude/plugins/store/x-mod-guard_*.json`): session, its registry name, the command cut to 160 characters, refused or escaped, door, target; the newest 50 kept
  - then x-mod-stash's band folds the run into one `🛡️ <n> refusals · <m> sessions` counter row that ages out 30 min after the last event, no dismiss — x-mod-stash's `FTR.md`, «guard counter»
- ✅ every day's refusals and escapes are counted past the kept events
  - makes: one `day:<yyyy-mm-dd>:<session>` key in x-mod-guard's `$.store`, `{ refused, escaped }`, the local day; counts older than 30 days are dropped
  - then a halt sums the day's keys for the whole day, however many events the newest-50 cut has dropped
  - decision: one key per session a day — two sessions never write the same key, so a count is never lost to a race; a count that fails to write never changes the refusal
  - 📌 only the Bash tool is read: a command started by `Monitor` or a `!` line in the prompt goes through unread

- ✅ a system, overwrite, prune or remote-delete command is refused with its door
  - given a Bash call runs one of:
    - system: `sudo` (or `doas`) ahead of any command; `diskutil erase*`; `dd of=/dev/<device>`; `mkfs*` / `newfs*`; `chmod -R` / `chown -R` on `~`, `$HOME` or a dir above it; `csrutil` past `status`; `spctl --master-disable|--global-disable`; `tccutil reset`
    - silent overwrite: a `>` (or `2>`, `&>`) redirect onto a file that exists, `: > file` included; `cp /dev/null <file>`; `mv`, or `cp -f`, onto a file that exists, or into a dir that holds a file of that name
    - history: `git filter-repo`, `git filter-branch`, `git gc --prune=now`
    - prune: `brew cleanup`, `pnpm store prune`, `docker system prune`, `crontab -r`
    - remote delete: `gh repo|release delete*`, `vercel rm|remove` and `vercel env rm`, `op <item|…> delete|rm|remove`, `security delete-*`, `linear issue delete`, an `issueDelete` mutation sent by `curl` or `linear`
    - top dir: `trash` of `/`, `~`, a dir above it, a dir right under it (`~/Documents`) or the obsidian vault root; `defaults delete <domain>` with no key, or `-g` with none
  - then it is refused, and the reason opens with the door: «ask cclio» for a disk, a device, history or a remote delete; «hand dima the step» for `csrutil`, `spctl` and `tccutil`; «hand dima the command» for `sudo`; «leave the prune to dima — name it in your report»; `>>`, a new path or the Write tool for a redirect; `mv -n` / `cp -n` or trash the old file first; «cancel it» for a linear issue; trash the files inside, by name; one `defaults` key
  - then the nearest harmless form runs: `diskutil list`, `dd` onto a file, `chmod -R` inside `~`, `csrutil status`, a `>` onto a new file, `>>`, `> /dev/null 2>&1`, `mv` onto a new name or into a dir without that file, `git gc`, `crontab -l`, `gh release view`, `vercel env ls`, `linear issue view`, `trash` of a file in `~/Documents` or a note in the vault, `defaults delete <domain> <key>`
  - then `sudo` ahead of a floor command keeps the floor's door (`sudo rm` → trash)
  - then a history rewrite inside a job's own scratch clone runs, like the other local rewrites
  - decision: an overwrite is refused only when the file is on disk — x-mod-guard looks each target up before the call; a plain `cp` onto a file is left alone, only `cp -f` and `cp /dev/null` are read (FRM-324's list)
  - 📌 not read: an overwrite inside `bash -c` or `eval` (the lookup reads the top command only), `tee`, `truncate`, `rsync --delete`; a remote delete sent through `gh api` or a raw `curl` to any api but linear's

## every Agent spawn

- ✅ a fork must say why it needs the parent context
  - given an `Agent` spawn of type `fork` whose prompt has no `why-fork: <what parent context it needs>` line
  - when x-mod-guard reads the spawn
  - then it is refused, and the reason opens with the door: a fresh agent with a self-contained brief, or `chore-helper` for a mechanical job
  - given the same fork with a `why-fork:` line, then it runs; any other agent type is left alone
  - then the refusal counts in x-mod-stash's 🛡️ counter row (`fork: <description>` when unfolded), like a Bash refusal
  - decision: a required line, never a guess at «mechanical» — a keyword guess was unreliable (51 loose hits, most of them real research); a fork carries the whole parent context, ~220k (FRM-323)
  - 📌 harness-proven only: a headless `claude -p` offers no `fork` type («Agent type 'fork' not found»), so the live check is a fork from an interactive session
