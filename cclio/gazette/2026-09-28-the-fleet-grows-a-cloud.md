---
date: 2026-09-28
slug: the-fleet-grows-a-cloud
tickets: [BYT-85, BYT-95, BYT-96, BYT-100]
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

## trail

- shipped: cc cloud joins the fleet (crew-cloud, plugin x in the VM, 5 probes) · browserbase + adhd on vet · jev router gates 17–18 → 20/23 · BYT-85 reshape · usage → cc-usage-window.json · habit-vet
- open: push 18 commits at boot · BYT-97 first cloud job · chords shift step 0 · flawlog flush owed · the router's skill-suggestion reshape
- state: frame a0d2c4f0 + this post unpushed, bytes 08d9fce1 (2 docs commits), no coders, 5 idle cloud probes, x 0.11.144 · cclio 0.3.79
