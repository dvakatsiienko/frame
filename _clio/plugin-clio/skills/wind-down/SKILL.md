---
description: load when dima says «wind-down», «wind down», «in 2–3 h we finish», «gradually stop everyone», «finish everything for today» — main clio only, the day's lanes landed and parked inside the window he names.
---

# /clio:wind-down — the day's lanes land and park inside his window

his want (PK-363:W1124–W1130, 2026-11-11): he names a window («up to 3 h»); every lane finishes and lands what it is on, then parks; the estimate comes from the day's real cadence, never from inference; only his word stops a lane. main clio runs it; a wing estimates its own lanes and follows main's plan.

## the steps

0. **the window**: his number, every time; none in his words → one orbit ask «wind-down window: how long?», nothing starts before it
1. **the roster**: `ListAgents` and every live 🛼 glide; per lane: its current chunk and the steps that chunk has left (its lane plan)
2. **the cadence, measured**: per lane, its own landed steps with their commit times (`git log --format='%h %ad %s'` over the lane's paths, or its lane plan's ticked steps with their shas), the newest hour first: its median minutes a step; a lane with under 3 steps in that hour takes the day's median (round 1, 11-12: day medians, swollen by review waits and a dirty pr, ran 30–90 min long)
3. **the wings estimate too**: one `SendMessage` to each wing that runs a lane: «wind-down: estimate your lanes — steps left, your minutes a step from today's commits, the finish HH:MM». the lane's estimate is the median of the wing's number and mine
4. **the estimate, printed**: one short line per lane in the thread — `<lane> — <n> steps left × <m> min (today: <k> steps, median <m>) → done ~HH:MM`; a number without its source never prints
5. **the briefs**: each lane member gets «wind-down: finish your current chunk, land it fully, then park with a handoff for what is left; never stop»; a lane whose estimate leaves room for its next chunk inside the window takes it, else it parks after landing; while another lane still runs, a lane that finishes a slice takes the next one instead of parking (slice mode, PK-363:W1153 «you can send herdr codie another slice, so he is not parked for free»), an unsigned next slice going to dima as a sign ask the turn it parks; a slice-mode slice is low-risk (a wisp, a test, a look), a guard, sign or merge change lands only after its sixth sense round (round 1: a late heredoc fix opened a forged clean); a feature that needs his hands lands behind a switch until he tries it; a current chunk is never cut, and one running past the window reaches dima as one line with its numbers
6. **the check-ins**: at the window's half and 30 min before its end, one line per lane — on track or behind, re-estimated from the newest commits
7. **the end**: each parked member's handoff is read against the night's decisions (ticks, reverts, re-signs) and rewritten through `x handoff write --replaces` where it misses one; then each parked lane gets its own `⚠️ stop <member>` orbit ask; his tick is the only stop. then one orbit ask for the halt, which runs with him only, after the day's tails and the next day's prep
8. **the log**: per lane, estimate vs real finish, one line in `docs/test-drive/wind-down.md` (the done test: every lane landed or parked inside his window)

## never

- a park or a stop decided by the estimate alone (his W1127: off estimates stopped lanes too early)
- a lane stopped before his tick
- a wing running its own wind-down: main runs one, the wings follow it
