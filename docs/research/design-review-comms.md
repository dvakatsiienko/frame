---
dies-when: the review desk is a skill or script the designer flow uses (x:crew-designer step 5), or the idea is dropped
---

# design review comms — how a designer agent asks dima without making him hunt

Ticket: none

dima, 2026-10-01: «designing communications is exhaustive for me (because I have to hop across frames too much and spend a lot of effort on finding the right place you are interested in)» · «can this be a checkbox?»

## what is true

- the Claude Design canvas declares `comments: composer_only`: only a person in the page starts a thread; Claude only replies to and resolves threads sent to it. no agent-placed pin exists there
- a plain Artifact page can declare `db`: its buttons store answers that Claude reads back with ArtifactData — the review desk ([prototype](https://claude.ai/artifact/H33By6YXWRkTNtJiSw8EcB))
- Figma's REST comments endpoint does let an agent post a pinned comment (`client_meta`, a node + region) — both lanes, sources in their output; not our canvas

## what the lanes recommend (exa 63 s $0.10 · parallel 138 s — they agree)

- a durable **decision object** per ask: id · board · target · crop · question · options · recommended · why · status — rendered in one decision inbox; the canvas stays the source, never the answer surface
- each card self-contained: the cropped spot, the options side by side at the same scale, the recommendation highlighted, «1 of N» and what is left; answering never needs opening the board (an «open in canvas» link for when he wants it)
- one glance, one keystroke: number keys pick, Enter takes the recommended, S skips / defers; rationale behind a disclosure; ordered by what the answer blocks, not by time
- computer use only as a last-mile adapter with screenshot verification — never the record

## the shape for us

- the designer ends a round by writing `decisions.json` (the object above, crop as a rect on a board) instead of stickies
- a script renders the boards (`design:comp-render`), crops each spot, and publishes the desk; dima clicks; cclio reads the answers and relays them as one batch
- computer use (claude-in-chrome, 2026-10-01): the extension drives only tabs it opens; the canvas loaded and comment mode turned on, but two clicks on an artboard opened no composer (the boards render in frames). dropped as a channel: slow, brittle, screenshot-heavy
- no open claude-code issue asks for agent-opened canvas comments; the nearest is #88710 (anchors collapse to editor chrome)
