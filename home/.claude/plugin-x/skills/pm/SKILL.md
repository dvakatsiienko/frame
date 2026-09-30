---
name: pm
description: >-
  Load BEFORE any `linear` command runs — reads included — any FRM-N/BYT-N mention,
  "read/check <ticket>", create/update/comment/close/triage, "save this idea as a ticket",
  "ticketify", scope changes to tracked work, or /x:pm.
---

# PM — literal PM mode over Linear

🚨 **Trigger is the `linear` binary, not the topic.** If the next tool call contains `linear`,
this skill loads first — including reads, including mid-conversation continuations («post it»,
«let's try», «go ahead») where the ticket context arrived turns earlier. A conversation that has
been discussing tickets without loading pm has already drifted; load on the first command, not
the first mention.

**lane** — `cw`: `x-cw__pm_guide` for the contract, then the `linear` cli through the shell · `cc`: Bash.

📌 The always-loaded `rules/linear-flow.md` already holds what must be true whenever a ticket is
touched at all — where tickets live, In Progress the moment work starts, never inventing an id.
On `cw` nothing auto-loads it: read it at
[`../../rules/linear-flow.md`](../../rules/linear-flow.md) in the plugin root, or take it inlined
from `x-cw__pm_guide`. This skill is the PM handbook on top of that: field contracts, judgment, CLI
mechanics. Do not restate the rule file here; when the two overlap, edit the rule file.

You are the PM for the duration of the request. One tracker: **Linear**, workspace `x-com`.

Two files, and the split matters:

- **vocabulary is normative in the repo** — `~/frame/docs/tracker/CONTEXT.md` (glossary)
  and `~/frame/docs/tracker/adr/` (`TRK-nnnn` decisions). what a team, project, story,
  label or assignee *means* is settled there. never restate it, never contradict it.
- **recipes are here** — [references/workspace.md](references/workspace.md): current projects,
  states, cli mechanics, quota ops. read it before the first write of a session.

Channel: the `linear` CLI; `linear api '<graphql>'` for anything it lacks. **Pick by probing
your own tool list, never by guessing the platform** — first match wins:

1. a shell tool (`Bash` on `cc`, Desktop Commander on `cw`) → the `linear` CLI through it.
2. no shell tool at all (Claude iOS) → the Linear MCP connector — the one narrow exception to
   «never the Linear MCP».
3. a shell but no `linear` binary or auth → say so and stop; never reach for the MCP to route
   around a broken CLI.

Everything below is transport-independent; only the call layer differs.

## CLI cheatsheet — inlined on purpose

📌 The calls that get guessed wrong live here, in the file you are already reading — invented
flags (`issue list --query`, `issue search`) came from citing recipes that sat unloaded. This
list is **what breaks**; for anything not on it, `linear <cmd> --help` confirms a flag in one
call and is always cheaper than a wrong guess.

- **listing** — `linear issue query --team FRM`. `issue list` shows only issues assigned to *you*,
  and there is no `--query` flag on it.
- **old ids resolve** — a team key change keeps every old identifier alive: `DOT-26` answers as `FRM-26` in `issue(id:)` and in search, so old ids in text never need a sweep.
- **searching** — no `issue search` subcommand exists. Use `linear api` with `searchIssues`.
- **multi-line bodies** — write a file, pass `--description-file f.md` (`issue create` /
  `issue update`) or `--body-file f.md` (`issue comment add` / `issue comment update` — there is no
  top-level `comment` command). Inline `--description "$(cat …)"` lets the shell mangle `$VAR` and
  backticks silently.
- **labels replace, never add** — `issue update --label` drops every label you omit, silently, with
  a success message. Pass the full intended set (`--label agent --label improvement --label 'opus
  5'`) and verify: `linear api 'query { issue(id: "FRM-N") { labels { nodes { name } } } }'`.
- **state on create** — `issue create` with no `--state` lands in **Triage**, and that is the
  contract (dima's call 2026-08-31): agent-created tickets are BORN in Triage so he sees, trims
  and steers every one. Never pass `--state Todo` on create; promotion out of Triage is his word.
- **reading fields back** — `issue view --json` exits 5, and `issue view` omits comments. Use
  `linear api` GraphQL for any read that informs a decision, comments included.
- **archiving** — no CLI verb. `linear api 'mutation { issueArchive(id: "<uuid>") { success } }'`,
  uuid from `linear api 'query { issue(id: "DOT-3") { id } }'`.
- **hanging >15s** — likely a hidden keychain prompt. Tell Dima to check the screen.
- **labels via the api**: names take no emoji (`Label names cannot contain emojis`); label and
  project descriptions cap at 255 characters — the pattern text lives in the ticket, the
  description points at it.

## The framework underneath

Matt Pocock's pipeline (`grilling` → `domain-modeling` → `to-spec` → `to-tickets` → `triage` →
`implement` → `code-review`) is the spine; the role mapping onto our linear lives in
`~/frame/docs/tracker/CONTEXT.md` — absolute on purpose, the tracker is ONE domain from any
repo. Reach for his skills by name when a stage's depth is needed.

## The two jobs

1. **Tweak an existing ticket** — read it first (`linear issue view`), then edit surgically; keep the ticket's voice.
2. **Capture an idea as a new ticket** — precise but compact: the idea's core, the trigger context, stated constraints.

## Field contract (every create AND update)

Role, priority and estimate are **always filled and current** — monitoring them is your job, not Dima's:

- **Role first.** Every ticket carries one role (state ↔ label map in [references/workspace.md](references/workspace.md)), assigned by you on every create and every update, without being asked. Judge it from the ticket's own readiness: fully specified and mechanical enough to hand over → `agent`; needs Dima's taste or hands → `human`; a real question blocks it → `needs human` (an agent waiting on Dima) or `needs agent` (Dima waiting on agent research) — pick by **who is waiting**; dead → Canceled. New tickets are born fully fielded AND in Triage — his review gate, see state-on-create in the cheatsheet. A ticket blocked on quota, time, or another ticket keeps its real role — a blocker is a relation, never a role.
- **Kind second.** Alongside the role, every ticket carries one kind — `bug` / `feature` /
  `improvement` (see [references/workspace.md](references/workspace.md)). Role says who does it,
  kind says what it is; both are yours to keep current.
- **State and assignee floor** — `rules/linear-flow.md` binds with or without this skill: state
  tracks reality, never pass `--assignee`. On top of it: assigned-to-Dima means strictly his —
  never resolve, start, or reassign it; the `human` label says a human does the work, not *which*
  human (importance is priority's job).
- **Starting work pins it in sline** (`cc` only). Same turn as the In Progress move, replace this
  session's one-slot focus file — sline renders it as `🪄 FRM-N` on line 1, and `claim FRM-N` typed
  by Dima writes the same slot:
  `printf '{"session_id":"%s","prompt":"claim FRM-N"}' "$CLAUDE_CODE_SESSION_ID" | ~/.claude/shelf/hooks/sline-focus.sh` — that hook is the ONLY writer of the slot, and it also kicks off the status fetch a raw write skips (`shelf/hooks/FOCUS-SPEC.md`)
- 📌 `--label` **replaces** the whole label set rather than adding to it. Always pass role AND
  kind together, or one of them is silently dropped.
- On create: propose priority (1–4) + estimate (1–5) + project + **parent and milestone** — a
  ticket with a parent inherits the parent's milestone unless the body says why not; no milestone
  means invisible on the «where are we» board. Projectless is legal for one-offs and idea pools —
  do not force one.
- **Parent-or-flat test on create**: name the story this ticket dies with — none names it → flat
  project-level. The parking spot comes from the project's live description, never memory recall.
- **Milestone create**: linear appends a new milestone LAST — set `sortOrder` at create or
  reorder in the same turn, and verify the project's milestone order before reporting done.
- On any scope change to an existing ticket: re-eval both, propose the delta.
- **Structural tracker change** (project born/dissolved, term decided, label vocabulary shift) →
  `~/frame/docs/tracker/CONTEXT.md` / TRK adr updated **in the same batch**, never later.
- Approval is **batched and diff-shaped**: one bullet list per edit batch, one `field: old → new` line per change, one approve — never N sequential confirms. Silence on a line in Dima's reply = accepted.

## The assumption gate — run before every estimate

**If you cannot estimate a ticket without inventing a fact, it is not estimable — it is blocked.**
Label it `needs human` (or `needs agent`, by who is waiting), and write the invented fact into the
body as an open question instead of quietly assuming it.

Why this gate and not another: agent-written tickets do not fail on format. They score at or above
hand-written ones on structure. They fail on **unstated assumptions** — so the leverage is in
probing what a ticket does not say, never in polishing how it says it.

How to run it, on every create and every estimate:

- Write the estimate first, then ask what you had to believe to land on that number. Anything on
  that list Dima never said is an unstated assumption.
- One open question is enough to block. Do not average it away into a bigger estimate — a number
  covering an unknown reads as certainty the ticket does not have.
- Put the questions in the body as questions, not as decisions. `?` prefix, one line each.
- 📌 The gate blocks the **estimate**, never the capture. Still create the ticket, still fill role,
  kind, priority and project — an idea is never lost to a missing answer.

## Run markers — stamp every agent tracker write

Provenance and undo. A bad batch reverts in one pass, and a later session can tell it already filed
a ticket instead of filing it twice. No tracker vendor ships this; the marker is ours.

**Mint once per working session**, at the first tracker write, then reuse it for every write in that
session: `<surface>·<YYYYMMDD>·<slug>` — surface ∈ `cc` · `cw` · `ios` (`dp` only in stamps older than 2026-09-04), slug short and
kebab (`cc·20260819·batch1`). Never mint a second one mid-session.

**Stamp** as the **last line** of a created ticket body and of any comment you author:

```
⸻ 🪪 cc·20260819·batch1 · <model name> · agent run stamp — please keep 🙏
```

It is a footer, not a label — labels sprawl against the 250 quota, and bodies are searchable. The
middot triple is the grep token; the human-readable tail exists so nobody mistakes it for junk.

**Before creating, check you have not already filed it.** Search the marker plus the title stem; a
hit means update that ticket instead of creating a second one:

```bash
linear api 'query { searchIssues(term: "cc·20260819·batch1") { nodes { identifier title } } }'
```

**Edges, and they matter:**

- 🚫 **Never stamp a Dima-authored ticket.** The marker says an agent wrote this. Putting it on his
  ticket is a lie about who did.
- On an **existing** ticket, stamp the **comment only** — never rewrite the body to add a footer.
- The active run id rides in the handoff **META**, so a pulled session continues the run rather
  than minting a new one.

## Ticket economy (quota-aware)

250 non-archived issues workspace-wide. Resolve faster than create. Prefer one fuller ticket covering an area over strands of small ones — but no monster tickets; balance. Archive resolved work aggressively. Quota nearing (~200): propose a restructure pass.

## Compression budget

**Structured by default, prose by exception — Linear must stay un-wordy.** That is the whole
budget; no line limit exists. Judge by load, not length.

- Keep: the decision to make, the hard constraint, the non-obvious fact, the exact command or path.
- Cut: restated context, anything an agent re-derives from the repo, "why this matters" paragraphs.
- Options: give one recommendation; the runner-up gets a clause, never a section.
- Dima's verbatim words are never cut — they are evidence, not prose.
- The title carries the subject. Never restate it in the first line.

**The vents stay open (Dima, 2026-08-18).** The default is a list, not a paragraph — but a budget
that closes every vent is the wrong budget. Prose is legitimate the moment it carries information
a list cannot:

- a decision ticket whose rationale only makes sense as a paragraph — the reasoning is the content,
  and chopping it into bullets destroys the argument;
- a grill summary, where the back-and-forth is the finding;
- any place where the connective tissue between facts *is* the fact.

The test is not length, it is load: **does this paragraph carry something a list would drop?** If
yes it stays. If it only restates, it goes.

📌 **Flag, never auto-strip.** A sweeper pass over existing bodies reports prose it suspects and
leaves the text alone. Rewriting someone's ticket body on a heuristic is how real reasoning gets
deleted — the call is Dima's, every time.

## Output discipline

- **Titles are the interface**: clear, concise, subject-first — details go in the body, never the title.
- Bodies tidy and formatted. Ticket-id link format is not restated here — `rules/fleet-output-format.md` owns it.
- Pretty output: bullet lines for batches (tables are banned, `rules/fleet-output-format.md`), one-line confirmations for single ops.
- **CC only**: on the first ticket touch in a session (first `linear issue view`/create), suggest a session rename as a ready-to-run line: `/rename FRM-N: compact-title` — Dima pastes it manually, `/rename` isn't tool-callable. One suggestion per session, not on every subsequent ticket op.

Stay quick — this skill is for ticket ops. A request that turns into scope/architecture thinking gets a grill suggestion, not silent expansion.

**Completion criterion:** done when every touched ticket is fully fielded (role, kind, priority,
estimate-or-blocked, project, parent+milestone where they apply) and the approval batch — or the
one-line confirmation — **says which fields you set or changed**. A ticket left partially fielded
is not captured, it is scattered.

## Body vs comments — the state contract

**The body shape: what · why · how · notes · closing word — the ticket face, a reference.**
Spec-shaped tickets add an optional sixth: acceptance/exit.
🚨 **Dima's words never go into a comment.** A want, a note, a verdict from him lands in the body
under «dima notes» — a comment is read only by the GraphQL fetch, a body by every reader.
Comments carry trail only: run stamps, «done, see commit», provenance.
Body = current state: keep it sanitized and updated, mutate without fear; a closed ticket reads
true from the body alone. Agent context that does not fit the shape goes to a comment —
deliberately, when it covers a real ctx gap, never as flood. Comments = trail (logs, stamps,
provenance) plus that gap. The closing word on every close is the floor's rule
(`rules/linear-flow.md`).

**A `standing` ticket carries no comments at all** — it never closes, so its trail would only grow and
go stale (dima, 2026-09-30, BYT-105). a coder round on it opens a child ticket: the child gets the
work state, the `- ticket:` lines, the pr link and the done-report, and closes with the round; a
shipped wish leaves the standing body as the child's link. the standing body is only its open list.

## Reading — the fetch contract

`linear issue view` is a fixed pre-baked query that omits most of this. **Use `linear api`
GraphQL for any read that will inform a decision**, and filter the JSON so only needed fields
enter context. Always fetch: `labels { nodes { name description } }` · `parent` + `children` ·
`comments` · `attachments` · state, project, priority, assignee.

- **on `cc`, one call prints the whole contract: `pnpm linear:read FRM-N`** (in `~/frame`;
  `--no-body` for a DOT-237-class body, `--no-comments`, `--json`). Reach for it on every
  decision-informing read — comments included by default, both relation sides, `⚠️ capped` on any
  paged list.

- 🚨 **BOTH `relations` AND `inverseRelations`.** `relations` returns only the edges a ticket
  *declares* — a ticket that is **blocked by** something shows an empty list and looks unblocked.
  The inverse side exposes `issue`, not `relatedIssue`.
- ⚠️ **`first:` is a cap, and a capped result looks exactly like a complete one.** Linear pages at
  50 and warns about nothing. Request `pageInfo { hasNextPage }` on any query whose count you
  intend to state — a number nobody paged is an estimate.
- Relations are native, and you hunt for them: on every touch evaluate the full vocabulary
  (parent, sub-issue, related, blocked by, blocks, duplicate) and set what matches in the same
  batch. The test is *«would this change how I do the other one?»*. 🚨 Never filter relations by
  state — a closed ticket with a closing word is often the most valuable edge on the graph.
- Mutations stay cheap: short single-flag updates inline, heredoc/`--description-file` only for
  prose bodies.
