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

## «today was chaotic for me» · 2026-10-01
three designers drew speak at full fidelity, 25 boards each, and he reviewed all of it by hopping across canvases, hunting the spots my messages named while the boards carried three naming schemes. late in the evening he named the feeling first, «designing is a bit chaotic … because of this rough back-and-forth with scattered places», and only then the cause: «initially we planned a design flow like this, split into four phases … that phase idea got buried somewhere». the first spread had asked layout, colour, copy and states in one go, so every comment was a polish comment on everything; and the canvas lets only a human open a thread, so every question came back to him as words to search for. his felt sense read the process before the cost did ($63 on one fable session). → `x:crew-designer` four phases, ballot ([FRM-293](https://linear.app/x-com/issue/FRM-293)), `docs/research/design-review-comms.md`

## «why you were waiting for already completed and green pr?» · 2026-10-02
he had said «merge once ready», and bytes #120 sat in his browser with «All checks have passed» and a live squash button while I told him the merge waited on the ci review. my pr watch printed «green, ready to merge» once per head, and it had fired on the final head before the required `review:clean` check even existed; when the review went green on the same head, the watch stayed silent. he sent a screenshot, «looks clean to me», then asked why I was waiting at all. his eye on the page read the state my watch had stopped reading. → `pr-watch.sh` keys on github's merge state `CLEAN`, and a green-but-blocked head prints once

## «why does biome so often prevent you from committing?» · 2026-10-04
the row commit had just been refused by the biome format check, the second stumble of the night, and he asked why it keeps happening and whether a format-on-edit hook would solve it. the hook already existed: `biome-format.sh` runs after every `Edit`/`Write`. the miss was mine: bypass mode had me writing files through Bash heredocs and python replaces, which no tool hook sees — 19 biome lines across 11 flawlog files. the commit hook could not take the fix, it is banned from writing because it once lost a file; so the format moved into the commit door, `x lane commit`, on the named paths only. his felt sense counted the stumbles before any log did. → `x lane commit` 0.11.206, `x:cmt`

## «your cache will most likely be cold» · 2026-10-04
mid-session he pictured the end of a shift: he comes back to the keyboard, asks a few simple questions, and the first one re-reads a 600k thread at the 1h cache-write price. nobody had priced the return. the numbers agreed with him — a cold first ask costs about forty warm reads — and the answer split in two: a shift now ends with a report artifact and a CST so his questions go to a fresh cclio, and a keep-hot switch pings an idle session when a window runs dry before its reset. his sense of the cost arrived before any measurement of it. → `cclio:shift` 0.3.94, stash keep-hot (FRM-302)

## «then it looks useful! why park it?» · 2026-10-05
`mods:live` sat parked behind the third-need rule: a pty harness for reload and hover checks, two needs counted, build on the third. he read my one-line description and answered with his own frame: «from my understanding, this `mods:live` command is similar to a dev server for web applications». the rule had counted it as a rare check, needed when a hover bug hit; his analogy showed a dev loop every mods coder runs all day, the way vite runs for a web app. it was built that night and worked on the first probe. his felt sense saw the category before my counter did. → FRM-322, `pnpm mods:live`
