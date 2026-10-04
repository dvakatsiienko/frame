# rules-lazy — rules that load when their work starts

## the want

> resident memory carries only what every turn needs. a rule that matters for one kind of work (linear, git, the vault) arrives the moment that work starts, by mechanism, never by my recall. pilot: linear-flow.

dima, 2026-10-04: «if we keep it, it must work very well and always load correct memories when needed (because we already had some experiment with the jev skill router, and it failed). i don't want another failed thing. let's see if it works, make it work, or discard it.»

## decided (grill, 2026-10-04)

- a classic hook, a sibling of the path loader, never a mod — nothing to show, and hook context injection is proven
- the hook family is `memory-load-*`: the path loader becomes `memory-load-agents-md`, the new hook is `memory-load-rule-lazy`
- triggers for linear-flow: a `FRM-N` / `BYT-N` id in dima's prompt; a Bash call running `linear`, `git commit` or `gh pr create`
- the first tool trigger of a session is refused once with the rule attached — the only way the rule lands before the action
- a miss is traced, never silent: a Stop hook scans each turn for linear signals and logs `miss` when the rule never loaded
- measured, then kept or discarded: a replay over 14 days of real transcripts must show 100 % of signals preceded by a load, then a 2-week test drive; a miss no trigger can fix → discard, the file goes back to `rules/`
- lazy rules live in `home/.claude/rules-lazy/`, outside `rules/`, which auto-loads every file in it

## the cut (v0)

- `rules/linear-flow.md` → `rules-lazy/linear-flow.md`; `rules-lazy/triggers.json` maps a rule to its prompt and command patterns
- `shelf/hooks/memory-load-rule-lazy.py`: the prompt trigger injects; the tool trigger refuses once with the rule; once per session; every load logged with its trigger
- the miss detector: a Stop hook, signals = a ticket id, a `linear.app` link, a `- ticket:` line, a `linear` call
- compaction: `SessionStart:compact` clears the loaded marks for both `memory-load-*` hooks — the path loader never reloaded an `AGENTS.md` after a compaction
- `pnpm memory-load:replay --days 14` — the detector over real transcripts, the hit rate printed
- cw: the path constant in `mcp-x-cw/src/pm.ts`, rebuilt
- the path loader's rename to `memory-load-agents-md` on every layer: file, `settings.json`, log strings, docs

**out:** `fleet-hazards` and every rule besides linear-flow until the verdict · jev · any ui · a separate load for subagents (they carry the parent's context)
