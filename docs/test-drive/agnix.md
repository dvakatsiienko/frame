---
status: live
until: 2026-11-04
dies-when: the verdict line below is written
---

# agnix — a linter for agent configs: SKILL.md, CLAUDE.md, agents, hooks, settings, MCP

Ticket: none (pocket PK-203, the system checkup)

**test card:** we believe agnix catches config defects no check of ours sees (frontmatter that a strict parser rejects, settings keys cc ignores, hook schema slips) · we test it by running it as a `clio:system-checkup` check over `~/frame` on every checkup run, and once over `~/projects/bytes` · we measure findings per run, real vs noise (each one opened at its spot), seconds, and how many real ones no check of ours caught · we're right if each run surfaces at least one real defect nobody else caught, or the noise stays under 50 % once our layout's false positives are suppressed in `.agnix.toml`
**kill rule:** two runs in a row with only noise — drop it; it needs telemetry on, or a network call beyond the npm fetch — drop it

the run: `npx -y agnix@<version> --target claude-code --format json .` from `~/frame` (flags before the path; read-only unless `--fix` is passed, telemetry off by default — `agnix telemetry status`).

## stress list
- frontmatter parse (AS-016, CC-AG-007) — every SKILL.md and agent card — errors found vs what cc itself loads
- settings validity (CC-SET-*) — `home/.claude/settings.json` — real vs the mirror-layout false positive (it reads the user settings as project settings)
- hooks (CC-HK-*) — our hook scripts and plugin hooks — schema slips found
- rule file size (CC-MEM-014) — `rules/` — agrees with memory-lint's budgets or not
- `--fix-safe` — one throwaway branch — what a safe fix changes
- `explain <id>` — one rule per real finding — whether its evidence link holds up
- a second repo — `~/projects/bytes` — findings and noise

## rounds
- 2026-10-19 · round 1, frame, v0.59.0 · 603 files in ~1 s; 7 errors, 28 warnings, 43 info · **7 real**: 7 frontmatter descriptions (4 skills, 3 agent cards) held a bare «: » that strict YAML (go-yaml, yq) rejects — cc loads them anyway, a strict reader would not; fixed in place (folded into `>-` block scalars), re-run 0 errors. noise: 14 CC-SET-034 (our `home/.claude/settings.json` is the user settings through the mirror, agnix reads it as project settings), 9 CC-SK-021 (repo path `home/.claude` read as a user dir). worth a look: `fleet-output-format.md` 224 lines (cc recommends < 200), quicksilver's `$0` inside code becomes `$ARGUMENTS[0]` · grade: **a real catch no check of ours made**, noise ~70 % of warnings until suppressed

- 2026-10-22 · round 2, frame, v0.59.0, the halt's checkup slice · 0 errors (round 1: 7, fixed), 31 warnings, 45 info · warnings +3 vs round 1, unread · the usual door (none) would have caught nothing

## verdict
