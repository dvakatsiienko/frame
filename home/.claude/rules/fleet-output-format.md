# output formatting — the mechanical shape of every reply
<!-- sync: cw -->

**scope:** everything checkable without hearing a tone — links, typography, emoji, casing, copy
fences, reply shapes and skeletons, the ➡️ cta, question shape. binds every fleet member.
**not here →** tone, register, manner, the voice stack: `rules/fleet-voice.md`. how to read dima's own messages: `rules/dima-signals.md`.

<!-- boundary: swap the voice and this file still binds — a tone test parks fleet-voice.md only. -->

## 🚫 bans — the shapes that keep breaking

- **md tables, everywhere** — replies, tickets, docs. a table renders broken in his terminals and
  burns tokens on pipes; bullets carry it as `- key — value`. one exception: dima asks for a table.
- **the `·` separator and one-line lists.** three things in a row are three bullets; `·` never
  sits inside a sentence. the reply-check hook logs every recidive.
- **commit hashes in a reply to dima.** he reads none; a reply names what landed in words. member
  traffic keeps them — a coder's «push <branch> <sha>» is what the coordinator verifies.
- **trailing emoji** — an emoji leads its line, see emoji below.
- **glyph run-ons** like ①②③ in one line — next steps are plain separate lines.

## shapes

- **answer first.** open with the verdict. never build up to it.
- **tldr is default.** compact replies that deliver every point; expand when asked.
- **bullets over prose.** prose is the exception, never more than three lines.
  - a bullet is one sentence. more than that, and it nests: the bullet becomes a label, each fact
    a sub-bullet.
- **operations get list shape.** one op per line, `FRM-N → what happened`, grouped by kind;
  reasoning stays prose.

## typography

emphasis is semantic and stable — same entity type, same treatment, every time. this substitutes
for colour, which the terminal cannot render.

- `backticks` — system entities: files, paths, skills, commands, stores, code identifiers. also
  brand and product names (`linear`, `github`, `notion`), which stay lowercase; the backticks do the
  standing-out a capital used to do.
- **bold** — key assertions, outcomes, decisions, numbers that matter, and peer and agent names.
- no italics.

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
- **every fleet word prints bold, with its badge glued to it when it has one** — **✨ wisp**,
  **🌤️ siesta**, **🌠 wish**, **🍀 freebie**, **lane** (dima's verdict after a thread trial, 2026-10-08: «bold
  reads much better than non-bold for vibe keywords»). the badge never travels alone: a bare ✨ reads as
  llm slop sparkles, «✨ wisp» reads as the bug list. the words and badges live in `rules/fleet-vibe.md`.
- **picking an emoji for anything** — offer a few from dima's own favourites first, then a few fresh
  fits; he picks. his set (handpicked, 2026-10-08): 🐋 🐬 🐠 🫍 🦈 🐆 🪶 🐉 🐦‍🔥 🪸 🌼 🌻 🌞 🌘 🌗 🌔 🪐 💫 💨
  🛼 🫟 🎑 🌠 🌌 🧞‍♂️

## links and paths — one click, always

if a thing has a url, dima reaches it in one click. he never copies a bare url, never searches for
a page you named, never navigates from a site root to the page you meant.

- **every web resource you name is a markdown link.** label it and link it.
- **a generic filename prints with its parent dir** — `refresh-crew-coordinator/recipe.md`, never a bare
  `recipe.md`, `log.md`, `SKILL.md` or `AGENTS.md`, so the name alone says which one (dima, 2026-10-07)
- **strictest when you ask him to do something** — grab an api key, flip a setting, re-grant a
  permission: deep-link the exact page or pane so the click IS the action, never «go find X».
  before asking at all, look for the door that does it for him (a `defaults write`, a script).
- **ticket ids are always an https link plus a short tldr**, never bare — including inside
  lists: `[FRM-3](https://linear.app/x-com/issue/FRM-3): setup audit — in progress`. https is the
  one form every surface renders (the desktop Code tab and cw strip custom schemes); dima opens a
  ticket in the app with his Hyper+G raycast command.
- **an issue or pr from another repo is a full link** — `[vhs#787](https://github.com/charmbracelet/vhs/issues/787)`.
  a bare `#787` autolinks to the repo in view, and he lands on the wrong page (2026-09-25).
  - **inside a repo file, a plain relative markdown link** — `[pm](pm.md)` — renders in every
    viewer; no scheme.

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

- every question round ends with a ➡️ recommendation.
- **every reply ends with a ➡️ suggested next move**, a quick answer excepted (see the skeletons) — driven by the roadmap and handoffs — so
  dima steers with one word instead of typing a long query.
- when he answers a round and skips a question, the omission means he accepts the recommendation.
  proceed. never re-ask to confirm.
- **a questionnaire dima fills in holds one item per line**, numbered `1.` `2.`: the item, the ➡️
  recommendation, and the line's end free for his `←`.
- give the context needed to choose fast, and no more.

### 🔭 blocked on something external
- **when**: only while a review bot, ci, a background job or another agent genuinely holds the
  session. not blocked → no 🔭 line, or the marker rots into decoration.
- **where**: the LAST line, after the ➡️ and the ⏳ block. ➡️ says what comes next; 🔭 says what holds now,
  so dima can tell «correctly idle» from «stalled».
- **shape**: what is waited on + how the answer arrives — `🔭 waiting on the bots on [#70](https://github.com/…/pull/70) — the pr watcher wakes me`.
  - a thing with a page is a link labelled with an emoji and a short word; several things, one per line
  - a member is bold with its role emoji, no link: **🦉 cclio**, **🔧 coder**, **🔎 verifier**,
    **🎨 designer**, **🐝 researcher**, **🧪 probe**, **☁️ cloud**, **🤝 cw**

### ⏳ open asks
- **open asks ride a «⏳ waiting on your word:» block at the very end of the reply**, repeated in
  every following reply to HIS message until he verdicts each. an ask that appeared once is an ask
  he never saw.
- **ONE live bucket.** every print carries every open ask, renumbered from 1; an ask leaves only on
  his verdict. a new ask joins the bucket, never a second partial block.
- the header sits OUTSIDE the fence as a plain line; the fence holds only what he answers.
- **one fence, one copy**: the asks under a bare `lane` line; Wispr adds (`rules/dima-signals.md`)
  in the same fence under `wispr adds`, after a blank line, each pre-ticked ✓. no adds, no section.
- a line under the fence points at the last report, the name bold; his **`rewind`** reprints it.

      ⏳ waiting on your word:

      ```
      lane
      1. <ask> ➡️ <recommendation>
      2. <ask> ➡️ <recommendation>

      wispr adds
      1. <heard> → <meant> ✓
      ```

      📄 last report: **<topic>**, <HH:MM>

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
- 🚦 fleet reports as one line per session, in fixed order — 🟢 done-idle, then 🟡 working, then 🔴 blocked;
  naming is type-first — «ccli batch-1», «cwrk research-x»
- 🧾 diff-shaped state changes: `field: old → new`
- 🏷️ incremental art or product work (a diorama set, an mvp growing round by round) → every
  report ends with its version label — `mvp`, `mvp v1`, `mvp v2`, `prod`, or a number like
  `0.03` — and the artifact carries the same label in its title or header, bumped on each
  republish. one-off work carries no label (dima, 2026-09-25). **the artifact's title is the source
  of the label**: a message quotes the version the title shows, never its own count — «canvas v10»
  in a reply while the title still read «spread v1» sent dima looking for a page that was right
  there (2026-09-30)
