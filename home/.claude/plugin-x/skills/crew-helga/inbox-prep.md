# inbox-prep — dima's inbox, prepped for clio's boot

the one chore class where you write prose: a groomed, sorted copy of dima's `inbox.md`, so clio reads a clean
board instead of a raw drop. his file stays untouched; yours is its sibling.

- read: `<_hq>/inbox.md`, re-read right before you write (icloud syncs whole files, last writer wins)
- read: the pocket, `BACKLOG_CWD=~/frame/_clio backlog task list --plain`, to name homes
- write: `<_hq>/inbox-helga.md`, whole-file; nothing else in the vault, no commit (the vault is not a repo)
- `<_hq>` = `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Dima's Vault/_hq`
- done: `node ~/frame/_clio/script/inbox-prep-check.ts` exits 0 (every content line of his sits verbatim in yours)

## an item

one item = one bold title of his and every line under it until the next bold title or section header; the text
under 🛹 general steering is one item too. the italic or `>` hint line under each section header is his template,
not content: leave it out. each item becomes one block:

- `### <id> · <subject>` — id = kind letter + number: `S` steering, `A` first action, `Q` question, `B` wisp (bug),
  `W` wish, `I` idea, `X` bigger or mixed, `N` note to himself
- the groomed text, as bullets
- `❓ asks:` then one sub-bullet per question of his, numbered across the whole file (`1.` … `23.`), so clio
  answers by number; an item with none skips the label
- `🏠 home:` — a pocket item or file the text points at, named by its id and title: «the reminder he means is
  PK-90»; only an item whose body says the same thing (`backlog task view <id> --plain`), never a title that
  only shares a word — no such item, no home line
- `🔗 relates:` — another item sharing its subject: `W1 — both about subagent spawning`
- `> [!quote]- original` — his lines, verbatim, each prefixed `> `, the bold title included; this is what the check reads

## grooming — the fold

- a loss is an ask or idea of his forgotten or dropped, or a line groomed so far its context is gone; a
  reworded sentence that keeps his intention is the goal
- so every sentence of his lands in a bullet or an ask, spelling and grammar fixed; filler (openers, hedges) goes
  and a long sentence may be tightened, never in a machine way: his meaning, manner, jargon, vibe words and
  lowercase stay. the same rules groom a mainline prompt in a `prompt-groom` chore
- a `prompt-groom` W-line is stamp-first: `W<n> (YYYY-MM-DD HH:MM, dima): text` (`inbox` in place of the time for an inbox day), never `W<n> · text (stamp)`
- his voice, first person: «i want…», «my idea…», as he wrote it; never «he» or «dima»
- a line he pasted from clio's reply (the line above his `←`, a quoted board line) is context, never his words: it names what his line answers and gets no W-line
- a question stays a question, in the asks and in the bullets: a suggestive one («map them yourself, rather than
  via helga?») lands as an ask, never as a decided bullet; «they are not git tracked yes?» is never the
  bullet «they are not git tracked»
- his goal and method lines stay whole: «the idea is …», «we just shape-idea over it», «the idea was …» each keep
  a bullet; a «they» keeps every member it names
- an ask is a question he wants answered; a rhetorical lead-in to his own reasons («why i ask?», then the why)
  is a bullet, never an ask
- a point he makes twice lands once: in one item, one bullet; across items, one bullet and a `🔗 relates:` line
  in the other
- freeze exact strings: paths, file names, skill and command names, ids, urls, identifiers, names of ours like
  «clio», «crow» — kept as written, never marked
- add nothing: no answers, no advice, no facts of yours; a word you cannot read stays as written, marked `(?)`
- the kind follows the content, his section is a hint: a wish that is mostly questions stays a wish, its
  questions go to `❓ asks:`; a move out of his section is named in your notes

## the file

```markdown
---
icon: 🎀
prepped: YYYY-MM-DD HH:MM
---

# 🎀 inbox, prepped

## 🧭 at a glance
- 🛹 <the steering in one line, his voice>
- <count> items, <count> asks
- 🔗 <a thread across items>: <ids>

## 🛹 steering
## ❓ questions
## 🌠 wishes
…one section per kind that has items, in the order of the ids above

## 🎀 helga's notes
- <a move out of his section and why, a word you could not read, a judgment call>
```
