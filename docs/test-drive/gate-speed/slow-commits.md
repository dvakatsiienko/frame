# Slow commits: what they held, by lane

Window: transcripts under ~/.claude/projects/*/*.jsonl modified in the last 7 days (top-level files, no subagent files). Local time is EET. Scripts: slow-collect.mjs (pairing from collect.mjs, plus result text, background read-back, queue-enqueue time), slow-analyze.mjs, slow-report.mjs in the same folder.

## Method and caveats
- A commit call is a Bash call with a segment opening `x lane commit` or `git commit` (or `git -C <dir> commit`), not `--dry`/`--help`. Heredoc bodies are stripped before splitting on `&& || ; | newline`, and `timeout N` and env prefixes are skipped. Calls are deduplicated by tool_use id (the first pass of collect.mjs counted replayed ids several times).
- Calls blocked by a PreToolUse hook (`PreToolUse:Bash hook error`, nothing ran) are dropped; they would have shown as 0.1 s commits. A session counts as 20+ after that drop, so 83c713a6 (22 attempts, 11 ran) falls out.
- Duration: foreground = tool_result time minus tool_use time. Background (and calls the harness moved to the background mid-run) = the task notification minus tool_use. The notification time is the earlier of the queue-operation enqueue time and the delivery time, because delivery waits for the turn to end.
- A commit call is often a whole script: edit via python, `x mods edit push|test`, typecheck, vitest, `sleep`, then `x lane commit`, then push. Its whole duration is booked as one commit (same as analyze.mjs). I tag each call `pure` (no edit/test/red-proof/sleep/push segment in the same command) or `compound`, with the segments named. This is the main split in the results below.
- A call holding both a commit and `x mods edit` or red-proof is counted once, as a commit (analyze.mjs priority). The `x mods edit` and red-proof sums therefore cover only calls with no commit in them.
- Green commits print a JSON line with a sha; only 2 of the commits at 20+ printed a lefthook `✔️ name (N seconds)` summary, so per-gate seconds are mostly not recoverable from transcripts. When the agent piped output to a log and `tail`ed it, the transcript holds only what it printed.
- Mods lanes here: 6aa1af14 (stated), 8cfae24d and c7a7ba63 (inferred from 89-100% mods paths and x-mod-stash/x-mod-guard commands). d7eef112 (worktree mods-lane-5, 17 commits) is below the 20 cut and is not in any group.
- Active hours = sum of gaps between consecutive transcript events that are 30 minutes or shorter (idle gaps dropped).

## 1. Sessions with 20+ commits
- 8cfae24d  cwd /Users/dima/frame
  - first message: «This session is being continued from a previous conversation»
  - lane: mods lane (inferred: 100% of commits name mods paths; first message is a context-continuation summary)
  - 28 commits (28 foreground, 0 background); p50 55.1s, mean 59.8s, p90 84.0s, max 97.7s, sum 27.9 min; 3.4 commits per active hour (8.2 active h, 11-03 10:27 to 11-03 21:06)
  - pure commit calls 27: p50 55.1s mean 59.4s; compound calls 1: p50 72.6s mean 72.6s
  - `x mods edit` calls (no commit inside): 135, sum 44.7 min; red-proof calls: 11, sum 6.0 min
- 6aa1af14  cwd /Users/dima/frame
  - first message: «Background (from the session that started this one): mods la»
  - lane: mods lane 4 (first message says so)
  - 62 commits (62 foreground, 0 background); p50 52.1s, mean 54.4s, p90 75.8s, max 145.3s, sum 56.2 min; 8.7 commits per active hour (7.1 active h, 11-02 12:52 to 11-02 22:03)
  - pure commit calls 29: p50 47.8s mean 42.0s; compound calls 33: p50 65.4s mean 65.2s
  - `x mods edit` calls (no commit inside): 219, sum 53.2 min; red-proof calls: 31, sum 30.4 min
- c7a7ba63  cwd /Users/dima/frame
  - first message: «you finished but can't push becase of gh issues?»
  - lane: mods lane (inferred: 100% mods paths, x-mod-stash; first message gives no lane)
  - 35 commits (31 foreground, 4 background); p50 108.1s, mean 119.1s, p90 233.4s, max 262.2s, sum 69.5 min; 6.6 commits per active hour (5.3 active h, 11-04 10:19 to 11-04 16:34)
  - pure commit calls 6: p50 67.3s mean 46.7s; compound calls 29: p50 134.4s mean 134.1s
  - `x mods edit` calls (no commit inside): 84, sum 40.0 min; red-proof calls: 14, sum 50.1 min
- e7e7d905  cwd /Users/dima/frame
  - first message: «The x-mod-stash plugin sent a message: x-mod-stash keep-hot »
  - lane: clio-side work, not mods (inferred: FRM-491/494 siesta and card commits, 0% mods paths)
  - 32 commits (32 foreground, 0 background); p50 11.4s, mean 14.9s, p90 24.8s, max 32.5s, sum 7.9 min; 13.5 commits per active hour (2.4 active h, 11-03 14:51 to 11-03 19:36)
  - pure commit calls 19: p50 10.7s mean 13.2s; compound calls 13: p50 14.3s mean 17.3s
  - `x mods edit` calls (no commit inside): 0, sum 0.0 min; red-proof calls: 30, sum 7.4 min
- 96392cd0  cwd /Users/dima/frame/_clio
  - first message: «why mods lane does not starts with quet messages fix? its im»
  - lane: clio coordinator (inferred from cwd _clio and message)
  - 95 commits (95 foreground, 0 background); p50 42.6s, mean 40.0s, p90 68.2s, max 183.7s, sum 63.4 min; 10.8 commits per active hour (8.8 active h, 11-04 09:51 to 11-04 19:12)
  - pure commit calls 29: p50 18.8s mean 20.0s; compound calls 66: p50 50.8s mean 48.8s
  - `x mods edit` calls (no commit inside): 1, sum 0.1 min; red-proof calls: 3, sum 0.7 min
- 668daff8  cwd /Users/dima/frame/_clio
  - first message: «⏰ 💸 today: turn off max $100 auto-renew, ≥24 h before the 1»
  - lane: clio coordinator (inferred from cwd and message)
  - 86 commits (86 foreground, 0 background); p50 29.1s, mean 27.5s, p90 51.1s, max 89.2s, sum 39.4 min; 8.6 commits per active hour (10.0 active h, 11-03 10:02 to 11-03 21:33)
  - pure commit calls 42: p50 10.8s mean 11.4s; compound calls 44: p50 42.1s mean 42.9s
  - `x mods edit` calls (no commit inside): 0, sum 0.0 min; red-proof calls: 1, sum 0.0 min
- f0e0062c  cwd /Users/dima/frame/_clio
  - first message: «push all trials and test drive 1 day+ — no activity was yest»
  - lane: clio coordinator (inferred from cwd and message)
  - 60 commits (60 foreground, 0 background); p50 36.2s, mean 32.8s, p90 59.1s, max 122.0s, sum 32.8 min; 12.0 commits per active hour (5.0 active h, 11-01 13:41 to 11-01 18:42)
  - pure commit calls 19: p50 9.1s mean 8.8s; compound calls 41: p50 43.2s mean 43.8s
  - `x mods edit` calls (no commit inside): 0, sum 0.0 min; red-proof calls: 1, sum 0.1 min
- 9939ff19  cwd /Users/dima/frame/_clio
  - first message: «chunks reoder (optional, if fits) — reorder (optimize) befor»
  - lane: clio coordinator (inferred; 17% mods paths, rest clio/x)
  - 35 commits (17 foreground, 18 background); p50 48.3s, mean 52.2s, p90 83.2s, max 288.7s, sum 30.5 min; 3.3 commits per active hour (10.8 active h, 11-05 16:51 to 11-06 03:36)
  - pure commit calls 17: p50 27.9s mean 36.4s; compound calls 18: p50 50.5s mean 67.2s
  - `x mods edit` calls (no commit inside): 12, sum 2.0 min; red-proof calls: 1, sum 0.0 min
- e1ac9b71  cwd /Users/dima/frame/_clio
  - first message: «y, go»
  - lane: clio coordinator (inferred; 10% mods paths)
  - 76 commits (76 foreground, 0 background); p50 32.1s, mean 30.4s, p90 65.1s, max 88.7s, sum 38.5 min; 8.4 commits per active hour (9.0 active h, 11-02 12:16 to 11-02 22:32)
  - pure commit calls 40: p50 11.5s mean 19.3s; compound calls 36: p50 42.1s mean 42.7s
  - `x mods edit` calls (no commit inside): 8, sum 5.7 min; red-proof calls: 0, sum 0.0 min
- all 9 sessions pooled: n=509 p50 41.0s mean 43.1s p90 75.4s max 288.7s, sum 366.0 min
- mods lanes pooled (8cfae24d, 6aa1af14, c7a7ba63): n=125 p50 60.2s mean 73.7s p90 139.7s max 262.2s, sum 153.6 min
- other sessions pooled: n=384 p50 32.1s mean 33.2s p90 64.0s max 288.7s

## 2. The 15 longest commits
### Overall (all sessions at 20+)
- #1 9939ff19 11-05 19:08 288.7s background [other]
  - compound call with sleep; only the commit JSON with a sha (green, no gate lines); background, ack after 1.6s; seconds end at the notification (11-05 19:13); the session issued 15 tool calls meanwhile, the last 10.5s before the notification; output read back 9.5s after the notification; touched mods paths
  - command opens: "cd ~/frame; S=\"/private/tmp/claude-501/-Users-dima-frame--clio/9939ff19-1907-40f1-a889-f458e677ef48/scratchpad\"; for i in $(seq 1 80); do l=$(sysctl -"
- #2 c7a7ba63 11-04 15:59 262.2s background [mods]
  - compound call with mods-edit:test, mods-edit:push, test, push, sleep; no gate lines; tail: «9	[exited with code 0] ⏎ 10»; moved to background after 246.4s; seconds end at the notification (11-04 16:04); the session issued 1 tool calls meanwhile, the last 10.9s before the notification; output read back 2.5s after the notification; touched mods paths
  - command opens: "cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; M=home/.claude/plugin-x/mods/x-mod-"
- #3 c7a7ba63 11-04 15:49 242.1s foreground [mods]
  - compound call with mods-edit:test, mods-edit:push, test, push, sleep; no gate lines; tail: «f799cbb9 ⏎ 6a19e096»; touched mods paths
  - command opens: "cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; M=home/.claude/plugin-x/mods/x-mod-"
- #4 c7a7ba63 11-04 16:12 242.0s background [mods]
  - compound call with mods-edit:test, mods-edit:push, test, push, sleep; no gate lines; tail: «11	[exited with code 0] ⏎ 12»; background, ack after 0.1s; seconds end at the notification (11-04 16:16); the session issued 2 tool calls meanwhile, the last 35.9s before the notification; output read back 3.2s after the notification; touched mods paths
  - command opens: "cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; M=home/.claude/plugin-x/mods/x-mod-"
- #5 c7a7ba63 11-04 15:28 233.4s foreground [mods]
  - compound call with mods-edit:pull, mods-edit:test, mods-edit:push, push; no gate lines; tail: «8daac394 ⏎ home/.claude/plugin-x/mods/x-mod-stash/FTR.md:697:[FRM-500](https://linear.app/x-com/issue/FRM-500): the mod r»; touched mods paths
  - command opens: "cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; S=home/.claude/plugin-x/mods/x-mod-"
- #6 c7a7ba63 11-04 15:44 212.4s foreground [mods]
  - compound call with mods-edit:test, mods-edit:push, test, push, sleep; no gate lines; tail: «1f64e232 ⏎ 🐞 x-mod-stash: a store refusing the rung costs one line, mods:set t»; touched mods paths
  - command opens: "cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; M=home/.claude/plugin-x/mods; S=$M/"
- #7 c7a7ba63 11-04 15:20 188.4s foreground [mods]
  - compound call with mods-edit:pull, mods-edit:test, mods-edit:push, push; no gate lines; tail: «       0 ⏎ In Progress»; touched mods paths
  - command opens: "cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; S=home/.claude/plugin-x/mods/x-mod-"
- #8 96392cd0 11-04 12:51 183.7s foreground [other]
  - compound call with push; only the commit JSON with a sha (green, no gate lines); no mods paths
  - command opens: "cd ~/frame; S=/private/tmp/claude-501/-Users-dima-frame--clio/96392cd0-55a1-4898-87d1-781fbca20e51/scratchpad; sd 'mods:pace-watch' 'mods:set-pace-wat"
- #9 c7a7ba63 11-04 15:34 175.9s foreground [mods]
  - compound call with mods-edit:push, push; no gate lines; tail: «442f814d 📜 pocket: pk-316 (auto) ⏎ ed9efb90 📜 clio: plugin bump for shape-lane»; touched mods paths
  - command opens: "cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; S=home/.claude/plugin-x/mods/x-mod-"
- #10 c7a7ba63 11-04 16:16 168.5s background [mods]
  - compound call with mods-edit:pull, mods-edit:test, mods-edit:push, push, sleep; no gate lines; tail: «8	[exited with code 0] ⏎ 9»; background, ack after 0.1s; seconds end at the notification (11-04 16:19); the session issued 4 tool calls meanwhile, the last 134.0s before the notification; output read back 2.3s after the notification; touched mods paths
  - command opens: "cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; M=home/.claude/plugin-x/mods/x-mod-"
- #11 c7a7ba63 11-04 15:08 158.3s foreground [mods]
  - compound call with mods-edit:push, test, push; no gate lines; tail: «lane push rc 0 ⏎ b660b59b»; touched mods paths
  - command opens: "cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; M=home/.claude/plugin-x/mods; S=$M/"
- #12 c7a7ba63 11-04 12:29 146.3s foreground [mods]
  - compound call with mods-edit:push, test, push; printed `mods:typecheck: 4 mods clean`; touched mods paths
  - command opens: "P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; R=home/.claude/plugin-x/mods/x-mod-stash; cd ~/frame; x m"
- #13 6aa1af14 11-02 14:12 145.3s foreground [mods]
  - compound call with mods-edit:push, test; printed `mods:typecheck: 4 mods clean` / `mods:test: red in x-mod-stash, 1969 pass, 1 fail`; touched mods paths
  - command opens: "cd ~/frame && S=/private/tmp/claude-501/-Users-dima-frame/6aa1af14-8ce8-40a3-9026-142a9a3029a0/scratchpad; G=home/.claude/plugin-x/mods/x-mod-guard; x"
- #14 c7a7ba63 11-04 10:57 140.4s foreground [mods]
  - compound call with mods-edit:pull, mods-edit:test, mods-edit:push, push; only the commit JSON with a sha (green, no gate lines); touched mods paths
  - command opens: "P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; R=home/.claude/plugin-x/mods/x-mod-stash; cd ~/frame; x m"
- #15 c7a7ba63 11-04 14:59 139.7s foreground [mods]
  - compound call with mods-edit:pull, mods-edit:push, push; no gate lines; tail: «7929c911 ⏎ 7929c911»; touched mods paths
  - command opens: "cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; M=home/.claude/plugin-x/mods; S=$M/"

### Mods lanes
- #1 c7a7ba63 11-04 15:59 262.2s background [mods]
  - compound call with mods-edit:test, mods-edit:push, test, push, sleep; no gate lines; tail: «9	[exited with code 0] ⏎ 10»; moved to background after 246.4s; seconds end at the notification (11-04 16:04); the session issued 1 tool calls meanwhile, the last 10.9s before the notification; output read back 2.5s after the notification; touched mods paths
  - command opens: "cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; M=home/.claude/plugin-x/mods/x-mod-"
- #2 c7a7ba63 11-04 15:49 242.1s foreground [mods]
  - compound call with mods-edit:test, mods-edit:push, test, push, sleep; no gate lines; tail: «f799cbb9 ⏎ 6a19e096»; touched mods paths
  - command opens: "cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; M=home/.claude/plugin-x/mods/x-mod-"
- #3 c7a7ba63 11-04 16:12 242.0s background [mods]
  - compound call with mods-edit:test, mods-edit:push, test, push, sleep; no gate lines; tail: «11	[exited with code 0] ⏎ 12»; background, ack after 0.1s; seconds end at the notification (11-04 16:16); the session issued 2 tool calls meanwhile, the last 35.9s before the notification; output read back 3.2s after the notification; touched mods paths
  - command opens: "cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; M=home/.claude/plugin-x/mods/x-mod-"
- #4 c7a7ba63 11-04 15:28 233.4s foreground [mods]
  - compound call with mods-edit:pull, mods-edit:test, mods-edit:push, push; no gate lines; tail: «8daac394 ⏎ home/.claude/plugin-x/mods/x-mod-stash/FTR.md:697:[FRM-500](https://linear.app/x-com/issue/FRM-500): the mod r»; touched mods paths
  - command opens: "cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; S=home/.claude/plugin-x/mods/x-mod-"
- #5 c7a7ba63 11-04 15:44 212.4s foreground [mods]
  - compound call with mods-edit:test, mods-edit:push, test, push, sleep; no gate lines; tail: «1f64e232 ⏎ 🐞 x-mod-stash: a store refusing the rung costs one line, mods:set t»; touched mods paths
  - command opens: "cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; M=home/.claude/plugin-x/mods; S=$M/"
- #6 c7a7ba63 11-04 15:20 188.4s foreground [mods]
  - compound call with mods-edit:pull, mods-edit:test, mods-edit:push, push; no gate lines; tail: «       0 ⏎ In Progress»; touched mods paths
  - command opens: "cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; S=home/.claude/plugin-x/mods/x-mod-"
- #7 c7a7ba63 11-04 15:34 175.9s foreground [mods]
  - compound call with mods-edit:push, push; no gate lines; tail: «442f814d 📜 pocket: pk-316 (auto) ⏎ ed9efb90 📜 clio: plugin bump for shape-lane»; touched mods paths
  - command opens: "cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; S=home/.claude/plugin-x/mods/x-mod-"
- #8 c7a7ba63 11-04 16:16 168.5s background [mods]
  - compound call with mods-edit:pull, mods-edit:test, mods-edit:push, push, sleep; no gate lines; tail: «8	[exited with code 0] ⏎ 9»; background, ack after 0.1s; seconds end at the notification (11-04 16:19); the session issued 4 tool calls meanwhile, the last 134.0s before the notification; output read back 2.3s after the notification; touched mods paths
  - command opens: "cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; M=home/.claude/plugin-x/mods/x-mod-"
- #9 c7a7ba63 11-04 15:08 158.3s foreground [mods]
  - compound call with mods-edit:push, test, push; no gate lines; tail: «lane push rc 0 ⏎ b660b59b»; touched mods paths
  - command opens: "cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; M=home/.claude/plugin-x/mods; S=$M/"
- #10 c7a7ba63 11-04 12:29 146.3s foreground [mods]
  - compound call with mods-edit:push, test, push; printed `mods:typecheck: 4 mods clean`; touched mods paths
  - command opens: "P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; R=home/.claude/plugin-x/mods/x-mod-stash; cd ~/frame; x m"
- #11 6aa1af14 11-02 14:12 145.3s foreground [mods]
  - compound call with mods-edit:push, test; printed `mods:typecheck: 4 mods clean` / `mods:test: red in x-mod-stash, 1969 pass, 1 fail`; touched mods paths
  - command opens: "cd ~/frame && S=/private/tmp/claude-501/-Users-dima-frame/6aa1af14-8ce8-40a3-9026-142a9a3029a0/scratchpad; G=home/.claude/plugin-x/mods/x-mod-guard; x"
- #12 c7a7ba63 11-04 10:57 140.4s foreground [mods]
  - compound call with mods-edit:pull, mods-edit:test, mods-edit:push, push; only the commit JSON with a sha (green, no gate lines); touched mods paths
  - command opens: "P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; R=home/.claude/plugin-x/mods/x-mod-stash; cd ~/frame; x m"
- #13 c7a7ba63 11-04 14:59 139.7s foreground [mods]
  - compound call with mods-edit:pull, mods-edit:push, push; no gate lines; tail: «7929c911 ⏎ 7929c911»; touched mods paths
  - command opens: "cd /Users/dima/frame; P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; M=home/.claude/plugin-x/mods; S=$M/"
- #14 c7a7ba63 11-04 11:37 138.1s foreground [mods]
  - compound call with mods-edit:push, test; red: «commit failed — the hook's own lines are below, the whole log at /var/folders/k0/7z1qfw7j4_n8kbvkdd3t1f9c0000g»; printed `mods:typecheck: 4 mods clean` / `mods:test: 4 mods green, 2528 pass, 0 fail`; touched mods paths
  - command opens: "P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; cd ~/frame; R=home/.claude/plugin-x/mods/x-mod-stash; M=h"
- #15 c7a7ba63 11-04 12:51 137.5s foreground [mods]
  - compound call with test, push; printed `mods:typecheck: 4 mods clean`; touched mods paths
  - command opens: "P=/private/tmp/claude-501/-Users-dima-frame/c7a7ba63-7265-4eb8-b607-18eda0d0e659/scratchpad; R=home/.claude/plugin-x/mods/x-mod-stash; cd ~/frame; pnp"

## 3. Mods lanes: mods paths and tested-bytes skips
- 125 commits in the mods lanes: 118 name mods paths, 7 name none (0 with no path list in the command)
- touched mods: n=118 p50 62.3s mean 77.3s p90 140.4s max 262.2s
- touched none: n=7 p50 9.5s mean 12.9s p90 40.8s max 40.8s
- touched mods, pure calls only: n=55 p50 54.2s mean 54.7s p90 72.0s max 97.7s; compound: n=63 p50 75.8s mean 97.1s p90 175.9s max 262.2s
- touched none, pure calls only: n=7 p50 9.5s mean 12.9s p90 40.8s max 40.8s; compound: n=0
- reporting a tested-bytes skip (`skipped on tested bytes` or `already green on these bytes`): 0; not reporting: 125
  - of the not-reporting, 0 have no recoverable output at all
  - skip text across all 509 commits at 20+: 1 `skipped on tested bytes`, 0 `already green`
- reds in mods lanes (commit JSON error or "commit failed"): 20; their p50 62.3s, others p50 59.9s
- index.lock mentioned: 0; timeout rerun lines: 0; gate-queue lines: 0

## 4. Runs of 10 consecutive commits within one active stretch
- Stretch = a run of session events with no gap over 30 min. Within a stretch the commits are taken in time order and cut into disjoint chunks of 10 (floor(n/10) per stretch); the minutes are the summed durations of the 10 commit calls (background calls count their notification wait). The span is first start to last end, which also holds the work between commits.
- 8cfae24d [mods]: 28 commits in 2 stretches, largest 19; 1 runs of 10 (10 commits); minutes in commit calls: worst 9.4, median 9.4; span worst 119.3, median 119.3; overlapping windows worst 10.5
- 6aa1af14 [mods]: 62 commits in 3 stretches, largest 31; 5 runs of 10 (50 commits); minutes in commit calls: worst 11.0, median 9.4; span worst 131.6, median 47.0; overlapping windows worst 12.6
- c7a7ba63 [mods]: 35 commits in 2 stretches, largest 20; 3 runs of 10 (30 commits); minutes in commit calls: worst 24.6, median 16.9; span worst 115.9, median 66.0; overlapping windows worst 31.5
- e7e7d905 [other]: 32 commits in 2 stretches, largest 23; 2 runs of 10 (20 commits); minutes in commit calls: worst 2.3, median 1.8; span worst 46.2, median 32.8; overlapping windows worst 2.7
- 96392cd0 [other]: 95 commits in 2 stretches, largest 57; 8 runs of 10 (80 commits); minutes in commit calls: worst 9.0, median 6.1; span worst 71.9, median 52.7; overlapping windows worst 10.5
- 668daff8 [other]: 86 commits in 2 stretches, largest 61; 8 runs of 10 (80 commits); minutes in commit calls: worst 7.5, median 3.8; span worst 74.0, median 48.7; overlapping windows worst 7.5
- f0e0062c [other]: 60 commits in 1 stretches, largest 60; 6 runs of 10 (60 commits); minutes in commit calls: worst 8.9, median 4.5; span worst 79.8, median 33.5; overlapping windows worst 10.4
- 9939ff19 [other]: 35 commits in 1 stretches, largest 35; 3 runs of 10 (30 commits); minutes in commit calls: worst 11.5, median 8.4; span worst 240.8, median 191.0; overlapping windows worst 12.4
- e1ac9b71 [other]: 76 commits in 2 stretches, largest 60; 7 runs of 10 (70 commits); minutes in commit calls: worst 7.8, median 5.0; span worst 125.2, median 48.4; overlapping windows worst 8.4
- mods lanes pooled: 9 runs of 10 (90 commits); commit-call minutes worst 24.6, median 10.4, runs at 30 min or more: 0; span worst 131.6, median 65.5, spans at 30 min or more: 8
- other sessions pooled: 34 runs of 10 (340 commits); commit-call minutes worst 11.5, median 5.2, runs at 30 min or more: 0; span worst 240.8, median 47.7, spans at 30 min or more: 30
- all pooled: 43 runs of 10 (430 commits); commit-call minutes worst 24.6, median 6.1, runs at 30 min or more: 0; span worst 240.8, median 48.7, spans at 30 min or more: 38

## 5. Days and the queue
- queue birth 2026-11-06 18:16 local
- all 509 commits: 509 predate it, 0 after; by day 11-01: 60, 11-02: 138, 11-03: 146, 11-04: 130, 11-05: 13, 11-06: 22
- mods lanes 125 commits: 125 predate it, 0 after; by day 11-02: 62, 11-03: 28, 11-04: 35
- commits whose output carries a `gate-queue:` line: 0 of 509 (mods lanes 0); latest commit at 20+ sessions: 11-06 03:35
- inference: no figure here ran under gate-queue if the count above is 0 and every commit predates the birth; the 4 commits of this session (2e3b8126, after the birth) are below the 20 cut

## Hand-checks against the raw jsonl (3)
- c7a7ba63 11-04 15:49, foreground 242.1s: raw tool_use toolu_01YGvumopvELb34HJdbgNEsF at 13:49:03.069Z, its tool_result at 13:53:05.145Z, difference 242.08s. The command holds python edit, `x mods edit test`, `x mods edit push`, `pnpm mods:typecheck`, `x lane commit`, then a `x lane push --apply` retry loop with `sleep 30`; its output ends `commit rc 0`, `pushed try 2`, two shas.
- 9939ff19 11-05 19:08, background 288.7s: raw tool_use at 17:08:12.786Z, ack at 17:08:14.372Z, queue-operation enqueue of the task-notification at 17:13:01.496Z (task buqg8tytn), difference 288.71s; the command is a load-average wait loop (up to 80 x `sleep 15`) before the commit, so the seconds are mostly the loop (inference: the log was read back 9.5s after the notification and shows only the commit JSON).
- 8cfae24d commit count: raw ids whose Bash command contains `x lane commit` anywhere: 34; of them 28 open a segment with it after stripping heredoc bodies, matching the 28 counted.

## Reading for the claim «10 commits, half an hour» (inference)
- the mods lanes' commit calls: p50 60.2s, mean 73.7s, so 10 of them cost about 12.3 min on the mean and 10.0 min on the median; the worst run of 10 is 24.6 min, none of 9 reaches 30
- but 63 of the 118 mods-touching calls are scripts (edit, mods test, push, typecheck, push retries) and run mean 97.1s against 54.7s for the pure calls; c7a7ba63 alone has 29 of them at mean 134s
- the wall time of 10 consecutive mods commits (first start to last end) has median 65.5 min and 8 of 9 are 30 min or more: «half an hour for 10 commits» holds as elapsed time, and it is mostly work between the commit calls (edit, red-proof, review), not the commit call
