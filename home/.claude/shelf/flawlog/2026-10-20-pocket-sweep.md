# flawlog · 2026-10-20 · pocket-sweep

- ~14:01 zsh unsplit $VAR: `A="node script/pocket-add.ts"; $A …` ran nothing 9 times — the known trap, hit outside `x lane commit` (PK-190 covers only that verb). fixed in place with a function. #guard-gap
- ~14:02 pocket-add has no re-prioritise verb: moving 3 items now → next needed a hand ordinal pick, and the next band is capped at 99999 (PK-152 sits on the ceiling). #automation
- ~14:03 x-mod-guard refused a wishkeeper brief for «path /clear — no such path»: a slash command read as a path. #guard-wisp
- ~14:04 composed clock: the three lines above were stamped 14:05–14:12 ahead of the real clock (ccrow caught it); restamped from the prompt hook's times. #stamp
- ~14:12 board said «we run 2.1.301» from `claude --version` (the cli on PATH); this desktop session runs the bundled 2.1.299 — method-report-verify's «a version off the disk is not the running process», missed again. #version — retracted 14:32 by dima: two cc builds side by side is by design, not a flaw; the line went into root CLAUDE.md § session habits
- ~14:20 clear probe: `expect`'s sleep never drains the pty, so cc blocked silently; desktop CLAUDE_* env leaked into children; /private/tmp sessions save no transcript. 3 runs, no verdict. #probe
