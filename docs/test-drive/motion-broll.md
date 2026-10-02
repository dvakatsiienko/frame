---
dies-when: adopted or dropped after this run
---

Ticket: none

# motion-broll — test drive

the skill: [Barty-Bart/motion-graphics](https://github.com/Barty-Bart/motion-graphics) (MIT), `skills/motion-broll`.
it turns a talking-head video and its words into motion-graphic b-roll: one shape that morphs and never cuts,
every frame a pure function of `t` in an html page, rendered by playwright chromium (4 subframes, motion blur) and
ffmpeg. candidate lane: atelier's motion lane.

run from a clone at `~/Movies/motion-broll/skill-src`, never installed; work folder `~/Movies/motion-broll/motion`.

## round 1 — speak promo (2026-10-02, opus 5.5)

input: `~/Desktop/speak-promo.mov`, 66.9 s, 1280×720, 30 fps, h264, one talking head, full frame, no srt.

### wall time per step
- setup (clone + patched setup) — ~1 min
- inspect (`inspect_video.py`, contact sheet) — under 1 min
- word timings (faster-whisper `small.en`, uv venv) — ~2 min incl. two failures; the transcription itself ~12 s
- plan (read speak docs + config, plan as bullets) — ~3 min
- build (5 clip fragments + a shared speak kit) and still checks — ~6 min, 2 fix rounds
- render — 5 clips in parallel, 45 s wall
- composite + viewer/compare pages — 5 s

### render seconds per clip (parallel, 14 cores)
- 01 f4 → pill, 8.8 s clip — 34 s
- 02 pill lights each word, 11.0 s — 45 s
- 03 the en chain, 6.0 s — 21 s
- 04 fallback, 6.8 s — 27 s
- 05 redesign card, 5.2 s — 22 s

tokens (from the session transcript, video in → preview out, opus 5.5, 56 api turns):
- output 42.9k · cache read 8.0M · cache write 164k · fresh input 0.1k
- ≈ **$3.80** at api list price ($20 out, $0.20 cache read, cache write at 2× input for the 1-hour ttl); a subscription pays it in quota, not dollars
- cache reads are ~42 % of it: every tool call re-reads the ~140k resident context
- local compute (render, whisper) is free: about 1 min of cpu in all

### what broke
- `faster-whisper` on PyAV: `open() got an unexpected keyword argument 'metadata_errors'` → fed the wav as a numpy array instead of a path
- `beats.js` keeps a 1920×1080 viewport, so a 720p clip's contact sheet carries an empty band; `render.js` resizes, so renders are fine
- the skill writes its plan as a markdown table; our rules ban them → bullets
- the skill's defaults are 1080p, Geist and orange; a 720p source and speak's look meant per-clip cam values and a shared kit (`clips/_common.html`: palette, engine marks, the pill, the 17-bar meter) prepended before `build.py`

### what we patched (local only, never upstream)
- `setup.sh`: `npm install playwright` → `pnpm add playwright` + `pnpm exec playwright install chromium` in `motion/`
- numpy: already present system-wide; faster-whisper went into a `uv venv` (`~/Movies/motion-broll/asr-venv`)
- playwright: scoped to `motion/node_modules`, this session's named exception
- `build.sh`: concatenates the speak kit before each clip, then runs the skill's `build.py`
- `render-all.sh`: renders every clip in parallel at 30 fps

### dima's verdict per clip
- 01 — pending
- 02 — pending
- 03 — pending
- 04 — pending
- 05 — pending

## round 2 — the research levers, patched in (2026-10-02, opus 5.5)

same input. the skill was patched on branch `fleet-patches` in `~/Movies/motion-broll/skill-wt` (one local commit
plus two fixes found in the run). work folder `~/Movies/motion-broll/r2/motion`.

### the patch list (the vendoring diff)
- `SKILL.md`:
  - a style-frame step (§ 3.5): one still from DESIGN.md + PRODUCT.md, approved before any animation
  - scene variety replaces the «one shape, never cuts» default: six kinds, never two of the same kind in a row
  - the background ban is lifted: gradients, glows, slow light, particles and grain are allowed; glows stay off UI
    chrome
  - a sound step (§ 5.5), GSAP rules, 2.5D screenshots, the DESIGN.md kit, the `~/Movies` work folder
  - pnpm/uv instead of npm/pip, and the plan as bullets
- `engine/build.py`:
  - `--kit` prepends a project kit
  - inlines `motion/node_modules/gsap` when a clip calls `gsap.`
  - new `bg` and `hud` slots, and a grain layer
- `engine/motion.js`:
  - `gsap:` timelines are paused and seeked to `t` every frame
  - `grain:` re-offsets a pre-baked tile at 24 fps
  - a scene may skip the morphing shape
- `engine/grain.png`: a 256² noise tile, seeded and deterministic
- `engine/base.css`: the `#bgfx` and `#grain` layers
- `engine/render.js`: a `SUBFRAMES` env replaces the hard-coded 4, in the capture loop and the ffmpeg `tmix`
- `engine/beats.js`: the viewport follows the clip's W×H, and the temp dir uses `os.tmpdir()`
- `scripts/setup.sh`: pnpm (playwright + gsap), uv (numpy), requires the dir argument
- `scripts/words_asr.py` (new): faster-whisper in a uv venv, fed a numpy array
- `scripts/sfx_fetch.py` (new): Openverse CC0 search, download and credits
  - two fixes from the run:
    - anonymous `page_size` > 20 returns a 401
    - a refused download falls through to the next hit
- `scripts/mix.py` (new): voice + sfx hits + a bed ducked by a sidechain on the voice
  - one fix from the run: a mono source is upmixed with `pan`, because ffmpeg's default upmix drops the voice 3 dB
- `scripts/composite.py`: takes `plan.json` `"audio"` when present

### wall time
- patches + style frame — ~14 min, including the HyperFrames clone (1.4 GB with LFS, started before the order change)
- 6 clips written + still checks — ~6 min, 2 framing fixes
- render — **199 s wall** for 6 clips in parallel; mix + composite + pages — 6 s
- remix after the mono fix — ~10 s

### render seconds per clip (parallel, 14 cores)
- 01 kinetic headline, 4.6 s clip — 94 s
- 02 select → F4 → pill, 7.5 s — 131 s
- 03 the pill up close, 11.0 s — 199 s
- 04 the real admin in 2.5D, 6.0 s — 85 s
- 05 before / after split, 6.8 s — 81 s
- 06 chapter card, 5.2 s — 100 s
- 📌 that is ~4× round 1 per clip-second (inferred cause: a full-frame blend-mode grain plus large `filter: blur` glows
  repainting every subframe). the cheap test: `SUBFRAMES=2`, and the grain at 12 fps.

### sound, measured
- the voice holds its level: -28.0 dB in the mix vs -30.8 dB at the mono source, over 10–11 s
- the bed fills the silences: -38.8 dB / -37.5 dB in the two real gaps, where the source sits at -71 / -80 dB
- the sfx land: the thud on «fails» lifts a -70 dB gap to -33 dB
- credits: `r2/motion/work/sfx/credits.json`, all CC0

### tokens
- cumulative after round 2: 144 api turns, output 111k, cache read 34.0M, cache write 321k
- the delta since round 1 (it includes the vendoring eval and the HyperFrames peek): output 68k, cache read 26.0M,
  cache write 157k ≈ **$7.80** at api list price. cache reads dominate, because the context has grown.

### dima's pick
- round 2: «the updated version is much flashier!» (relayed by cclio)

### diff against the «Motion studio rules» (0xMovez's X article, linked from Lukas Margerie's video)
source: [How to build motion design studio with Opus 5.5](https://x.com/0xMovez/article/2104216919033192746). X
refuses a direct fetch (402); `parallel-cli extract` read it.
- **render contract**: a pure `seek(t)`, no transitions or timers, seeded noise, H.264 yuv420p CRF 16
  - we already had: `seek(t)`, no carried state, yuv420p (CRF 14)
  - added: «seeded noise only, never `Math.random`»
- **look**: it bans a centred title on a gradient, everything fading in, corner labels and frame borders, glow on UI
  chrome, generic particle bursts. one display face and one UI face; something new every 2–4 s.
  - added: the five bans, and the 2–4 s rule
  - our particle allowance narrows to sparse drifting background particles; bursts stay banned
  - 📌 round 2 breaks two of these bans: clip 06 is a centred title on a gradient, and clip 01 carries a corner
    label («speak · read aloud on F4»). clip 03 holds a still pill for ~3 s twice, at the edge of the rule.
- **sound**: it synthesises score and sfx in code, puts hits on a measured beat grid, and normalises to -14 LUFS
  - we use Openverse CC0 recordings, and cue to speech words, not beats (a talking head has no beat grid)
  - added: `loudnorm` to -14 LUFS in `mix.py`, and the beat-grid rule for music-driven pieces
  - measured: round 2's mix was **-24.3 LUFS**; with the patch it lands at -14.6
  - left out: synthesised score — CC0 recordings sound better than a code synth for a bed (inferred, untested)
- **loop before showing**: a contact sheet per beat, scored 1–10 on hook, phone readability, motion, variety, brand,
  sound sync; fix the 3 worst until all are 8+
  - added to § 6 as «score before you render»; our stills check had no rubric
- **effort**: xhigh for new films, max when the first 3 s carry a launch. this session ran on opus 5.5 at its
  default; the effort lever is untested here.
- **prompt frame** («you are an incredible motion designer», 15 s, 6–8 shots, «go all out»): queued as the brief
  opener for the next render. the article itself warns of «brief contagion»: identical one-liners produce look-alike
  reels.

patch branch now: 2 commits, 12 files, +173 −42.

## evaluation for vendoring

dima liked round 1 and wants motion-broll as a global, user-only skill we maintain. upstream state: one commit
(2026-09-25), MIT — vendor with `LICENSE` and an attribution line.

### 1. efficiency
- wall per step: see round 1. the model's time is spent on the plan and the clip code (~10 of ~15 min). rendering
  is cheap.
- render, measured on clip 03 (6.0 s, 180 frames × 4 subframes = 720 screenshots), on its own: **25 s, 4.2× real time**
- per subframe, measured over 120 subframes at 1280×720:
  - `seek(t)`: 0.4 ms
  - playwright png screenshot: 17.7 ms
  - jpeg q95: 22.7 ms (slower)
  - raw CDP `Page.captureScreenshot` with `optimizeForSpeed`: 32.5 ms (slower)
- where the time goes: screenshots ≈ 13 s of the 25 s (~50 %, measured). the rest is the ffmpeg png decode +
  `tmix` + x264 encode and the browser launch (~12 s, inferred by subtraction).
- parallel clips scale well: 5 clips took 45 s wall on 14 cores (measured)
- faster paths, all inferred and untested:
  - ✅ **fewer subframes** (`K` in `render.js` is hard-coded to 4): K=2 halves the screenshots, and K=1 suits still-heavy
    clips. it costs motion-blur quality. the cheapest patch: an env var.
  - ✅ **split one clip across pages**: N pages each take a frame range, then concat. this should be near-linear on 14
    cores, because `seek` is pure. the best next measurement.
  - 🔎 `HeadlessExperimental.beginFrame` (headless-shell's deterministic frame control): this could replace
    seek+screenshot with exact compositor frames. research it.
  - 🚫 CDP `Page.startScreencast`: it pushes frames on compositor ticks, not on demand, so it cannot capture
    frame-exact. it breaks the `seek(t)` contract.
  - 🚫 WebCodecs in-page: the clips are DOM, not canvas. capturing DOM into a canvas means rewriting the engine.
  - 🚫 jpeg and raw CDP capture: both measured slower than the default.

### 2. fleet fit, each with its patch
- **playwright vs `agent-browser`**:
  - measured: `agent-browser` `eval` + `screenshot` costs **213 ms per subframe** against playwright's 18 ms. that is
    12× slower, because each call spawns a CLI process. clip 03 would take ~2.5 min instead of 25 s.
  - its alpha support (`omitBackground` for ProRes panels) is unknown.
  - → playwright is the one justified exception. pinned in the skill's `motion/node_modules`, never global.
  - `x:browser-headless` gets one named line: «motion-broll's renderer only».
  - the chromium binary sits in the shared `~/Library/Caches/ms-playwright` (557 MB, already present).
- **npm → pnpm**: `setup.sh` changes `npm install playwright` + `npx playwright install` to `pnpm add playwright` +
  `pnpm exec playwright install chromium`. it already writes the `package.json` pnpm needs.
- **pip → uv**:
  - numpy: `uv pip install numpy --system --break-system-packages`
  - word timings: `faster-whisper` in a `uv venv` (183 MB). it needs a fix: feed the wav as a numpy array, because
    PyAV crashed with `metadata_errors`.
  - ship it as a script, `scripts/words_asr.py`, writing the srt + `words.json`, instead of the skill's «pip install
    faster-whisper» hint.
- **palette vs DESIGN.md**:
  - the skill's defaults (orange `#FF5A1F`, Geist, warm grey) are hard-coded in `SKILL.md` and `base.css`.
  - patch: the interview reads the project's `DESIGN.md` first. a project kit (`clips/_common.html`: tokens, font
    stack, brand marks, signature components) is prepended by `build.py --kit`. this replaces our `build.sh`.
  - Geist stays as the fallback only.
- **working folder**:
  - upstream puts `motion/` inside the user's project. that drops `node_modules`, renders and the source video into a
    git repo.
  - patch: default to `~/Movies/motion-broll/<slug>/motion`, outside every repo. round 1 used 33 MB plus the source
    video.
- smaller fixes:
  - `beats.js` keeps a 1920×1080 viewport. it should resize to the clip's W×H, the way `render.js` does.
  - the plan table → bullets, per our rules.
  - `make_pages.py`'s TIMING.md table is fine: it is for the editor, not for dima.

### 3. keep / patch / drop
- ✅ **keep**:
  - the engine: `motion.js` (pure `seek(t)`, closed-form springs, one-shape morph)
  - `render.js`'s subframe motion blur, `composite.py`, the viewer and compare pages, `plan.json`
  - the content rules: never invent numbers, one idea per clip, changes on spoken words
  - the examples, as the quality bar
- 🔧 **patch**:
  - `setup.sh` (pnpm, uv)
  - `beats.js` viewport
  - `build.py --kit`
  - `scripts/words_asr.py`
  - `render.js`: a subframe count option, plus a frame-range split
  - the working folder default
  - plan as bullets
  - the DESIGN.md-first interview
- 🚫 **drop**:
  - the «pip install faster-whisper» instruction, since the uv script replaces it
  - npm and npx everywhere

### open research for the refresh recipe
- `HeadlessExperimental.beginFrame` as a frame-exact capture path
- the speedup from splitting a clip across pages, measured on 14 cores
- K=2 vs K=4: does the motion blur drop visibly?
- the cost of one run on sonnet 5.5 vs opus 5.5 at equal quality
- whether `agent-browser` can capture with a transparent background
- the refresh recipe itself: diff upstream `skills/motion-broll/` against the vendored copy, then re-apply this patch
  list. upstream has one commit, so its churn is unknown.

## verdict
pending dima's clip verdicts; leaning **reshape** — vendor the engine, patch the five fleet clashes above.
