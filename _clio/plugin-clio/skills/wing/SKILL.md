---
name: wing
description: load when dima asks for a wing — «wing», «second wing», «side channel», «fresh side channel», «forked side channel», «open a side channel» — at any time, in a boot prompt too.
---

# wing — a 🪽 wing, clio in a second seat beside the main thread

a wing (dima's name, 2026-11-06, was «side channel») takes dima's side questions, research, fixes, chores, plans and grills, so the main stays on its lanes. the fork-guard banner gives it its role and closing rules; this skill opens the door and draws the split.

## the split

- main keeps: her own lanes' dispatch, merges and watches, a grill or body write on a running lane's ticket, the boot's inbox parse and its prompt groom
- the wing takes the rest; main hands a chore or grill to it the turn it lands, with one line to dima naming it
- 🐦‍⬛ crow reads every wing on its own clock and sends its note there; a wing still consults her by `SendMessage` on a grill or a solo call, and a plan goes through `pnpm crow:plan-critique <file>`
- every clio sees every clio lane: `node ~/frame/_clio/script/clio-lanes-radar.ts`, printed at each start and compact; asked about state, run it first
- heavy runs go in the background: `x lane commit` and `x lane push` take the machine-wide turn themselves; a long round (mutants, a suite by hand) runs through `~/frame/script/gate-queue.sh --long <command…>`

## the doors

- **fresh**, the default: her memory, an empty thread, cheap
- **forked**: a copy of this thread, when the question needs what this thread knows; picked only when dima says «forked» or «fork»

## open one

1. several may run (dima, 2026-11-06): `mcp__ccd_session_mgmt__list_sessions`; the new one takes his number, else the lowest no live wing holds
2. `mcp__ccd_session__start_session`, initiation `user_asked`, title `🦉🪽 clio: wing <N>`:
   - fresh: context `fresh`, cwd `~/frame/_clio`, use_worktree false, prompt «greet dima in one line; read your flyway, clean its finished lines, then work it with him», background naming today's roadmap step, the day's chores and what he asked the wing for
   - forked: context `fork`, prompt «you are a wing; greet dima in one line; read your flyway, clean its finished lines, then work it with him»
3. done: the result names a started session; the reply links it, `[its title](#local_<id>)`, in one line

## the flyway

a wing's plan, seat, tree and branch carry its number and outlive the session, for the next wing of that number: `habit-shared-files` § the flyway.

## after it

**`clio-wing-<N>` is the one wing label, on a pocket item and a linear ticket alike** (dima, 2026-11-06): on, the work is that wing's and the others leave it alone; a wing takes it off when it hands the work back, a ticket's at its close too; a closed item keeps it, as the groom check's record. a pocket item is born with `pocket-add --wing <N>`; a ticket takes `x linear set FRM-M --add-label clio-wing-<N>` at the first write. a wing lists its open ones at its start (`backlog task list --labels clio-wing-<N> -s open --plain`) and closes them on its fork branch; the boot lists a closed wing's for main, and a new wing taking that number takes what main has not. a wing lands its own `clio-wing-<N>` branch, the banner holds the steps (dima, 2026-11-06: «do it now and merge yourself»); clio merges what it leaves unlanded by the halt, never dropped (dima, 2026-10-29).