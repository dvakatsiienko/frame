---
name: top-seven
description: Load when Dima says «emoji battle», «top 7», «top 5 emojis», «emojis for», «pick an emoji», «name battle», «battle for», «names for», «pick a name», and BEFORE naming anything lasting — a skill, a job, an app, a verb, a memory leaf, a file family.
argument-hint: "<topic> [names|emojis|pairs]"
---

# top seven — seven candidates, one pick marked

he answers with a number. the kind follows his words: «emoji» → emojis; «name» or a new lasting thing → names; both asked, or a thing that wears a badge (a member, a mod, a skill shown with its emoji) → pairs.

## names

- **first call the thing's kind** (dima, 2026-10-16: «I accept the drawback that a name will then be a little bit more verbose, but clarity wins here»); the test: will the name alone have to tell it apart from look-alike siblings?
  - **a worker** — a script, a verb, a hook, a job, a file family, read in a list of siblings: `<area>-<object>-<action>`, verbose is fine — `memory-trace-append`, never `trace-append`
  - **a character** — a member, a mod, an app, a skill called by name: short and evocative, no area prefix — `helga`, never `clio-helga`
- seven distinct names; `rg --hidden -n '<name>'` over `~/frame` and `~/projects/bytes` before printing, so none clashes with a live name
- naming rules: root `CLAUDE.md` § global naming conventions (entity-first, one name on every layer)
- his own words lead: a verb or noun he used for the thing is candidate 1

## emojis

- his handpicked set (`rules/fleet-output-format.md` § emoji) leads with every one that fits; fresh fits fill the rest

## the shape — exactly this, nothing before or after

this shape overrides the emoji-prefix rule of `fleet-output-format.md`. names only: drop the emoji; emojis only: the name is the emoji's own name; pairs: both.

```
top 7 <names|emojis|names + emojis> for **<topic>** (<a worker|a character>, names only).

1. ⭐ <emoji> — **<name>**: <why, ≤5 words>
2. ⭐ <emoji> — **<name>**: <why, ≤5 words>
3. ⭐ <emoji> — **<name>**: <why, ≤5 words> ⬅️ **my pick**: <reason>
4. ⭐ <emoji> — **<name>**: <why, ≤5 words>
5. ⭐ <emoji> — **<name>**: <why, ≤5 words>
6. ⭐ <emoji> — **<name>**: <why, ≤5 words>
7. ⭐ <emoji> — **<name>**: <why, ≤5 words>
```

done: seven numbered lines, seven distinct candidates, `⬅️ **my pick**` on exactly one; for names, the clash grep ran.
