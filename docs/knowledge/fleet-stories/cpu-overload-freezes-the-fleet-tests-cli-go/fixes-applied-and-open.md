---
fed-by: incidents
---

# fixes applied and open — the cpu story's verdicts in one page, 2026-11-24

the three researches, distilled to what we picked. each line names where it was read; a line marked «main, 24 Nov» is main clio's status of that day, not re-read here.

## the verdicts

- [ways to more fast lanes](research/ways-to-more-fast-lanes/verdict.md): no git beats a custom minimal build, and a git start is no longer the big cost; the largest door left is running fewer heavy suites
- [why git starts cost so much](research/why-git-starts-cost-so-much/verdict.md): no single trick frees the mac; `LANG` and a slim git paid, the rest is what the fixtures make git do and `x` running as a real child
- [why agents saturate the mac](research/why-agents-saturate-the-mac/verdict.md): the cause of the sys time is unproven, and no public source measures it
- [go tests in a linux vm](research/go-tests-in-a-linux-vm/rounds.md): the go suite costs about 3× less cpu there, vitest wins nothing

## applied

- `LANG` set for agent shells: a git start 1.7× cheaper, the go suite −13 % cpu (story, 2026-11-07)
- a slim git (`script/git-slim.sh`, FRM-532): the go suite −16 to −19 % cpu against brew's (git verdict, «measured after the lanes»)
- the go fixture cut (FRM-528, frame#147): the go suite 385.9 → 307.8 cpu-s (story, 2026-11-07 18:34)
- a commit runs related tests or none, never the whole suite (FRM-534, FRM-557; lanes verdict, rank 2)
- results keyed by byte hash, step 1 (FRM-533; lanes verdict, rank 1)
- the `nostacks` pass runs on ci only; `GOGC=off` for `x`'s start (FRM-535; lanes verdict, ranks 5 and 8)
- one heavy run at a time: the gate owns its turn, `script/gate-queue.sh` (pr 132; main, 24 Nov)
- finder's «calculate all sizes» off; `core.bare` guarded, the gates drop git's location vars (story, 2026-11-07)
- mods tests run only what a change reaches, pure logic off the host, a cpu cap per suite (FRM-678, FRM-688; [the mods story](../cpu-overload-freezes-the-fleet-tests-cc-mods/story.md), 23 Nov); FRM-678 built, not closed

## in a lane now

- the queue rider on the mods lane: a lane's whole run goes first, a batch gives the turn back between groups (main, 24 Nov; no ticket of its own yet)

## open, in no lane

- FRM-551: go tests in the linux vm, built 1 of 6 steps, one calm rerun owed by 27 Nov (main, 24 Nov)
- FRM-652: `x/go` split into packages, unsigned (main, 24 Nov)
- FRM-537: the perf probes menu, his «later»
- FRM-525: name what burns the kernel time, the sudo read first, his «after herdr and speak v2»
- a remote linux box, the one door that adds cores: never measured (lanes verdict, rank 4)

## dropped

- «fewer threads»: his 7 Nov word, not a solution (main, 24 Nov)
- ruled out as the main cost: memory, fseventsd, 1password, gatekeeper, edr, otel, an idle claude spin, fsmonitor (story, 2026-11-07)
- `LC_ALL=C` over `LANG`: no steady gain (git verdict, «dead ends»)
- swapping go's spawn for `posix_spawn`: about 6 % over the whole suite, 2 tests broke (git verdict)
- vitest threads or no isolation: forks stay (lanes verdict, rank 11)
