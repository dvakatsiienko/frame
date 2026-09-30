---
dies-when: every candidate use below has a verdict, written into `x:crew-cloud` (by 2026-11-04)
---

# cc cloud — a fleet member on a test drive: find what it is good for

Ticket: none

**what:** Claude Code sessions on Anthropic VMs, launched with `claude --cloud` (through `script` from a tool call). the contract is `x:crew-cloud`; the day-0 research is `docs/research/cc-cloud.md`.
**window:** 2026-09-28 → 2026-11-04. the $250 cloud credit expires 2026-11-05 09:59 GMT+2; the test drive spends it on purpose.
**the meter:** dima's usage page, before and after each job (no field reads the credit).

## the question the test drive answers — two phases (dima, 2026-09-28)

- **while the credit lasts:** explore wide. every candidate use below gets one real job; the credit is spent on purpose.
- **after it is spent:** a cloud job is picked deliberately, and it must answer one question — «is spending dima's plan window on this justified, when a local coder on his always-on mac could do it?» the answer names what the cloud gives that a local `--bg` coder cannot: isolation (many parallel trees, no shared hooks), survival across a reboot or an os update, pr auto-fix, a start from the phone. no such gain → a local coder.
- open: whether cloud usage after the credit draws from the plan window or bills apart — unread; one cloud job and one same-sized local job, compared on the usage page, settle it.

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
8. **plugin `x` in the VM** — the environment's setup script sparse-clones frame and installs `x` (probe 2: reachable + installs; the next-session load is unproven)

## rounds

<!-- date · use # · job · credit before → after · worked? · note -->

- 2026-09-28 · #1 prep ✅ · probe 4 (session_016CWYTc4eJGxGX33Rhch3G6): a cloud prompt opening with `/x:crew-coder dima …` arrived with the contract expanded — no Read, Bash or Skill call; the brief shrinks to the contract + cloud deltas · credit not read
- 2026-09-28 · #8 ✅ · probe 3b (session_01P2tbibq4RHKhUQ2gkqqQ46) after the setup script landed in «cloud base»: 19 `x:*` skills in the session's list, `gh` 2.45, node 24, pnpm 12.3.4 · first session after a script edit ran minutes longer (cache rebuild) · credit not read
- 2026-09-28 · #8 · probe 2 on bytes (session_01Vh92jhsWo8LiocQzhKGtb7): private `frame` IS reachable from the VM (`git ls-remote` ok), a sparse clone of `home/.claude/plugin-x` ok, `claude plugin marketplace add <dir>` + `install x@x` ok (0.11.139 — the pushed version) · the x:* skills load only in the NEXT session · 🚫 `gh` is NOT installed (the research said preinstalled) · credit not read
- 2026-09-28 · probe · read-only environment report on bytes (session_014QV6GViG5BzJYugdtrZuzw) · credit not read · worked: launched through `script`, read back with `--teleport` · details in `docs/test-drive/browserbase.md` round 1

## round 1 · 2026-09-28 · a pr-lane coder — BYT-97 knip report

- job: install + configure knip on bytes, one evaluated report as a pr comment, no deletions. brief = `/x:crew-coder` short form + the cloud deltas, named `☁️ cloud: BYT-97 knip report`
- result: [bytes#105](https://github.com/dvakatsiienko/bytes/pull/105), 3 files, ci green, 73 findings each with a verdict + reason, nothing deleted, 5 `?` decisions in the body — the brief held
- surprise: the session pins its own `claude/<slug>` branch and ignores the brief's `coder/…` name → a head-keyed pr watch goes blind (skill fixed: key on the ticket id in the body)
- read-back: `claude -p … --teleport <id>` from a scratch clone answered in one call
- meter: $245 of $250 left after round 1 (probes 1–5 on 09-28 + the name probe + this job — no «before» split); week 3 %, session 18 % at ~16:00
- verdict for this use: works; the report quality matches a local coder's
