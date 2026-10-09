# test drive — Backlog.md as cclio's pocket

Ticket: none · window 2026-10-09 → 2026-10-23 · verdict date lives here only

the trial: brew `backlog-md` 1.53.0, project `cclio/backlog/` (prefix `pk`, no auto-commit, no agent files, no branch scan); `pocket.md` frozen. our contract in its config: statuses open · claimed · blocked · waiting · done; priority now · next · later; labels xs · s · m · l; types task · research · grill · test-drive · idea · wish · question. 32 pocket items migrated as `pk-N`, pocket number in the title.

research (3 lanes, 2026-10-09): `cclio/.scratch/todo-trackers-top5.md` (opus source lane), the exa + parallel runs. all three: keep Backlog.md, add our own validator + stale check as a boot hook. runner-ups: beads (most mechanisms, a Dolt db — unreadable in obsidian), tasks-axi (new, one file, fixed line form, expiring holds, 64 stars).

## stress list — each feature, the real ask it is tried on, the numbers a round records

- intake: every inbox drop as `backlog task create` with type + priority + size — drops per boot, seconds per drop, a field missing
- the board: `backlog board` / `backlog task list --priority now` as the «what's next» answer — matches the order dima expects? y/n
- search: `backlog search` on a real «where is X» ask — ms, hit rank of the right item
- `--ready` + `--depends-on`: blocked items leave the ready list — one real blocked pair
- expiry: `--due-date` on xs/s items, read by our stale check — overdue count per boot
- done: `backlog task edit --status done` then `backlog cleanup` — the live list shrinks, the archive keeps the record
- `doctor`: run every boot — exit code, ms; known gap: an archived id is reused (pk-1, day 0) and doctor misses it
- our validator: a boot script over the frontmatter (enums, size present, expiry on xs/s, waiting carries its check) — exits non-zero on drift, proven red
- drift: count items whose frontmatter breaks the template after 2 weeks of agent writes — the number dima's screenshot showed in pocket.md
- dima's read: the web ui (`backlog browser`, :6420) and the files in obsidian — his y/n on reading from the phone
- cost: tokens per boot read (`task list --plain`) vs `pocket.md` (~36k chars)

## known breaks to watch (research)

- auto-commit sweeps the whole backlog dir (#795) — off here
- web ui slows at hundreds of tasks (#807) — we have 32
- `backlog init` can write agent instruction files — skipped here (integration none)

## rounds

- 2026-10-09 day 0: install, config, 32 items migrated, doctor 87 ms clean, search 89 ms ranked; archived-id reuse found; UTC timestamps
