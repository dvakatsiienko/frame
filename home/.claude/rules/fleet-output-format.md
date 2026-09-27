# output formatting — the mechanical shape of every reply
<!-- sync: cw -->

**scope:** everything checkable without hearing a tone — links, typography, emoji, casing, copy
fences, reply shapes and skeletons, the ➡️ cta, question shape. binds every fleet member.
**not here →** tone, register, manner, the voice stack: `rules/fleet-voice.md`. how to read dima's own
messages: `rules/dima-signals.md`.

<!-- boundary: swap the voice and this file still binds — a tone test parks fleet-voice.md only. -->

## the shapes that keep breaking

- **answer first.** open with the verdict. never build up to it.
- **tldr is default.** prefer compact responses that deliver all points clearly. expand when asked.
- 🚫 **md tables are banned everywhere — replies, tickets, docs.** bullets carry it:
  `- key — value`. a table renders broken in his terminals and editors and burns tokens on
  pipes. print one only when dima asks for a table, or for a genuine 3+ column matrix he
  approved.
- **bullets are encouraged.** prose is the exception, never more than three lines.
  - a bullet is one sentence. more than that, and it nests: the bullet becomes a label, each fact
    a sub-bullet. never let a bullet wrap into a block.
  - 🚫 oneline lists are banned — «topic a · topic b · topic c» always becomes multiline. the
    `·` separator never appears inside a sentence at all: three things in a row are three
    bullets (dima on a «missed so far» paragraph, 2026-09-08: «ugly block»).
- **operations get list shape, never prose.** one op per line, `FRM-N → what happened`, grouped by
  kind. his words on a reply packed with ids mid-sentence: *«so ugly… hard to read»*. reasoning
  stays prose; operations never do.
- **next steps are plain separate lines.** never ①②③ glyph run-ons in one line.
- **plain is not the goal.** flat output is *«a bit boring»*. structure **plus** colour. grey walls
  and confetti are both wrong.

## typography

emphasis is semantic and stable — same entity type, same treatment, every time. this substitutes
for colour, which the terminal cannot render.

- `backticks` — system entities: files, paths, skills, commands, stores, code identifiers. also
  brand and product names (`linear`, `github`, `notion`), which stay lowercase; the backticks do the
  standing-out a capital used to do.
- **bold** — key assertions, outcomes, decisions, numbers that matter.
- _italics_ — peer and agent names (_cc_, _cw_) and soft emphasis.

highlight the load-bearing part of a sentence so it scans. never ship flat prose.

## emoji

allowed and wanted, judiciously — accent, not confetti. ascii art is welcome where it earns its
place: diagrams, celebrations, easter eggs.

an emoji is a **line prefix**, never inline decoration.

- ✅ `- ✅ a. workflow — kept` — emoji first, before numbering, labels, or names.
- ❌ `- a. workflow — ✅ kept` — never trailing.
- verdict emojis (✅ 🚫 📌 ⚠️ 🔎 📋 ➡️) lead the line.
- 📌 marks what dima should not skim — a caveat, a constraint, a thing that will bite later. this
  is the common one; reach for it by default.
- ⚠️ is reserved for a **live hazard**: something broken now, or an action that destroys work.
  spending it on ordinary caveats is what made it invisible.
- mid-sentence emoji only when the emoji **is** the content.

## links and paths — one click, always

if a thing has a url, dima reaches it in one click. he never copies a bare url, never searches for
a page you named, never navigates from a site root to the page you meant.

- **every web resource you name is a markdown link.** label it and link it.
- **strictest when you ask him to do something.** deep-link to the destination so the click *is*
  the action.
- **ticket ids are always an https link plus a short tldr**, never bare — including inside
  lists: `[FRM-3](https://linear.app/x-com/issue/FRM-3): setup audit — in progress`. https is the
  one form every surface renders (the desktop Code tab and cw strip custom schemes); dima opens a
  ticket in the app with his Hyper+G raycast command.
- **an issue or pr from another repo is a full link** — `[vhs#787](https://github.com/charmbracelet/vhs/issues/787)`.
  a bare `#787` autolinks to the repo in view, and he lands on the wrong page (2026-09-25).
- **file paths stay in backticks, never an editor-scheme link** — the Code tab and cw strip
  `cursor://` too. in a chat reply, name the path so it can be found: repo-relative inside the
  repo, absolute outside it.
  - **inside a repo file, a plain relative markdown link** — `[pm](pm.md)` — renders in every
    viewer; no scheme.

🚨 **the check is mechanical, not attentional.** this rule has been broken with the rule in
context — once ~20 bare ticket ids in one reply. an id feels
like a word while you are writing it. **before sending, scan for `FRM-`, `DOT-`, `BYT-` and confirm
each sits inside `](https://linear.app/`.** same scan, same
bucket: **any chained sequence in one line** — ①②③ glyphs, `a → b → c` arrows, step chains,
and every `·` between two things — becomes plain separate lines. the shape is the bug, not the
glyph. 📌 the `·` habit is fed by our own memory files; a memory write uses bullets too, so the
next boot stops re-teaching it (dima, 2026-09-08: «how to force you stop printing these»).

## copy-paste blocks get visible ends 📋

**any text dima is meant to copy elsewhere is fenced AND ribboned** — a prompt for another agent, a
boot block, a command. a prompt printed as prose reads fine and gives no way to tell where it stops.

the ribbons sit **outside** the fence so they never get copied, with **one blank line between
ribbon and fence — to breathe**. **plain text only — no box-drawing glyphs, no dashes**: the long
`╭───╮` lines wrapped in the code tab and trimmed in cw (dima, 2026-09-08); an emoji-bold-emoji
line renders the same in every pane:

    📋 **copy → terminal** 📋

    ```
    the payload, and nothing else
    ```

    ✂️ **end** ✂️

- **the fence holds ONLY the payload.** commentary goes above or below the ribbons.
- **label the top ribbon with the destination** — `copy → next session`, `copy → terminal`.
- applies to **every** prompt. a one-line command is the easiest to mis-copy, because it looks
  like prose.
- **his hands needed → hand him the exact command in this fence, unprompted.** but first ask
  whether your own shell reaches it — run what you can run; fence only what truly needs him.

## casing — lowercase sentence-initial capitals

lowercase reads flatter and flows; a capital mid-line is a bump the eye clears.

**on** — everything that is ours:

- chat replies to dima in any frontend, any repo, ours or external — the reply is his channel and
  the surrounding repo never changes it
- our linear, in full: ticket titles, bodies, comments
- our own memory files and rules
- our own skills
- readmes and docs of repos we own (`frame`, `bytes`, …)
- commit subjects and bodies, in our own repos

**off** — never lowercase:

- contributions to projects we do not own — there our lowercasing is **undone**
- job and recruiter mail
- anything published under dima's name to an audience that is not dima
- quoted text, ever

### never re-case, in any mode

exact strings are not prose. **if a machine reads it, or a human would copy-paste it, it freezes.**

- code: identifiers, config keys, types and classes, env vars, json/yaml keys
- system: paths and filenames, commands and flags, file extensions
- web: urls, domains, package names
- tracker and git: ticket ids, branches, hashes
- human: quoted text, people's names

three traps that look like prose:

- **camelCase inside a sentence.** «pass `dangerouslySetInnerHTML` carefully» — flattening it
  produces a thing that does not exist.
- **a capital that distinguishes two real things.** `Linear` the tracker vs linear the adjective.
- **acronyms that are part of a name.** lowercase `ssh` in prose, never in `SSH_AUTH_SOCK`.

when unsure, do not flatten. a missed lowercase costs nothing; a flattened identifier costs a
debugging session.

🚫 **never re-case file content on sight**, even when asked to «apply the rule». rewrite only the
file he names.

## questions, options, and the ➡️ cta

- **two options max** per question. give the context needed to choose fast, and no more.
- **a questionnaire dima fills in holds one item per line**: the item, the ➡️ recommendation, and
  the line's end free for his `←`. a filled row of `a · b · c` reads badly to him while he answers,
  and to you when his answers come back as a prompt (dima, 2026-09-27).
- every question round ends with a ➡️ recommendation.
- **every reply ends with a ➡️ suggested next move** — driven by the roadmap and handoffs — so
  dima steers with one word instead of typing a long query.
- when he answers a round and skips a question, the omission means he accepts the recommendation.
  proceed. never re-ask to confirm.
- **⏲️ blocked on something external → the LAST line says so.** after the ➡️ and the ⏳ block,
  only while a review bot, ci, a background job or another agent genuinely holds the session:
  what is being waited on plus how the answer arrives — `⏲️ waiting on the two pr bots — the
  pr watcher wakes me when either posts`. **the waited thing is a link when it has a page** — a
  pr, a ci run, a deploy: `⏲️ waiting on the bots on [#70](https://github.com/…/pull/70)`; a
  coder or an agent needs no link, dima sees it in his tab. dima peeks into a quiet thread and cannot tell
  «blocked, correctly idle» from «stalled»; ➡️ says what comes next, not what holds now. a reply
  that is not blocked carries no ⏲️ line, or the marker rots into decoration. (dima's ask,
  2026-09-11, relayed from a coder session.)
- **open asks ride a «⏳ waiting on your word:» block at the very end of the reply** — the final
  cta of every turn, repeated in every following reply until he verdicts each. an ask that only
  appeared once is an ask he never saw. (this is for asks awaiting a decision; a skipped question
  in an answered round is still an accept.) the header sits OUTSIDE the fence as a plain line;
  the fence holds only the numbered asks, so what he copies is exactly what he answers (dima,
  2026-09-14: cw rendered the in-fence header as a thing to delete after every paste):

      ⏳ waiting on your word:

      ```
      1. <ask> ➡️ <recommendation>
      2. <ask> ➡️ <recommendation>
      ```

## reply skeletons

- **default report** — anything non-trivial:
  - bolded verdict line
  - bullets carrying the substance
  - ➡️ next step
- **plan report** — you wrote a plan file and are summarising it. the reply is the trailer, not
  the movie:
  - bare path to the file
  - bolded verdict, the one decision it turns on
  - 🔎 **findings**, including the surprising ones — this section earns its length
  - 📋 **plan**, numbered, one line each, no code
  - 📌 risks and what you left out
  - ➡️ next step
- **quick answer** — a factual question with a short answer: just answer it. no skeleton, no
  verdict line, no next step. never inflate a one-line answer into a report.

## boards — status reports have ONE shape

- bold section header per topic, then one fact per line, nested bullets.
- 🟢🟡🔴 group by state, never inline lists of ids in prose.
- a section «the one confirm» — every question isolated there, one line each.
- a section «no action needed» — everything informational parks under it.
- an id never shares a line with a second id's story.

## the output kit

- 📊 mini scoreboard for session wrap-ups (created / done / touched / routed) — bullet lines, not a table
- 🚦 fleet reports as one line per session, fixed order: 🟢 done-idle · 🟡 working · 🔴 blocked.
  naming is type-first — «ccli batch-1», «cwrk research-x»
- 🧾 diff-shaped state changes: `field: old → new`
- 🏷️ incremental art or product work (a diorama set, an mvp growing round by round) → every
  report ends with its version label — `mvp`, `mvp v1`, `mvp v2`, `prod`, or a number like
  `0.03` — and the artifact carries the same label in its title or header, bumped on each
  republish. one-off work carries no label (dima, 2026-09-25)
- 🃏 a one-line lowercase haiku at session wrap

## a multi-item drop gets restated

when his message carries several separate items, open with a short parsed list of what you read
out of it, then act. he corrects a misread before it becomes work. **mark the observation-only
ones** — those are what a wrong read turns into unwanted work; his markers are in
`rules/dima-signals.md`.

👀 parsed:
1. rename the mcp verbs
2. seed the milestones
3. answer the naming question
4. (observation, no action) ctx cost
