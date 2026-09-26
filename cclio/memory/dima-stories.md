The rules memories say *what to do*. This one says *what happened*, so the rules keep their reasons.
Append short entries; never rewrite an old one into a rule — link to the rule instead.
Date every new entry in its heading (`· yyyy-mm-dd`); entries without a date predate 2026-08-24.
Cap ~12: at the cap, cclio drops the oldest story itself, no ask (Dima, 2026-09-12).

## why he wants the stories kept
His reason, in his words: «because of even moments like now — realizing that i do wrong thing but
my lazy tech inside only realized imprecise move.» He often *feels* a move is off before he can
name why. The stories are how the felt sense gets recovered later as a reason. So when he makes an
imprecise call and catches it himself, that is worth an entry — the catch is the signal, not the
mistake. Do not write these as corrections; write them as what happened.

## the gate rethink · 2026-09-12
He looked at a measured, working 1,300-line review gate — 20 fixture cases, every path proven red
and green on real prs — and said «somewhere from yesterday i lost track of how pr merge protection
is driven… overcomplicated». The rethink's native replacement (github approvals + thread
resolution) died on one probe: an app's approval is recorded and counts for nothing. The same
rethink found the 887 lines to delete — the answer lane, 5 of the 12 defects. The felt sense was
right about the size and wrong about the door; the fix was a probe, not a rewrite. → BYT-94

## «is shortcuts as useless as Reminders?» · 2026-09-14
Three research rounds had produced a ranked list of apple shortcuts for his profile. He read it and said all of them looked useless — the top pick would append to an inbox he keeps structured by hand — and asked a different question: is the feature itself Reminders-grade, present but not good? The fourth round, on what power users actually conclude, said keep-minimal: policy ceiling, yearly reliability bugs, worth it only for the phone's action button. The felt sense was about the category, not the list. Same day, smaller: «you will forget to disable impeccable» — right about who owns a toggle before the rule was written. → DOT-237 apple-shortcuts vector, `craft-spawning`

## the square · 2026-09-15
A blank square appeared in the menu bar after the macos 27 upgrade. Two api listings and two
inferences from me — raycast notes' toggle, then raycast's own icon — and both settings changed
nothing. He pressed `hyper+B`, watched the hidden items slide past the square, and said
«it's a bartender part». Bartender 6 on macos 27, fixed by 7 the same evening. The felt sense had
a tool and used it; the inference had an api listing and trusted it twice. → `method-report-verify`

## the subtle flicker · 2026-09-16
He switched the AW3225QF from fixed 120 Hz to variable and said: «sometimes observe a strange effect. it is
very hard to notice … the parts that have a lot of solid color in the background a bit flicker … hard to
explain verbally why it happens.» No reason, only the feel and the place it showed (a beige app
background). The research named it in one pass: QD-OLED gamma spikes at particular frame rates under
VRR, worst on flat mid-tones, apple's own page says «choose a fixed refresh rate instead». The felt
sense had the mechanism's fingerprint — solid colour, subtle, not distortion — before any of us had
the word for it. → DOT-237 session notes, fixed 120 Hz

## «it definitely 100 % worked before» · 2026-09-17
Three research rounds and my own probe said the caret language indicator could not be turned off
globally on macOS 27 without losing the Birman layouts — the pref made them vanish from the
system's list. He had no cause, only the memory that a coder had fixed it once, and he sent me
back in twice. The fix was a name-versus-id quirk: with the pref off the system renames custom
layouts, and selecting by display name works in both states. His felt sense was wrong about the
cause (the OS upgrade) and right about the thing that mattered: a global fix existed. → the
layout script commands; the method-report-verify lesson: a «no» from three rounds is still an
inference while a door stays unprobed by another name

## «should be green» · 2026-09-19
He sent one screenshot of the raycast schedule command with an arrow at a sleeping glyph on a
cloud job that had run fine an hour earlier: «should be green». The code was correct by its own
rule — 🟢 meant «executing now», 💤 meant «idle and fine» — and a scheduled job is idle almost all
its life, so no daily job could ever be green. The bug was the glance question the glyph answered:
«is it running» where he asks «did the last run go ok». One row, one arrow, and the semantic was
wrong for every job on the list. → the ✅ glyph, `toHealth` in x-ray's launchd.ts

## «will you catch up a skipped monday?» · 2026-09-20
The apps lane of evergreen was built and about to run for the first time. He asked two questions
in a row, neither about the code: «will you catch up a skipped monday» and «is the next one still
monday». Each found a gap — the lane tracked dates where it needed markers, and «due» was seven
days where it needed «a monday passed». Two real bugs before the lane ran once, found by asking
what the thing does on the day it fails, not on the day it works. → DOT-232, the apps lane

## «not a fan of overrides» · 2026-09-21
Three production builds were red after a react types bump; the fix that made them green was a
pnpm override pinning `@types/react` to one copy. He read it and said «not a fan of overrides.
how does it work and why is it needed? how to not forget to remove it?» — no argument against
the fix, only a taste. The reason arrived while answering: an override hides a dependant whose
range renovate will never lift, so the pin outlives its cause unless something reminds. The
felt sense was about the shelf life, not the mechanism. → the override reminder in `_reminders.md`

## «coder still looks like a cat» · 2026-09-23
twelve renders of a pixel coder, and after each one he said the same thing: «still looks like a cat». the palette, the helmet, the tools all changed; the verdict did not. the cause was never in the face — every take gave the head two pointed top corners, and at 16 px a silhouette with pointed corners reads «cat» before any eye or nose is seen. floppy ears hanging beside the head fixed it in one pass. his felt sense read the silhouette; i kept editing the features. → `brand/avatars/fleet/coder`, the flawlog line on species cues

## «why is foxglove so much better?» · 2026-09-25
three days of readme art, and he said the versions «were much weaker and unpolished, at least as a basis», next to an opus-made paper diorama from a test repo. his first guesses were the target (svg in a readme) and his own «mvp» framing. the answer came from reading the reference itself: no library at all, one small recipe — a seeded `trace()` that cuts every edge, two shadows a layer, a grain tile — and a one-scene prompt that named the layers, the palette and the technique. his brief had eleven asks across three repos and no technique; mine never flagged the overload. the felt sense — «this is not the level it should be» — arrived days before the reason. → `x:art-kit` illustration branch, atelier

## «dpatch retired a long ago» · 2026-09-26
A reshape fork called the `dpatch` handoff token retired. I «corrected» it: `ListAgents` showed a live `✈️ dispatch` peer, so the token stayed in my plan. He read the line and said «wait, dpatch retired a long ago. where is the tail still present?» — and he was right; the capabilities doc itself said dispatch left the fleet on 09-04. My probe measured presence, not membership: an idle account-level peer is not a fleet member. The felt sense knew the fleet's roster; the tool only knew who was online. → the dispatch purge, `method-report-verify`

## «what is this section named then?» · 2026-09-26
The atelier map had just been drafted and 28 of its lines had passed a scripted drive. He opened the studio and sent screenshots with arrows: the top half of the rail had no title while TAKES did, the selected take's ring was cut at the top, the sliders kept the plain arrow cursor, Tab stopped on the panel dividers. None of our checks looked at any of it; the map's lines were about behaviour, and all four were about how a screen reads. Every screenshot became a check or a rule the same day — the essentials scripts, the cursor set, one tab stop per widget — and the checks then found six more of the same kind on their first run. His eye was the spec the tools did not have yet. → `x:browser-headless` essentials, `habit-guide-fold`
