---
date: 2026-09-28
slug: the-fleet-grows-a-cloud
tickets: [BYT-85, BYT-95, BYT-96, BYT-100, FRM-255, BYT-97, FRM-147, FRM-251, BYT-109, BYT-110]
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

## trail

- shipped: chords shift #50 (FTR + CONTEXT, 7 bindings, loopback writes) · daemon bare keys · knip on bytes via cloud · <app>-run/-verify everywhere · x:ftr · worktree seed + deadline guard · pushInsteadOf · quicksilver on vet
- open: tart run 5 (FRM-147) · shift debrief · atelier docs · crew-designer research · designer run · browserbase round · BYT-109/110 in Triage
- state: frame + bytes pushed and green, one coder (tart), x 0.11.152 · cclio 0.3.81, week 8 %
