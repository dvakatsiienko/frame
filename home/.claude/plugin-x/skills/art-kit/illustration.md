# illustration — code → picture

there is no image model here. the picture is written as code (seeded svg shapes), lit and rendered
in three.js, and shot to webp/png. the studio for it is **atelier** (`bytes/apps/atelier`,
[BYT-103](https://linear.app/x-com/issue/BYT-103)). the scenes live in `apps/atelier/art/`;
`pnpm dev:atelier` from the bytes root opens it, and `apps/atelier/AGENTS.md` says how to add a
piece, shoot and ship.

## the look comes from a recipe, not a library

the quality bar (foxglove hollow, `docs/research/art-studio-tooling.md`) uses no library at all:

- one seeded generator drives every choice — a seed recuts the whole scene
- `trace()`: split every edge every ~7 px and nudge each point sideways — the hand-cut edge.
  never ship a perfect circle or rectangle; those read as clip-art
- 7–9 layers stepping from pale at the back to dark at the front, each with two shadows: a 1 px
  light rim on top and a soft shade below, scaled by depth
- a noise tile laid over every sheet as grain, a vignette, one glow
- a library of shape functions (`pine`, `fern`, `mushroom` …) on the same seed

## the brief — one scene at a time

a scene brief names, in one pass: the medium and the technique rule, the layers back to front, an
inventory with counts, at most 7 hexes, the light, the composition (frame, focal point, leading
line) and one quality-bar sentence. one scene is finished to that bar before the set spreads.
«mvp» never appears in an art brief.

## the loop — this is where quality comes from

render → screenshot → read it beside the reference at the same size → write the ranked gaps →
one bounded change → render again. iterate privately; dima sees takes, not every round.

**done when** the render sits beside the reference with no gap left on the list, the take is saved
(atelier) or shot into `out/`, and the report ends with its version label.

## icons and favicons

- draw on a grid of size/16 units and check the pixel view at 16 px before any polish — half-pixel
  pills, a shadow smearing a gap and an off-grid sun cost the atelier favicon most of its rounds (#117)
