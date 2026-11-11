# regression replay windows

times are local (UTC+2). transcripts are under `/Users/dima/.claude/projects/-Users-dima-frame--clio/`. the 11-09 and 11-07 cases come from sessions that are not today's.

## case 1

- commit_range: `32c0c0ec..d5c7dd64` (the frame#152 pr branch before its squash merge 123716ee; d5c7dd64 is the pr head the chunk read ran on, and `x/go/merge_auto.go:1310` exists at that head)
- transcript: `/Users/dima/.claude/projects/-Users-dima-frame--clio/b33a2902-a6e4-4b53-8088-a8901ca2f292.jsonl` (wing 2), 21:00–21:32 (the chunk read is spawned at 21:17, the claim reaches dima at 21:31–21:32)
- tickets: FRM-548, PK-348 (grill 2 file `.scratch/pk-348/grill-2-proposal.md` in the clio-wing-2 worktree); pr frame#152
- confidence: high. the transcript names «Wishkeeper chunk read of #152», the sha d5c7dd64 has the cited line, and the grill-2 file path matches.

## case 2

- commit_range: `f63de9a7..a5d0acf6` (clio-revive.sh lands in 4368aa67; a5d0acf6 is the alias commit, after the second reply)
- transcript: `/Users/dima/.claude/projects/-Users-dima-frame--clio/6664e8d8-d7cb-4958-bc38-9107adcc3039.jsonl` (wing 1), 19:35–20:12 (replies at 20:06:31 and 20:11:52)
- tickets: FRM-575
- confidence: high. both reply timestamps match assistant text blocks in this wing 1 session, and lines 25-27 of the script at a5d0acf6 are the effort read.

## case 3

- commit_range: `ec4162fd..51a45e0e` (51a45e0e is the reuse-before-summon commit that put the line at `craft-fleet-flow.md:49`)
- transcript: `/Users/dima/.claude/projects/-Users-dima-frame--clio/58db26e0-944d-4500-a4eb-2034252a4b11.jsonl` (main), 2026-11-09 23:50 to 2026-11-10 00:22 (the report to dima comes at 00:21)
- extra read: his prompts file is `/Users/dima/.local/state/clio/prompts/2026-11-10.md` (the case's `prompts/2026-11-10.md`, lines 8 and 23)
- tickets: none named
- confidence: high. line 49 at 51a45e0e is the reuse-before-summon line, and the main transcript holds the dima steer at 00:01 and 00:07, the memory edit at 00:08, and the wishkeeper read at the 00:21 commit.

## case 4

- commit_range: `4b437d7a..ef9fae6c` (the last commit before the fix commit 91ec4731; the PK-328 move was a pocket edit made in the working tree at 15:45, so it shows in the transcript, not in a commit)
- transcript: `/Users/dima/.claude/projects/-Users-dima-frame--clio/483eb11c-11aa-472a-b36f-e442bba3da8f.jsonl` (wing 1, 2026-11-07), 15:20–15:59 (the siesta read is spawned at 15:51, its report to dima at 15:58–15:59)
- tickets: FRM-521, PK-328 (W35 among its W-lines)
- confidence: medium. the session is wing 1 and FRM-521's close and the PK-328 move are at 15:39–15:45, but the git range is only a proxy for a pocket-file change that has no commit of its own.

## case 5

- commit_range: `c5d775b4..a42e81e4` (a42e81e4 is the escape-table commit named in the case; base is five non-pocket commits earlier)
- transcript: `/Users/dima/.claude/projects/-Users-dima-frame--clio/e1ac9b71-23bb-4ccb-846b-94fa166c7202.jsonl` (main, 2026-11-02), 13:05–13:36 (the lane plan line is written at 13:12, the report to dima is at 13:35)
- tickets: FRM-471, FRM-472 (named in the o9 follow text of the same stretch)
- confidence: high. the plan line, the sha and FRM-471 all sit in this main session within 25 minutes.

## case 6

- commit_range: `aee242c7..148aa078` (head is the commit named in the case; the fix commit b54dea04 lands at 21:53, after the catch)
- transcript: `/Users/dima/.claude/projects/-Users-dima-frame--clio/6664e8d8-d7cb-4958-bc38-9107adcc3039.jsonl` (wing 1), 21:20–21:52 (the report arrives at 21:50:23)
- tickets: PK-349 (crow replay row, flyway line #21)
- confidence: high. the sha, the packet id and the report time all match this wing 1 session.

## case 7

- commit_range: `74ba7162..138a26cc` (the evening's herdr-lane work on the chat; 138a26cc is the fast-chat commit at 21:45)
- transcript: `/Users/dima/.claude/projects/-Users-dima-frame--clio/1e70bf35-bc95-404c-957d-ec4bdf5250e5.jsonl` (main), 21:20–21:52 (the tick ask goes out at 21:49, his steer at 21:51:25, the message to codie at 21:51:33)
- tickets: none named
- confidence: medium. the transcript is the main session with the exact ask phrase, but the case gives no sha, so the commit range is picked from the lane's chatter commits.
