---
name: wing
description: load when dima asks for a wing — «wing», «second wing», «side channel», «fresh side channel», «forked side channel», «open a side channel» — at any time, in a boot prompt too.
---

# wing — a 🪽 wing, a second clio beside the main thread

a wing (dima's name, 2026-11-06, was «side channel») takes dima's side questions, research, fixes, chores, plans and grills, so the main stays on its lanes. the fork-guard banner gives it its role and closing rules; this skill opens the door and draws the split.

## the split, until tilde decides

- main keeps: dispatch, merges, watches, a grill or body write on a running lane's ticket, the boot's inbox parse and its prompt groom
- the wing takes the rest; main hands a chore or grill to it the turn it lands, with one line to dima naming it
- 🐦‍⬛ crow reads only main's thread, so the wing's grills go unwatched; a plan goes through `pnpm crow:plan-critique <file>`
- a heavy run (a gate, a commit, a push, mutants) takes the machine-wide turn: `~/frame/script/gate-queue.sh <command…>`, in the background

## the doors

- **fresh**, the default: her memory, an empty thread, cheap
- **forked**: a copy of this thread, when the question needs what this thread knows; picked only when dima says «forked» or «fork»

## open one

1. several may run (dima, 2026-11-06): `mcp__ccd_session_mgmt__list_sessions`; the new one takes the lowest number no live wing holds, an old `🦉 clio (side)` counting as 1
2. `mcp__ccd_session__start_session`, initiation `user_asked`, title `🦉🪽 clio: wing <N>`:
   - fresh: context `fresh`, cwd `~/frame/_clio`, use_worktree false, prompt «greet dima in one line; write your day plan, then work it with him», background naming today's roadmap step, the day's chores and what he asked the wing for
   - forked: context `fork`, prompt «you are a wing; greet dima in one line; write your day plan, then work it with him»
3. done: the result names a started session; the reply links it, `[its title](#local_<id>)`, in one line

## the day plan

the wing's durable plan is one pocket item he can read, so it survives a second wind:
- first act: `node script/pocket-add.ts "day plan MM-DD: wing <N>" --priority next --top --wing <N>`, then one `--ac` per line through `backlog task edit`, in his order
- a finished line: `backlog task edit <id> --check-ac <n>`, that turn; a new line: `--ac`
- `clio:halt` closes it with the other day plans

## after it

**`wing-<N>` is the one wing label, on a pocket item and a linear ticket alike** (dima, 2026-11-06): on, the work is that wing's and the others leave it alone; a wing takes it off when it hands the work back. a pocket item is born with `pocket-add --wing <N>`; a ticket takes `x linear set FRM-M --add-label wing-<N>` at the first write. a wing lists its own at its start (`backlog task list --labels wing-<N> --plain`), closes them on its fork branch, and with no live wing <N> they wait. a wing lands its own `worktree-fork-*` branch, the banner holds the steps (dima, 2026-11-06: «do it now and merge yourself»); clio merges what it leaves unlanded by the halt, never dropped (dima, 2026-10-29).