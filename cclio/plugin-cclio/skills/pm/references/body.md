# pm — the body, writing, run markers

read before a ticket create, a body rewrite, or a comment cclio writes (`cclio:pm` § write and close).

## the body — a spec seed

`to-spec` runs on the body alone (dima, 2026-10-07). in order, a small ticket filling only the lines it has:

- `lane: <kind>` (the four kinds: `fleet-vibe` § entities, lane) — the first line, the kind word only; `repo: <name>` under it once signed (`cclio:shape-lane` § 3)
- **wish** — dima's words, folded (`cclio/memory/craft-pm.md` § wishes), one point per numbered W-line; his raw drop stays in the pocket notes, linked (`craft-pm` § wishes)
- **dima notes** — his later notes and verdicts, folded and dated, read by the ask-guard; a later ask joins the wish block as W-lines
- **why** — what hurts today
- **stories** — 3–8 lines, «as dima, i …»
- **proposed** — his vision of the solve, open until a grill moves a line to decided
- **decided** — each call with its source (dima, a grill, an adr)
- **open** — `?` lines; a ticket goes to `to-spec` only with this empty
- **🎯 done test** — dima's «how i'll know it works», given/when/then; the exit lines live in the spec, written from it at dispatch (`craft-fleet-flow` § lane init)
- **out** — out of scope and «decided against», so nobody re-proposes it
- **refs** — research, designs, prior art
- **closing word** — at close
- **`## signed`** — the last section, appended to, never edited: `✍️ signed <YYYY-MM-DD> · body <hash>` at his sign (`cclio:shape-lane` § 4 owns the hash), `✍️ re-signed <YYYY-MM-DD> — <what changed> · body <hash>`, `✏️ changed <YYYY-MM-DD> — <what>, no re-sign: tiny · body <hash>`, `merge: pre-approved` when his sign covers the merge, `🚀 dispatched <YYYY-MM-DD>` or `🚫 cancelled <YYYY-MM-DD> — <why>` (`cclio:shape-lane-dispatch`), `↩️ back to Todo <YYYY-MM-DD> — <why> · left: <asks>` (`cclio:halt`), `✍️ re-sign pending <YYYY-MM-DD> — <what changed>` when a scope moved after his sign: the chunk is blocked until his re-sign, asked in orbit the same turn (dima o66)

**the ticket ↔ spec rule, its one home** (dima, 2026-10-10: «i still worry that it is somewhat scattered across places»):
- want in the ticket: the want lives in the ticket's wish block, always — a moved want is edited there, before and after dispatch — on a signed ticket with its `## signed` line in the same write (`cclio:shape-lane` § 4)
- how to spec: the how is the body's `proposed` / `decided` until dispatch; `to-spec` then moves it into `.scratch/<feature>/spec.md`, beside the exit lines
  - each chunk section opens with its own `wish: FRM-N` in place of a problem statement, never restates the want, and cites the W-lines each part serves (`script/wish-cover.ts` exits 0 on it)
  - steers on the how land in the spec, and its outcome folds into the closing word when the run lands
- run check, logged in `docs/test-drive/spec-pipeline.md`: «did `to-spec` need anything outside the body?»
- slices: the slices `to-tickets` cuts live in the coder's worktree `.scratch/<feature>/issues/`, never in linear

- 🚨 **dima's words never go into a comment**: the body is read by everyone, a comment by a
  graphql fetch. comments carry trail only — run stamps, «done, see commit», a member's done report
- a `standing` ticket carries no comments and an empty body: a round on it is a child ticket, which takes
  the wish, the state, the pr and the done report; a coder brief names the child, never the
  standing ticket (dima, 2026-09-30, BYT-105). only a story that closes holds a body describing it (dima, 2026-10-23: «standing tickets are not allowed to have a cluttered body»)

## writing — pretty, short, true

- lowercase register, emoji and ascii art welcome
- a title is subject-first and assertive, like a commit subject: «prune brew of unused formulae»;
  a blurry ask gets a sharp title proposed, never filed as mush
- the body holds key data, a list by default; prose stays where it carries what a list would drop
  (a decision's reasoning, a grill summary). one recommendation, the runner-up a clause
- no dates or lineage: linear stores dates, a relation replaces «split out of …»; a date that IS
  the fact (an expiry, a deadline) stays
- 🚨 **a rewrite starts with a full-body fetch the same turn** (`x linear body`) — linear keeps no
  description history (DOT-228). merge new into old, drop only the stale
- 🚨 **dima's text survives every edit** — his notes, asks, takes: restructure around them; one
  that looks stale goes to him first, the original beside the change. an approved fold is not an
  approve to drop his words
- a suspected wall of prose is flagged to him, never stripped on a heuristic
- tracked means every surface: project descriptions and overviews, health updates (their ids do
  not auto-link — write full links), label names and colours, team descriptions; a new project gets dima as lead, its
  real status, an emoji-led lowercase description and a short overview
- drafts go out as one batch for one approval, never edit ping-pong
- 🚨 every id is a link (`rules/fleet-output-format.md`) — the most-repeated slip on this surface: scan before sending

## run markers

mint one per session at the first write, reuse it all session: `<surface>·<YYYYMMDD>·<slug>`
(`cc·20260819·batch1`); a pulled session continues the run from the CST META. it is the last line
of a body cclio creates and of every comment cclio writes:

```
⸻ 🪪 cc·20260819·batch1 · <model name> · agent run stamp — please keep 🙏
```

- before a create, search the marker plus the title stem: a hit is updated, never filed twice
- a ticket dima wrote never gets a stamp; an existing ticket gets it on the comment only
