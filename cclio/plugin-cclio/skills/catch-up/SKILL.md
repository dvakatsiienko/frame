---
name: catch-up
description: load when dima asks how a part of our system or the fleet works, or what is happening in it — «remind me how our … works», «how does our … work now», «what's happening in our …», «i forgot how …», «catch me up on …» — and on your own when his words show an outdated picture of a part. not for setting a reminder (that is cclio:remind).
---

# cclio:catch-up — help dima recall, explore and learn our system

the system grows faster than he can follow, and he steers better when he knows how a part works now.
the answer comes first, plain and current; the routes invite him wider or deeper. the want and the
decisions: `~/frame/.scratch/catch-up/PRODUCT.md`.

## 1. gather — live, never from memory alone

- find the area's home: its `AGENTS.md`, its skill, its `docs/` page, through `rg` and the maps the
  fleet keeps (`frame/AGENTS.md` § the other homes, the skill list); no hand-kept area table
- `test -e` every path before reading it; a dead path is named in the answer, never read as «nothing new»
- the 🆕 window: `jq -r '.["<area>"] // empty' ~/.local/state/cclio/catch-up.json`, else 14 days;
  `git -C <the area's repo: ~/frame or ~/projects/bytes> log --since=<that> --format='%cs %s' -- <paths>` plus the area's lines in `cclio/gazette/_trail.md`
- the lag check: `git log -1 --format=%cs -- <home doc>` against the same over the area's code paths

done: the home file read, the paths proven, the log read.

## 2. the answer — ≤ ~1,500 chars (a trial; dima leans compact), longer only on «go deeper»

- **the asked thing**, first, in plain words; no tech details until he asks
- **the area around it**: 3–5 neighbour parts, one line each
- **🆕** one line: what moved since his last catch-up there
- **a map** of ≤8 ascii lines, only when the area is a flow
- **the source** named as a link; code newer than the doc → «docs lag the code by N days»
- his picture was off → name the one thing that changed, without a lesson
- light emojis, dense ones where they fit (`x:top-seven` style), clean

done: printed under the budget.

## 3. the routes — 2–3 orbit asks

matt's `teach` (user-only, read by path: `~/.claude/plugins/marketplaces/mattpocock/skills/productivity/teach/SKILL.md`) is a multi-session course of html lessons:
offered as a route only when an area deserves real study, in this skill's format, never by default.

wider, deeper, what changed — each an orbit ask whose pick names where it goes («deeper: how a recipe
run's lanes fan out»); his tick takes the route, an unticked one dies with the turn. never numbered
lines in the reply.

then write today into the stamps file, through a temp file (jq never writes in place):

```bash
f=~/.local/state/cclio/catch-up.json; mkdir -p "${f%/*}"; [ -s "$f" ] || echo '{}' > "$f"
jq --arg a '<area>' --arg d "$(date +%F)" '.[$a]=$d' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
```

done: the asks are in orbit and the stamp is today.

## on my own

the tell is concrete: his words contradict what the area's file says now. then one line offers a
catch-up on that area — «🧭 that part changed on 10-14, catch up?» — at most once per area per
session, never an unasked lesson.
