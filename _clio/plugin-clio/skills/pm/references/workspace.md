# linear workspace — x-com — recipes

the words live in `~/frame/docs/tracker/GLOSSARY.md` + the TRK adrs; a definition here that
disagrees with them is the bug. this file holds only what you run.

## which team

the test: «am i solving how we work (`FRM`), or building the thing (`BYT`)?» — never which repo the
files sit in. a deploy-quota problem is `FRM` even when every file is under `bytes`.
📌 `BYT/tooling` is app-local build config inside `bytes` only; cross-cutting tooling is `FRM`, always.

## projects — read live

```bash
x linear api 'query { teams(first: 10) { nodes { key projects(first: 50) { pageInfo { hasNextPage } nodes { name state description } } } } }'
```

the parking spot for a create comes from a project's live description, never from memory. a
project created or renamed as a decision lands with a TRK adr in the same batch.

## stories

a story is a parent with sub-tickets, the parent doubling as the batch id; order and dependency are
`blocks` relations, never title prefixes. an old «epic» met in a title or body becomes «story» in passing.

```bash
x as cclio -- linear issue update FRM-N --parent FRM-M
```

## model labels

`fable 5` · `opus 5` · `sonnet 5` · `haiku 5.5` — dima's note of which model a ticket wants; set one
only on a real preference. when he asks what to grab, read them and say which ticket wants which model.

## execution order — `sortOrder`

one float per issue, lower first, shared by every view (never per milestone). read the current
values, then write the wanted order spaced by 1000, negative and below the neighbours so untouched
tickets stay put; read it back:

```bash
x linear api 'mutation { issueUpdate(id: "FRM-39", input: { sortOrder: -194319.29 }) { success issue { identifier sortOrder } } }'
x linear api 'query { issue(id: "FRM-39") { identifier sortOrder } }'
```

## quota — 250 non-archived, workspace-wide

```bash
x linear api 'query { issues(first: 250, filter: {}) { nodes { id } } }' | jq '.data.issues.nodes | length'
```

auto-archive is on: FRM and BYT archive completed and canceled tickets after 1 month (`autoArchivePeriod: 1`, read 2026-10-13), but never while their project or cycle is open; `x linear archive --days 14 --apply` does the rest.
