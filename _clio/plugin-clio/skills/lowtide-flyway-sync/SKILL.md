---
name: lowtide-flyway-sync
description: lowtide, a flyway matched to the live state — load when dima says «sync your flyway», «flyway sync», «clear done, reorder», and right after a second-wind pickup (`clio:checkpoint` § 4) — every clio thread, main or a wing.
---

# /clio:lowtide-flyway-sync — the flyway matches the live state

the pass that applies `habit-shared-files` § the flyway; every command runs from `~/frame/_clio`.

1. **read it**: `grep -nE '^- \[' pocket/tasks/pk-*flyway-main.md` (a wing: `pocket/tasks/pk-*flyway-wing-<N>.md`)
2. **judge each line by its home, never by memory**: `node script/flyway-done.ts <PK> --check` runs first and prints every open line beside the live state of each id it names (🔴 a closed one, ⚪ none named: read that line's home by hand); then a ticket's state (`x linear read`), a lane plan tick, a commit on origin/main, an orbit tick. a line is done only when that home shows it; a line moved elsewhere (a rider, a ticket body, another flyway) is done once that home holds it, its done note naming it
3. **clear**: `node script/flyway-done.ts <PK> <n>` per done line, highest first (each clear renumbers). 📌 it never refuses: a «check: <id> is still <state>» print means the line is already gone, so a premature one goes back at once with `--add` plus a `reopened <stamp>: <line>` note (`backlog task edit <N> --append-notes`), its done note kept
4. **reorder**: what runs now first, then the rest by importance; each wait carries its prefix, which `--sort` reads, and its suffix (`⏳ … — waits for:`, `📅 … — on:`, `💤 … — later:`), a cleared wait (a 📅 date reached, a ⏳ thing arrived) drops both and moves up, then `node script/flyway-done.ts <PK> --sort`
5. **prove**: `node script/pocket-check.ts` green
6. **tell the wings** (main only): one `SendMessage` to every live clio thread in `ListAgents`: «sync your flyway: clear done lines, reorder, give each wait its ⏳/📅/💤 prefix and its suffix, a cleared wait moves up»; a wing with no live thread keeps its flyway for the next one
7. **reply**: lines cleared, lines moved up, wings told; each cleared line's home named
