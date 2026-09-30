---
dies-when: distilled into `crew-designer-brief` + `crew-designer` and the design-directions gallery artifact, and the first atelier run has graded the recipe
---

# design process — how the fleet designs, from brief to build

Ticket: [FRM-244](https://linear.app/x-com/issue/FRM-244)

researched 2026-09-29, five lanes on one brief (12 vectors): exa agent · parallel core · an opus lane reading sources (leaked prompts, skills, the Design type, npm) · neuroarxiv (20 arXiv papers) · `advise-project-approach` (round 3). the lanes agreed on the spine; disagreements are noted inline.

## the verdict

**brief gate → 4 takes on 2 named axes → pick → 2–3 variants of the pick → impeccable builds.** the input decides the output; the operator's job is a short, picked brief and a veto on concrete takes, never an essay.

- **4 takes, not 10** — all five lanes. agencies show 1–3 concepts; Stitch's own skill offers 1–5 variants; parallel prototyping (Dow et al. 2010) used 3 → 2 → 1; a varied spread pulls the human to its centre (arXiv 2607.09018), and 10 is choice overload at 2.5× the cost. go to 3 if a pick takes >10 min twice; to 6 if «more options» is asked twice.
- **diversity is designed, never hoped for** — frames chosen *as a set that covers the brief's axes* beat a fixed roster ~2× on separation (2609.30492); verbalized sampling (N candidates with probabilities, keep a low-probability valid one) lifts diversity 1.6–2.1× (2510.01171); all LLMs homogenize together, so switching models alone adds little (2501.19361). the diversity numbers come from text tasks — for UI they are a hypothesis until measured.
- **label each take by its axis position**, and say out loud that a middle take gets picked more; a «mash-up» request (colour of 2, layout of 4) means the axes were wrong — fix the brief, don't generate more.
- **the brief gate**: every adjective has an anchor reference + «what exactly to take from it»; ≥3 do and ≥3 don't lines; the two axes named; the FTR states for the view (empty · loading · error, not only the ideal). missing any → the designer doesn't start.
- **stop after 3 iteration rounds**; a 4th means back to the brief.

## the operator — what dima decides, and what he needs to know

- **his ~5 touches per job**: sign off purpose + audience · name the two axes · mark which do/don't lines are hard · the pick · the final comp approval. agents propose references (he vetoes), pick type/colour/spacing specifics, cover every state, critique and build.
- **his eye works as a veto on concrete things**, not as a generator of abstract direction: ask «which of these 3 references, and what exactly in it», never «describe the vibe».
- **the vocabulary worth knowing** (enough to judge, not to design): hierarchy (what wins first) · density (information per area) · rhythm (repeated spacing/size cadence) · type pairing (role contrast, 1–2 families) · colour roles (surface, text, action, status — not «colours») · spacing scale (a few repeatable gaps) · contrast.
- **a 10-minute critique card** for a take: what is the job? what do I notice first? what feels wrong for this app? what is missing? which ONE decision should change? — feedback names the problem + goal («less competing emphasis; keep the canvas primary»), never «more polish».
- **the AI look** (the tells to veto on sight, merged from anthropic `frontend-design`, impeccable, v0, same.dev, taste-skill): cream `#F4F1EA` + serif + clay accent · near-black + one acid accent · purple/indigo/cyan gradients and glow · SaaS card kits and nested cards · all-caps eyebrows, `A · B · C` meta strings, mono as a «technical» costume, `→` on every link · Inter/Space Grotesk/Fraunces/Playfair as display · a coloured `border-left` card · fake metrics and placeholder art · the premium beige/brass look.

## art direction — where to look before a brief

one line each (what it is · when it fits):

- **swiss / international** — grid, type, restraint · information-rich tools
- **minimal / linear-like** — quiet surfaces, tight type, keyboard density · tools; easy to clone, so borrow qualities, not the brand
- **editorial** — large type, captions, deliberate pacing · content-led studios and portfolios
- **bento** — modular unequal tiles · overviews; not a hierarchy by itself
- **flat / material** — explicit surfaces, elevation, tokens · scalable multi-screen apps
- **skeuomorphic** — physical-material cues · instruments, creative tools, onboarding
- **neumorphic** — soft raised/recessed surfaces · calm few-layer tools; contrast risk, poor for dense UI
- **glassmorphic** — translucent blur layers · overlays and media; legibility risk in core UI
- **claymorphic** — soft inflated forms · friendly playful products
- **neobrutalist** — raw blocks, hard borders, loud contrast · expressive marketing and community
- **y2k** — chrome, pixels, saturated nostalgia · youth and culture campaigns
- **retro-futurist** — analogue and space-age cues · themed experiences and art

where to see them: shipped app screens and flows → [Mobbin](https://mobbin.com/), [Refero](https://refero.design/), [Page Flows](https://pageflows.com/) · web art direction → [Godly](https://godly.website/), [Land-book](https://land-book.com/), [Awwwards](https://www.awwwards.com/), [siteInspire](https://www.siteinspire.com/) · sparks, not evidence of a usable flow → [Dribbble](https://dribbble.com/). an image model (fal.ai: Flux, Nano Banana) can render a 6–9 tile moodboard per direction — atmosphere only, never UI truth. a searchable style/palette/font dataset exists in `ui-ux-pro-max` (79 styles, 192 palettes, 74 pairings; quality unverified).

## the designer — how it works

- **one isolated branch per take**, each with its own frame chosen to cover the axes (impeccable's `concept-seed` roll or matt's «design it twice: one constraint per sub-agent»); taste-skill's three dials (`DESIGN_VARIANCE`, `MOTION_INTENSITY`, `VISUAL_DENSITY`, 1–10) are ready-made axes.
- **token-first, two passes** (anthropic `frontend-design`): a plan with 4–6 named hexes, type roles, an ascii wireframe → review it against the generic default («if any part reads like the default, revise it») → only then render. v0's `GenerateDesignInspiration` makes the same brief-first step mandatory: «if you generate a design brief, you MUST follow it».
- **a direction contract** (impeccable: ~150 words, six blocks — thesis, own-world, story …) is the handoff from the pick to the build; a structured spec, not pixels, is what later edits target (SpecifyUI 2509.07334).
- **critique the pick on screenshots with separate roles** (UX · PM · engineer beat one critic, 2602.01796), few-shot designer critiques and region-pinned comments (UICrit 2407.08850, +55 %); bounded: at most two rounds, then a fresh-context reviewer (impeccable).
- **the built-in Design type** (read 2026-09-29): a `canvas.json` index + one self-contained `.dc.html` per artboard, all in one Artifact call. cost = artboards × full html each + reads on revise. cheap at the same quality: tokens as a Design System artifact copied server-side · shared chrome via `<dc-import>` · palette variants as `data-props` (dima turns them, zero regeneration) · one key view per take · revise per file. it never verifies unless asked, so quality rests on the input. 📌 at launch Claude Design burned ~80 % of a weekly Pro allowance on three page variations (VentureBeat 2026-06-17); anthropic cut tokens per turn since — measure, don't guess.
- ⚠️ **don't import the current design system** for a from-scratch redesign — it is Claude Design's recommended first step and exactly what breaks the blinding. feed the stripped FTR (features + purpose + states) only; the operator's own references can still leak the old look, so he should know that.

## tooling — computed, never eyeballed

a `design:*` script family (packages verified on npm 2026-09-29):

- `design:contrast <tokens.json>` — every fg/bg role pair, WCAG ratio (pass/fail) + APCA Lc (advisory) — `colorjs.io` 0.7.1 does both
- `design:palette <seed> --ratios …` — oklch ramps at target contrasts → DTCG json — `@adobe/leonardo-contrast-colors` 1.1.0 + `culori` 4.0.2
- `design:cvd <tokens.json>` — adjacent-role ΔE under protan/deutan/tritan — `culori`'s deficiency filters, with the dataviz validator's thresholds (CVD ΔE ≥ 8, normal ≥ 15) ported, not copied
- `design:scale` — fluid type + space `clamp()` steps — `utopia-core` 1.6.0 + `@capsizecss/core` 4.1.3
- `design:tokens` — DTCG json → tailwind v4 `@theme` vars — `style-dictionary` 5.5.5
- `design:diff <comp.png> <shot.png>` — build vs comp — `odiff-bin` 4.5.0
- skip: `apca-w3`, `wcag-contrast` (redundant), `color-blind` / `@bjornlu/colorblind` (dead since 2022–23)

## memory — never research this twice

- this doc is the evidence; the two skills carry the distilled rules; the directions gallery artifact is what dima browses before a brief
- per app: `PRODUCT.md` (truth), `FTR.md` (features, purpose, states), `DESIGN.md` + tokens (the look, with the *why*), and a short decision log per pick: choice, rejected directions and why, revisit trigger. keep rejected takes' thumbnails — the next app starts from decisions, not taste archaeology.

## measuring a run

log per run, in `docs/test-drive/design-run.md`: brief version · takes · artboards · tokens in/out · wall minutes · usage-window % before/after · renders and retries · pick time · the 1–5 rubric (job clarity, hierarchy, distinctiveness, accessibility, implementation risk, dima's preference). compare cost per *selected usable direction*, not per draft.

## the adhd question

isolated divergent frames have support for text ideation (persona and frame sets, 2609.30492, 2411.02989, 2409.12538) and none yet for UI specifically; a fixed or random frame list is the weak baseline. the adhd method's own small eval: 5 wins / 1 loss on engineering tasks. **test it, don't assume it**: one spread from axis-derived frames vs one from adhd's fixed frames, scored by screenshot distance and dima's pick.

## anti-patterns — how design goes wrong upstream

vague asks («make it modern») · no real content · no named direction · coding before exploration · picking the first plausible take · mixing branches before all are rendered · iterating on the wrong take · pixel-pushing before structure and states · the model self-certifying. each has a gate above; the brief gate carries most of the weight.

## where to design — Cowork or Claude Code (researched 2026-09-29, sources ≥ 09-01)

- **one Design capability behind several doors**, not two products: the 09-16 «Cowork is now Claude» launch put Design, Docs and Slides into ordinary conversations; the 09-23 Design guide lists the doors — a chat, the Artifacts tab, Claude Code (`/design`, the Design artifact type), standalone `claude.ai/design`. identical hidden prompts or models are **unverified**; anthropic publishes no per-surface matrix.
- **no quality or speed comparison exists** between the surfaces; **one shared usage pool** (Design no longer has its own weekly allowance) — designing in the app does not save the Code budget.
- claude code's own changes that week touched artifact *pages* (v2.1.283 artifact-design wording, v2.1.284 the design plan on the page), not the Design type. the «Design tab» migrates *design systems* from standalone Design; people and projects stay where they are.
- the bridges: `/design-sync` (repo tokens/components → Design) and the handoff Design → Code; a CLI agent reading any live Cowork canvas is **unverified**.
- ➡️ for the fleet: **design in Claude Code** through the Design artifact — agent-driven, scripted, measured, and the canvas still opens on claude.ai for dima's direct edits and comments. ⚠️ skip `/design-sync` on a blind redesign — it imports the current look. Cowork is worth one A/B take later, never a dependency.

## open questions

- is the brief gate real or ceremony? test: one spread from the gated brief vs one from a deliberately vague brief on the same axes (advise-project-approach's disprovable first action)
- does comp → code lose fidelity? if the finish review finds big gaps, try paper.design (html canvas) or takes produced as code
- pick-by-axis first, then a take? (the central-tendency trap) — no paper tests it
- the Design type's own `craft.md` / `format.md` / `questions.md` references are readable only inside a created canvas — read them on the first run
