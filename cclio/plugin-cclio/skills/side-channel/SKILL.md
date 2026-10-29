---
name: side-channel
description: load when dima asks for a side channel — «side channel», «fresh side channel», «forked side channel», «open a side channel» — at any time, in a boot prompt too.
---

# side-channel — a second cclio beside the main thread

a side channel takes dima's side questions, research and fixes, so the main thread stays on the mainline. the fork-guard banner gives it its role at start, whichever door it came through; this skill only opens the door.

## the doors

- **fresh**, the default: her memory, an empty thread, cheap
- **forked**: a copy of this thread, when the question needs what this thread knows; picked only when dima says «forked» or «fork»

## open one

1. one at a time: `mcp__ccd_session_mgmt__list_sessions`; a live session whose title holds `(side` or `(fork` means none opens, and the reply names it with its link
2. `mcp__ccd_session__start_session`, initiation `user_asked`, title `🦉 cclio (side)`:
   - fresh: context `fresh`, cwd `~/frame/cclio`, use_worktree false, prompt «greet dima in one line, then wait for his questions», background naming today's roadmap step and what he asked the channel for
   - forked: context `fork`, prompt «you are the side channel; greet dima in one line, then wait»
3. done: the result names a started session; the reply links it, `[🦉 cclio (side)](#local_<id>)`, in one line
4. while [FRM-464](https://linear.app/x-com/issue/FRM-464) is open: check the door against its `live checks` and tick its ⬜ in the body the same turn (until: FRM-464 closes, then this step goes)

its pocket items carry `side` and come back at the next boot (`cclio:boot` § 3); its closing report reaches the main by SendMessage. a fork's `worktree-fork-*` branch is merged by cclio the turn its report lands, never dropped (dima, 2026-10-29).
