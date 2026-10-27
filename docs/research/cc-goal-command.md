Ticket: FRM-1
dies-when: the FRM-1 trial verdict is written

# cc `/goal`: how it works, best practice, fit with our coder setup

Researched 2026-10-27. Docs = https://code.claude.com/docs/en/goal (fetched 2026-10-27; the page has no version stamp, latest cc is 2.1.311 from 2026-10-26). Changelog = `gh api repos/anthropics/claude-code/releases`.

## how it works
- **One goal per session.** A new `/goal` replaces the old one. `/goal` with no args shows the condition, elapsed time, turns, tokens and the evaluator's last reason. `/goal clear` (also stop/off/reset/none/cancel) clears it, and so does `/clear`. Source: docs (2026-10-27). The old note is still correct here.
- **Setting it starts a turn right away**, with the condition as the directive. No separate prompt is needed. Source: docs. Added in v2.1.139 (2026-05-11), "works in interactive, `-p`, and Remote Control".
- **The condition can be up to 4,000 characters.** Source: docs (2026-10-27). The limit is still open as a feature request in [#84953](https://github.com/anthropics/claude-code/issues/84953) (2026-08-08). The old note is still correct.
- **It reads the transcript only.** After each turn the condition and the conversation go to the small fast model (Haiku by default, `ANTHROPIC_DEFAULT_HAIKU_MODEL` changes it). It returns one of three verdicts: not met (Claude keeps going and gets the reason as guidance), met (goal cleared), or impossible (goal cleared). It "doesn't run commands or read files" and "does not call tools". Source: docs. The old note is still correct.
- **The old note is wrong on one point: `/goal` is a Stop hook.** The docs call it "a wrapper around a session-scoped prompt-based Stop hook", and so does hooks.md (https://code.claude.com/docs/en/hooks, line ~2732, fetched 2026-10-27).
- **Loop guard.** If several turns in a row have no tool use, the loop stops with a warning and the goal stays set. Source: docs. hooks-guide gives the cap as 8 consecutive blocks with no tool call (https://code.claude.com/docs/en/hooks-guide, "Stop hook hits the block cap"). [#101528](https://github.com/anthropics/claude-code/issues/101528) (2026-10-12) says it saw a "9-consecutive-block" cap. Both are reported here.
- **Errors.** Unrecoverable errors clear the goal: auth (unless the desktop app holds the credentials), credit balance, a context overflow that compaction can't clear, or a missing model. Since v2.1.234 (2026-08-17). Other errors retry up to 3 times or pause the goal. Since v2.1.269 (2026-09-11). A rate limit or "a hook that ended the turn" pauses it. Source: docs.
- **Background work holds off evaluation.** No verdict is given while a subagent or background shell is still running (fixed in v2.1.143, 2026-05-15). Check-ins come after 30 min, then 1 h, then every 2 h (v2.1.234, v2.1.236, v2.1.239). Idle check-ins are capped at 3 per goal (v2.1.246, 2026-08-25). `CLAUDE_CODE_GOAL_CHECKIN_MINUTES=0` turns them off. `/goal` is unavailable under `disableAllHooks` or `allowManagedHooksOnly`, or in an untrusted workspace (v2.1.140). Source: docs and changelog.

## best practice
- **Condition wording.** Give one measurable end state, a stated check (for example "`npm test` exits 0"), and the constraints that must not change. Write it so that Claude's own output can prove it. Source: docs (2026-10-27). [inventivehq](https://inventivehq.com/blog/claude-code-goal-command-guide) (2026-06-01) says the same: "a verifiable end state, not a list of instructions".
- **Forbid gaming the goal**, for example "don't touch test files". Source: [MindStudio](https://www.mindstudio.ai/blog/claude-code-goal-command-autonomous-agent-loops) (2026-07-13).
- **Scope size.** The docs suit "substantial work with a verifiable end state", for example "implementing a design doc until all acceptance criteria hold". MindStudio (2026-07-13) suggests checkpoints for large jobs and a plain prompt for one-shot tasks. No source gives a size number. «inference»: one chunk with 3–6 exit lines is about the right grain.
- **Turn caps.** The docs say to add "or stop after 20 turns". Claude reports against the cap and the evaluator judges it from the transcript. Caution: in [#103908](https://github.com/anthropics/claude-code/issues/103908) (2026-10-21, a comment on 2.1.308 in the Code tab) the evaluator read "A or N rounds" as "A and B" and ran past the cap. «inference»: write the cap as its own sentence ("If turn 20 is reached, the goal is met regardless"), not as an OR clause.
- **Cost.** Evaluator tokens are "typically negligible" (docs, a vendor claim). Turn count is the real cost driver (inventivehq, 2026-06-01). Neither source has measured numbers.
- **Practitioner write-ups** add nothing beyond the docs. Searched with WebSearch "Claude Code /goal command condition tips experience 2026" (2026-10-27). The Medium post was behind a paywall and was dropped.

## known problems (all open unless marked)
- The evaluator can't see a `/goal` instruction stored only in `<command-args>`, so it loops until it says "impossible": [#93744](https://github.com/anthropics/claude-code/issues/93744) (2.1.268).
- Stops it should accept but doesn't: it concedes the stop condition and still returns met:false in [#103894](https://github.com/anthropics/claude-code/issues/103894). It treats an OR cap as AND in [#103908](https://github.com/anthropics/claude-code/issues/103908). It loops after the work is done in [#85594](https://github.com/anthropics/claude-code/issues/85594) (2.1.226).
- It ignores the user's "stop", and `/goal clear` sits in the queue while the goal keeps re-prompting: [#101528](https://github.com/anthropics/claude-code/issues/101528) (Code tab, 2.1.308), [#100634](https://github.com/anthropics/claude-code/issues/100634) (Code tab, 2.1.287), [#104040](https://github.com/anthropics/claude-code/issues/104040) (2.1.305).
- It loops when the last step is denied or needs the user: the auto-mode classifier denies the step in [#98066](https://github.com/anthropics/claude-code/issues/98066) (2.1.284). The step needs user-only auth in [#100010](https://github.com/anthropics/claude-code/issues/100010). The user accepted BLOCKED in [#92242](https://github.com/anthropics/claude-code/issues/92242).
- The Code tab shows no goal indicator: [#101528](https://github.com/anthropics/claude-code/issues/101528) (comment 2026-10-24, 2.1.308).
- Forked subagents inherit the goal and act on it: [#72659](https://github.com/anthropics/claude-code/issues/72659) (2026-07-01).
- On Opus 5.5 under `/goal`, checks were reported as PASS when they had failed, and the goal hook vanished mid-run: [#104037](https://github.com/anthropics/claude-code/issues/104037) (2.1.296, desktop).
- No launcher flag or hook field can set, pause or clear a goal; it has to be typed: [#100532](https://github.com/anthropics/claude-code/issues/100532) (2.1.294).
- The evaluator timeout can't be configured: [#96723](https://github.com/anthropics/claude-code/issues/96723), [#96757](https://github.com/anthropics/claude-code/issues/96757).
- Fixed: the goal was lost on resume after a compaction (v2.1.274). A goal set right at a compact boundary never started (closed [#82546](https://github.com/anthropics/claude-code/issues/82546), 2.1.220).

## fit with our setup
1. **Can a `--bg` session's first prompt be `/goal <condition>`?** Unknown. `--bg` takes a positional prompt (https://code.claude.com/docs/en/agent-view, ~line 502). Agent-view dispatch sends skills, your own commands and "prompt-expanding built-ins" as the first prompt; other built-ins show "isn't available in agent view" (same page, ~line 415). #100532 (2.1.294) says "a new conversation cannot start with one". `-p "/goal …"` is documented as working. Probe: `claude --bg -n goal-probe --model haiku "/goal the file /tmp/goal-probe.txt contains the word done; prove it with cat"`, then `claude agents` and attach, and check for a `◎ /goal active` indicator or a `/goal` status line. Fallback if it fails: attach and type `/goal …` after boot.
2. **Can a desktop Code tab session take it?** Yes. The docs (2026-10-27) say it works "in the desktop app". But the Code tab shows no indicator, and `/goal clear` can get stuck in the queue: #101528 (2.1.308) and #100634. «inference»: check status with `/goal` and not by eye.
3. **Does it survive compaction?** Yes for normal auto-compaction. «inference», drawn from three sources: the docs clear it only on "a context overflow that auto-compaction couldn't clear"; v2.1.274 fixed overflow after a reactive compaction and keeps the goal on resume after a compaction; #82546 is closed. Probe: in a goal session run `/compact`, then `/goal`, and check that the condition is still listed.
4. **What happens when our Stop hook blocks?** Partly answered. Matching hooks run in parallel (https://code.claude.com/docs/en/hooks, ~line 398). "A hook that ended the turn" pauses the goal (docs). Our block feeds the next turn the same way the goal's does. The 8-block cap counts consecutive blocks with no tool call (hooks-guide). Unknown: which reason Claude sees when both block, and whether our hook's `stop_hook_active` check now trips on goal continuations. «inference»: it will, because `stop_hook_active` is true whenever a Stop hook continued the turn. Probe: in one goal session, set our blocking condition, end a turn, then `rg -n 'Stop hook feedback|stop_hook_active|goal' ~/.claude/projects/<proj>/<session>.jsonl`.

## recommendation for a one-chunk trial
- Pick one chunk with 3–4 exit lines, each provable by a command that runs in under 1 minute. Run it in a `--bg` coder on the CLI (2.1.311), not in the desktop app, because the Code tab has no indicator and its clear can get stuck (#101528, #100634). Run probe 1 first.
- Put the condition text inline, because the evaluator may not read a goal that only says "read spec X" (#93744). Draft:

```
/goal Chunk <id> of <spec path> is done when all four exit lines below are proven in this
conversation by the command shown, run AFTER the last code edit, with its raw output pasted:
E1 given <...> when <...> then <...> — proof: `<cmd1>` prints <expected>
E2 given <...> when <...> then <...> — proof: `<cmd2>` exits 0
E3 given <...> when <...> then <...> — proof: `<cmd3>` prints <expected>
E4 given <...> when <...> then <...> — proof: `<cmd4>` exits 0
and `git status` shows every change committed on branch <branch> and the PR is opened.
Do not edit test files or the spec. Do not merge. A failed proof is not met; fix and re-run.
Separate rule: when 25 turns have been used, report the open lines and the goal is met.
```

- Compare against our default coder run on a similar-size chunk:
  - turns: from `/goal` status (turns evaluated)
  - tokens: from `/goal` status, plus the session usage
  - wall time
  - early stop: met while any exit line's output was missing or failed. Check this by hand against the PR, because of #104037
  - looping: any turns after met, any no-tool-use block-cap warnings, or turns run past the 25-turn cap (#103908)
  - Stop-hook clash: how often our hook and the goal hook both fired (probe 4 rg)
  - verifier rounds to `clean` (0–3), plus the number of findings in round 1
- Kill switch: if the goal is still re-prompting after the PR is open, interrupt first and then `/goal clear` (#100634).
<!-- end -->
