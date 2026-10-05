# x — features

- 🧭 asked, not built yet (a new ask, an experiment) · ⬜ built, not checked yet · 🐞 built, its check fails · ✅ passes in the app's verify recipe · 🔎 dima used it and it holds
- given/when/then lines are the verifier's exit lines
- makes: lines name what a feature leaves behind — a file, a take, a clipboard item
- decision: lines record a choice and its reason

## x — the overview

- 🧭 bare `x` draws the T2 overview
  - given dima runs bare `x` in a terminal at 80 and at 120 cols
  - when it renders
  - then it matches the T2 dense-family overview ([spread v6](https://claude.ai/artifact/6FSNX9owdhioGuJyeyGZJu)) at both widths: one framed table, a colour per family, the takes column folded under 100 cols
  - decision: the look is picked by the a/b/c in FRM-284 — TS + gum, TS + ink, go + full charm
- 🧭 every verb speaks one envelope
  - given any verb run with `--json` or into a pipe
  - when it ends
  - then stdout holds one envelope `{verb, ok, status, data}` and the exit code matches `ok`
- 🧭 a wrong verb names the right ones
  - given an unknown verb or flag
  - when it fails
  - then the error lists the valid verbs or flags of that family
- ⬜ `x schema` prints a verb's schema — the same entry that dispatches it
- 🧭 `x schema` at two detail levels
  - given a verb or a family name
  - when `x schema` runs with the short level
  - then it prints names and one-line purposes only; the full level prints the whole schema

## the resident index

- 🧭 a session boots knowing every verb
  - makes: the verb index (name + purpose) in the session's context, printed by a SessionStart hook
  - given a fresh cc session
  - when it boots
  - then its context holds the index, and no `x` call was needed to learn it
- 🧭 a new verb reaches the index by itself
  - given a new verb lands in the registry
  - when the next session boots
  - then the index shows it, with no hand edit anywhere

## lane — git

- ⬜ `x lane commit` commits only the named paths and prints the new sha
- ⬜ `x lane push` pushes HEAD's sha and reads the remote back
- ⬜ `x lane pr-open` opens a pr as the coder app
- ⬜ `x lane merge-main` merges origin/main, stops on a conflict with the file list
- ⬜ `x lane unlock` decrypts a worktree's git-crypt files

## handoffs

- 🧭 `x handoffs` lists, peeks and ingests CSTs from the shared store
  - given a pending handoff in the store
  - when `x handoffs list` runs
  - then it lists the same handoffs `x-cw`'s tools see — one store, two doors
- 🧭 a cloud thread reaches handoffs through the mac
  - given a cloud project thread
  - when it runs `~/.local/bin/x handoffs list` through the remote-devices Desktop Commander
  - then it gets the same envelope as on the mac
