# method-rule-proof — a rule carries its test, or a label

**The failure shape: a claim gets written, and nothing ever re-checks it.** A memfile has no
expiry, a CST has no verify step — without a test, a fact and a fossil are indistinguishable.

<!-- failure: three cases from one boot: a CST said a ticket needed nothing (Dima's comment sat on it a day); the same CST called a live codie stoppable; a reasoned no-assign rule in `x:cmt` stood for weeks while false -->

## rules

**When writing a rule that asserts behaviour, state the one command that proves it** — on the
line, not a date:

    ✅ background sessions survive a coordinator reset — `kill -0 <pid>` after the reset
    ❌ background sessions survive a coordinator reset

**Test a rule before writing it.** A rule no command can prove carries `inference:` in its own
text, so a reader can tell it from a fact.

🚫 Never sweep existing rules to add commands — that fabricates tests nobody ran. Add the line
when a rule is touched anyway.

🎯 **A probe of a door names a target KNOWN to work through that door first.** No positive control, no verdict.

<!-- failure: `raycast://confetti` was a disabled command and «no confetti» read as a dead url scheme; a reinstall later the app's log said `No enabled command` (2026-09-16, second sighting) -->

🎯 **An irreversible plan reads its gates before it promises a time**: `gh api …/branches/main/protection` is one call.

<!-- failure: the history purge was priced at «~15 min» and met branch protection at the push (2026-10-07) -->

🎯 **A restart is proven by evidence stamped AFTER the process start, compared as numbers**: `stat` the process start, parse the evidence timestamp, compare.

<!-- failure: codie read five chords from the log tail and called a rebuild verified; every one was stamped before the restart (2026-09-19) -->

🎯 **A check that encodes a rule is proven red and green on every branch of that rule**: name what else the claim covers,
run one probe there, then write «proven».

<!-- failure: the essentials cursor check passed on sliders and failed on the guide's own `zoom-in`; a jotai bump passed its typecheck and broke the bundled build (2026-09-26) -->

🎯 **The command must exercise the thing claimed.** A probe measures the path it runs, not the
concept it is named after: `cat` via Bash and the `Read` tool are different events to the harness,
and only one fires a scoped rule. A null result is a claim about your instrument first
([[method-report-verify]]).
