---
name: crew-designer-interview
description: Load BEFORE any design job starts — «let's design», «design for», «redesign», «new app design», «new look for», «quick design». the operator interview that turns dima's want into a designer brief.
argument-hint: "<app> [quick|blind]"
---

# crew-designer-interview — the brief, picked, never written from scratch

You interview dima so the designer (`x:crew-designer`) gets a brief it can act on. Dima is new to
design and his eye works as a **veto on concrete things**: offer picks, examples and a
recommendation on every line, and never ask him to describe a vibe. Keep his part light: one
message of questions, one round of answers.

The output is `~/projects/studio/jobs/<app>/brief.md`. The input decides the output, so the brief
is the whole job.

## 1. mode

- **⚡ quick** — «quick», «just make something beautiful», «surprise me»: no interview. write a
  3-line brief (app, the view, «quick: designer picks the axes»), print the links (step 3), and
  hand off. the designer picks its own two axes from the app's purpose.
- **🎯 full** — everything else. steps 2–6.

## 2. prep, silent — never ask what a file answers

- read the app's `PRODUCT.md` (purpose, users, constraints) and `FTR.md` (features, states per view).
- **blind** (a from-scratch redesign: the arg, or dima says «from scratch», «ignore the current
  look») → write `jobs/<app>/map.md`: the features, the purpose and the states of the views in
  scope, copied from `FTR.md` and `PRODUCT.md` with every look word removed (colours, fonts,
  themes, named styles, «like the current …»). the designer reads this map and never the repo.
- pre-fill every answer the files give; the questions below confirm them in one line.

## 3. the links — print them every time

Dima browses before he picks. print this block at the top of the questions message, every job:

- 🖼️ shipped app screens and flows
  - [Mobbin](https://mobbin.com/)
  - [Refero](https://refero.design/)
  - [Page Flows](https://pageflows.com/)
- 🌐 web art direction
  - [Godly](https://godly.website/)
  - [Land-book](https://land-book.com/)
  - [Awwwards](https://www.awwwards.com/)
  - [siteInspire](https://www.siteinspire.com/)
- ✨ sparks, not evidence of a working flow
  - [Dribbble](https://dribbble.com/)
- 🎨 the design languages, one sample each → `~/projects/studio/directions/gallery.html` (and its
  artifact link when one is published)

## 4. the questions — one message, ≤10, each a pick

Numbered, one per line, each with its options and a ➡️ recommendation, the line's end free for
his `←`. A skipped line means he accepts the recommendation. Drop any line the prep settled.

1. purpose + audience — your one-line reading of `PRODUCT.md` → «right?»
2. the view in scope — one key view by default; name it from `FTR.md`
3. axis 1 — a pair from the list below, or his own:
   - quiet ↔ expressive
   - dense ↔ airy
   - tool ↔ toy
   - warm ↔ cool
   - classic ↔ experimental
   - soft ↔ sharp
4. axis 2 — a second pair, different in kind from the first (one about feel, one about layout)
5. references — up to 3 links (from the lists above or his own), each with **what exactly to
   take** from it (the type? the density? the one screen?)
6. do lines — offer 5 candidates to tick, he adds his own; the brief needs ≥3
7. don't lines — offer 5 candidates (the AI look is the first source: purple gradients and glow,
   SaaS card kits, cream + serif + clay, near-black + one acid accent), he adds his own; ≥3
8. which do/don't lines are **hard** (a take breaking one is out)
9. states to cover — the list from `FTR.md` (empty, loading, error …) → «all of them?»
10. the spread — 4 takes, blind yes/no, the artifact door for sharing (➡️ files only)

## 5. the gate — before the brief is written

- two named axes
- every adjective has an **anchor**: a reference and what to take from it
- ≥3 do and ≥3 don't lines, the hard ones marked
- the states of the view listed, not only the ideal one

A gap → one short follow-up, then write it as an open line under `## open`. The designer reads
an open line as «your call, say what you chose».

## 6. write the brief

`~/projects/studio/jobs/<app>/brief.md` — the product half takes impeccable's `PRODUCT.md`
headings, so the build later reads the same words:

```md
# <app> — brief v1

mode: full | quick · blind: yes | no · spread: 4 · share: files | artifact
map: jobs/<app>/map.md   ← blind only

## Users
## Product Purpose
## Capabilities and Constraints
## Evidence on Hand        ← real content the takes must carry; absences never invented

## View
## Axes                    ← «quiet ↔ expressive», «dense ↔ airy»
## References              ← link — what exactly to take
## Do                      ← (hard) marks the hard ones
## Don't
## States
## open
```

Then show dima the brief in five lines (view, the two axes, the hard lines) for a yes or one
correction round, and hand it off: the designer session starts in `~/projects/studio` with
`/x:crew-designer <app>`.

## completion criterion

`brief.md` exists and passes the gate (or lists every gap under `## open`), a blind job has its
`map.md` with no look words, the links block was printed, and dima said yes to the brief.
