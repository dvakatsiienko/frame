---
date: 2026-09-28
slug: the-fleet-grows-a-cloud
tickets: [BYT-85, BYT-95, BYT-96, BYT-100, FRM-255, BYT-97, FRM-147, FRM-251, BYT-109, BYT-110, BYT-86, BYT-87, BYT-88, BYT-108, BYT-111, FRM-266]
posted: {health: yes}
---

# 🗞️ cclio's gazette · the fleet grows a cloud

## shipped

- ☁️ **cc cloud is a fleet member, on vet to 11-04.** `claude --cloud` works from here once it has a tty (`script`); «cloud base» boots plugin `x`, `gh` and node 24 through a setup script; a prompt opening with `/x:crew-coder` arrives expanded. the contract is `x:crew-cloud` (x 0.11.140 → 0.11.144). five probes, zero failures after the setup landed
- 🌐 **browserbase on vet to 10-05**: key in 1password `browserbase-golden`, `bb` installed, the cloud environment's credential proxy attaches it (`X-BB-API-Key`, 200 from the VM). 8-item stress list in `docs/vet/browserbase.md`
- 🧠 **adhd on vet to 10-05**: plugin at cclio scope, locked by a `Skill(adhd:adhd)` deny (dima types it, cclio cannot); the cli door costs ~18.5k a call against ~94k a branch in-session
- 🧪 **jev's skill router, sharpened from its own docs**: one condition per noul — `_ack` and `_later` gates. 23 fixtures (10 real misses) went 17–18 → 20 of 23 over 3 runs; a scheduled push no longer loads `x:cmt`
- 🔑 **npsso**: a logged-in browser does not mint a fresh token and a scripted sony login is a ToS risk — [BYT-85](https://linear.app/x-com/issue/BYT-85) proposes one-click renewal instead
- 🔗 the ci chain is ordered: [BYT-95](https://linear.app/x-com/issue/BYT-95) blocks [BYT-96](https://linear.app/x-com/issue/BYT-96) blocks [BYT-100](https://linear.app/x-com/issue/BYT-100)
- ✨ the rate-limit mirror is `~/.claude/shelf/cc-usage-window.json` (dima's name), every layer moved
- 🧾 the halt resets the inbox from dima's `inbox-template.md`; a new leaf `habit-vet` makes vetted tools the first door

## tricks gained

- frame's git-crypt covers ONE file (`gmail/blocklist.json`) — `.gitattributes` is the list; frame is cloud-workable
- `skillOverrides` never reaches a plugin skill; a `Skill(<plugin>:<skill>)` deny does the lock
- a cloud session is steered by `SendMessage` and read by `claude -p … --teleport <id>` in a scratch clone; it cannot message back yet
- `parallel-cli extract` truncates by default; `--full-content --json` returns the page

## state

- 18 frame commits unpushed — dima's word: push at boot (the cloud installs the PUSHED plugin x)
- first cloud job: [BYT-97](https://linear.app/x-com/issue/BYT-97) knip report through `x:crew-cloud`, usage screenshots before/after
- the chords day shift (m1 of FRM-266) still opens at its step 0
- flawlog `2026-09-28-adhd-cloud-and-vets.md` owes its flush (stop-lane halt)

⸻ upd 17:50 — the checkpoint

## shipped

- chords day shift, m1 of [FRM-266](https://linear.app/x-com/issue/FRM-266): the first product doc (`FTR.md`, 31 lines, 26 ✅) + `CONTEXT.md`, 6 bindings + the F4 rebind, loopback-only writes, the aurora error, layout A — merged as frame#50 after 2 verifier rounds, live on :7373: [FRM-255](https://linear.app/x-com/issue/FRM-255)
- the stats daemon stops logging a chord's own release as a bare modifier (1,059 phantom `cmd`) and counts bare F-keys + esc; rebuilt, re-granted, proven live
- first real cloud job: knip on bytes, 73 findings with verdicts, then the cleanup and a ci knip step: [BYT-97](https://linear.app/x-com/issue/BYT-97)
- every app has `<app>-run` + `<app>-verify` (entity-first, proven with the built-in /run and /verify); `x:product-docs` → `x:ftr`, `MAP.md` → `FTR.md`
- evergreen reads every changelog and republishes one standing artifact; brew 31/31, pnpm 12.6 + autoDedupe (9 duplicates gone in bytes)
- the worktree seed really seeds (pnpm `-s` and the git-crypt re-smudge were both silent); a background command needs a deadline (a new guard hook); deploy-watch names its repo and reads the pushed range
- `.gitconfig` fetches github over https, pushes over ssh — the seed run found fetches hanging a fresh mac: [FRM-147](https://linear.app/x-com/issue/FRM-147)
- quicksilver vendored for a two-week vet; the lanet autopay nag filtered; cdaf folded into [FRM-251](https://linear.app/x-com/issue/FRM-251)

## tricks gained

- desktop auto-archive archives and stops only desktop-made local sessions at their merge; `--bg` and `--cloud` stay (4 probes)
- a cloud session names by `-n` before `--cloud`, pins its own `claude/<slug>` branch, and treats a SendMessage as information, not a task
- the verifier runs on medium: high buys +3.5 to +6.7 points for ~35 % more cost

## state

- tart run 5 (the full Brewfile) in progress; chords → bytes [BYT-109](https://linear.app/x-com/issue/BYT-109) and the sidebar → kit [BYT-110](https://linear.app/x-com/issue/BYT-110) in Triage
- next: the shift debrief → atelier docs → crew-designer research → the designer run, a browserbase round beside it

⸻ upd 23:30 — the first shift nobody steered

## shipped

- the trophy-sys shift, m1.1 of [FRM-266](https://linear.app/x-com/issue/FRM-266): the first run with no steers — the npsso bug (a client query latched the dead-token error), gremlins, hardening tails, CONTEXT + six ADRs; then early re-mint and the gremlins answers, bytes #111 / #113 / #114, all live: [BYT-88](https://linear.app/x-com/issue/BYT-88)
- every app carries its essentials: one checker, a required check on bytes main, both commit hooks, the boot digest; every app green, cv included: [BYT-111](https://linear.app/x-com/issue/BYT-111)
- a fresh mac seeds hands-free and runs the fleet, proven twice in a tart vm; the seed installs the cli, builds sline, skips the app store on a flag: [FRM-147](https://linear.app/x-com/issue/FRM-147)
- `lane` (commit / push / pr / merge with no «git» in the command), `pr-watch` (a watch lives until its pr merges), the travel hook (a session that enters another repo gets its memory), `/cclio:shift` (decide, log, continue)

## tricks gained

- the «git» refusals are claude code's worktree isolation: a bg session's git must provably target its own tree
- a cloud vm's node needs `NODE_USE_ENV_PROXY=1` before browserbase attaches its key
- names lead with the mode: ☕ lane · ☀️ day shift · 🌙 night shift

## state

- tomorrow: atelier docs sharpen with dima, then the designer run; sys waits for [BYT-86](https://linear.app/x-com/issue/BYT-86)'s grill sessions
- frame + bytes pushed after the halt, no coders alive, x 0.11.158 · cclio 0.3.84

## trail

- shipped: chords shift #50 · the trophy-sys shift, no steers (#111 #113 #114 live) · app essentials required on bytes main · fresh-mac seed proven twice (FRM-147 closed) · lane · pr-watch · the travel hook · /cclio:shift
- open: atelier docs sharpen → the designer run (adhd round) · quicksilver round 1 · BYT-86 grill sessions (dima schedules) · the first night shift (dima picks)
- state: frame + bytes pushed, no coders, x 0.11.158 · cclio 0.3.84, week ~17 %
