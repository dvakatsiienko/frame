# coderabbit — the free local reviewer on trial

Ticket: none
dies-when: the verdict line below is written (2026-10-16) — kept as a lane, or cut from crew-coder's review chain

dima, 2026-09-30: «move it into test drive for 2 weeks instead? it is not good that it does not finds anything but it
have an unobvious plus — its a free code review still. and CR as a product is actually solid — one of the best code
review tools out there. i don't know why it performs not well. maybe free tier CR's have kinda lower prio so code
review quality lower?»

the question: why does coderabbit find nothing on our prs, when the other layers each find something only they see?
crew-coder's rule cuts a layer with no unique finds after two real prs; this test drive decides with data instead.

## day 0 — to read before the next round

- the free tier vs paid: which model, which checks, what is capped (reviews per hour, file count, diff size) — its
  docs and pricing page, never a guess. the «lower priority on free» idea is dima's hypothesis, unverified
- the cli's modes: `coderabbit review --agent` (what we run) vs `--plain`-like text vs the github app on a pr —
  does the local cli see the whole branch or only the working diff?
- its config: a `.coderabbit.yaml` with path instructions and review profile (chill / assertive) — we run defaults

## stress list — one real pr each, unique finds counted against code-review, the verifier and the ci reviewer

- the local cli with defaults (today's lane)
- the local cli with an assertive profile + path instructions
- the github app on a pr, if the free tier allows it for a private repo
- a pr with a planted bug of each kind the others caught (a duplicate id, a wrong grep scope, a missing test)

## log — date · pr · mode · findings · unique · minutes

- 2026-09-30 · bytes#116 (atelier lens ring, 29 files) · cli --agent · 0 · 0 · — (the BYT-113 coder's retro)
- 2026-09-30 · bytes#117 (atelier favicon) · cli --agent · 0 · 0 · —
- 2026-10-01 · frame #52 (speak gremlins) · 2 findings (CRLF, link punctuation), 0 unique — both also found by matt code-review; verifier 15 real (9 unique), code-review 15 (5 unique) · free tier
- 2026-10-02 · bytes#119 (design-loupe v1, 55 files) · cli --agent --committed --base main · 3 findings (2 the same README avatar gap, 1 «validate Host» major) · 0 unique real — the avatar gap was already a known skip, the Host finding is false: vite 8's host check answers 403 before plugin middleware (probed with a foreign Host + matching Origin) · free tier · ~4 min
- 2026-10-02 · frame coder/FRM-278 (lane --repo + design:states, branch, no pr) · cli on an older head · 1 unique real (`--ftr` at a dir crashed with a stack trace → exit 2) · matt code-review found the only high (`--repo` into a mid-merge repo would conclude its merge) · free tier
- 2026-10-02 · frame coder/FRM-294 (ab-js + red-proof --pairs, branch, no pr) · cli · 1 finding, 0 unique — the same defect the code-review fork found · free tier
- 2026-10-02 · bytes#120 (design-loupe verify kit, 5 files) · cli --agent --base main · 1 finding, 1 unique real (`kit.sh boards` read green on an empty board list) · matt code-review found 4 others, the ci reviewer 1 (a red-proof claim with no proof on record) · free tier · ~3 min
- 2026-10-05 · frame coder/FRM-268 (jev skill router, 5 files) · cli --agent --base main · 3 findings, 0 on the branch's files — it read ~40 files of other work beside ours · matt code-review found 8 real (an empty router passing the precision refusal, a ms column that was not latency) · free tier · ~2 min
- 2026-10-05 · frame coder/FRM-305-router-v2 (skill router v2, 11 files) · cli --agent --base main · 3 findings, 2 on the branch, both unique real minors (`rosterLatest` crashed on a missing projects dir; a test that checked the trace but not the dropped load) · 1 on `stash/hooks/register.tsx`, off the branch · matt code-review found 7 others (cclio skills routed in coder sessions, memory dropping a seen skill from the Choice, no reset at compaction) · free tier · ~4 min
- 2026-10-05 · frame coder/FRM-308-jev-budget (jev spend gate, 9 files) · cli --agent --base main · 1 finding, 1 unique real major (a spend log that cannot be written threw away a paid answer) · matt code-review found 7 others (log re-read per call, two price sources, a spent budget reading as a broken api) · free tier · ~4 min
- 2026-10-05 · frame main FRM-321 (guard mod + stash 🛡️ line, 13 files) · cli --agent --uncommitted --include-untracked --dir home/.claude/plugin-x/mods · 2 findings, 2 unique real minors (`python -m pip list` refused like an install; a multi-line command stored raw on a one-row band) · matt code-review found 17 others (~30 floor shapes slipping the parser, a dismiss that resurfaced, false positives on `$HOST:8080`) · `--dir` scoped it cleanly in a dirty shared tree · free tier · ~12 min
- 2026-10-05 · frame main FRM-322 (mods:live, 2 files) · cli --agent --uncommitted --include-untracked --dir home/.claude/plugin-x/mods · 2 findings, 2 unique real minors (a hover answer read half-written; reloads counted on screen, which the live run showed has no scrollback on the alternate screen) · matt code-review skipped, the 5h window was at 93 % · free tier · ~5 min
- 2026-10-06 · frame worktree FRM-284 arm c (go cli, ~30 files) · cli --agent --base main · 3 findings, 1 on the branch: 1 unique real minor (the `--repo` mid-merge check joined an absolute `--git-path` to the repo root in a linked worktree) · 2 on files of other work, the local main had moved · matt code-review found 8 others (tool output dropped in agent mode, a binary tied to its build tree, form residue) · free tier · ~4 min
- 2026-10-06 · frame worktree FRM-284 v1.1 (go cli: store reader, 5 verbs, completion, pager, ~45 files) · cli --agent --base main · 3 findings, 3 on the branch, all 3 unique real: a major data loss (a hold that failed midway put untaken tracked files on the restore list, and restore deleted them), a major path corruption (`git status -z` output trimmed, so an unstaged edit sorting first lost its status column), a minor panic (a blank code span in a brief) · matt code-review found 9 others (nested exit lines split, `pnpm <bin>`, `--apply` on every verb, the pager ignoring a width change) · free tier · ~6 min
- 2026-10-07 · frame worktree FRM-340 (x telemetry: trace writer, x stats, zsh hook, ~22 files) · cli --agent --base main · 1 finding, 1 unique real minor (a short vcs revision would panic version(); the short() helper existed) · matt code-review found 4 others (a trace per zsh Tab press, --days past the 90 kept days silently capped, CLAUDE_PROJECT_DIR also reaches MCP servers, a tty panic in a step goroutine) — none overlapped
- 2026-10-07 · frame worktree FRM-343 (x handoff: write/delete, replaces contract, x-cw + raycast + skills on x, ~40 files) · cli --agent --base main · 1 finding, 1 unique real minor (a plain write in the same second truncated a pending CST of the same name → exclusive create) · matt code-review found 10 others (flag completion gap, a part-way delete losing its report, a hollow-on-git-failure contract test, write ids missing from traces) — none overlapped; the verifier's 11 findings over 4 rounds overlapped neither · free tier · ~3 min
- 2026-10-07 · frame worktree FRM-344 (x linear: 10 verbs, x as + keys, push port, 4 scripts die, ~50 files) · cli --agent --base main · 1 finding, 0 unique — the unknown `--remove-label` matt code-review also found (fixed) · matt code-review found 8 others (1 medium: the archive confirm on an unopened board) · free tier
- 2026-10-08 · frame#67 (FRM-346, 4 verifier rounds) · coderabbit 0 unique finds; matt's local review 6 real, the verifier 4 more + 2 decisions (the coder's retro)
- 2026-10-09 · frame worktree FRM-355 (x lane review, lane pr-body, brief preflight + skill lines, ~15 files) · cli --agent --base main · 1 finding, 1 unique real minor (`touchedBy` returned git output without checking ok) · matt code-review found 8 others (crew-coder 3b vs «final» ownership, grill words in headings skipped, «line 0» commit rows) — none overlapped; ci caught a test reading the real frame origin/main, which neither reviewer saw · free tier · ~3 min
- 2026-10-09 · frame worktree FRM-364 (x gh pr: rest reads, 3 skill lines, ~10 files) · cli --agent --base origin/main · 1 finding, 0 unique — the `--since` same-second loss, which matt's standards and spec axes and the verifier all found too; its fix (a 2-minute overlap) would repeat comments every poll, github's Date header plus an inclusive cutoff was taken instead · matt code-review found 7 others (a forwarding wrapper, three position-matched feed lists, the board reading strings back out of the envelope, outdated line comments unmarked, multi-behaviour tests) · free tier · ~3 min
- 2026-10-09 · frame worktree FRM-359 (x: lane commit holds + ftr none, brief/preflight rules, plugin bump, plugin:release retired, go 1.27.2, 21 files) · cli --agent --base main · 0 findings · matt code-review found 9 (a named dir sweeping a held file, a landed-hold release diverging from the mod on a git error, dropped rev-parse errors, a non-runnable Next, a skill read only ever stubbed) — the verifier's round 1 found the dir sweep too · free tier · ~3 min
