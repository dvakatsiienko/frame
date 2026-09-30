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
- 🎨 the design languages, one sample each → `~/projects/studio/directions/design-languages.html` (and its
  artifact link when one is published)

## 4. the questions — one message, ≤10, two options each

Two question kinds, never mixed in one question:

- **character** — a fixed lean every take shares (quiet or expressive). dima picks a side.
- **axes** — what the 4 takes vary. dima picks a *pair*, never a side; say so in the question
  («the 4 takes differ on this — pick which difference you want to see»).

The shape, in plain markdown (never inside a code fence):

- a bold numbered question in plain words, one line
- **a.** and **b.** as sub-bullets, one per line, each with what it looks like in one clause; the
  recommended one leads with ➡️. «or your own» is always allowed, never listed as an option.
- nothing packed into one line: no `·` runs, no option lists inside a sentence

Then one answer fence at the end, ribboned `📋 copy → your answers 📋`: one line per question,
its short title, the pre-filled pick after ➡️, and the line's end free for dima's `←` steer. he
copies it and edits only what he disagrees with:

```
1. purpose — is this right? ➡️ a ←
2. the first view ➡️ a ←
3. how loud is the app itself ➡️ a ←
```

The questions, drop any the prep settled:

1. purpose + audience — your one-line reading of `PRODUCT.md`, right or needs a fix
2. the view in scope — one key view from `FTR.md`, and what art sits in it (never the app's
   existing pieces on a blind job)
3. character — the leans every take shares, one question per lean: quiet or expressive, tool or
   toy, cool or warm, sharp or soft, airy or dense. ask only the ones the app does not already
   settle
4. the language — his top pick or his top two, from his gallery order when he has one
5. axis 1 — two candidate pairs, built from his picks above (the language often makes one:
   «glass ↔ swiss»)
6. axis 2 — two candidate pairs, different in kind from axis 1 (one about material or feel, one
   about layout)
7. references — up to 3 links with **what exactly to take** from each, yours or his
8. do and don't lines — 5 candidates each (don'ts start from the AI look), ticked by default;
   the brief needs ≥3 of each, and he marks the **hard** ones
9. states — the takes draw the ideal state + one more and the rest go on the pick, or all
   states now
10. the spread — 4 takes, blind, files only, or his changes

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
