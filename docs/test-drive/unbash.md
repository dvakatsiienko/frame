---
status: live
until: 2026-11-22
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

- 2026-11-02 17:2x · round 1, side by side before any wiring (`unbash` 6.0.3, zero deps, ~350 KB of `.js`; a mod imports only its own folder, so wiring means vendoring it into x-mod-guard) · bench: `node docs/test-drive/unbash-bench.mts <dist> 7`, which compares the command names unbash reads with the walker's names (`commandsDeep`), over the escape table (230 rows) and the last 7 days of real Bash calls (15,780 unique)
  - **escapes closed: 0.** unbash reads no command name the walker misses, in either set: its 22 raw extra names on the rows and 372 on the replay are all names the walker already resolves on purpose (`$R` → its value, `pnpm exec` and `env` peeled, a path to its basename). every escape the walker still has is semantic (a value, an alias, a file written then run: FRM-472's rows), and a parser reads none of those
  - **what it reads better:** the bench's `walkerOnly` (27 replay calls, 13 rows) is mostly the walker resolving a variable right (`R=rm; $R` → `rm`, all 13 rows); a hand read of the 27 leaves 10 real misreads, a non-command read as a command: a `case` pattern (`*`, `*ccrow*`) in 7, a `(( SECONDS > end ))` word in 2, a `declare -A W=([k]=…)` element in 1. none of those is a floor name, so no refusal changes
  - **what it reads worse:** unbash misses `head` in `for f in *.pem(N); do head …` (the zsh case below), where the walker reads it
  - **latency:** warm p50 0.004 ms, p95 0.013 ms, max 0.29 ms per call (the walker's own deep read: p95 ~0.1 ms); the first call in a process pays a ~50 ms module warm-up — far under the 20 ms bar
  - **zsh parse fails: 2 of 15,780** — a glob qualifier (`*.pem(N)`) and a quote that only zsh's reading closes; unbash recovers a partial tree with an error, so a wiring would have to fail closed there
  - codie's read: wiring it buys 0 escapes and ~14 cleaner reads for a vendored 350 KB and an adapter onto the walker's token shape (keywords glued to segments, `$( … )` read twice), which 843 lines of rules lean on. asked dima before building it

- 2026-11-07 · round 2, today's proven holes against unbash 6.0.3: `echo "price $'"; rm -rf ~` and `echo "${x:-"$'"}"; rm -rf ~` both read `echo,rm`, where our reader saw one `echo` (the first fixed by hand today, the second still open, FRM-472's rider). round 1's «0 escapes closed» measured names over a table these rows were not in. my quick walker reads no `rm` inside `$( )`, `$(( ))` or a heredoc: inconclusive, the tree may hold them in a form it missed
  - **the new shape, clio's weighed call on his steer o45**: no vendoring under the guard; a test-side oracle in FRM-472, unbash as a dev dependency compared with `commandsDeep` over the escape table and a fuzz of quote shapes, so a disagreement names a reader bug by itself. verdict at FRM-472's close

## verdict
