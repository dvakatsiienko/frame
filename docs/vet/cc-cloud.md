---
dies-when: every candidate use below has a verdict, written into `x:crew-cloud` (by 2026-11-04)
---

# cc cloud — a fleet member on vet: find what it is good for

Ticket: none

**what:** Claude Code sessions on Anthropic VMs, launched with `claude --cloud` (through `script` from a tool call). the contract is `x:crew-cloud`; the day-0 research is `cclio/shifts/2026-09-28-research/cc-cloud-credits.md` + `cc-cloud-sessions.md`.
**window:** 2026-09-28 → 2026-11-04. the $250 cloud credit expires 2026-11-05 09:59 GMT+2; the vet spends it on purpose.
**the meter:** dima's usage page, before and after each job (no field reads the credit).

## strong and weak — day 0

- strong: runs while the mac sleeps · the credit pays first · a fresh VM per job, so parallel PRs never share a tree · node 24 + pnpm 12 preinstalled · reaches `api.browserbase.com` · steerable by `SendMessage`, readable by `--teleport`
- weak: carries none of our rules, skills or memory (the brief inlines the core) · cannot message back (the pr is the report) · no browser · idle reclaim kills background work · no cli to stop it or read its credit
- measured: `--cloud` refuses a non-tty; `claude -p … --teleport <id>` in a scratch clone reads its history

## candidate uses — one real job each

1. **a pr-lane coder** — [BYT-97](https://linear.app/x-com/issue/BYT-97) knip report, the first job
2. **the night shift** — a planned bytes night runs in the cloud instead of on the mac (after FRM-266's armor)
3. **parallel prs** — two independent tickets at once, one VM each
4. **the opus research lane** — the second half of a `parallel` or `adhd` round, run in the cloud
5. **the verifier** — `x:crew-verifier` on a pr, with browserbase for the exit lines (needs the key in the environment's api credentials)
6. **post-deploy check** — a routine after a vercel deploy (`/schedule`, api trigger), checked through browserbase
7. **a frame job** — proves the git-crypt read: a fresh clone commits normally around `gmail/blocklist.json`
8. **plugin `x` in the VM** — a `git-subdir` marketplace from frame, so the cloud coder loads our guides (private repo: unproven)

## rounds

<!-- date · use # · job · credit before → after · worked? · note -->

- 2026-09-28 · probe · read-only environment report on bytes (session_014QV6GViG5BzJYugdtrZuzw) · credit not read · worked: launched through `script`, read back with `--teleport` · details in `docs/vet/browserbase.md` round 1
