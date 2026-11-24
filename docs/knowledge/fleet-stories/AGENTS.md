# AGENTS.md: fleet stories

one problem's arc over days, told so the next session does not walk it again: what happened, the numbers, the cause, what changed, the line that keeps it away. a wrong call of ours is told plainly, with who made it and what it cost; a problem nobody caused is told the same way.

## who starts one

- **a story is written only on dima's request** (dima, 2026-11-24: «hand-picked by me, because I evaluate differently than you»); an incident worth one gets a one-line proposal to him, never a file

## names

- **a story's dir name is a short sentence: who did what to whom**, so the name alone tells the story: `guard-locks-out-the-fleet`, never `guard-lockout`; stories of one family open with the same words: `cpu-overload-freezes-the-fleet-tests-cli-go`, `…-tests-cc-mods`
- a log keeps a noun name: `comms-log`
- **a file inside a story says what it holds**: `fixes-applied-and-open.md`, `measured-cases.md`; never a bare `cases.md`

## the shape

- one dir per story: `<name>/story.md` is its entry, every other file of that story sits beside it
- a story past five files sorts them into `research/<question>/` (its `verdict.md` or measured rows on top, the raw lanes under `raw/`), `measures/` and `scripts/`
- `story.md` opens with frontmatter: `status: open | sealed`, `dates: <first> → <last>`, `tickets: [FRM-N, …]`, `tags: [<words>]`, `fed-by: incidents`
- a fact an agent needs before acting goes to a shelf file in `docs/knowledge/` (`x knowledge read <name>`), linked from the story; the story keeps the arc
- not here: the day's raw flaws (the flawlog), the day's news (the gazette), one answered question (`docs/research/`), a tool on trial (`docs/test-drive/`)

## find one

- by tag: `rg -l 'tags:.*<word>' ~/frame/docs/knowledge/fleet-stories`
- open ones: `rg -l '^status: open' ~/frame/docs/knowledge/fleet-stories`

## the stories

- the list is this dir; each `story.md` opens with its status and dates
