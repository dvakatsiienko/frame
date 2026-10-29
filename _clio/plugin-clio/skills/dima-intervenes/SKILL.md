---
name: dima-intervenes
description: load when dima asks how a part of our system or the fleet works or what is happening in it — «remind me how our … works», «what's happening in our …», «i forgot how …», «show me our …» — when he senses a part is off — «feels off», «drifted», «something's wrong with our …», «let's shake your …» — and on your own when his words show an outdated picture of a part. not for setting a reminder (that is cclio:remind).
---

# cclio:dima-intervenes — dima regains a part of our system, and fixes it with me

the system grows faster than he can follow, and his grasp of it shapes every prompt. three modes, one
voice: **recall** (how a part works now), **tour** (a part he never saw, light, an mvp), **fix** (a part
is off and we fix it together). he is the strategist and drives the what; i do the tech and keep it in
plain words. the want, the W-lines and the decisions: `PRODUCT.md` beside this file.

## 1. gather — live, never from memory alone

- find the area's home: its `AGENTS.md`, its skill, its `docs/` page, through `rg` and the maps the
  fleet keeps (`frame/AGENTS.md` § the other homes, the skill list); no hand-kept area table
- `test -e` every path before reading it; a dead path is named in the answer, never read as «nothing new»
- the area's key is its home file's repo path, never his wording that day
- the 🆕 window: `jq -r '.["<area>"] // empty' ~/.local/state/clio/dima-intervenes.json`, else 14 days;
  `git -C <the area's repo: ~/frame or ~/projects/bytes> log --since=<that> --format='%cs %s' -- <paths>` plus the area's lines in `_clio/gazette/_trail.md`
- the lag check: `git log -1 --format=%cs -- <home doc>` against the same over the area's code paths

done: the home file read, the paths proven, the log read.

## 2. recall and tour — one answer, ≤ ~1,500 chars, longer only on «go deeper»

- **the asked thing**, first, in plain words; a tour opens with what the part is for
- **the area around it**: 3–5 neighbour parts, one line each
- **🆕** one line: what moved there since his last visit
- **a map** of ≤8 ascii lines, only when the area is a flow
- **the source** named as a link; code newer than the doc → «docs lag the code by N days»
- his picture was off → name the one thing that changed, without a lesson

done: printed under the budget.

## 3. fix mode — his concern words start it

a concern word anywhere in the message wins over a recall ask; a case i cannot read gets one line,
«recall, or fix?». the run's state (layer, his account, his guess, findings) lives in
`~/frame/.scratch/dima-intervenes/runs/<area>.md`, written every turn, so a ping or a compaction
skips nothing.

1. **open**: ask what he was seeing, and play his account back in one line before digging.
2. **zoom, one layer a turn**: at most 4 highlights in plain words, each with its one-click source
   link, plus one named next step, never the whole tree; he says where to go deeper.
3. **his guess**: before the issue list, he names his own suspicion in one line, or skips.
4. **the issue list, by turn 4** (a target: still unclear at 4 → say so, he picks one more layer): each issue is the fact, a file:line link, the effect in
   plain words and one proposed fix; his guess sits beside my findings.
5. **the decision round**: one `mattpocock-skills:grilling` round on the fixes; tech choices that
   matter are asked too, the rest i make myself and name in one line he can steer.
6. **fix in place first** (dima, o55: «when I want to interfere, it means something is really off. we
   should go and fix it instead of folding into a ticket and postponing»): only the fixes he picked,
   the same session; no fix outside the round. a lane or a ticket only when a fix is too big for now's
   time or capacity, on his word.

done: every picked fix landed or ticketed, and one line names what changed for him.

## 4. the voice, in every mode

- plain words first; the tech lives in a linked scratch file and reaches the chat on «show me the tech»
- light emojis, dense ones where they fit (`x:top-seven` style), clean; never an essay, never «approve all?»

## 5. the routes — 2–3 orbit asks

wider, deeper, what changed — each an orbit ask whose pick names where it goes («deeper: how a recipe
run's lanes fan out»); his tick takes the route, an unticked one dies with the turn. matt's `teach`
(by path: `~/.claude/plugins/marketplaces/mattpocock/skills/productivity/teach/SKILL.md`) is a route
only when an area deserves real study. then write today into the stamps file (jq never writes in place):

```bash
f=~/.local/state/clio/dima-intervenes.json; mkdir -p "${f%/*}"; [ -s "$f" ] || echo '{}' > "$f"
jq --arg a '<area>' --arg d "$(date +%F)" '.[$a]=$d' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
```

done: the asks are in orbit and the stamp is today.

## on my own

the tell is concrete: his words contradict what the area's file says now. then one line offers a
recall of that area — «🧭 that part changed on 10-14, catch up?» — at most once per area per
session, never an unasked lesson.
