---
kind: refresh
owner: designer
cadence: "on demand — «refresh art-kit», a rebrand spotted, a new art job type. otherwise quarterly."
artifacts:
  - home/.claude/plugin-x/skills/art-kit/
  - ~/frame/gifs/AGENTS.md
  - ~/projects/bytes/apps/atelier/FTR.md
  - ~/projects/bytes/apps/atelier/GLOSSARY.md
script: none
---

# refresh-art-kit

Keeps `x:art-kit` current in every branch: gifs, terminal clips, illustration, brand logos, and how
an svg ships in an app. Born from the 2026-09-30 svg round (three lanes, graded in
`docs/test-drive/exa.md` + `docs/test-drive/parallel.md`).

## contents

- the want
- the run
- vectors
- artifacts
- findings

## the want

dima's, 2026-09-30:

> I want access to any SVG of any product, accessible and reliable, and SVGs also must be high
> quality … The condition is that all icons are up to date, because logos of products change …
> We would also want to have the freshest versions of logos.

> I didn't research optimal SVG application for a long time, and I would be interested to know how
> the picture looks nowadays and what the most optimal SVG application is in the LLM era.

> whenever we would want to refresh our SVG knowledge, you would just run a refresh ArtKit recipe?
> … fold other parts of ArtKit, like illustrations, gifs, logos, and everything that ArtKit covers.
> Describe its features as research vector lines to allow a full refresh of the ArtKit skill each
> time we pass through a recipe to update it.

## the run

1. re-groom the vectors with dima; drop the branches he does not want this run. done: his word on the list. (open)
2. one brief file from the kept vectors → `pnpm research:lanes <brief>` (exa + parallel) plus a
   fresh opus source lane that PROBES: the svgl api, the npm versions, which logo each set serves,
   the tool versions on this mac (`ffmpeg -version`, `gifski --version`, `vhs --version`,
   `yt-dlp --version`) — `habit-research-lanes`. done: every lane returned or marked failed. (script)
3. the analysis vectors, run locally while the lanes work. done: each vector answered or marked empty. (script)
4. distill: clever-merge into the artifacts, one branch file at a time; raw lane output stays in
   `last/` until the next run's distill; bump `x`. done: every kept branch file merged or named «unchanged». (open)
5. grade every lane in its test-drive file; findings print. done: the grades are in the test-drive files. (template)
6. log today's line in `log.md`. done: the line is there. (open)

## vectors

### research

**logos** — `logos.md`, `scripts/logo.ts`
1. official product logos an agent can fetch with no human: svgl (api, count, freshness, license
   terms), simple-icons, iconify sets, devicon, any new source or agent-built cli/mcp — coverage,
   color vs mono, how each stays fresh, which serve a stale logo after a rebrand
2. rebrands since the last run in the tools we use (vite, next.js, linear, cursor, claude,
   raycast …) — does each source serve the new mark

**svg in apps** — `logos.md` vendor section
3. storing and shipping svg in react today: inline TSX vs `.svg` + svgr vs `<img>` / css
   background / `mask-image` vs sprite — bundle, caching, Lighthouse / Core Web Vitals, RSC,
   accessibility, reuse outside react
4. svg → component tooling: svgr (still maintained?), vite-plugin-svgr, next.js turbopack loader
   rules, svgo presets — new versions, new traps, successors
5. the LLM-era angle: which svg form agents read, edit and reuse most reliably

**gifs** — `gifs.md`, `~/frame/gifs/AGENTS.md`
6. video → gif: ffmpeg filters, gifski, yt-dlp — new versions and flags; any better encoder,
   palette method or size/quality trade-off; gif vs mp4/webm/avif for readmes and chats
7. captions over clips without drawtext — is there a better path than html screenshots

**clips** — `clips.md`
8. terminal → clip: vhs (charmbracelet) and its rivals (asciinema + agg, t-rec, others) — output
   quality, svg vs gif, readme rendering on github

**illustration** — `illustration.md`, bytes `apps/atelier`
9. code → picture: generative svg technique (seeded shapes, paper/grain, shadows, dioramas),
   libraries and references at the foxglove quality bar; how the best studios prompt a model for
   one scene
10. prompt → image (the unbuilt room, [BYT-70](https://linear.app/x-com/issue/BYT-70)): which
    image models an agent can call now, cost, svg-capable output

### analysis

- art flaws: `grep -il 'art-kit\|gif\|logo\|svg\|atelier' ~/.claude/shelf/flawlog/*.md` since the
  last run — which branch failed, what the doc said
- logo freshness: `node …/art-kit/scripts/logo.ts --manifest <each logos.json>` across bytes and
  frame — every `~` line is a rebrand the vendored copy missed
- hand-drawn strays: grep the repos for svg components with no `logos.json` entry (a mark drawn,
  not fetched)
- coder retros that touched art: what the branch file left unclear

## artifacts

- `home/.claude/plugin-x/skills/art-kit/` — `SKILL.md`, `logos.md`, `gifs.md`, `clips.md`,
  `illustration.md`, `scripts/logo.ts`
- `~/frame/gifs/AGENTS.md` — the gif store contract
- bytes `apps/atelier` docs (`~/projects/bytes/apps/atelier/FTR.md`, `~/projects/bytes/apps/atelier/GLOSSARY.md`) — only when vector 9 or 10 changes the studio

## findings

- print dima the delta per branch, noop included
