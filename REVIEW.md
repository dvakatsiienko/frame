# REVIEW.md: frame

what every reviewer of a frame diff reads first: the local cards, the built-in `/code-review` on quick and main lanes only (a pr's ci round is its cold read), and sixth sense, by its path in their brief or skill; the ci reviewer by its prompt in bytes' shared `review-round.yml`, and coderabbit reads it through `.coderabbit.yaml`, its cli run not yet probed. it says what a failure looks like here and how a finding is written. the code's own rules stay where they live, named below.

## a finding

- each finding is a `path:line`, a concrete failure (an input and the wrong outcome) and a one-line fix
- a bug blocks; a nit is reported once, at the end, and never raised again on a later round
- a re-review reads only the diff since the last round, against the findings already raised; it says which are fixed, which are answered and which stand
- the summary opens with the count; with nothing to fix it says «nothing to fix» and stops
- a claim the reviewer could not run is labelled «not run», never written as checked

## what a failure looks like, per area

- a memory, rule or skill file (`home/.claude/`, `_clio/`): a word of dima's lost or reworded, a rule fixed in one of its homes and left in the others, a line that asks for an action without naming the call
- a guard or mod (`home/.claude/plugin-x/mods/`): a rule that fails open on a branch nobody tested (a nested `bash -c`, a flag value before the verb, a quote or fence), a new refusing rule outside `WARN_ONLY`, a save under `hooks/` that reloads a red mod into every session
- the `x` cli (`x/`): an exit code that reads success on a failed write, a json envelope a caller cannot parse, a verb whose help names a door that does not exist
- a script or hook (`script/`, `schedule/`, `.claude/hooks/`): a temp dir outside `TMPDIR`, a paid or networked call a test reaches for real, a wait with no deadline
- a test, anywhere: it reads live state instead of a fixture, or its red was never proven on the line it guards

## the standards it checks against

- `AGENTS.md` at the repo root and the nested one beside each touched file
- `home/.claude/plugin-x/mods/AGENTS.md` for a mod, `x/AGENTS.md` for the cli
- the `x:guide-code` skill, then `x:guide-typescript`, `x:guide-go` or `x:guide-react` for the file's language
- an app or mod's `FTR.md`, whose lines are the behaviour a change must keep
- beyond the documented rules, the Fowler smells (a mysterious name, duplicated code, speculative generality, a middle man) are judgement calls, labelled «possible <smell>», and a documented rule overrides them

## paths to skip

- generated or vendored files: the `!` paths in `biome.jsonc` (`assets/`, `brand/`, `logos/marks/`, the vendored quicksilver skill and ts lsp), and `pnpm-lock.yaml`
- dated history: `gazette/`, `home/.claude/shelf/flawlog/`, a test-drive's past rounds
