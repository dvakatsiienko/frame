---
status: live
until: 2026-11-09
dies-when: the verdict line below is written
fits: codie (mods)
---

# unbash — a real bash parser under x-mod-guard's walker

Ticket: FRM-472

**test card:** we believe a parsed command tree (`webpro-nl/unbash`) closes the guard's escapes better than the hand-written reader in `x-mod-guard/hooks/shell.ts` · we test it by wiring it under the walker in mods lane 4 and running every real Bash call of the week through it · we measure the escape table (180 rows + lane 4's new ones) refused, the 7-day replay's new refusals, guard latency per call, and every parse failure on zsh-only syntax · we're right if all escape rows refuse, the replay adds 0 false refusals, p95 latency stays under 20 ms, and zsh parse failures fail closed with a clear hint
**kill rule:** a parse failure that lets a floor command through, or a false refusal dima hits twice in one day

## stress list
- heredocs, `$(( ))`, subshells, functions, `bash -c` — the escape table — rows refused
- zsh-only syntax (`${=VAR}`, glob qualifiers, `=(…)`, `[[ =~ ]]`) — dima's daily zsh — parse fails, and what the guard does then
- the 7-day replay — real calls — new refusals, latency

## rounds

## verdict
