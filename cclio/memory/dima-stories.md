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

## «a run skill would pick up run-atelier and hang» · 2026-09-27
The built-in `run` and the generated `run-<app>` skills had just been adopted, and `run-atelier` said «leave the server running» so dima could watch a coder's tree. He asked: «if a built-in run skill is designed to only do a sanity check … then a skill like run-atelier would interfere with it … or am I getting something wrong?» He was right: `run` defers to any project skill whose description says it launches the app, so every sanity pass would have left a server behind — the same shape as the orphan vite a coder had left on `:5173` the day before. The fix split the two jobs: `run-<app>` stays neutral (start, drive, stop) and the keep-alive moved into the coder's contract. His felt sense read the two skills as one system before either of us had run them together. → `crew-coder`, `run-atelier`, `run-chords`

## «you closed the pr, not merged it» · 2026-09-28
The auto-archive probe had closed its pr and watched the card stay; my verdict went out as «auto-archive does nothing for our sessions». He read it and said the close was a different event from a merge — it might archive on merge alone. The merge round kept the verdict for our `--bg` and `--cloud` sessions, and then his own two desktop-made probes showed the real line: a desktop-made local session is archived and stopped at its merge. His question split one event I had treated as two into the two it was, and the second probe he set up found the case my first one could not reach. → `craft-spawning`, the auto-archive line

## «you were still asking me confirmation questions» · 2026-09-28
He wrote the trophy-sys plan with me, said «start shift» and went to cook. I kept sending him ⏳ blocks between his steps at the stove, and he answered them. After dinner he named it: «you have memories that instruct you to use a turn-based approach … when paired with a shift, the boundary is blurry, so you try to do both.» No rule was broken; every habit was right for a lane and wrong for a shift. His felt sense saw two modes where I ran one with exceptions, and the first night shift needed exactly that line. → `cclio:shift`, the ⏳ exception in `fleet-output-format`

## «make it lightning fast» · 2026-09-29
speak worked end to end on node: raycast → a script → op-run for the keys → ffplay, with a clean engine fallback. he listened and said: «system readaloud have slight .1s delay before speaking. i feel that with those fallbacks the latency also be present. make it fast.» no profiler, only the feel of F4 beside ours. the coder timed each stage: op-run 800 ms per press, a player spawn 250–360 ms, `say` 280 ms — over a second before any synthesis, against F4's already-running speech engine. the whole node design went; one resident swift daemon took its place, and his first F5 heard Sarah at 401 ms, warm ones at 189. his felt sense named the architecture before anyone measured it. → `schedule/jobs/x-speak`, the latency line in `craft-spawning`
