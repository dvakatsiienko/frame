# TRK-0005 — labels live in mutually exclusive groups

status: accepted · 2026-09-05

decision: dima turned the label vocabulary into linear **label groups**, which the api enforces as
mutually exclusive — one label per group on a ticket, an update carrying two is refused.

- `executor` = `agent` · `human` — who does the work
- `type` = `bug` · `feature` · `improvement` — what it is
- `blocker` = `needs human` · `needs agent` — who is waiting; a blocker is not a role, the executor stays
- `domain` = `memory` · `skill` · `tools` — which system it touches; the project field says where the work lives
- `model` = `fable 5` · `opus 5` · `sonnet 5` · `haiku 4.5` — dima's routing notation

`needs data` is **folded into `research`**: both described «output is knowledge, not code», and
`needs data` had no distinct use since TRK-0004 created it. seven tickets relabelled, the label deleted,
`research`'s description absorbs the meaning. TRK-0004's «closed at three» becomes closed at two.

loose labels stay loose because they combine: `freebie` `granular` `walkthrough` `research` `test drive`
`standing`.

consequences: the role slot in `docs/tracker/GLOSSARY.md` becomes the group list; the triage bridge
maps mattpocock `needs-info` onto the two blockers by direction; `x:pm` sends exactly one label per
group and never a second from the same one.
