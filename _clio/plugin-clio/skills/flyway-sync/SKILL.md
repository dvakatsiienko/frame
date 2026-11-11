---
description: load when dima says «sync your flyway», «flyway sync», «clear done, reorder», and right after a second-wind pickup (`clio:checkpoint` § 4) — every clio seat, main or a wing.
---

# /clio:flyway-sync — the flyway matches the live state

the flyway's rules (order, markers, one per seat) are `habit-shared-files` § the flyway; this is the pass that applies them.

1. **read it**: `grep -nE '^- \[' "pocket/tasks/<your flyway file>"`; main's is `flyway: main`, a wing's `flyway: wing <N>`
2. **judge each line by its home, never by memory**: a ticket's state (`x linear read`), a lane plan tick, a commit on origin/main, an orbit tick. a line is done only when that home shows it; a line whose work moved to another home (a rider, a ticket body, another flyway) is done only when that home holds it, and its done note names it
3. **clear**: `node script/flyway-done.ts <PK> <n>` per done line, the highest number first. 📌 it never refuses: a «check: … still Todo» print means the line is already gone, so a premature one goes back at once with `--add`
4. **reorder**: what runs now first, then the rest by importance; each wait gets its marker (`— waits for:`, `— on:`, `— later:`), then `node script/flyway-done.ts <PK> --sort`
5. **prove**: `node script/pocket-check.ts` green
6. **tell the wings** (main only): one `SendMessage` to every live clio seat in `ListAgents`: «sync your flyway: clear done lines, reorder, give each wait its marker»; a wing with no live seat keeps its flyway for the next one
7. **reply**: lines cleared, lines moved up, wings told; each cleared line's home named
