---
dies-when: the cpu overload ticket closes with its cause proven, and the findings have moved into that ticket's fix or `docs/knowledge/`
---

# mac agent cpu overload — why many agent sessions saturate this mac, and who solved it

Ticket: FRM-525

Asked 2026-11-07: exa, parallel, an opus source lane, and a local measure on this mac. The local cases live in [gate-speed/cpu-cases.md](../test-drive/gate-speed/cpu-cases.md). Raw lanes, read for depth: [mac-agent-cpu-overload/](mac-agent-cpu-overload/).

## the verdict

**The cause of the sys time on this mac is unproven.** No public source measures it either. The lanes agree on that and split on the lead: exa leans to event multiplication and hot directories, parallel refuses any verdict, the source lane leans to an idle spin in claude code, which the local measure did not reproduce in its window.

## the prior art worth keeping

- [Pelton](https://www.nathanpelton.com/content/blog/ai-workflow/claude-code-agent-team-mac-mini.htm), 2026-10-12: the same machine, M4 Pro 48 GB, many agents, load 172 when two test runs overlapped. His line: the bottleneck is how many test runs happen at once, not how many agents. Solved with a queue, a per-company cap of about 45 % of the cpu, and module-scoped tests; one change still waited about two hours. Opened
- [claude-code#107009](https://github.com/anthropics/claude-code/issues/107009), 2026-11-03, open: 14 cores, Darwin 27, idle desktop `claude` processes about one core each, mostly sys, load 60 to 70, still in 2.1.317, the build running here. Workaround: a launchd job sends SIGTERM after 10 idle minutes. Opened by the source lane
- [claude-code#104173](https://github.com/anthropics/claude-code/issues/104173), 2026-10-21: the Developer Tools exemption does not reach the Bash tool: 40 of 40 fresh binaries scanned, against 1 of 40 from a plain shell. Opened by the source lane
- [claude-code#107076](https://github.com/anthropics/claude-code/issues/107076), 2026-11-03: hiding the desktop window took WindowServer from 34.5 % to 6.3 %. Opened by the source lane
- [Cursor](https://cursor.com/blog/self-driving-codebases), 2026-02-05: hundreds of agents, on large Linux machines; the disk became the hotspot. Opened by the source lane

## the claims

- 64 local sessions running local tests on one mac: **no first-hand report found**. High counts sit on servers, big Linux VMs or remote sandboxes
- Linux beats macOS for this: **no same-suite measurement exists**, on a VM or on metal. Keep the checkout on the guest disk in any test: bind mounts cost about 3x. Linux does not cure agent-side load
- A mac mini fixes it: **no evidence**. The trend is about always-on hosts and local inference; it has the same scan path

## what to try, cheapest first

The ranked list with its proofs lives in the cases file.
