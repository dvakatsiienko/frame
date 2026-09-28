# tracker context — glossary

the linear workspace (`x-com`) domain. one term per concept, per TRK adrs. operational recipes live in `x:pm`; this file is vocabulary only.

- **team** — top split by nature of work, never by repo: `FRM` = tooling/approaches/how-we-work (key `DOT` until 2026-09-23; old `DOT-N` ids resolve), `BYT` = building apps. two teams, free-plan max.
- **project** — long-lived area inside a team. never closes. DOT: pm, mind, fleet, cli, shelf, revamp, sline, numi. BYT: rl, design-system, cv, x-com-chat, tooling, lab, trophy-sys, monorepo (bytes-the-repo: shape, deps, turbo, lint, scripts — sweeps over the whole repo).
- **story** — a ticket with sub-tickets grouping one strand or batch inside a project. the only grouping term («epic» is dead, TRK-0001). no title marker — the sub-tickets are what makes it a story.
- **ticket** — unit of work. pretty title (short, descriptive, subject-first), body = key data only.
- **standing ticket** — a recurring home that never finishes (DOT-82). carries the `standing` label and legitimately sits In Progress between rounds — the one exception to state-tracks-reality (TRK-0004, `rules/linear-flow.md`). without the label, an In Progress ticket is stale, not standing. its body lists open lines only: a done line is deleted in the same edit that ships it — the pre-push hook attaches the commit, so the trail lives in attachments and the body never grows (dima, 2026-09-28).
- **loose ticket** — projectless is legal for one-offs and idea pools (DOT-86).
- **label** — labels live in mutually exclusive **groups** (TRK-0005): `executor` (`agent` · `human`) · `type` (`bug` · `feature` · `improvement`) · `blocker` (`needs human` = agent blocked on dima · `needs agent` = dima blocked on agent research) · `domain` (`memory` · `skill` · `tools`) · `model`. exactly one executor and one type per ticket, a blocker only while blocked; `needs data` folded into `research` (TRK-0005); **state** labels (`standing`, `vet` 🧪) and dima's own `walkthrough` (he wants to be walked through it — a learning session, never a delegation) sit beside them; **model routing** labels (`fable 5` · `opus 5` · `sonnet 5` · `haiku 4.5`) are dima's notation, future label→model routing. a label never names a **project** — that is what the project field is for (TRK-0004). no hyphens in names, workspace-level only (TRK-0002).
- **assignee** — assigned-to-dima = strictly his, agents never resolve it (≠ `human` label, which only says a human does the work). unassigned = open to anyone.
- **priority** — how much a ticket matters, p1 rare. sequencing = `blocks` relation, never inflated priority. **estimate** — complexity 1–5, not wall-clock.
- **sweep** — a read-only analysis pass over the tracker producing proposals, flushed only after approval.
- **run marker** — per-run identifier stamped as the last line of agent-created ticket bodies and agent comments: `⸻ 🪪 cc·20260819·batch1 · agent run stamp — please keep 🙏`. minted once per session, `<surface>·<date>·<slug>`. buys one-pass revert of a bad batch and cross-session idempotency. never on a dima-authored ticket. contract in `x:pm` (DOT-107).
- **doc** — research/deliverable attached to a ticket or project the moment it is born (task outputs are ephemeral). title is the interface: topic — kind — date.
- **project overview** — a project's content field, the standing description of what it is and where it stands. a tracked surface: the coordinator maintains it for dima, it is never left to rot.
- **coordinator** — the session that owns tracker work: creates, updates, closes, triages, and never writes product code. **`cclio`** holds it (a ccli session in `~/frame/cclio`) — the DOT-188 trial resolved in its favor 2026-08-31.
- **health update** — a linear project update. cadence is weekly per active project plus event-driven on real state changes (TRK-0003). ticket ids do not auto-link there, so every id is a markdown link — mandatory, not style.

## channel

issues live in **linear**, workspace `x-com`, teams `FRM` / `BYT`, since the 2026-08-13 migration.
github issues are retired — closed history only, each carrying a pointer comment to its linear
successor. never create or reopen a gh issue.

all operations go through the `linear` cli (schpet/linear-cli, on PATH, keyring-authed);
`linear api '<graphql>'` covers anything without a dedicated command. **the linear mcp is not
used.** command mechanics live in the `linear-cli` plugin skill; the field contract in `x:pm`.

📌 **ticket→gh-issue mirroring was tried and scrapped** (2026-08-21, dima). do not re-litigate.
what IS live: the linear push webhook on `dvakatsiienko/frame` and `dvakatsiienko/bytes`
carries **commit magic words** (`ref` / `Closes`) — the daily convention, owned by the `x:cmt`
skill and the linear-flow rule. the `/cc` comment trigger was retired 2026-08-27 with the whole
cc-cloud experiment lane (DOT-61 canceled, workflows deleted).

## triage role bridge

the mattpocock skills speak five canonical triage roles. this is how they land in linear:

| role in mattpocock/skills | in linear |
| --- | --- |
| `needs-triage` | **Triage** status (inbox) |
| `needs-info` | Todo + one of the `needs *` family — pick by what the ticket waits on. there is no `needs-info` label in linear |
| `ready-for-agent` | Todo + `agent` label |
| `ready-for-human` | Todo + `human` label |
| `wontfix` | **Canceled** status |

when a skill mentions a role, apply the corresponding status and label via `linear issue update`.
