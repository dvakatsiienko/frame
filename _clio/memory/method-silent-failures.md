# silent failures — the tool did the wrong thing and said nothing

Each of these leaves the system looking healthy from both sides. 🎯 **The fix is always a
different invocation, never a firmer intention** — attention is exactly what runs out, so a
discipline fix for a mechanism failure fails twice.

## ❗ a broken `@import` loads NOTHING and says nothing

No error, no warning. The file reads fine on disk and is simply not in context. Paths resolve
relative to the **importing file**: inside `memory/_MEMORY.md` a leaf is `@slug.md`;
`@memory/slug.md` resolves to `memory/memory/slug.md` and loads nothing quietly.

**The probe — the only detector:** name a fact that lives ONLY in a leaf body (standard: commit
hash `d03f3da` in [[sys-settings-drift]]). Cannot name it → the chain broke, say so 🚨 and read
the barrel by hand. **Re-probe after any rename, move, or barrel edit.** Counting files proves
existence, never loading.

## ❗ a bare `git commit` takes the whole index — guard: `x-mod-guard` refuses one with no `--` paths; the door is `x lane commit`

<!-- failure: fired twice in one day; «check afterwards» caught it once and prevented nothing -->

📌 `git commit --only <paths>` passes the guard and is not the fix: it commits the worktree content of those paths, unstaged hunks included.

<!-- failure: --only swept in unstaged hunks on a coder, 2026-08-25 -->

## ❗ `open(path,"w")` truncates before the read nested inside it

```python
open(p,"w").writelines([l for l in open(p) if ...])   # ❌ empties the file
lines = open(p).read().split("\n"); open(p,"w").write(...)  # ✅ read fully, then truncate
```

<!-- failure: this emptied `_MEMORY.md` (9,408 bytes → 0) and the verification passed — a grep for absence passes trivially on an empty file -->

🎯 **Never verify a deletion with a check an empty file also passes; assert what must REMAIN** — pointer count, byte count, a known-good line.

## ❗ a bulk edit verified by its own filter

<!-- failure: the +2 date shift passed its own check while 8 window and `dies-when` lines in test-drive files kept the old dates (2026-10-05) -->

**verify a bulk edit by grepping every old value across the repo**, never by the filter that chose the targets.

## ❗ zsh: an unquoted `$VAR` is one word

- unguarded: **zsh does not word-split an unquoted `$VAR`** — `for f in $FILES` runs once with
the whole string as one word, and a snapshot loop copied nothing (2026-09-26). split with
`${=FILES}` or feed a `while read -r f`.

## ❗ a truncated read recorded as a truncated source

<!-- failure: a quote read as breaking mid-sentence became a blocking precondition; the bullet simply continued on its own line -->

**When a quote looks incomplete, re-read the original before writing the gap
into a rule.**

## ❗ the 8k Bash cap previews the head, and errors sit at the tail

clio's `bashOutputMaxChars` is 8000 (dima's o48, 2026-10-14: «save your context, never cut your precision»): a longer output lands in a file and only its first 2KB reaches the thread. a long gate or test run ends `> <file> 2>&1; echo "exit $?"` and its tail is read; a whole file goes through `Read`, never `cat`.

## ❗ an «everywhere» delete is a graph operation

<!-- failure: two agent files deleted on request were spawned by name in three places inside a skill -->

**One `grep` for the name before the `rm` is the whole check** — a file is a node; deleting it without
walking its edges leaves edges pointing at nothing.

📌 When a mechanism returns nothing, suspect your own inputs first — the moral's home is
[[method-report-verify]].
