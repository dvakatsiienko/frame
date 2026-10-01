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

## «it feels off to me that it is unavailable» · 2026-09-29
he asked the speak coder to set up impeccable, and it said the plugin was inaccessible. the coder turned it on, and he came
to me with one line: «it feels off to me that it is unavailable when I need it». the day before, he had said «keep it
enabled, no toggling», and I had set it on at user scope. my own commit that evening edited frame's project settings and
left `"impeccable@impeccable": false` in them; a project value beats a user value, so every frame session ran without it
for a day. no error, no log line, only his sense that a thing he had settled was not settled. → `sys-settings-drift`,
e4c5c8b5

## «the question we covered in a grill makes the design totally different» · 2026-09-30
speak was built on a random ask the day before and never shaped. the re-shape grill took four
questions: why (he hears 90 % of his text, F4 is his most-used hotkey), what the product is (the pill and
the admin, both daily), the friction (a forgotten selection turns pause into «read this instead»), what
goes (nothing — the providers are his playground). each answer moved the design: ⇧F4 pause came out of
one question, the pill's volume and speed popovers out of another, word highlight turned from a nice-to-have
into «I follow the text while it reads». his note after it: «a grilling session before design has incredible
value … if we would not grill but just start a design randomly» — the day shape-idea became an invariant. → `x:shape-idea`, `fleet-identity`

## «why not here?» · 2026-09-30
the atelier lens ring was built from the comp and clean in the verifier's eyes. on his wide screen the art sat
letterboxed, and he circled the empty dark band above it: «why not here?». two rounds moved the pills toward the band,
and each still felt off to him; then he named it — sticking them to the art's edge «reads off … they break out of a
horizontal rhythm compared to other pills». the comp had drawn only one window shape, where the art fills the screen,
so nobody had designed the letterbox case; his eye was the spec. → «The One Frame Rule» in atelier's `DESIGN.md`, the
window-shapes question in `crew-designer-interview`

## «why? not good» · 2026-10-01
he sneaked back to the keyboard after sleep, and speak's admin said the daemon was unreachable; F4, his most-used
hotkey, had read nothing since the mac woke. I probed the socket twice, both answered in ~10 ms, and I wrote «not
reproduced». his reply: «why? not good. my most used feature is flawed». no theory, only the sense that a probe of
the present could not clear a failure of the past. the daemon's own log held it one awk away: the F4 at 01:51 hung
6.5 minutes, then twelve queued presses flushed in the same millisecond — a blocked main thread, which also starved
the control socket. his felt sense read the claim's timeframe before I did. → `method-report-verify`, the speak wake gremlin
