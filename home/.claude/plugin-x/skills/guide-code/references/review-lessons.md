# review lessons: state, time and events

the mistakes a whole-codebase review found in code written fast, live, by agents (the herdr mods, 2026-11-13: three readers, one root). they apply to any code that holds state, waits on time or reads events. read before writing any of those.

## state

- **one owner per fact.** a fact the user sees (is this ticked, did this pick apply, was this sent) lives in one record that every reader asks; three stores merged by a priority rule drift, and each patch adds a fourth
- **per-item state is keyed by the item.** data about one thread, row or box sits in a `Map` keyed by its id, never one field for all of them: one slot shared by every box swallowed the second box's key
- **a rule written twice is a bug waiting.** a lookup or a check repeated at four call sites goes through one function; copies across modules carry a «twin of» line and a test that reds when they part
- **an action checks the state it can break.** a send waits on or refuses during an open pick for the same target, the way a pick refuses a pick in flight

## time

- **settle on an answer, never on a timeout.** a mark that clears after N seconds reads to the user as a flip-back or a stuck state; it clears when the system answers, and a timeout, if kept, shows itself as one
- **no timer to reorder events.** a 1 ms wait so one event «has landed» guesses at an order the platform never promised; read the order the platform gives, or carry both events in one record
- **a timing window has a fake-clock test.** each threshold (a tap vs a hold, a repeat burst) gets a test row per hostile order, written red first; a window with no row is the next live patch
- **a threshold sits below the slowest real input.** a hold that starts at 100 ms turned a normal 130 ms Enter into nothing; measure the human input before picking the number
- **one gesture, one detector.** two hand-rolled «tap or held» detectors for the same keys drift apart; one pure `keyPress(state, event, now)` serves both

## events and reloads

- **concurrent reloads are ordered.** several watchers and a timer each starting a reload means the slowest one wins; one reload runs at a time, or each carries a sequence and older results drop
- **a new row reads its real state before it draws.** a row born empty and filled by the next poll shows the wrong state for one poll
- **a press in flight is not started twice.** a second press while the first take-back still runs joins it or is refused

## errors and tests

- **a swallowed catch names why.** a bare `catch {}` on a read of a state file turns a broken read into a quiet wrong state; one wrapper logs it, and only optional reads stay silent
- **a test fails on the old code.** a test that stays green with the fix reverted is hollow; the tell is calling the code twice with one input and comparing the results. prove it with `x verify red`
- **a rule lives where a test can load it.** logic buried in a file the tests cannot import (a framework class) has no red; move it into a pure helper the test reaches

## mod-only traps

- a helper green in vitest can lack a herdr global (`TextEncoder`): after a landing, shoot a view that ran it (`home/.config/herdr-app/mods/AGENTS.md` § hazards)
- a mod imports nothing outside its folder, so a shared rule is a twin copy: that makes the «twin of» line and its test above mandatory
