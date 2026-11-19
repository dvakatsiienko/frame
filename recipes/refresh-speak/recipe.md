---
kind: refresh
owner: coordinator
artifacts:
  - speak/docs/readaloud-playbook.md
  - speak/PRODUCT.md
  - schedule/jobs/x-speak/
  - speak/
script: none
was: [refresh-read-aloud]
---

# refresh-speak

Keeps `speak` — dima's read-aloud, his door to 95 % of what he reads on screen — built on the best voices, models, practices and techniques. Born from [FRM-269](https://linear.app/x-com/issue/FRM-269) (2026-09-29).

## the want

dima's, 2026-11-19 (PK-457):

> read-aloud is my main door to the data on my screen: i read 95 % of the text on screen, on all surfaces, through read-aloud.

> we move to the speak app. to build it we prep data first … knowledge, so we build a great read-aloud app.

> what do we want to know to build the best possible read-aloud solution? wispr or superwhisper grade level?

> we can start from the current model, a locally run app only, but in the future i want it to work on remote hosts too … so i can release this app, stick «buy me a coffee» on it and have some income from it

> i really like kokoro. it is incredibly good for a fully free read-aloud … siri is solid though (only one certain voice), kokoro is still better.

> during kokoro updates, ensure its voices survive, my favourites especially, and most importantly af_heart … note: fish's sarah is also nice, i like it.

his standing calls, 2026-11-19:
- the want is the knowledge to build the best read-aloud for someone who reads 95 % of the screen by ear: mac and local now, a released app later (grill 1, o1)
- speak v2 is built as planned; the distributable app is phase 2, [FRM-668](https://linear.app/x-com/issue/FRM-668), researched now, built later (o2)
- the name stays `refresh-speak`; it becomes `refresh-readaloud` once the area grows bigger (17:02)

dima's, 2026-09-29:

> do an extensive research of current best readaloud tools that would gracefully replace siri … must have generous free tier or maybe kokoro settle

> use best tool e.g. elevenlabs for readaloud · if out of quota - silently use a fallback … tricky part is readaloud/stop, floating controls are nice to have

> readaloud works +- fine with siri voice 4, but siri stumbles when reading ids, numbers, tech texts, and reads punctuations not well

> make it lightning fast! … system readaloud have slight .1s delay before speaking. i feel that
> with those fallbacks the latency also be present. make it fast.

> i prefer female voices … readaloud does not reads emojis

> whenever i would ask you to refresh a read-aloud feature, you would go fetch the latest
> techniques, models, best practices, and tools, and suggest a text-to-speech overhaul

## the run

- the bar is wispr-grade on four axes — time to first audio, voice quality, tech-text handling, follow-along — measured against the best read-aloud apps (grill 1, o3)
- no kokoro engine or model change lands without the voice safety rule in the playbook (grill 1, o4)
- suggest a run when: a speak v2 lane is about to start, a free tier ends (fish: 2026-11-30), or kokoro's model moves upstream

1. **groom**: `clio:shape-recipe` step 0. done: his «run it». (open)
2. **research**: `clio:shape-recipe` step 1, plus a probe lane that makes real calls for first-audio ms and quality on any new engine. done: every lane landed or failed out loud. (script)
3. **kokoro's delta**: the engine's version and the model's revision against upstream, what changed for the voices. done: the delta named, or «unchanged». (script)
4. **booth**: a new voice or model that contends gets a blind round, af_heart and fish's sarah as the references. done: his ratings, or «no contender». (template)
5. **distill**: `clio:shape-recipe` step 2 into the artifacts below. done: each artifact touched or named «unchanged». (open)
6. **print and log**: `clio:shape-recipe` steps 3–4, the proposal for speak v2 inside the print. done: printed, `log.md` has today's line. (template)

## vectors

### research

1. building it well — best practices and guides for a solid text-to-speech app, mac first, working everywhere (dima)
2. the state of the art — the best free models, or a generous free tier that lasts the whole month; the TTS leaderboards (dima)
3. running it efficiently — does a launchd daemon plus a warm local server still hold; what the best apps do (dima)
4. kokoro and its alternatives — kokoro's news since 2026-09-29, other local engines on Apple Silicon, uk and ru (dima)
5. the bar apps — ElevenReader, Speechify, NaturalReader, macOS Spoken Content: their features and how they score on the four axes
6. the grab — getting text from any surface: accessibility ranges, the selection, ocr for images and pdfs
7. long-form controls — skip, rewind, speed, resume, a position kept across reads
8. tech text — ids, versions, units, code: engines that read them natively, normalizer libraries, a small llm rewrite pass
9. latency — streaming sentence by sentence, first-audio numbers, warm-connection tricks
10. following along — the spoken word highlighted, word timings from engines or forced alignment, where each breaks
11. shipping and earning — how such apps ship and earn: native swift, tauri, electron, remote hosts, donations (feeds [FRM-668](https://linear.app/x-com/issue/FRM-668))

### analysis

- the daemon log (`~/.local/share/x-speak/daemon.err.log`): real press → first audio per engine, fallthrough counts
- elevenlabs characters used per month against its free credits
- dima's own tuning in `schedule/jobs/x-speak/config.json` (the chain, the favourites) — his taste since the last run

## artifacts

- `speak/docs/readaloud-playbook.md` — the build knowledge; clever-merged, every line holding a source
- `speak/PRODUCT.md` — the engines, models and free tiers; a fact the run proved stale is replaced
- `schedule/jobs/x-speak/` — the daemon, `config.json` and the golden normalizer cases; changed only by a codie on dima's pick
- `speak/` — the voice admin app; its voice lists follow a model change

## findings

- a speak v2 proposal — what the four axes say about speak today, the engines to add or drop, the build practices v2 adopts; noop is a valid outcome
- checklist: kokoro's delta named · the voice safety rule held · af_heart still the default · each claim sourced or «?»
