---
fed-by: incidents
when:
  - { kind: basename, value: lefthook.yaml }
  - { kind: basename, value: index-run.sh }
---

# ⛩️ gates catalog — every gate in the fleet, in plain words

Ticket: FRM-530. A ⛩️ gate is a check that refuses: it stops a commit, a push, a merge, a summon or a turn. A check that only warns is a nudge, not a gate. This page is the one list: a new gate gets its line here in the same commit that adds it, a renamed gate is renamed here first, and a gate removed everywhere leaves this page too.

## core

- a commit waits for its slowest gate, since they run side by side: a 0.27 s memory-lint red still waits for a 32 s test run
- the costly gates are the tests: the push twin, the commit tests and the mods tests are about 1 h 33 min a day of wall time on this mac (11-07 → 11-09); every other gate takes a few seconds
- times below: p50 seconds from `~/.local/state/x/gate-steps.log`, 11-06 → 11-09, where measured

## frame — when you commit, the files

- **format**: the staged code is tidy (biome), 2 s
- **typecheck**: the code's types fit together, 2 s
- **test**: the tests for what changed still pass; none for a pocket-only commit, 28 s
- **x-go-reads**: a script the go tests read still passes them
- **mods**: a changed mod's types fit our cc version, 13 s
- **mods-test**: a changed mod's tests pass, on the commit only, 102 s before its skip
- **fleet-hazards**: a new hazard note names what guards it
- **memory-lint**: memory files stay within their size, 2 s
- **git-crypt-rename**: a moved secret file stays encrypted, 2 s
- **chords-essentials**, **speak-essentials**: those two apps keep their required parts

## frame — when you commit, the message

- **commit-msg-lint**: the message has our format
- **lane-gate**: a product change comes with its docs (`x lane gate`)
- **no-ci-skip-marker**: the message can't turn ci off by accident
- **session-trailer**, **agent-trailer**: not gates, listed so the siesta's gates drift check finds every hook; they strip the session trailer and stamp the `Agent:` one, never refusing

## frame — when you push

- **runner-twin**: the tests pass on a clean machine, not only on this mac, 43 s
- **mirror**: the dotfile links still work

## frame — on github

- **check + typecheck + test**: the same checks, on ci; required
- **Test x**: the cli's go tests, on ci; required; it holds the memory check that no retired command is named, off the commit since 2026-11-09
- **review-round**: the ci reviewer read the pr

## bytes — when you commit

- **format**: the staged code is tidy (biome)
- **package-json-shape**: a manifest keeps our shape
- **apps-essentials**: an app keeps its required parts

## bytes — the message and the push

- **lane-gate**, **no-ci-skip-marker**: as in frame
- **typecheck-changed**: the changed apps' types fit, at push

## bytes — on github

- **lint + typecheck + test + build**: the checks and the build, on ci; required
- **apps essentials**: every app keeps its required parts; required
- **skip-marker**: no commit turned ci off; required
- **financial**: the money app's own checks
- **vercel-install**: the deploy's install still works
- **review-round**: the ci reviewer read the pr
- **deploy**, **preview**: the app deploys, and a pr gets its preview

## every pr, both repos

- **sixth sense**: our verifier says the work is clean
- **merge-auto**: all of the above hold, then it merges (`x lane merge-auto`)
- **landed**: the after-merge chores are done (`x lane landed`)

## run by hand

- **x-go:gate**: all the cli's checks at once
- **x verify red**: a new test really can fail
- **brief check**, **brief summon**, **brief preflight**: a brief and a spec are right before a lane starts
- **lane dispatch**: a chunk carries dima's sign
- **pocket-check**, **wish-cover**, **prompt-groom**: none of dima's words got lost

## in a session

- **x-mod-guard**: risky commands are refused
- **x-mod-holds**: one writer per file
- **siesta-gate**: a 🌤️ siesta that's due gets done
