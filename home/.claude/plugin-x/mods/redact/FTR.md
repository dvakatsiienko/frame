# redact — features

- 🧭 asked, not built yet (a new ask, an experiment) · ⬜ built, not checked yet · 🐞 built, its check fails · ✅ passes in the app's verify recipe · 🔎 dima used it and it holds
- given/when/then lines are the verifier's exit lines
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
  - 📌 one raw copy stays: a queued prompt's `queue-operation` record, which the engine writes before any hook runs — a mod cannot reach it
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
  - 📌 trust: any tool call naming a placeholder gets the value — a command a prompt injection writes included; the model had the same reach before redaction
- ✅ a 1Password reference stays readable
  - given a row holds `op://dev/<item>/credential`
  - then it is kept as written — a reference is the safe form the fleet rules ask for, not a secret
- ✅ a vault error never lets a secret through
  - given the vault cannot be written (three version checks lost to parallel rows, or `$.state` failing)
  - when a row or a tool result carries a secret
  - then it is masked one way — its first six characters and `…‹redacted›` — and the error is logged; the row is never blocked
  - decision: fail to the mask, not to the raw row — the old one-way mask could not fail, so the placeholder must not open a hole it closed
