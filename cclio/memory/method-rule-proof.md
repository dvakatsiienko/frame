# method-rule-proof — a rule carries its test, or a label

**The failure shape: a claim gets written, and nothing ever re-checks it.** A memfile has no
expiry, a CST has no verify step — without a test, a fact and a fossil are indistinguishable.
Three cases from one boot: a CST said a ticket needed nothing (Dima's comment sat on it for a
day); the same CST called a live coder stoppable; a reasoned no-assign rule in `x:cmt` stood for
weeks while false.

## rules

**When writing a rule that asserts behaviour, state the one command that proves it** — on the
line, not a date:

    ✅ background sessions survive a coordinator reset — `kill -0 <pid>` after the reset
    ❌ background sessions survive a coordinator reset

**A rule with no such command is an inference and says so in its own text.** Test it, then write
it — «inferred» as a label does not help; a rule reads as a rule regardless.

🚫 Never sweep existing rules to add commands — that fabricates tests nobody ran. Add the line
when a rule is touched anyway.

🎯 **A probe of a door names a target KNOWN to work through that door first.** `raycast://confetti`
was a disabled command and «no confetti» read as a dead url scheme — a reinstall later, the app's own
log said `No enabled command` (2026-09-16, second sighting of the shape). No positive control, no verdict.

🎯 **A restart is proven by evidence stamped AFTER the process start, compared as numbers** — a coder read five chords from the log tail and called a rebuild verified; every one was stamped before the restart (2026-09-19). `stat` the process start, parse the evidence timestamp, compare.

🎯 **A check that encodes a rule is proven red and green on every branch of that rule** — the
essentials cursor check passed on sliders and failed on the guide's own `zoom-in`; a jotai bump
passed its typecheck and broke the bundled build (2026-09-26). name what else the claim covers,
run one probe there, then write «proven».

🎯 **The command must exercise the thing claimed.** A probe measures the path it runs, not the
concept it is named after: `cat` via Bash and the `Read` tool are different events to the harness,
and only one fires a scoped rule. A null result is a claim about your instrument first
([[method-report-verify]]).

## CSTs

**A CST's live-state claims are candidates, verified before use** — tickets by query, sessions by
pid, files by `ls`. Lives in `CST-SPEC.md`; costs ~three shell calls.

Related: [[method-report-verify]], [[craft-spawning]], [[method-silent-failures]]
