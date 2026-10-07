# test drive — mattpocock tdd

window: 2026-10-06 → 2026-10-20. the skill: `mattpocock-skills:tdd` (v1.3.1), red → green → refactor, one behaviour per test, test the contract not the internals.
why (dima, 2026-10-06): «it changes a coder's approach a lot» — a test drive with numbers, not a habit by default.

## how it runs

- `x:crew-coder` names it for a ticket whose exit lines are tests (how-you-work.md); every coder report says whether it loaded
- arm a vs arm b: tickets with tdd loaded vs comparable tickets without — the verifier's findings per ticket, rounds to clean, tests that were proven red, minutes

## stress list

- a bug fix with a repro test (pairs with `diagnosing-bugs`)
- a new verb in the go `x` (v1.1)
- a ui change in a bytes app (does tdd fit a component test in browser mode?)
- a refactor where the tests must stay green unchanged

## log

one line per ticket: date · ticket · tdd loaded? · verifier findings · rounds · tests proven red · minutes · note

- 2026-10-07 · [FRM-340](https://linear.app/x-com/issue/FRM-340) x telemetry · yes · 4 by round 2 (2 privacy holes in the trace — a mistyped dash word, free text in an id arg — a test seam in the binary, kinds on two preconditions) · 2+ · 17 test functions, each red first or by mutation (red-proof) · ~45 · the seams were pre-agreed by the spec, so the skill's «confirm seams» step was a no-op; three tests went green on first run because the code came first in the same slice — red-proof caught them, the loop alone would not
