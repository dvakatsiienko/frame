# memory-load — lazy rules on trial

- **what:** `memory-load-rule-lazy` loads `rules-lazy/linear-flow.md` when linear work starts instead of keeping it resident ([FRM-300](https://linear.app/x-com/issue/FRM-300)); docs in `home/.claude/rules-lazy/`
- **dima's bar:** «it must work very well and always load correct memories when needed … make it work, or discard it»
- **window:** 2026-10-04 → 2026-10-20
- **every halt:** read the hook's `miss` lines for the day; one log line here. a miss no trigger can fix → discard, the file goes back to `rules/`
- **at the verdict:** rerun `pnpm memory-load:replay --days 14`; keep → `fleet-hazards` is the next lazy rule (fix the replay's subagent blind spot first, FRM-303 riders)

## log — date · session · loads · misses · note

- 2026-10-04 · build day · replay 14 d: cclio 1648/1648, coder 284/284, other 345/346 (the one miss is a worktree path from `ps`, not linear work) · the hook fired live in cclio on a prompt naming FRM-300
