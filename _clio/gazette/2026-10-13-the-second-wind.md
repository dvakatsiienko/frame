---
date: 2026-10-13
slug: the-second-wind
tickets: [FRM-267, BYT-124, BYT-125]
posted: {health: yes}
---

# 🗞️ cclio's gazette · the second wind

## shipped
- 🐦‍🔥 second wind: a board button per session that checkpoints, compacts and re-ingests its own handoff, the role's init list first, the ingest queued right behind the compact; pressed live on the coder and on cclio
- mods round 4 (l14, 6 of 7): mods survive a reboot and an app restart, glide follows the coder's plan step and refuses a second lane per topic, member asks show on the board in an amber subcard, three reply-style misses are redrawn on screen, the date-bomb lint, the queued-prompt key leak fixed
- [FRM-267](https://linear.app/x-com/issue/FRM-267) sweep step 9 opened: nurture-skills merged into nurture-memory, the skills research (3 lanes) distilled into `author-memory/references/skill.md`
- the first `/doctor prompt-audit`: 7 readers, 154 findings (37 high); batches 1–3 applied across ~45 files, with fixes the audit's own merger got wrong caught on the way
- `x:cclio-mode` (a coder turns into a mini cclio in one call), `x:shape-recipe` grills every run first, refresh-monorepo run #2 → `docs/knowledge/monorepo.md`; [BYT-124](https://linear.app/x-com/issue/BYT-124) holds the frame → bytes merge research, [BYT-125](https://linear.app/x-com/issue/BYT-125) refreshed
- you-should-know runs only in cclio's folder; the notion token moved to 1password (`op.env`), proven both ways; ccrow is a `--bg` session cclio starts and stops

## tricks gained
- the prompt audit finds stale facts and file-to-file contradictions, not old-model cruft: about 40 lines that no longer matched the repo
- a mod already rewrites every reply as it streams (`ui.render` on `AssistantMessage`), so «no hook runs before a reply shows» was an untested can't; second time in a day, now a check (PK-118)
- `claude plugin eval` runs ~6 agent sessions a case: no evals until the $200 plan (dima, 20:03)
- a delete is a graph operation: two «stale» research docs were still pointed at by a recipe and a live trial, caught by the commit gate and restored
- `ntn api` waits on stdin forever; give it `-d` or `</dev/null`

## state
- tomorrow opens on the memory sweep, no mods lane: 9.2 census, 9.3 conflict hunt, 9.4 groom with audit batch 4
- the mods lane parks with its leftovers listed (`.scratch/mods-l13/leftovers-2026-10-13.md`, PK-120)
- frame pushed; bytes holds cclio's turbo.jsonc + AGENTS moves uncommitted (a push redeploys all 8 apps)

## trail
- shipped: second wind live · mods round 4 (6/7) · sweep step 9 opened, skills research distilled · first prompt audit, batches 1–3 applied
- open: sweep 9.2–9.4 tomorrow (no evals) · PK-118 reply-check remind mode · the mods lane resumes later from its leftovers
- state: frame pushed · bytes uncommitted (turbo redeploy) · coder parked · ccrow stopped at the halt
