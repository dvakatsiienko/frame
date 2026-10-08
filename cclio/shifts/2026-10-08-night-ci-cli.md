# shift · 2026-10-08 · night: ci boring + cli

status: ready — starts on dima's «let's start», after the 5h reset at 21:59
presence: away (rehearsal — dima is near and peeks, cclio acts as if he is gone; a steer of his lands in «steers»)
budget: spend-it-all week (dima: the weekly reset button is the plan); the 5h window is read at every lane boundary, and at 95 % the lanes pause with a keep-hot ping, never their cache
members, two lanes, two repos:
- 🅰️ frame — `🎯 🔧 night code: cli` + `🎯 🔎 night verify: cli`, opus 5.5 medium, one worktree pr per ticket
- 🅱️ bytes — `🎯 🔧 night code: ci` + `🎯 🔎 night verify: ci`, opus 5.5 medium, one worktree pr per ticket
- 🐦‍⬛ ccrow — live on cclio's thread, as every day

## the rules

- **live reads**: every step reads its ticket body at step start, never a copy in this file
- **merge** (dima, 2026-10-08: «you are allowed to press the merge button»): cclio merges a pr when the verifier said `clean` AND github's merge state is `CLEAN` (every required check green on that head — bytes: lint/typecheck/test/build, `review:clean`, apps essentials; frame: check + typecheck + test). squash, an `x:cmt` message. never `--admin`, never a red or pending check. before the merge, a `checkup` subagent (opus, read-only, ≤10 lines) reads `gh pr diff` against the ticket's exit lines and want — its answer is the only thing that enters cclio's context; a real finding → back to the coder, not merged. after a bytes merge, `deploy-watch` until `Ready`
- **cclio's own compaction**: the plan's `## log` after every step is the state; the `shift-recompact` hook re-reads it after an autocompact
- **no asks**: reversible → default + `decided: X — undo: Y` in the log · irreversible or external (a repo setting, a secret, prod beyond the merge) → parked with its reason · taste → one default built and flagged
- **one ticket per pr, the queue runs on**: a lane's next ticket starts when its pr merges; a parked pr does not stop the lane — the coder takes the next ticket in a fresh tree
- **the watch**: `pr-watch` + `ci-watch` re-armed on every expiry (each expiry notice is also cclio's heartbeat); every idle notice is a check (`craft-spawning`); a stall is fixed and logged as `fixed:`

## 0 · preflight (cclio, at «let's start»)

- `pnpm shift:checkup` all green · main pushed in both repos · `bg-spare` young
- ticket exit lines below are in each ticket body before its coder starts
- this header flips to `status: running`; ccrow live; both lanes spawned in one turn with a `not yours:` line naming the other lane

## 🅰️ frame — cli lane, in order

1. [FRM-352](https://linear.app/x-com/issue/FRM-352) `research:lanes` refuses an unstamped brief — exit lines in the ticket
2. [FRM-342](https://linear.app/x-com/issue/FRM-342) test env in git-crypt worktrees — exit lines in the ticket
3. [FRM-345](https://linear.app/x-com/issue/FRM-345) slice — `x fleet eq`, `x --board`, the merge-main ✨ wisp. exit (draft):
   - given the old flow script and `x fleet flow` on one frozen trace dir, `x fleet eq` prints «equal» and exits 0; one changed number prints the diff and exits non-zero
   - given an agent env (`CLAUDECODE` set), `x fleet flow --board` prints the human board, not json
   - given a `merge-main` merge that fails without conflicts, the envelope names git's own stderr line
4. mods retro items, one pr — exit (draft):
   - given a session that never Read a tracked file, a `Write` over it is refused by `x-mod-guard`; after a Read it passes
   - given a type error planted in `mods/writes.ts`, `pnpm mods:typecheck` goes red
   - given `- ftr: none` as a bullet, the ftr-gate message says «a bare line»
   - given a reply naming a fleet member (cclio, ccrow, coder, verifier, designer, helper, researcher, sifter, retro, explore, checkup), x-mod-stash's parser reads it bold with its badge, as it does wisp/siesta/wish/freebie today (dima, 2026-10-08: «print all fleet members and vibe keywords with its emoji, in bold»; the badges live in `rules/fleet-identity.md`)
5. 🔥 moves only by dima's click (or ccrow's start script) — stash unticks 🔥 by itself when the 5h window resets (`x-mod-stash/FTR.md` «🔥 turns itself off after the 5h window resets»), which dima never asked for and which cools ccrow overnight. exit (draft):
   - given 🔥 on and the 5h window resets, then 🔥 is still on and the next ping comes 50 min after the last turn
   - given dima clicks 🔥 off, then it is off and its store key is gone

## 🅱️ bytes — ci boring lane, in order (BYT-106's order, BYT-98 out)

1. [BYT-100](https://linear.app/x-com/issue/BYT-100) the guard on a big pr + the pr-body skip check. exit (draft):
   - given a pr whose review payloads exceed ARG_MAX, the guard still publishes its verdict
   - given a pr body holding the skip-ci marker, the marker check goes red
2. turbo: skip doc-only builds (BYT-106's merge slice S1, ~6 lines of `turbo.jsonc`) — exit: given a commit touching only skills or `AGENTS.md`, `turbo query affected` selects 0 builds
3. [BYT-95](https://linear.app/x-com/issue/BYT-95) a pr cannot rewrite its judge. exit (draft):
   - given a pr that edits `review.yml`, the review that judges it runs main's copy (the `workflow_run` lane)
   - given any third-party action, it is pinned to a sha, and renovate's digest preset is on
   - given a red ci on main, Deploy is skipped, not green
4. [BYT-94](https://linear.app/x-com/issue/BYT-94) the gate, simplified — decided 2026-09-26 in BYT-106: one reviewer, the verdict check + the round cap stay, threads go to github's native resolution, admins stay unenforced. exit (draft):
   - the gate fits one screen in its README: one reviewer, the verdict check, the cap
   - the branch protection gains `required_conversation_resolution` — dima's yes (2026-10-08), cclio flips it with `gh api` at this step, after the coder's pr is green
5. [BYT-96](https://linear.app/x-com/issue/BYT-96) preview by label — `vercel-golden` is in 1password `dev` (probed 200 on `/v2/user`, 20:45); cclio sets the github secret `VERCEL_TOKEN` from it at this step, through the `x-fleet` service account (`OP_SERVICE_ACCOUNT_TOKEN` from the keychain, as `op-run.sh` does — never the desktop session, which asks dima for Touch ID) piped into `gh secret set`, never printed

## steers

## log
