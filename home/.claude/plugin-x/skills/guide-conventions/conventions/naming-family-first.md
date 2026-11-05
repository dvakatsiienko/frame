# naming — the word siblings share leads

the rule, its test and the rename-on-every-layer done line live in root `CLAUDE.md` § naming; this file holds
what the head can be, the edge shapes and where the rule stops.

## after the head, say what it does

the words past the head tell a newcomer what the thing does (root `CLAUDE.md`). dima's own before → after:

- `refresh-jev.md` → `refresh-classification-branch`
- `x-otel` → `x-cc-otel`
- `habit-pacing` → `habit-dima-comms-pacing`
- `quiet-canary` → `quiet-delivery-test`: «canary» says nothing to a newcomer

## what the head can be

- an area: `crew-codie`, `mods:test`, `speak:build`, `fleet-vibe`
- a thing: `handoff-create`, `x lane commit`, `x linear read`, `usageSave`, `FormSubmit`
- an action: `audit-codie`, `shape-lane`, `author-memory`
- a kind: `guide-react`, `habit-cto`, `refresh-speak`

a family is measured in the list it sorts in, so `x lane` holds both `merge-main`, `merge-auto` and `pr-open`, `pr-body`.

- the test, worked: `handoff-create`, `handoff-delete`, `handoff-list` → handoff; `audit-codie`, `audit-sixth-sense`, `audit-clio` → audit
- no sibling in sight (`siesta`, `top-seven`) → the first sibling renames it into a family
- a free root: `x fleet audit`, then `x fleet audit-*`
- 🚫 `codie-crew`, `x-plugin`: the shared word went last, and the family scatters

## the edge shapes

- nested families read general to specific: `refresh-crew-coordinator-helga`, `x fleet audit-codie`
- both words repeat, a grid: the family that will grow leads, usually the area (`speak:test`, not `test:speak`), and `audit-codie` over `codie-audit`, since audit grows and codie has no such family in `x fleet`. a repo-wide loop verb keeps its `:` variants, `test:watch`, `dev:cv`; `package-json.md` holds that shape
- a set read in time order leads with its date: `2026-11-04-the-takeover-and-the-piles.md`; a fixed order with its number: `01-a-live-proof-runs-on-its-own-store.md`, `0001-sline-server-provided-numbers-only.md`
- a sidecar or a kind tail stays with its subject: `siesta-gate.test.ts`, `crew-codie/SKILL.md`, `<feature>-codie-retro.md`
- a machine-read grammar orders its fields by who filters first: `<audience>--<lane>--<slug>--by-<author>--<stamp>.md`
- the family's separator follows the surface: `-` in files and skills, `:` in scripts, a space in `x` verbs, camelCase and PascalCase in code
- a character takes a short name and no family: `helga`, `crow` (`x:top-seven`)
- `_` lifts a home or an infrastructure file above its list: `_clio`, `_MEMORY.md`

## code

- ✅ `FormSubmit`, `FormLogin`, `FormField` · 🚫 `SubmitForm`, `LoginForm`
- ✅ `usageSave`, `usageRead`, `usagePath` · 🚫 `saveUsage`, `readUsage`

## where the rule stops

- a framework's fixed names stay as the framework spells them (`page.tsx`, `useEffect`, `getServerSideProps`)
- a React hook keeps its `use` prefix, the rest follows it: `useUsage`, `useFormSubmit`
- a dependency's api is never renamed through a wrapper just to match

## why

Dima reads the tree by families; a name that buries the shared word scatters one feature across the alphabet
(«the grouping of stuff like files, folders becomes scattered … entity-first makes things more
organized, auto-relates related stuff by its name», 2026-09-27). «entity» was an early example of the shared
word, and on 2026-11-05 it picked `codie-audit` over his `audit-codie`, so the rule now names the goal (dima, that day:
«certain naming pattern allows for stuff colocation and reads much more easily. imagine all crew-* would be *-crew
instead — then everything would be scattered»).