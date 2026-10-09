---
name: cli-drift-check
description: Load BEFORE a cli lane starts or a cli chunk is sealed — «drift check», «does x still fit», «cli census», a brief or plan that adds, merges or cuts an `x` verb or family.
argument-hint: "[ticket ids of the chunks under review]"
---

# cli-drift-check — does x still fit dima's want

x grows several verbs per lane, faster than dima can watch. This check holds the cli against
its design before the next lane builds on it. The judgment is yours; the facts come from two
sources and nowhere else.

## the inputs

1. `x/PRODUCT.md`: the **want** is every `>` quote and every bullet under `## the want`; the
   **admission rule** is the section `## what x is not — the admission rule`.
2. `pnpm --silent x:cli-census` (script: `script/x-cli-census.ts`): per family its verbs and
   their runs from `x stats`, the callers, then the top raw Bash heads no verb covers.
3. the chunks under review, when the args name tickets: `x linear read <ids…>`, the body is
   the spec.

Any repo file may back a verdict as evidence (`x/go/registry.json`, a verb's source); the
three inputs decide what gets a verdict.

The census has two spans. The verb runs cover what `x stats` holds, printed in the header;
a verb with zero runs over a span shorter than 30 days is **unproven**, never dead, since the
admission rule's telemetry clause needs 30 days. The raw heads always cover 14 days of cc
transcripts, so their counts are firm.

A raw head that names a script or a binary of ours (a file under `home/.claude/plugin-x/bin/`
or `script/`) is an **old door** candidate: a verb may already do its job, and the head shows
the door is still in use.

## the steps

1. **plan fit.** Give each want line one verdict, `met`, `partly`, `missing` or `contradicted`,
   with its evidence: a census number, a `file:line`, or a verb name. Done when every want
   line has a verdict.
2. **families.** Give each family in the census one verdict, `keep`, `merge into <family>`
   or `cut`, with its evidence: verb count, runs, and any raw head it could absorb. A raw head
   with ≥5 runs that matches a family's job is a **gap**: name it under that family. Done
   when every family has a verdict.
3. **chunks** (only when tickets were named). Per chunk, per verb, family, mode or flag it
   adds to x: does it serve a want line (name it), and does it pass each of the admission
   rule's three tests (a fleet procedure, more than one surface calls it, it hides a hazard,
   sequence or location)? The surface answer reads the census callers; with no caller data
   for that verb, label the answer an inference. A fix or a refactor that adds nothing gets
   one line and no rule answers. Done when every addition has a fit verdict and three rule
   answers.

## the report

Print it once, in this order: the census span line, plan fit, families, chunks, then the
three changes you would make first, ranked, each naming the ticket or family it changes.
Bullets, one verdict per line, the evidence after an em dash. The report is the whole
output: the census and the review stay in this session.
