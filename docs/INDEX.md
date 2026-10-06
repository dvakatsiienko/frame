# docs index

one line per doc in `docs/`, grouped by folder. this is the barrel over the whole doc tree.

three rules keep it honest:

- **it is an index, never content.** a line here points at a doc, it does not explain it. if you
  find yourself writing a second sentence, it belongs in the doc.
- **it is the membank seed manifest** for [DOT-177](https://linear.app/x-com/issue/DOT-177). when
  membank lands it ingests this index and follows the pointers from here, so the taxonomy is being
  built now, once, and never re-derived later.
- **adding a doc to `docs/` means adding its line here, in the same turn.** a doc missing from the
  index is, for membank, a doc that does not exist.

## knowledge/ — read on demand, the lookups behind the rules

- [claude fleet capabilities](knowledge/fleet-claude-capabilities.md) — what each surface can reach, what memory it keeps, who can operate whom; core coordinator knowledge behind `rules/fleet-identity.md`
- [authoring — skill](knowledge/authoring-skill.md) — the full reference for writing a skill: frontmatter, invocation control, the listing budget, argument placeholders as measured
- [authoring — memory](knowledge/authoring-memory.md) — where a fact goes, decided BEFORE it is written: the pre-write checklist, bucket tests, silent hazards
- [authoring — project memfile](knowledge/authoring-memory-project.md) — how to write a project `AGENTS.md`
- [models](knowledge/models.md) — the model cards and prices behind `rules/models.md`
- [spawn mechanics](knowledge/spawn-mechanics.md) — what is actually true about subagents, `--bg` sessions and their inheritance, per cc build
- [writing for humans](knowledge/writing-for-humans.md) — the distilled knowledge behind the `x:writing-for-humans` skill

## research/ — investigations, subject-first, one topic per file

- [agent harness building](research/harness-building.md) — building a custom orchestration harness on claude code / agent sdk
- [cc extension surfaces](research/harness-cc-surfaces.md) — every extension point of ccli, mechanics + gotchas per surface
- [headless browser tool](research/headless-browser-tool.md) — agent-browser vs playwright for llm coders, measured
- [matt's framework walkthrough](research/matt-framework-walkthrough.md) — the digest of the walkthrough over his skills
- [notion channel](research/notion-channel.md) — notion, octoport, zapier: three verdicts
- [cw memory regeneration](research/cw-memory-regen.md) — does anything rewrite our lines in cw memory?

## adr/ — repo decisions (`ADR-nnnn`)

- [ADR-0001 sline shows server numbers only](adr/0001-sline-server-provided-numbers-only.md) — sline never computes estimates client-side
- [ADR-0002 handoff shared file store](adr/0002-handoff-shared-file-store.md) — one store, one format, every direction

## tracker/ — the linear domain (`TRK-nnnn`)

- [tracker glossary](tracker/GLOSSARY.md) — one term per concept: team, project, story, ticket, label, sweep; plus the channel (linear cli, commit-linking webhook) and the mattpocock triage role bridge
- [TRK-0001 story over epic](tracker/adr/TRK-0001-story-over-epic.md) — one grouping term; «claude» split into four domain projects
- [TRK-0002 label vocabulary](tracker/adr/TRK-0002-label-vocabulary.md) — block direction, `standing`, `vet`; partly superseded by TRK-0004
- [TRK-0003 health update cadence](tracker/adr/TRK-0003-health-update-cadence.md) — weekly floor plus event-driven updates
- [TRK-0004 label system evolution](tracker/adr/TRK-0004-label-system-evolution.md) — the `needs` family closed at three, labels never name a project
