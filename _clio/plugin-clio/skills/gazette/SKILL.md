---
name: gazette
description: load when /clio:halt reaches phase 4.5, when /clio:checkpoint writes its update block, or when dima says «gazette» — the day's post and the gated wire.
---

# /clio:gazette — clio's gazette 🗞️ the tweet and the wire

**clio's gazette** — the durable event history plus its outward release. the halt calls this BEFORE the CST, so the
handoff carries only what the gazette did not already say.

**what it is (dima, 2026-09-03): the memory of what meaningful stuff we did, not a mirror of
the tracker.** anything that changed something belongs — a ticketed close and a bare todo fixed
in place carry equal weight; an immediate ask done without a ticket is exactly the kind of fact
only the gazette keeps. meaningful only — a minor move stays out, however fresh. on point only: the fact and its effect, no talk, no fluff. a linear body
already describes the ticket; the post says what happened.

## phase 1 — the tweet (always, no gate)

write the day's post: `_clio/gazette/YYYY-MM-DD-<short-slug>.md`.

- **one file per day.** a second halt the same day APPENDS under a `⸻ upd hh:mm` rule — never a
  second file. slug is minted at first write and stays.
- **source from evidence, not memory of your own turns**: `git log --since=<today>` across
  touched repos, the day's linear activity, the session context last — codies and cloud chat leave
  traces clio's thread never saw.
- frontmatter: `date` · `slug` · `tickets: [FRM-N, BYT-N, …]` · `posted: {health: no}`
- header line: `# 🗞️ clio's gazette · <slug title>` — the masthead leads every post
- skeleton, soft cap ~25 lines:
  - **shipped** — what landed, every fact linear-linked
  - **tricks gained** — fleet-useful finds, gotchas, new capabilities
  - **state** — what is open, where it parked
- fleet voice. only facts that changed something; a fact links its ticket, never restates the
  body; dates absolute, never «today».
- dedup: read the previous post before writing.
- every post ends with a `## trail` section: three bullets, `shipped:` / `open:` / `state:`, one line each — the only part that stays resident. after writing, run `_clio/.claude/hooks/gazette-trail.sh` (from the frame root): it regenerates `gazette/_trail.md`, which the memory barrel imports into every clio boot

## phase 2 — the wire (gated)

the release — derived from the tweet, pushed outward.

- **gate:** ask «🗞️ the wire? y/n» and **block until a literal answer**; the question stands alone on its line.
- **health update** for each project the tweet touched — **no title line**: pulse already shows the
  date and the author, the body starts at the first paragraph (dima, 2026-09-02) — ⚠️ full markdown
  links (health updates do not auto-link ids). **the house style:**
  - **hybrid voice**: fleet structure carries the scanning (emoji line-prefix per paragraph,
    bold verdict openers), the sentences underneath stay human — `x:writing-for-humans` flow,
    no id-stuffing, no arrow chains, rhythm varies
  - **paragraphs 2–3 rendered lines each**, one thought per paragraph — linear renders wide;
    a paragraph that wants two tickets is two paragraphs
  - **ticket badges at sentence edges**: linear renders an id link as a fat badge with the full
    title, so a badge goes at a line end after a colon — the sentence carries the meaning, the
    badge is the door. **one badge per paragraph, ~3 per update**, never inside parentheses
  - **the inverse of a commit message**: not what changed — **what got easier for dima**, each
    paragraph a gain written for him, not for an agent
- **pulse is the feed** — the reply names WHICH
  projects got a post, one line total; no per-post links, no gists.
- flip the `posted:` marks after each fanout — a re-run with marks already yes is a no-op, so
  the wire fires at most once per day's content.

## phase 2.5 — the initiative update (gated: a mil completed this session)

the linear initiative «roadmap» carries the plan-level feed, one post per **milestone end**,
never daily (dima, 2026-09-03: «gazette - daily, initiative - per mil (end)»). the gate is
literal: a milestone reached done/total this session, or a roadmap step closed. nothing → skip
silently. when it fires: three sentences — what became true, what starts, what it unblocks —
through `initiativeUpdateCreate` (same shape as the project update, `health` included), full
markdown links for ids. a step transition also rewrites the initiative body's step list and
moves the attached projects to the new step (`memory/dima-strategy.md`, the roadmap section).

## completion criterion

the day's file holds today's facts with correct `posted:` marks, `gazette/_trail.md` is
regenerated, and the reply names what went out on the wire (or that it was declined).
