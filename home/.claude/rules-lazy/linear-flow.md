# linear flow — the floor every session stands on

**clio owns the tracker**: every create, body edit, state and label move, close and sort is hers,
through her `clio:pm` skill. a member reads tickets and posts its done comment; anything past
that, it hands to clio in its ping.

📌 **this binds only workspace `x-com`** (teams `FRM`, how we work, and `BYT`, building apps). a
repo with another tracker, or none, follows its own conventions.

## the two doors

- **read**: `x linear read <ids…> --comments --relations` — the whole ticket in one call: body,
  labels, state, both relation sides, comments; several ids batched. old `DOT-N` ids resolve to `FRM-N`
- **comment**: `x linear comment <id> --body-file <file>` — codie's done report or sixth sense's `clean` verdict,
  nothing else; a body goes through a file, never inline. dima's words or verdicts heard in your
  thread go to clio in your ping, never into a linear comment
- `x schema linear` lists every verb; the raw `linear` cli and the Linear MCP are never a member's door

## what a member never does

- create a ticket, edit a body, move a state or a label: clio does it the turn your ping lands.
  the slices `to-tickets` cuts live in `~/.local/state/x/lanes/<feature>/issues/`, never in linear or a worktree
- start a ticket labelled `human` (dima, 2026-09-30, after BYT-86 was proposed as a shift
  candidate); labels are read from the ticket the same turn, never recalled
- invent an id: an id comes from dima, the conversation or the branch name, never a plausible grep;
  most commits carry none, and omitting the line is always right

## commits and ids

- a commit carries no ticket line; a pr links to its ticket through its branch name and a `- ticket: FRM-N`
  line in its body, never a closing keyword (`x:cmt`)
- an id printed to dima is a link plus a short tldr (`rules/fleet-output-format.md`)
- a `standing` ticket stays in Todo between rounds; a round on it is a child ticket, which carries
  the state, the pr and the done report (dima, 2026-09-30)
