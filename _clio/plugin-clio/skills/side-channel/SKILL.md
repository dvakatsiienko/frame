---
name: side-channel
description: load when dima asks for a side channel — «side channel», «fresh side channel», «forked side channel», «open a side channel» — at any time, in a boot prompt too.
---

# side-channel — a second clio beside the main thread

a side channel takes dima's side questions, research, fixes, chores, plans and grills, so the main stays on its lanes. the fork-guard banner gives it its role and closing rules; this skill opens the door and draws the split.

## the split, until tilde decides

- main keeps: dispatch, merges, watches, a grill or body write on a running lane's ticket, the boot's inbox parse and its prompt groom
- the channel takes the rest; main hands a chore or grill to it the turn it lands, with one line to dima naming it
- 🐦‍⬛ crow reads only main's thread, so the channel's grills go unwatched; a plan goes through `pnpm crow:plan-critique <file>`

## the doors

- **fresh**, the default: her memory, an empty thread, cheap
- **forked**: a copy of this thread, when the question needs what this thread knows; picked only when dima says «forked» or «fork»

## open one

1. one at a time: `mcp__ccd_session_mgmt__list_sessions`; a live session whose title holds `(side` or `(fork` means none opens, and the reply names it with its link
2. `mcp__ccd_session__start_session`, initiation `user_asked`, title `🦉 clio (side)`:
   - fresh: context `fresh`, cwd `~/frame/_clio`, use_worktree false, prompt «greet dima in one line; write your day plan, then work it with him», background naming today's roadmap step, the day's chores and what he asked the channel for
   - forked: context `fork`, prompt «you are the side channel; greet dima in one line; write your day plan, then work it with him»
3. done: the result names a started session; the reply links it, `[🦉 clio (side)](#local_<id>)`, in one line

## the day plan

the channel's durable plan is one pocket item he can read, so it survives a second wind (dima, 2026-11-06, his standing word for this item's owned tag):
- first act: `node script/pocket-add.ts "day plan MM-DD: side channel" --priority next --top --side-channel-owned`, then one `--ac` per line through `backlog task edit`, in his order
- a finished line: `backlog task edit <id> --check-ac <n>`, that turn; a new line: `--ac`
- `clio:halt` closes it with the other day plans

## after it

its pocket items carry `side` and come back at the next boot (`clio:boot` § 3); an item dima wants solved here carries `side-channel-owned` (`pocket-add --side-channel-owned`, on his word only): a side channel lists them at its start (`backlog task list --labels side-channel-owned --plain`) and closes them on its fork branch; with none open they wait. a channel lands its own `worktree-fork-*` branch, the banner holds the steps (dima, 2026-11-06: «do it now and merge yourself»); clio merges what it leaves unlanded by the halt, never dropped (dima, 2026-10-29). a ticket it works carries the `side` label; clio leaves it alone.
