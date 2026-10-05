# redact — features

- 🧭 asked, not built yet (a new ask, an experiment) · ⬜ built, not checked yet · 🐞 built, its check fails · ✅ passes in the app's verify recipe · 🔎 dima used it and it holds
- given/when/then lines are the verifier's exit lines
- makes: lines name what a feature leaves behind — a file, a take, a clipboard item
- decision: lines record a choice and its reason

## every row a session keeps

- ✅ a secret never lands in a transcript
  - given a tool prints an api key or token (`sk-…`, `ghp_…`, `github_pat_…`, `xoxb-…`, `AKIA…`, `lin_api_…`, `ops_…`, a private key block)
  - when the session keeps that row
  - then the transcript and the model read it masked: its first six characters and `…‹redacted›`
  - decision: one `session.append` hook masks every row — a tool result, a prompt, a reply — since the engine stores and sends the rewritten form; the screen may flash the raw row first
  - decision: the mask carries no glob characters — the model receives a masked prompt, and `[redacted]` broke a zsh `echo` in the live probe
  - proven live 2026-10-05: a headless `claude --plugin-dir` run echoed a planted `sk-ant-…` fake; 8 rows came out masked, the reply too
  - 📌 one raw copy stays: a queued prompt's `queue-operation` record, which the engine writes before any hook runs — a mod cannot reach it
  - a prompt that carries a key reaches the model masked, so a key pasted in chat for the model to use arrives unusable — 1Password is the door
- ✅ a 1Password reference stays readable
  - given a row holds `op://dev/<item>/credential`
  - then it is kept as written — a reference is the safe form the fleet rules ask for, not a secret
- ⬜ a redactor error never blocks a row
  - rows reach the hook as plain JSON, so the harness cannot make masking throw; the guard is a try around the rewrite
  - given masking a row throws
  - then the row is kept as it came, and the error is logged
