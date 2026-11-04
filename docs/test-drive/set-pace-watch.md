---
status: live
until: 2026-11-18
dies-when: the verdict line below is written
---

# set-pace-watch — the mod tells clio when the 5h window crosses a ladder line

Ticket: FRM-500

**test card:** we believe the pace watch catches every ladder crossing between clio's turns, so the window stops running past the park line unseen, and the habit reads can go · we test it by running it on in clio's session all day and in every shift · we measure per window: lines fired, each line's rung against the meter at that minute, minutes from crossing to clio's line, how far over pace the window went, and any crossing with no line · we're right if every crossing in 2 weeks gets its line within 2 min, none fires falsely, and no parked window passes +10
**kill rule:** a false park that stops a lane twice, or a line that burns turns while nothing crossed

## stress list
- park at +5 — a normal busy window — the line's numbers against the meter
- park at 90 % with more than 1 h left — a heavy morning — fired or not, minutes to it
- resume at ≤ 0 — a park with more than 1 h left — fired from a stale meter, minutes after crossing
- burn at ≤ 1 h left — any window that ends parked — fired, and that it outranks park
- no new chunk at 70–80 % — a window never parked — fired once
- the ⏰ turn-on — a shift's start and end — ⏰ on with no click, restored after
- a parked fleet overnight — a shift — resumes after the reset with the waker, no park in the first 10 %
- the 🔋 button and the default on for clio — once built — one click flips the key, a new clio session starts on

## rounds
- 2026-11-04 13:00 · first real on, this session, the fleet parked by hand at 12:55 at +7 · one line within a minute of the switch: «+5 over pace — park», 83 % used, +6, 1h 10m left; no meter read beside it, so the match is an inference · no crossing measured: it was already over, and it arrived as hook context in a busy turn
- 2026-11-04 13:09 · burn branch, dima's staged test: everyone parked, the mod left to wake me · one line, unprompted, from idle: «≤ 1 h left — burn», 89 % used, +9, 1h 0m left; it outranked the standing park, rung changed once · the usual door would have been a turn he or a hook started, so a win

at adopt: propose cutting the window reads from `habit-ctx-load-balancing` (dima's question, 2026-11-04)

## verdict
