# diorama-draw — the art set for frame, the profile and bytes

📌 **status: draft trace.** we are still finding the recipe. every session that draws appends to
the trace; nothing here is automated yet. the run section is written from the trace only once a
step repeats unchanged.

## the want — dima's words

- «trace what you are doing is to then think about how to automate what we are doing
  eventually, but not yet, because we are still figuring out a recipe.» (2026-09-25)
- «i want an approximate, or even a higher, level of detail … so the design decision is
  consistent» across the profile, frame and bytes (2026-09-25)

## analysis vectors — the questions each run answers from local evidence

- does every image hold the bible (`bytes/apps/atelier/art/story.md`, `dino.md`, `palette.ts`)?
- light = day and dark = night on every piece?
- does the art direction stay quiet: few flowers, no cheer, Oles stern?
- svg or raster: which one wins per piece, and what does each cost to render and ship?

## artifacts — where they live

- `~/projects/bytes/apps/atelier/art/` — the bible (`story.md`, `dino.md`), `palette.ts`, the generators, `out/`
- `~/frame/home/.claude/plugin-x/skills/guide-ui-ux/SKILL.md` — ui rules that came out of the studio
- the studio artifact — https://claude.ai/artifact/4YAEdDqeH5SrSCUWnkB13h (source rebuilt by a
  scratch `build.ts`; move it into frame once the recipe settles)

## the trace

### 2026-09-25 · FRM-263 · opus 5.5 in cclio

- **evaluate** — render every existing svg into contact sheets with `agent-browser` (a page of
  `<img>` tags, one screenshot per sheet, ~3k tokens each) and judge them by eye
- **bible first** — `story.md`, then `dino.md`, then `palette.ts` as tokens (day, night)
- **generators** — `.ts` run by node 24, one module per concern: `paper.ts` (filters, smooth
  curves, ridges), `flora.ts`, `props.ts`, `crew.ts`, the dino models, one module per scene;
  `draw.ts` writes `out/<repo>/<piece>-{light,dark}.svg`
- **the look loop** — `node draw.ts` → a scratch `look.sh` (one svg in an html page,
  `agent-browser` screenshot) → read the png → fix → repeat. ~5 s and ~3k tokens per look;
  a pair script puts light and dark side by side. two to four loops per piece.
- **solo renders** — a character is judged alone at 2× before it goes into a scene
- **studio** — a scratch `build.ts` copies v1 and v2 svgs next to `page.html` and publishes the
  artifact; toggles for day/night, v1/v2, readme width; click-to-zoom
- **steers that changed the direction** — the dino was too happy → v1's rex polished, the clean
  rig saved as an alternative; the profile hero became the settled homestead and the walk went
  to `out/stash/`; flowers cut back, ferns and foliage instead; no smiley on Dym; a fire circle
  belongs beside the cabin, never on the path
- **raster probe** — `raster.ts` splits the homestead into depth layers (`homesteadLayers`),
  inlines each as a data-url svg, and three.js draws one plane per sheet with a sun casting
  soft shadows between them, paper grain, bloom at night. `agent-browser` at 3200×1200 → png →
  webp (pillow, q88).
- **the bake is a build** — a png is re-baked only when its scene changes; iteration stays in
  svg. **~1 s per page**: headless chrome already runs webgl on the gpu (ANGLE Metal, M4 Pro),
  the render call itself ~40 ms. a scratch `bake.sh` runs one `agent-browser` session per page,
  in parallel, and waits on the page title (`wait --fn`), which reports each stage and any error
- **measured** — homestead day: svg 199 KB · png 2× 2.9 MB · webp 2× 115 KB. the webp ships
  lighter than the svg

- **the stage** — atelier (`bytes/apps/atelier`, `pnpm dev:atelier`; it replaced `frame/brand/diorama/stage` on 2026-09-25) imports the
  scene modules directly: no data-url build step, hmr on every edit. a designed side panel
  (dima: lil-gui «have ugly selector») — day/night switches in place, grouped sliders, a switch
  per effect: card thickness (a dark cut edge behind each sheet), paper fibre (a normal map),
  haze (fog between sheets), camera tilt, lens blur, fire and window point lights, wind (a vertex
  shader bends the ferns and pines), drifting clouds (their own sheet), chimney smoke, fireflies; «copy settings» prints the set to paste back into
  `stage/src/settings.ts`. `?bake` renders one 2× frame; `?loop=N` exposes `stageFrame(i)`.
- **motion** — fireflies as three.js points, the fire as a point light plus a glow sprite; every
  motion uses whole-number frequencies over t ∈ [0, 1) so the loop is seamless. the exporter
  opens the stage once, steps 36 frames through `stageFrame`, screenshots each, and pillow packs
  an animated webp. measured: 36 frames in 54 s, webp 406 KB, apng 28 MB (dropped: too heavy for
  a readme). motion is opt-in in the live stage: a nonstop render loop keeps the gpu busy

### 2026-09-25 night · the stage grows up (dima asleep, own explorations)

- **panel** — every number is also a text field (`inputmode="decimal"`, live apply, Enter/blur clamps, Esc reverts, ↑/↓ step, Shift ×10, Alt ×0.1) and every setting has a copy button that copies `key: value`. financial's `rifm` was the suggested lib: it is a React hook, the stage is plain TS, so native it is
- **tone mapping** as a setting (exact / agx / aces / neutral + exposure), 8 bakes compared: exact wins by day, agx washes the day grey, aces is the moodiest night, neutral is close by day and richer at night
- **painted halos vs real light** — the svg's baked warmth circles read as solid domes in 3d; `hasGlow: false` drops them in the stage and point lights do the job (fire, window, town)
- **life** — birds by day, embers at night, camera drift (parallax sway). loops exported as animated webp: day 48 frames, night 36, drift 48
- **scene registry** — `stage/src/scene.ts` holds one spec per scene (layers, wind per sheet: `rooted` or `hanging`, extras = lights and moving bits). the market got `marketLayers`: signs and bunting are their own sheets and throw real shadows on the shop fronts. `?scene=market`, a scene picker in the panel
- **the bake runs from the stage** — `?scene=&time=&bake&set={json}`; `raster.ts` is deleted. five 3200×1200 heroes bake in parallel in 2–3 s each; webp 130–172 KB

### pitfalls met

- a group AND its child both given the same z doubles the depth: the birds sat behind the sky. extras are built at z 0 and only their group is placed
- the stage's dev server hot-reloads while a loop exports: never edit files it serves until the export lands (checked by frame-to-frame diff — no spike, no reload)

- three.js `PointsMaterial.size` is `size × (canvas height / 2) / distance`: at 20 units away
  0.16 draws ~2 px. size a point in world units for the bake height, then check the preview
- scene modules shared with the browser stay free of node apis: the font loads as a json import
  (`with { type: 'json' }`), never `readFileSync`; the stage's own tsconfig includes them and
  proves it

- `agent-browser wait <selector>` waits for a *visible* element: an empty `#done` div never
  counts, so every wait ran its whole timeout and a 1 s render read as «100 s». a page signals
  through its title, read with `wait --fn`

- biome sorts object keys on write: an order that matters (the readme's app rows) needs an
  explicit list, never `Object.keys`
- a filter rect over the whole canvas paints a faint box around a transparent sign: clip the
  grain to the shape
- a new `.ts` dir is outside `tsconfig.json` `include` until added; the gate caught a bad cast
  the moment it was
- sky and far mountains must not receive shadows in the raster, or the edge pines paint the sky

## cadence

per art change, on dima's word.

## last run

2026-09-25 night — stage 0.03: panel with fields + copy, tone mapping, scene picker (homestead, market), bakes from the stage, day/night/drift loops.
