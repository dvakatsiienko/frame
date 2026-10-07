---
dies-when: FRM-287's verdict — the adviser lands in x:shape-idea (this log becomes its evidence) or is dropped
---

# plan adviser — three critics on one build plan

Ticket: [FRM-287](https://linear.app/x-com/issue/FRM-287)

## round 1 — 2026-10-01 · the speak build plan v1 (3 tickets: pill → admin → stats)

arms, same plan, same day:
- **blind** — `advise-project-approach`, opus, saw the problem only (no plan, no repo) · ~138k tokens · 81 s · ~$1.5 (est.)
- **opus 5.5 high + the template** — saw the plan + the repo · $1.86 · 3.2 min · verdict revise
- **fable 5.1 high + the template** — the same · $4.60 · 5.5 min · verdict revise

what each found (✓ = found it):
- the lit word covers a sliver of reads — kokoro reads 81 % (1,663 of 2,055 first-audio lines), the timing engines ~8 %: fable ✓ (blocker) · opus ✓ (blocker, + elevenlabs has 3 credits left) · blind ✓ (word highlight last, per engine)
- the live daemon has no dev channel or rollback in a pr lane: fable ✓ (blocker, the plist runs the main checkout's ignored `bin/`) · opus ✓ (a dev daemon) · blind ✓ (rollback gated on a fresh `ok` record)
- tickets 2 and 3 share `speak/src` and the daemon: fable ✓ · opus ✓ · blind — (cut differently)
- the exit lines cover ~12 of 25 boards: fable ✓ · opus ✓ · blind ✓ («matches its board» needs fixtures + snapshots)
- **fable only**: the popover's number box vs a borderless non-activating panel (typing needs key status, which steals the app in front's keyboard) · `server.ts` has no Origin / Host check before a key route and a restart route land · «volume 72» has no defined meaning or store · `words` ≠ words heard on stopped reads · the meter's redraw budget
- **opus only**: the stats-cut board shows real text samples, which the plan's «counts and kinds only» forbids · a char-proportional timing fallback for every engine
- **blind only**: the per-read record doubles as the post-relaunch health check (a fresh `ok` line, else swap back) · Kokoro-FastAPI's `/dev/captioned_speech` may already return word timings (unchecked against our server)

read: all three agree on the 4 big findings, so a cheap arm would have caught the cut's main flaws. fable's extra finds are real and specific (a security gap, a panel-focus conflict) at 2.5× opus's cost; the blind arm's two ideas are the cheapest-per-insight. one round is an anecdote — next shape repeats it.
