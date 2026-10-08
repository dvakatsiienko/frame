# x-mod-holds — features

- 🧭 asked, not built yet (a new ask, an experiment) · ⬜ built, not checked yet · 🐞 built, its check fails · ✅ passes in the app's verify recipe · 🔎 dima used it and it holds
- given/when/then lines are the verifier's exit lines
- makes: lines name what a feature leaves behind — a file, a take, a clipboard item
- decision: lines record a choice and its reason

no two sessions write the same file: a session's first edit of a file holds it until the file is committed, the session ends or it sits idle 30 min. x-mod-stash's band shows the 🔒 chip from this mod's store file — its `FTR.md`, «holds chip».

## edits

two sessions, A and B, in one checkout.

- ✅ holds run in a Code-tab session
  - given a Code-tab session
  - when holds checks a file's git state
  - then the check returns; if it cannot, the build stops before any other line
  - proven live by cclio, 2026-10-04: a `--bg` session held `.holds-probe.txt`, a Code-tab Write of the same path was refused «held by session 75f531d4, which took it 2 min ago» — a deny means the git check through `$.process` returned, since fail-open would have let it through
- ✅ a first edit takes the hold
  - given A edited `x.ts`
  - when B edits `x.ts`
  - then B is refused, and the message names A and when A took the hold
  - decision: no override in v0 — the deny names who to ask
  - decision: the holder is named by the first 8 characters of its session id; every session in one checkout shares the repo name
  - decision: the hold keeps the real path in its own case and git runs on it, so a symlinked leaf (`~/.claude/CLAUDE.md`) is held like its target
  - decision: the key is lowercased on every platform — APFS is case-insensitive and a mod cannot ask which os it runs on
- ✅ the holder keeps editing
  - given A holds `x.ts`
  - when A edits it again
  - then the edit goes through
- ✅ other files stay free
  - given A holds `x.ts`
  - when B edits `y.ts`
  - then the edit goes through
- ✅ a commit releases
  - given A committed `x.ts`
  - when B edits it
  - then the edit goes through and A's hold is gone
  - decision: clean releases only a hold whose edit landed — while A's permission prompt is open the file is clean and still A's
- ✅ a commit through Bash releases at once
  - given A holds `x.ts` and commits it through Bash (`x lane commit …`, `git commit …`) mid-turn
  - then A's clean holds drop from the store right after the command (so B's 🔒 chip stops counting them at its next poll); a command that commits nothing keeps them to the turn's end (FRM-337)
  - decision: before, a hold dropped only at A's turn end or on B's next try — a coordinator in one long turn kept its holds ~30 min past the commit and blocked the FRM-336 coder
- ✅ a new file stays held until committed
  - given A created a new file and left it uncommitted
  - when B edits it
  - then B is refused
- ✅ a dead holder releases
  - given A's process was killed
  - when B edits A's file
  - then the edit goes through
  - decision: the pid is the `$PPID` a mod's child sees (measured: the `claude` process), kept with its start time, so a reused pid reads as dead
- ✅ an idle holder releases
  - given A's last turn ended over 30 minutes ago
  - when B edits A's file
  - then the edit goes through
  - decision: 30 min — prior art ranged 5–120, and 5 min dropped long turns
- ✅ one winner in a race
  - given A and B edit the same new file in the same second
  - then never both of them hold it
  - decision: no compare-and-set, so after its write a claim that sees any rival yields; a true tie refuses both and the next try settles it — earliest `at` let both win when one session's write landed late (verifier round 1)
- ✅ a broken store never blocks work
  - given the store file is unreadable
  - when B edits
  - then the edit goes through and the error is logged
- ✅ a Bash write to a held file is refused — by x-mod-guard, which reads this store; its `FTR.md`, «held files» (FRM-350)
