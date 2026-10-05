# guard — features

- 🧭 asked, not built yet (a new ask, an experiment) · ⬜ built, not checked yet · 🐞 built, its check fails · ✅ passes in the app's verify recipe · 🔎 dima used it and it holds
- given/when/then lines are the verifier's exit lines
- makes: lines name what a feature leaves behind — a file, a take, a clipboard item
- decision: lines record a choice and its reason

## every Bash call

- ✅ a floor command is refused with its door
  - given a Bash call runs one of: `rm` or `unlink` (also `xargs rm`, `find -delete`, `find -exec rm`); a kill by pattern (`pkill`, `killall`, a `kill` fed by `pgrep`, `ps`, `grep` or `awk`); `git reset --hard`, `git checkout --`, `.` or `-f`, `git restore` of the worktree, `git clean -f`, `git stash drop|clear`; `git push --force|-f|--force-with-lease|--delete` or a `+ref` / `:ref` refspec, `git branch -D` or `-d -f`, `git worktree remove|prune`; `--no-verify` or `--no-gpg-sign` on `git` or `x`, `git commit -n`, `-c commit.gpgsign=false`, `-c user.name|user.email`, `git config user.name|user.email <value>`; a `mv` in the obsidian vault; a `HOME=` override; `npm -g` or `--location=global`; `pip install`
  - and wherever it sits: behind `sudo -u <user>`, `env`, `timeout`, `nice`, `xargs`; inside `if`, `for`, `while`, `{ … }`; inside a `$( … )` or backticks, quoted or not; in a `bash -c` / `-lc` script or an `eval`
  - when guard reads it
  - then that one command is refused, and the reason opens with the door: `trash`, `claude stop <id>`, `git stash -u`, the `obsidian` cli, `uv pip install`, `brew` / `pnpm add -g`, a run without the flag — and «ask cclio» only for a force-push or a remote branch delete, a local branch delete, `git worktree remove|prune` and a stash drop, where no safe door exists
  - proven live 2026-10-05: a headless `claude -p --plugin-dir guard` was told to `rm` a scratch file; the call was refused with the trash door, the file stayed, the event landed in guard's store
  - decision: a refusal stops one command, never the session — no dialog, so a missed click can never stall a coder; the coder finds its own way around (dima, FRM-321)
  - decision: quoted text, heredoc bodies and comments are never read as commands — a commit message may name `rm -rf`
  - 📌 not read: a script piped into a shell (`curl … | sh`, `cat x | bash`); `rmdir`, `truncate`, `git worktree` moves
- ✅ a hazard shape is refused with its fix, and its near miss runs
  - given a Bash call holds: an `sd` replacement with `$` in double quotes; an `sd` find led by `-` with no `--`; an unbraced `$var` before `:<letter>` (a zsh modifier) or a non-ascii character; `sd`, or `sed -i`, on `.github/workflows/*`; a trailing `&` with no `wait` or `sleep` after it; a gate (`typecheck`, `test`, `check`, `tsc`, `vitest`, a `family:test` script) piped into `head` or `grep`; a `git push` piped into `grep`; a `git commit` with no `--` paths, `git add -A` / `--all` / `.`; `pnpm -s`
  - then it is refused with its fix; `$HOST:8080`, `$HOST:/tmp`, `pgrep -l x; kill <pid>`, `kill $(cat x.pid)` and a search for `--no-verify` run; the shape one step away (single quotes, `--`, `${var}`, `sed -n`, a `sleep` after the `&`, an unpiped gate, `git ls-remote`, `-- <paths>`, `--silent`) runs
- ✅ an escape lets one refused command run
  - given dima said yes to a refused command
  - when the command ends with `# dima-ok: <targets>`, naming every target the refusal named (split by spaces or commas)
  - then it runs, and the escape is logged in the transcript and kept as a guard event
  - when the marker names another target, or only some of them (`rm -rf ~/keep tmp.txt # dima-ok: tmp.txt`)
  - then the command is refused as before
  - decision: the target is the command's own — its paths, pattern or branch; the rule's own word when it names none (`HEAD`, `&`, `-s`) — and the refusal prints the exact marker, so a coder never guesses it
- ✅ a guard that fails refuses the command
  - given guard throws or runs past its 10 s budget (the throw is tested; the overrun is the same `.catch` by the engine's types, unprobed)
  - then the command is refused with «guard: the check failed or ran out of time … (fail closed)»
  - decision: `.catch` answers `{ deny }` — a hook without one is skipped and the command would run
- ✅ every refusal and escape is kept as a guard event
  - makes: one `event:<at>:<session>` key in guard's `$.store` (`~/.claude/plugins/store/guard_*.json`): session, its registry name, the command cut to 160 characters, refused or escaped, door, target; the newest 50 kept
  - then stash's band shows it as a 🛡️ line until dismissed — stash's `FTR.md`, «guard lines»
  - 📌 only the Bash tool is read: a command started by `Monitor` or a `!` line in the prompt goes through unread
