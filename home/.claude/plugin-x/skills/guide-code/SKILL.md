---
name: guide-code
description: Load EVERY time you are about to write, edit, refactor or review source code — a .ts/.tsx/.swift/.sh/.py file, a function, a test, a script, a hook — BEFORE the language-specific guides. Not for settings dialogs, hotkeys, snippets, raycast/app configuration, tickets or prose.
---

# Code Guide

The values every language shares. `guide-typescript`, `guide-react` and their siblings refine;
these govern.

## Less is better

The best version of a change leaves the least behind. Volume is not progress; a diff that
removes more than it adds is usually the stronger one.

Reach for, in order:

1. **Delete it.** Code that isn't there needs no tests, no docs, and cannot break.
2. **Derive it.** A fact computed from what exists cannot drift; a hand-maintained list always
   will.
3. **Inline it.** One obvious place beats an abstraction used twice.
4. **Then write it** — the smallest thing that does the job.

Applies to everything countable: files, dependencies, options, verbs, layers, config keys,
branches, lines. **Before adding, ask what it removes** — a change that only adds needs a
reason a subtraction couldn't cover.

Calls this decides:

- A rare operation gets a documented one-liner, not a command.
- A wrapper that only forwards arguments gets deleted, not renamed.
- Dead code goes on sight, related to the task or not.
- A config option is a decision you failed to make — pick the default, delete the knob.
- Two ways to do one thing means one is wrong; find out which.

**Less is not fewer characters.** Terse names and clever one-liners spend the reader's
attention to save your keystrokes — that's more, not less. Minimise what a reader holds in
their head.

## Complete means whole

- **Reverse states.** A way in ships with the way out and the way to see it — snooze needs
  unsnooze, close needs reopen. A one-way door is a bug.
- **Every entry point.** Before calling a change done, name the other paths reaching the same
  behavior — the most common defect is a fix that works only where you tested it.
- **Smallest proof.** Targeted tests and typecheck for what you touched; CI owns the full
  suite — no repo-wide checks unasked.
- **A red-proof edits the existing line.** Prove a test by mutating the line it reads, never by adding a sibling
  key — biome sorts keys on save and the original silently wins, so the test reads «hollow» when it is not.

## traps that cost hours

- **an AppKit daemon's `main` is synchronous.** `NSApplication.run()` inside `static func main() async`
  starves the main actor, so no hotkey or timer Task ever runs — and a one-shot test never runs the
  app loop, so only a real key press shows it (speak, 40 min, 2026-09-29).
- **a UI order lives in an array, never in object keys.** a formatter's key sort (biome) reorders an
  object silently, and the columns move with it.

**Completion criterion:** the diff was walked against the ladder — what got deleted, derived,
or inlined before anything was written — and a change that only adds names the reason. One
sentence in the report, not a section.
