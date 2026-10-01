# authoring-memory-and-skills — maintenance tactics for our own memory and skills

internal rule picks for editing memory files, rules, and skills. emphases live here when a
mechanism (a skill trigger, a hook) proves too weak on its own — the entry names the tool AND the
moment to reach for it.

## load `writing-for-agents` BEFORE the edit

editing any skill, rule, `AGENTS.md`, or memory file → invoke `mattpocock-skills:writing-for-agents`
first, then open the target. its own description says exactly this and still fails to fire —
measured: a dozen edits in one session, zero loads. marketplace skill, so the fix lives here, never
as an edit to the skill itself (update drift).

## the vertical map — pick the bucket BEFORE writing

🎯 **AUDIENCE decides, never topic.** every memory lands in exactly one bucket — the widest one
whose whole audience benefits. wrong-bucket placement is the mistake this map kills.

- **root `~/.claude/CLAUDE.md`** — the entire fleet benefits: every session, every project.
- **`~/.claude/rules/*`** — same global audience as root: each file one granular area (output
  format, voice, linear floor, …), split so root stays lean.
- **`~/projects/AGENTS.md`** — every coding session, no coordinator: true in every repo under
  `~/projects` and nowhere else. cclio fills it. currently a deliberate stub.
- **project-level `AGENTS.md`** — sessions in that one project only. cclio fills these too.
- **`cclio/memory/*`** — the coordinator only; a coder reading it would be misled.
- **skills** — any audience, but loaded on demand, never resident. a memory that reads like
  steps wants to be a skill.
- **`docs/`** — read on demand: long, occasional, or a lookup.

📌 **the worked example — how the audience test runs:** pnpm FEELS coder-specific (topic: package
management), so the reflex says `~/projects/AGENTS.md`. but ask who benefits: any session may run
pnpm, even in non-coding projects like `~/frame` — so it parks in root. run every placement
through this shape: name the audience, ignore the topic.

## the deep layers — when the router is not enough

`writing-for-agents` is the craft authority — load it BEFORE every skill/rule/memory edit (the
section above). the mechanics live one layer down, read on demand:

- `docs/knowledge/authoring-memory.md` — placement mechanics, buckets table, precedence, the
  measured cc facts (html-comment stripping, `paths:`, import hazards)
- `docs/knowledge/authoring-skill.md` — cc skill mechanics: listing budget, frontmatter, invocation
  control

read the full doc when: unsure about a skill's quality · building a sophisticated skill · a skill
is fat or unstructured and needs the bigger picture of how one is written.

## the pre-write checklist — five questions, before ANY memory write

1. **who needs this?** everyone · every coder · one project · one surface · one role — the map above
2. **what does it cost?** a rule is resident in every session forever; a skill description is
   resident; a doc costs nothing until read
3. **does it already exist somewhere?** a second copy is worse than none — the two drift
4. **is it a fact, a rule, or a story?** different homes, different decay rates
5. **is it a measurement or a standing fact?** a dated «as of» line in an `AGENTS.md` or doc is a
   measurement and belongs in the commit that measured it; two such lines went stale within a day
   and each cost a false finding (2026-09-08). docs state what does not expire
6. **can the agent find it by looking?** scripts, layout, `--help` — a doc restating those is a
   stale cache. cache only the unwritten convention, the reason, the gotcha

## a new x:* skill asks the cw question

creating a skill in `plugin-x` does NOT reach the desktop — `plugin-x-cw` is a curated symlink
set. at create time, decide cw inclusion; if yes: `ln -s ../../plugin-x/skills/<name>` in
`plugin-x-cw/skills/` + bump both plugin versions.

## skill descriptions — WHEN only

**the description is ONLY the load trigger** — «Load BEFORE …», «Load EVERY time …», «Load
when …» (dima's call 2026-08-25, sharpening `docs/knowledge/authoring-skill.md`). the NAME carries
the entity, the BODY carries the what — details are one invoke away. never let a description
explain or answer: that is body content paid resident, every turn.
**a «Not for …» clause is part of the trigger**, added only when a misfire is on record — it names
the lookalike case in the words that misfired («Not for a 1password vault or item.») (dima's yes,
2026-10-01, after the jev router's miss log).
**seed the trigger with magic keywords** — the literal words dima would type («commit this», a
pasted url, «walk me through»), not an abstract paraphrase of the situation; the description
fires by matching the prompt, and it can only match words that actually appear in one.
