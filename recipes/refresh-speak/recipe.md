---
kind: refresh
owner: coordinator
cadence: "when dima says «refresh read-aloud», when a free tier ends (fish: 2026-11-30), or when the elevenlabs quota runs out two months in a row"
artifacts:
  - schedule/jobs/x-speak/
  - speak/
script: none
was: [refresh-read-aloud]
---

# refresh-speak

Keeps `speak` — dima's F5 read-aloud — on the best voices, models and techniques. Born from
[FRM-269](https://linear.app/x-com/issue/FRM-269) (2026-09-29).

## the want

dima's, 2026-09-29:

> do an extensive research of current best readaloud tools that would gracefully replace siri …
> must have generous free tier or maybe kokoro settle

> use best tool e.g. elevenlabs for readaloud · if out of quota - silently use a fallback …
> tricky part is readaloud/stop, floating controls are nice to have

> readaloud works +- fine with siri voice 4, but siri stumbles when reading ids, numbers, tech
> texts, and reads punctuations not well

> make it lightning fast! … system readaloud have slight .1s delay before speaking. i feel that
> with those fallbacks the latency also be present. make it fast.

> i prefer female voices … readaloud does not reads emojis

> whenever i would ask you to refresh a read-aloud feature, you would go fetch the latest
> techniques, models, best practices, and tools, and suggest a text-to-speech overhaul

## the run

1. re-groom the vectors with dima. done: his word on the list. (open)
2. spawn the lanes: exa agent · parallel core · an opus lane that probes (real API calls for first-byte and quality); probe any new engine for real (a key, one call, first-byte ms). done: every lane returned or marked failed. (script)
3. if a new voice is a contender: render a blind booth round, dima rates. a quality change is proven by a blind listening booth (the 2026-09-29 booth artifact is the
   template: same text into every engine, loudness-matched, letters shuffled, rated 1–5, decoded after). done: his ratings, or «no contender». (template)
4. eval + findings print. done: the proposal is printed. (template)
5. resolve with dima; a coder applies the picks. done: his word on each pick. (open)
6. log today's line in `log.md`. done: the line is there. (open)

## vectors

### research

1. voice quality — the current TTS leaderboards (Artificial Analysis arena, TTS Arena): which
   engines and models lead, especially female voices
2. free tiers and prices — elevenlabs, fish, gemini, cartesia, azure, google, new entrants;
   what changed since the last run (promos ending: fish `s2.1-pro-free` ran to 2026-11-30)
3. local models on Apple Silicon — kokoro and its successors, mlx-audio / FluidAudio, time to
   first audio, uk and ru support
4. technical-text normalization — engines that now read ids, versions, units, code natively;
   normalizer libraries; LLM rewrite passes
5. latency — streaming APIs, first-byte numbers, websocket vs http, warm-connection tricks
6. Ukrainian and Russian — which engines read them well now
7. macOS — new system voices, AVSpeech / SSML changes, privacy-pane or hotkey changes in the new OS
8. following along — how read-aloud tools highlight the spoken word, inside other apps (accessibility text ranges, overlays) and in their own ui; word timings from engines or forced alignment; where each breaks (electron, web, pdf) (dima, 2026-09-30: «I often follow a text that is read aloud and read myself in parallel»)

### analysis

- the daemon log (`~/.local/share/x-speak/daemon.err.log`): real press → first audio per engine,
  fallthrough counts, quota benches
- elevenlabs characters used per month vs the 10k free credits
- dima's own tuning in `config.json` (chain order, favourites) — his taste since the last run

## artifacts

- `schedule/jobs/x-speak/` — the daemon and `config.json` (the chain, voices, speed, gain, favourites)
- `speak/` — the voice admin app, its `FTR.md` and `AGENTS.md`
- the golden normalizer cases in the daemon's test set

## findings

- a TTS overhaul proposal — chain order, new engines, dropped ones, normalizer
  gaps; noop is a valid outcome
