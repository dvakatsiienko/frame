---
kind: refresh
owner: coordinator
artifacts:
  - docs/knowledge/code-storage.md
script: none
---

# refresh-code-storage

keeps the fleet's picture of code hosting true: our backup, github's state under agent load, and the next-gen hosts and version-control tools worth a move someday. born 2026-10-13.

## the want

> what if github dies suddenly? how to have a synced backup mirror of my repos, just in case? no budget, a generous free tier is really nice to have. ideally solid. (2026-10-13)

> backup only for now, but hunt for github alternatives as well, out of curiosity: everyone says github is not so good anymore because of how agents work and how often they push, the ecosystem is changing, even git is not seen as agent-grade. new platforms appear. hunt for places we could migrate to someday, paid or free, prefer a generous free tier. i want code storage that is agent-friendly, looks pretty, and is ideally next gen. (2026-10-13)

> it's good to have a prepped recipe to see what's happening via a run, instead of me explaining every time why and what to research. keep it compact. (2026-10-13)

> i wish code storage had a cli, ideally, like gh. (2026-10-14)

his standing calls: gitlab is out (archaic); the backup is codeberg-first until a run says otherwise; jj is tried in a bytes lane only.

## the run

- suggest a run when: github has a big outage or policy change, a host on the shortlist ships a free tier, or two months passed

1. **groom**: `clio:shape-recipe` step 0, the grill. done: his word on the vectors. (open)
2. **research**: `pnpm recipe:brief refresh-code-storage` → `pnpm research:lanes` + the `researcher` agent on primary pages (pricing, llms.txt, status feeds). done: every lane landed or failed out loud. (script)
3. **distill** into the knowledge file: rewrite the ranked list and the facts, one `## runs` line. done: the file carries the delta, or «unchanged». (open)
4. **findings print**, then **log** today's line in `log.md`. done: the line is there. (template)

## vectors

### research
- our backup: is the codeberg mirror still the best free door, did a host start pull-mirroring github for free
- github under agent load: outages, rate limits, pricing and policy changes since the last run
- next-gen hosts: new or relaunched ones, their free tiers, agent features (api-first repos, ephemeral branches, sync), and whether they look good
- beyond git: jj, sapling, pijul and the like — adoption, which hosts serve them
- the shortlist re-checked item by item: tangled, mesa, code.storage, cloudflare artifacts, depot code
- the cli for every host: is there one (official or community), is it in brew, maintained, and how close to `gh` (repos, prs, issues, actions, a raw api escape hatch); codeberg's `fj` vs `berg` re-checked each run

### analysis
- the backup itself: does the mirror still match github's head, is the key still in 1password

## artifacts

- `docs/knowledge/code-storage.md` — the reference data between runs: core facts, the ranked shortlist, the beyond-git notes, one line per run; the distill rewrites it, never appends raw research

## findings

the print adds the shortlist's movement (up, down, new, gone) and the backup's health; checklist: the five shortlist hosts, the cli per host, the backup mirror, the key.
