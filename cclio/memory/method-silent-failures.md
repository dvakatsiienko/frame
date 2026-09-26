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

## ❗ a bare `git commit` takes the WHOLE index

```sh
git commit -F msg.txt -- <explicit paths>   # the fix: pathspec on COMMIT
git diff --cached --name-only               # or read the index before every commit
```

`git add <paths>` narrows staging only. A failed pre-commit hook leaves the index dirty, so **a
failed commit attempt is a second writer too.** Fired twice in one day; «check afterwards» caught
it once and prevented nothing.

📌 `git commit --only <paths>` is NOT the fix either — it commits the **worktree** content of
those paths, ignoring the index, so it sweeps in unstaged hunks (fired on a coder 2026-08-25).
The pathspec-on-commit form above commits the INDEX for those paths; only it is safe.

## ❗ `open(path,"w")` truncates before the read nested inside it

```python
open(p,"w").writelines([l for l in open(p) if ...])   # ❌ empties the file
lines = open(p).read().split("\n"); open(p,"w").write(...)  # ✅ read fully, then truncate
```

This emptied `_MEMORY.md` (9,408 bytes → 0) and the verification passed — a grep for absence
passes trivially on an empty file. 🎯 **Never verify a deletion with a check an empty file also
passes; assert what must REMAIN** — pointer count, byte count, a known-good line.

## ❗ zsh eats unquoted `=word` args

`echo ===DIVIDER===` in a chained command aborts the WHOLE chain — zsh equals-expansion tries to
resolve `==DIVIDER==` as a command path, fails, and everything after the `&&` never runs (`(eval):1:
==DIVIDER== not found`). bit twice in one day. **quote separators, or drop the flair.** since 2026-09-26 the `zsh-equals-guard.py` PreToolUse hook refuses the unquoted form before zsh runs it.
same class: an unquoted `*` inside an option value — `grep --include=*.md` — is a glob, and with
nothing to match zsh aborts the whole chain (`no matches found`); the next command then read a
file the aborted one never wrote (2026-09-18). **quote it: `--include='*.md'`.**

## ❗ a truncated read recorded as a truncated source

A quote read as breaking mid-sentence became a blocking precondition; the bullet simply continued
on its own line. **When a quote looks incomplete, re-read the original before writing the gap
into a rule.**

## ❗ an «everywhere» delete is a graph operation

Two agent files deleted on request were spawned by name in three places inside a skill. **One
`grep` for the name before the `rm` is the whole check** — a file is a node; deleting it without
walking its edges leaves edges pointing at nothing.

📌 When a mechanism returns nothing, suspect your own inputs first — the moral's home is
[[method-report-verify]].

Related: [[method-report-verify]], [[method-rule-proof]]
