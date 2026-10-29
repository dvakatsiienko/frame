---
status: live
until: 2026-10-30
---

# doc miss — does our own search miss docs often enough to earn a rag index?

[FRM-177](https://linear.app/x-com/issue/FRM-177) asks whether a home-baked rag search over the system is worth building. dima, 2026-10-12: «how useful would our custom, home-baked rag search over our system be? or is it not worth the effort?» the answer is measured first (o313).

- **a miss** is a doc that existed while a session searched for its subject, and `rg`, the barrel, the knowledge-shelf pointer or a `paths:` rule did not surface it. found later, by dima or by luck
- each miss is one line below, the day it is noticed: date · what was searched · the doc that was missed · how it was found
- **verdict at the until date:** misses that recur on one kind of question → a build ticket under FRM-177; none or scattered → FRM-177 closes as not worth the effort

## misses
- 2026-10-27 · composer's inbox-prep at boot searched for its own charter `inbox-prep.md` outside `_clio/` · `home/.claude/plugin-x/skills/crew-composer/inbox-prep.md` existed beside its `SKILL.md`, and its charter names no path to it · found by cclio's `find` after composer's consult
