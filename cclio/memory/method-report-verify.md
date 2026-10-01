# method-report-verify — a report is a candidate, reading is the verification

**Dima's lived observation outranks a literature result** — if they conflict, the *question*
differs; locate the difference before writing a verdict. **An agent-sourced claim is written
attributed, never asserted.**

The four failure shapes, each measured here:

- 🚨 **a relayed claim needs the SOURCE OPENED, not merely checked.** A researcher said matt's
  skill «has no rung for resident cost» — false, one `grep` away («the two loads» section).
  Checking a report against your own reasoning is not verification.
- 🚨 **when your own check contradicts a report, suspect YOUR CHECK first.** A claim looked false
  because the grep pattern didn't match the text's wording. **A null result from your own tooling
  is the weakest evidence in the room** — and when a mechanism returns nothing, suspect your own
  inputs before the mechanism.
- 🚨 **the sharpest case is your OWN inference.** The auto-unassign fix was reasoned, labelled
  «inferred», written into two binding files — and falsified by the first push. The label did not
  help; [[method-rule-proof]] is the fix.
- 🚨 **name the FIELD the test observed, never the behaviour class it seemed to settle.** A
  linking test never looked at the state field; the conclusion stood one size wider for weeks.

- 🚨 **my own recall is a relay too.** a fact i remember (an api verb, a token lifetime, a
  settings value) gets its source opened before it reaches dima or a coder — the same rule as
  for a researcher's claim. 5 of 8 catches on 2026-09-05 were this shape (cron POST, `waitUntil`,
  refresh rotation, `3h` ttl, a gateway's schema); `/insights` named the pattern the same day.
  the label «verified» is earned by the probe, never by confidence.
- 🚨 **«not reproduced» is said only after the log window around the report is read** — gaps, bursts, the lines either side. two live probes answered speak's socket in ~10 ms, and `daemon.err.log` held the cause one awk away: F4 hung 6.5 min after wake, then 12 queued presses flushed in one ms (a blocked main thread). a live probe measures now; the log measured then (2026-10-01).
- 🚨 **one observation carries more than one meaning.** before reporting a run as proof of X,
  ask what else it is evidence of — the greptile skip on bytes #83 was reported as «the owner
  test works» and was also the concurrency-cancel bug, missing damage by seconds (2026-09-12).

- 🚨 **a version read off the disk is not the running process.** «cc 2.1.280 confirmed» came from `claude --version` (the binary) while this session ran 2.1.278 since the day before; the probe is `ps -o command -p <pid>` or the process start time, never the cli (2026-09-22). same shape: «1password swallows `⇧⌘L`» was a guess printed as a cause — the daemon had simply never seen a press
- 🚨 **a claim about a tool's capability names the version and the doc line it was read from.**
  «impeccable's monorepo config does not work as the docs say» stood a day; 4.3.1 discovers
  workspaces fine, the wrong thing was the readme's gitignore anchoring (2026-09-20).

Smaller, same root: a probe run while a human edits the system is not controlled — two of your own
measurements disagreeing means the environment moved · a table reads as measured whether or not it
is, tag provenance per cell or do not print it · «exhausted» describes a moment; a status
inherited from a document is always stale.

Related: [[craft-pm]], [[method-silent-failures]], [[method-rule-proof]]
