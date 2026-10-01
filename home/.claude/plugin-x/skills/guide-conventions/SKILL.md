---
name: guide-conventions
description: Load BEFORE designing a shape that is expensive to change later — «new route», «url shape», «api surface», «where should this file live», «package.json shape», «rename the family», «what should I call it», «which library», «add a dependency» — and whenever a review comment sounds like "we don't do it that way here". Not for a hotkey, a setting, or a cli tool pick.
---

# Conventions — the umbrella

One skill, many rules. The rules live in [`conventions/`](conventions/) as separate files and are
**read on demand**, never up front.

📌 Why the shape is this and not one skill per rule: a skill's `description` is resident in every
session from boot (~80–100 tokens), and on `cc` the whole skill listing shares a character budget —
overflow truncates descriptions and then drops them, quietest-first. A library of narrow convention
skills therefore taxes every session and eventually silences itself. One umbrella pays that toll
once; the rule files cost nothing until Read.

## How to use it

1. Run `ls` on the `conventions/` directory next to this file. Filenames are the index — there is
   no catalogue to maintain and nothing to keep in sync.
2. Read **only** the files matching the work in hand.
3. Apply them as binding. These are rules Dima already enforces by correcting mid-task; the file
   exists so the correction is not needed.

Do not read the whole directory "to be safe". That defeats the point of the split.

**Completion criterion:** before calling the shaping work done, **say which convention files you
read and which applied** — a named list, not "conventions checked". Zero matching files is a legal
answer and is also said out loud.

## Adding a convention

One file per rule, named for its subject (`routing-url-shape.md`, not `rule-1.md`): the rule,
✅/🚫 examples, and what the correction cost when it was learned. No frontmatter — read by path,
not resolved as skills. A rule belonging to exactly one repo goes in that repo's `AGENTS.md`
instead; this skill is for rules spanning repos.
