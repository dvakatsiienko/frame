# readaloud playbook — how to build speak well

the build knowledge for speak: the practices, the bar, the architecture calls and the voice safety rule. `refresh-speak` (`recipes/refresh-speak/`) writes it; a design or build change to speak reads it first. every line carries its source, or «?»; read 2026-11-19 unless a line says otherwise.

## contents

- the bar
- how speak is used
- kokoro and the voice safety rule
- engines and free tiers
- the grab
- long-form controls
- tech text
- latency
- following along
- running it
- shipping and earning

## the bar

- wispr-grade on four axes — time to first audio, voice quality, tech-text handling, follow-along — against ElevenReader, Speechify, NaturalReader and macOS Read & Speak (dima, grill 1, 2026-11-19)
- no bar app publishes a first-audio number; the axis is measured on our own log (searched vendor pages and the web)
- macOS 27 renamed Spoken Content to «Read & Speak», with word/sentence highlighting, a controller, Accessibility Reader, Detect languages and Pronunciations ([apple](https://support.apple.com/guide/mac-help/spch638/27/mac/27))
- Speechify on the mac: ⌥A reads the selection in any app, ⌥X reads a screenshot, a mini player with speed, text highlighting; English only ([speechify.com/mac](https://speechify.com/mac/))
- ElevenReader has no mac app (web, iOS, Android, Chrome); free 10 h a month, speed to 4×, sleep timer, bookmarks ([pricing](https://www.elevenreader.io/pricing))
- NaturalReader is the document and OCR reference: free 20k Lite and 4k higher-tier characters a day, OCR on paid (third-party sources, conflicting ?)

## how speak is used

- 659 presses a day on average over 50 days, 1,528 at the peak (`daemon.err.log`, 2026-11-19)
- kokoro speaks 99 % of reads: 35,273 first audios against 127 elevenlabs, 33 fish, 22 system (same log)
- the grab: accessibility on 80 % of presses, ⌘C on the rest, ~20 ms (same log)

## kokoro and the voice safety rule

- before any kokoro engine or model change, the model snapshot and all its voices are backed up; a new version replaces the old one only after dima hears af_heart on it ([FRM-669](https://linear.app/x-com/issue/FRM-669))
- the engine is `mlx-audio`, a `uv` tool; evergreen's `uv tool upgrade --all` moves it (0.6.4 → 0.6.6 on 2026-11-18) and prints kokoro every run (`clio:evergreen`)
- the model `mlx-community/Kokoro-82M-bf16` at a71e4d38 (2025-12-02) is upstream's latest; it holds all 54 voices, af_heart included, as safetensors and pt ([hf api at the revision](https://huggingface.co/api/models/mlx-community/Kokoro-82M-bf16/revision/a71e4d38b236d968966a2002c4c895dbd12b1c3c))
- kokoro itself has not moved since 2025-04 (hexgrad/Kokoro-82M f3ff3571); no release stream, so pinning the revision matters more than watching a version ([hf](https://huggingface.co/api/models/hexgrad/Kokoro-82M))
- mlx-audio moved from Blaizzy to Neywa-Labs in v0.6.5 ([repo](https://github.com/Neywa-Labs/mlx-audio)); v0.6.2 fixed named voices fetched from an unpinned repo, failing offline ([#1041](https://github.com/Neywa-Labs/mlx-audio/issues/1041)); kokoro vocoder speedups sit on main for the next release (0fed32ac, 13f280ef)
- the rankings: kokoro is the top open-weights model on TTS Arena V2 (#27), #67 on Artificial Analysis; its «hard prompts» score (numbers, codes) sits above its overall ([arena](https://huggingface.co/spaces/TTS-AGI/TTS-Arena-V2), [aa](https://artificialanalysis.ai/text-to-speech/leaderboard))
- kokoro runs natively in Swift through FluidAudio (CoreML / ANE), af_heart the default, ~49 ms warm on an M5 Pro; its GPU route aborts on macOS 27.0.1, so the tail runs on CPU there ([KokoroAne.md](https://github.com/FluidInference/FluidAudio/blob/main/Documentation/TTS/KokoroAne.md), [#1103](https://github.com/FluidInference/FluidAudio/issues/1103))

## engines and free tiers

- the leaders on Artificial Analysis: Eleven v4 and v4 Turbo, Qwen-Audio-3.1-TTS-Plus, Cartesia Sonic 3.6, Speechify Simba 3.5; Fish S2.1 Pro, speak's fish engine, is #24 (read through a summarizer, ?) ([aa](https://artificialanalysis.ai/text-to-speech/leaderboard))
- dima's blind booth, 2026-11-19, one tech line, loudness-matched: kokoro af_heart 5/5; Speechify simba-3.5 geffen_32 and harper_32 4/5 (alike to his ear), kristy 3.5, bwyneth 3.4 ([FRM-288](https://linear.app/x-com/issue/FRM-288) W40–W41)
- Speechify returns word speech marks (start and end ms) on every `/v1/audio/speech` answer, probed 2026-11-19
- Speechify API: 500k characters a month free, commercial use allowed, 333k of Simba 3.5 from 2026-11-21, word timestamps included ([pricing](https://speechify.ai/pricing), [speech marks](https://docs.speechify.ai/build/guides/text-to-speech/speech-marks.md))
- fish `s2.1-pro-free`: fair use, no hard cap; its end date reads 2026-11-30 or 2026-08-31 in the same post, so it is unclear ([blog](https://fish.audio/blog/s2-1-pro-free-api/), [docs](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits.md))
- Google Cloud Chirp 3 HD: 1M characters a month, uk-UA and ru-RU, billing enabled ([pricing](https://cloud.google.com/text-to-speech/pricing))
- Azure F0 neural 0.5M a month; Cartesia 20k credits; ElevenLabs 10k credits, Starter $6 for 30k ([azure](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/), [cartesia](https://cartesia.ai/pricing), [elevenlabs](https://elevenlabs.io/pricing))
- Gemini 3.8 Flash TTS has a free tier, its price doubles 2027-01-01; in our log it took 4.8 s and 11.4 s to first audio, then a 429 ([pricing](https://aistudio.google.com/docs/pricing), `daemon.err.log`)
- new local engines: Phonon 31M EN (Apache-2.0, 64.5 MB, its own normalizer, in mlx-audio), Kyutai Pocket TTS v4, Fish Drama 3 (#7 on AA, open weights, ~26 GB peak: too heavy for an always-on daemon) ([phonon](https://huggingface.co/gradium/phonon-31m-en), [pocket-tts](https://github.com/kyutai-labs/pocket-tts/releases/tag/v4.0.0), [drama 3](https://huggingface.co/mlx-community/fish-audio-drama-3-4bit))
- uk and ru: no small local model; Piper 1.8 (arm64 wheels) and HolosTTS for Ukrainian are the trials to run; kokoro has neither language ([mlx-audio readme](https://github.com/Neywa-Labs/mlx-audio), exa lane ?)

## the grab

- accessibility first: `kAXSelectedTextAttribute`, `kAXSelectedTextRangeAttribute`, `kAXBoundsForRangeParameterizedAttribute` for the on-screen rectangles; ⌘C only when it answers empty ([apple](https://developer.apple.com/documentation/applicationservices/kaxselectedtextrangeattribute))
- Electron and Chrome apps open their tree only after `AXManualAccessibility` is set; speak does it ([electron](https://github.com/electron/electron/blob/main/docs/tutorial/accessibility.md))
- images, canvas text and pdfs with no text layer read as «nothing selected» today; the door is a ScreenCaptureKit frame into Vision `RecognizeDocumentsRequest` (macOS 26+), which keeps paragraphs and reading order ([apple](https://developer.apple.com/documentation/vision/recognizedocumentsrequest))
- test the grab per app dima uses, never «all surfaces» as one claim (parallel lane)

## long-form controls

- the floor every bar app ships: play/pause, stop, speed, back and forward; Speechify skips 10 s ([speechify.com/mac](https://speechify.com/mac/))
- speak's sentence chunks are the natural unit for skip and rewind, and a kept position is last read plus chunk index (`schedule/jobs/x-speak/main.swift`)

## tech text

- a deterministic normalizer with golden tests stays the core (speak's `normalize.swift` + `golden.json`); add a case before changing an engine (parallel lane)
- a small llm pass for only the spans that fail a rule: Apple Foundation Models runs on-device and free, latency unmeasured (?) ([apple](https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel))
- ElevenLabs advises normalizing upstream for low latency; its own `apply_text_normalization` is off on Flash ([models.md](https://elevenlabs.io/docs/overview/models.md))

## latency

- measure press to the first playable sound, never server time (parallel lane)
- ours: kokoro median 268 ms, p90 417 ms; elevenlabs 236 ms; fish 682 ms; system 360 ms; kokoro's p90 rose from 367 ms in October to 515 ms in November, cause unchecked (`daemon.err.log`, 2026-11-19)
- speak already prefetches the next chunk and cuts a long first sentence at a comma (`main.swift`)

## following along

- word timings per source: kokoro computes them in mlx-audio's pipeline but `/v1/audio/speech` drops them (a server patch or in-process use); Speechify speech marks; Cartesia timestamps over SSE; `AVSpeechSynthesizer` range callbacks for the system voice ([pipeline.py](https://github.com/Neywa-Labs/mlx-audio/tree/c4c3cb82f0d53dd3f175aea77eb66238497ad845))
- speak's system engine is `NSSpeechSynthesizer`, which has no ranges; `AVSpeechSynthesizer` has them ([apple](https://developer.apple.com/documentation/avfaudio/avspeechsynthesizerdelegate/speechsynthesizer(_:willspeakrangeofspeechstring:utterance:)))
- the normalizer changes the text, so keep a span map from spoken offsets back to screen offsets, then place the highlight with `kAXBoundsForRangeParameterizedAttribute` (pattern, no primary source)

## running it

- a launchd daemon plus a warm local server holds for one user (our latency above)
- in-process CoreML kokoro is the next step: no python server, no warm-up (FluidAudio, above)
- a released app registers its agent through `SMAppService.agent(plistName:)` (macOS 13+), never a hand-installed plist ([apple](https://developer.apple.com/documentation/servicemanagement/smappservice))

## shipping and earning

phase 2, [FRM-668](https://linear.app/x-com/issue/FRM-668):
- native Swift fits: the grab, CoreML kokoro and a system-voice audio unit are Swift APIs, so tauri or electron would need a native helper for each (inference from the APIs)
- Developer ID and notarization need the $99 a year program; accessibility needs a non-sandboxed app, so no App Store (? not re-checked) ([apple](https://developer.apple.com/programs/))
- kokoro as a system voice: `AVSpeechSynthesisProviderAudioUnit` lets an app install a voice Read & Speak and VoiceOver can use; no prior art found ([apple](https://developer.apple.com/documentation/avfaudio/avspeechsynthesisprovideraudiounit))
- donations: GitHub Sponsors 0 % from personal accounts, Buy Me a Coffee 5 % plus Stripe ([github](https://docs.github.com/en/sponsors/sponsoring-open-source-contributors/about-sponsorships-fees-and-taxes), [bmc](https://help.buymeacoffee.com/en/articles/8105744-how-to-calculate-charges-on-your-payment))
- local mode free forever and no account; check each voice's redistribution terms before shipping it (kokoro is Apache-2.0, ? not re-fetched; Drama 3 restricts commercial use)
- remote hosts have no accessibility of their own: the text comes from the host, and an OpenAI-compatible `/v1/audio/speech` keeps engines swappable
