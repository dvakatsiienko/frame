# inbox-prep — dima's inbox, prepped for cclio's boot

the one chore class where you write prose: a groomed, sorted copy of dima's `inbox.md`, so cclio reads a clean
board instead of a raw drop. his file stays untouched; yours is its sibling.

- read: `<_hq>/inbox.md`, re-read right before you write (icloud syncs whole files, last writer wins)
- read: the pocket, `BACKLOG_CWD=~/frame/cclio backlog task list --plain`, to name homes
- write: `<_hq>/inbox-composer.md`, whole-file; nothing else in the vault, no commit (the vault is not a repo)
- `<_hq>` = `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Dima's Vault/_hq`
- done: `node ~/frame/cclio/script/inbox-prep-check.ts` exits 0 (every content line of his sits verbatim in yours)

## an item

one item = one bold title of his and every line under it until the next bold title or section header; the text
under 🛹 general steering is one item too. the italic or `>` hint line under each section header is his template,
not content: leave it out. each item becomes one block:

- `### <id> · <subject>` — id = kind letter + number: `S` steering, `A` first action, `Q` question, `B` wisp (bug),
  `W` wish, `I` idea, `X` bigger or mixed, `N` note to himself
- the groomed text, as bullets
- `❓ asks:` then one sub-bullet per question of his, numbered across the whole file (`1.` … `23.`), so cclio
  answers by number; an item with none skips the label
- `🏠 home:` — a pocket item or file the text points at, named by its id and title: «the reminder he means is
  PK-90»; only a match you can show from the pocket list, never a guess
- `🔗 relates:` — another item sharing its subject: `W1 — both about subagent spawning`
- `> [!quote]- original` — his lines, verbatim, each prefixed `> `, the bold title included; this is what the check reads

## grooming — the fold

- a loss is an ask or idea of his forgotten or dropped, or a line groomed so far its context is gone; a
  reworded sentence that keeps his intention is the goal (dima, 2026-10-15)
- so every sentence of his lands in a bullet or an ask, with spelling and grammar fixed; only filler words go
  (openers, hedges); his meaning, manner, jargon, vibe words and lowercase stay
- his voice, first person: «i want…», «my idea…», as he wrote it; never «he» or «dima»
- a question stays a question: a suggestive one («map them yourself, rather than via composer?») lands as an
  ask, never as a decided bullet
- an ask is a question he wants answered; a rhetorical lead-in to his own reasons («why i ask?», then the why)
  is a bullet, never an ask
- a point he makes twice lands once: in one item, one bullet; across items, one bullet and a `🔗 relates:` line
  in the other (dima, 2026-10-15)
- freeze exact strings: paths, file names, skill and command names, ids, urls, identifiers, names of ours like
  «clio» (cclio) — kept as written, never marked
- add nothing: no answers, no advice, no facts of yours; a word you cannot read stays as written, marked `(?)`
- the kind follows the content, his section is a hint: a wish that is mostly questions stays a wish, its
  questions go to `❓ asks:`; a move out of his section is named in your notes

## the file

```markdown
---
icon: 🎼
prepped: YYYY-MM-DD HH:MM
---

# 🎼 inbox, prepped

## 🧭 at a glance
- 🛹 <the steering in one line, his voice>
- <count> items, <count> asks
- 🔗 <a thread across items>: <ids>

## 🛹 steering
## ❓ questions
## 🌠 wishes
…one section per kind that has items, in the order of the ids above

## 🎼 composer's notes
- <a move out of his section and why, a word you could not read, a judgment call>
```

<!-- born 2026-10-15 on dima's boot ask; a 7-day trial in docs/test-drive/composer-inbox-prep.md decides it -->
<!-- round 1 sharpened the same day: composer's 8 spec gaps closed, questions kept questions, his voice, pocket homes -->
