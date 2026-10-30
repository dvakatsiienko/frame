# x-mod-redact — features

- 🧭 asked, not built yet (a new ask, an experiment) · ⬜ built, not checked yet · 🐞 built, its check fails · ✅ passes in the app's verify recipe · 🔎 dima used it and it holds
- given/when/then lines are sixth sense's exit lines
- makes: lines name what a feature leaves behind — a file, a take, a clipboard item
- decision: lines record a choice and its reason

## every row a session keeps

- ✅ a secret never lands in a transcript
  - given a tool prints an api key or token (`sk-…`, `ghp_…`, `github_pat_…`, `xoxb-…`, `AKIA…`, `lin_api_…`, `ops_…`, a private key block)
  - when the session keeps that row
  - then the transcript and the model read a placeholder: `‹`, the value's first six characters, `…`, eight hex characters of its hash, `›` — `‹sk-ant…1a2b3c4d›`
  - decision: one `session.append` hook rewrites every row — a tool result, a prompt, a reply — since the engine stores and sends the rewritten form; the screen may flash the raw row first
  - decision: the placeholder carries no glob characters — the model writes it into shell commands, and `[redacted]` broke a zsh `echo` in the live probe
  - proven live 2026-10-05 for the one-way mask: a headless `claude --plugin-dir` run echoed a planted `sk-ant-…` fake; 8 rows came out masked, the reply too
  - and a prompt is masked as it is submitted: a `prompt.submit` hook rewrites its text before the engine queues it, so a prompt typed mid-turn reads the placeholder in its `queue-operation` and `queued_command` records too, which `session.append` never sees (todo 24)
  - proven live 2026-10-13 18:40 on cc 2.1.296: a stream-json `claude -p` got a fake `sk-ant-…` key 5 s into a sleeping turn; the jsonl held it 0 times raw, 3 times as the placeholder, the queue's `remove` row and the `queued_command` attachment included (clio's 18:35 probe, before the hook: raw in 3 records)
- ✅ one value reads as one placeholder
  - given the same key appears in two rows
  - then both read the same placeholder, so the model can tell two keys apart and name the one it means
  - decision: the placeholder's tail is a hash of the value (fnv-1a), so it is stable across rows without a counter; a second value that hashes to a taken placeholder is masked for good instead, never restored to the wrong value
- ✅ a placeholder the model uses in a tool call runs with the real value
  - given dima pastes a fake key in a prompt
  - when the model runs a Bash command that names its placeholder
  - then the command receives the real value, and the transcript keeps the placeholder — in the command row and in its output
  - proven live 2026-10-05: a headless `claude -p` run got a planted `sk-ant-…` fake in its prompt; the model wrote `printf %s ‹sk-ant…› | tee file`, the file held the real value, the transcript held it only in the `queue-operation` record, 8 rows read the placeholder, `toolUseResult` included
  - decision: `tool.call` swaps placeholders back in a Bash call's input just before it runs; nothing else ever sees the value again (borrowed from ray-amjad/awesome-claude-code-function-hooks `plugins/secret-redactor`)
  - decision: Bash only — a `Write` or an `Edit` quoting a placeholder (a doc, a test, a config) keeps it as written, so a live key never lands in a file the model wrote, and from there in git (the local review, 2026-10-05)
  - decision: `tool.call` also redacts the tool's own result — the engine keeps it beside the row as `toolUseResult`, which `session.append` never sees; the first probe printed nothing to stdout and missed it
  - decision: the vault (placeholder → value) lives in `$.state`: it survives a hot reload and dies with the session — never on disk, never in `$.store`, which every session shares
  - 📌 after `/clear` or `/resume` the vault is empty: an old placeholder then reaches the tool as written
  - decision: a `command.run` hook empties the vault on `/clear` and `/resume` itself, never trusting `$.state` to reset there (unprobed, FRM-325)
  - 📌 trust: any tool call naming a placeholder gets the value — a command a prompt injection writes included; the model had the same reach before redaction
- ✅ a 1Password reference stays readable
  - given a row holds `op://dev/<item>/credential`
  - then it is kept as written — a reference is the safe form the fleet rules ask for, not a secret
- ✅ a vault error never lets a secret through
  - given the vault cannot be written (three version checks lost to parallel rows, or `$.state` failing)
  - when a row or a tool result carries a secret
  - then it is masked one way — its first six characters and `…‹redacted›` — and the error is logged; the row is never blocked
- ✅ a failing hook never lets a secret through
  - given the row hook or the tool hook throws, overruns its 10 s or answers a wrong shape
  - then its `.catch` runs in its place: the row goes on masked one way, the tool's result (replayed, or run with its placeholders as written) is masked one way, and a log line names the failure
  - given a row too big to scan inside what is left of the hook's budget (under 300 ms plus a millisecond per 4,000 chars), then it skips the vault and is masked one way at once
  - decision: fail closed, the opposite of quiet comms: a secret that leaks is never taken back, a row masked one way costs only a lost restore (brief 9 item 5, borrowed from ray-amjad/claude-code-mods `transcript-redactor`)
  - 📌 the harness clones an event before any hook, so no test row can make a hook throw: the two handlers are tested directly, their `.catch` wiring by reading
  - decision: fail to the mask, not to the raw row — the old one-way mask could not fail, so the placeholder must not open a hole it closed
  - proof: tests/vault.test.ts::a tool hook that failed before the tool ran runs it with its placeholders as written, plus the catch handlers and the vault error — not asserted: the tight-budget mask path (the harness cannot set `next.budget`)

## scripts

- ✅ `pnpm mods:probe-x-mod-redact` proves x-mod-redact live, end to end
  - given x-mod-redact is loaded (`CLAUDE_CODE_PLUGIN_DIRS`)
  - when the probe runs: a headless `claude -p` gets a planted fake key in its prompt and must `printf` it through `tee` into a file
  - then it exits 0 when the file holds the real value, no record of the session's jsonl holds the value raw (cc 2.1.312 writes the argv prompt's `enqueue` row with no text; probed 2026-10-30), and at least one row reads the placeholder; else it exits 1 and names which check failed
  - makes: one transcript under `~/.claude/projects/` holding the fake only, named by the probe's `--session-id`, printed in its output
  - decision: the fake is built by concatenation, so no source line reads as a secret to a live redactor
  - proven red 2026-10-05: with x-mod-redact's tool-result step removed, the probe exits 1; restored, it exits 0
