---
name: memory-update
argument-hint: "check | prettify <entry|all> | dedupe [entry|all] | dry"
description: >-
  Load BEFORE any memory_write, memory_str_replace, memory_append or memory_delete to cloud chat global memory, and before creating any new memory entry — no exceptions, including a one-line edit and including a write dima did not ask for in those words. Also on «upd memory», «remember this», «save to memory», «prettify memory», «forget that». Owns the description grammar every entry is born with. Args: check · prettify «entry or all» · dedupe [entry|all] · dry; dima typing it bare gets the menu. cloud-chat-only; a cc session stops here (cc memory has its own procedure).
---

# memory-update — the shape of every cloud chat memory edit

Every write to cloud chat global memory goes through this skill. It owns HOW a memory is written;
nothing else writes cloud chat memory. dima's account / profile / instructions is fed from `~/frame` by
`pnpm memory-sync:copy` and his paste — his own section (above the `═══` line) from
`instructions-head.md` beside this skill, the cc masters (below it) from every section tagged
`<!-- sync: cloud-chat -->`; `pnpm memory-sync:map` lists the routes. cloud chat never writes that field.

## the menu — every way in

dima typing `/x-cloud-chat:memory-update` with no arg → print this menu and stop; do nothing else.

- *(auto, no arg)* — loaded before any memory write; runs the dupe check, then the write
- `check` — is the account instructions field current? stamp compare, plus a field-side edit to his section
- `prettify <entry|all>` — reformat only, nothing removed; starts with `check`, ends with a dupes report
- `dedupe [entry|all]` — apply the dupes report, each fix on his word
- `dry` — add to `prettify` or `dedupe`: print every planned write, write nothing

## the dupe check — first, before every write

three stores load together: dima's own section of account / profile / instructions (above the
`═══` line), the cc rules rendered under that line, and this memory. **one fact, one store.**

1. read the account instructions in this session's system prompt. the fact is already there →
   **do not write it.** a sharper version of a rule below the line is a change for its master in
   `~/frame`; a sharper version of dima's own section is his to edit — relay either, never file a
   memory copy.
2. `memory_list` with previews. the fact already lives in an entry → update that entry, never add
   a second copy.
3. a dupe met on the way is fixed in the same run when it is a pure repeat: remove the memory
   copy — the field wins over memory; between two entries, the entry whose subject owns the fact
   wins. a dupe that differs in substance is a conflict: print it and ask, never pick a side.

## routing — where a fact belongs

- **one subject, one file.** a fact goes where its subject lives, never into whichever file was
  open. unsure → `memory_list` with previews: the descriptions ARE the index.
- `/areas/` = things with a lifecycle (a project, a hunt, a system) · `/topics/` = things that
  just are · `/profile.md` `/preferences.md` = fixed roots.
- a genuinely new subject gets a new entry, never a section squatting in a neighbour file.
- 📌 **a new entry is born with its description, in the same write that creates it** — written to
  the grammar below, not left for a later prettify pass. an entry created without one is an entry
  that cannot be found again, and the pass that would have fixed it has to notice it first.
- after any write that changes what an entry owns: refresh its `description` in the same run.
- 🚨 **the `description` is the most load-bearing line in the entry.** a leaf is never auto-loaded;
  the listing shows its path and its description and nothing else, and that line is the only thing
  deciding whether the file is ever read. it is not formatting and it is not «regenerable, so it
  does not matter».
- **trigger first, always** — `read before <the moment> — <what is inside>`, never the reverse.
  the listing **truncates a description at 80 characters** (measured 2026-09-21), so a trigger
  written last is a trigger that never arrives. 16 entries were found broken in exactly this way,
  every one of them faithful to the «what is inside, then when to read it» order this skill used
  to prescribe.
- verify it, do not trust the draft: `memory_list` with `include_preview` prints what the listing
  actually shows. no trailing `…` means it survived the cut.
- no index file exists: entry `description`s in `memory_list` ARE the index — unsure where a
  fact goes, read the descriptions and the closest match owns it.
- after moving a fact between entries: grep the OTHER entries for references to its old owner —
  a move silently stales any line that pointed there.
- **retiring an entry has one safe order**: copy its content to the new owner → verify it landed
  by re-reading the new owner → `memory_delete` the old entry → re-read the listing. any other
  order can lose data permanently (no history, no undo). ⚠️ never delete before the new owner is
  verified; a delete is final, and «i already wrote it» is not verification.

### the description grammar

- shape: `read before <the moment> — <what is inside>`. the moment is when a future session is
  about to act, not a topic name.
- 🚫 «dima's obsidian vault — where it lives, how he uses it … read before touching a vault file»
  — the trigger is past the cut and the entry is invisible.
- ✅ `read before any vault file read or write — path, sync hazards, house style` — 74 chars, the
  trigger arrives first, the contents place it.
- name the **moments that actually recur**, in his words, not a category: `any gmail, slack,
  notion, 1password or shell call` beats `tooling`. a reader matches on the moment it is in.
- `aliases:` carry the names a mention would use — `himalaya`, `slk`, `gmail` — so the entry is
  reachable by the thing, not only by the topic.

## write mechanics — the tool contract

- **read before write, always** — version tokens come only from `memory_read`, per file. the
  pre-write read is also the only backup that exists; hold it in context before writing.
- **`memory_str_replace` is the primary verb.** full `memory_write` only for restructures —
  ⚠️ it replaces the ENTIRE file; any line omitted is deleted. empty `new_str` on str_replace
  is the only line-delete available.
- `memory_append` only for a genuinely new fact on a sectionless entry — on a sectioned entry
  it lands outside every section.
- a version conflict returns the current content in the error: merge and retry same turn.
- a content-refused write (privacy filter) is a hard stop, never rewritten to slip past.
- **`memory_delete` exists and works from cloud chat** — verified in a projectless thread, 2026-09-21.
  it takes `if_version` from a fresh `memory_read`, so the pre-delete read is mandatory. never
  tell dima that cloud chat cannot delete an entry; that claim was wrong and he was told it more than once.
- 📌 delete only on his explicit ask for that entry or that subject — never to tidy up, dedupe,
  or drop a file that merely looks stale. unsure whether he means one fact or the whole entry:
  ask before either.

## the caps — what memory costs

- **only `/profile.md` and `/preferences.md` are auto-loaded.** every other entry is a leaf: a
  path and a description in the listing, read only when this skill's reader chooses to.
- injected-char budgets per host, measured 2026-09-21. no mirror blocks live in memory anymore —
  the whole budget is cloud-chat-native:
  - `/preferences.md` — 16 384
  - `/profile.md` — 8 192
  - a leaf — 49 152 bytes of storage, and it costs nothing at all until it is read
- chars are not bytes: emoji and «» push the byte count ahead of the char count. every write
  result reports both — read it, it is the only live measurement available.
- 🚨 **the resident pair is a routing table, not a library.** detail belongs in a leaf. what must
  stay resident is only what a leaf cannot rescue: that a door exists at all. a leaf is read only
  when the reader already knows it is in that domain, so an unknown-unknown — gmail has a cli,
  and no mcp — is lost unless it is resident. the doors live in `rules/fleet-doors.md` and reach
  cloud chat through account / profile / instructions; never hand-write them into an entry.

## register — how memory prose reads

memory serves two readers: dima (must answer his question without re-asking) and the agent
(must route correctly). write for both, plainly.

- every fact line starts `- [stated] ` and states one fact.
- **dima's words are copied verbatim, never paraphrased** — quotes are the payload.
- plain word over rare word; the real name of the thing; one name per concept.
- state facts flat — a memory line is a record, not writing. before finishing, reread every
  written line: a line that reads like flavour (metaphor, flourish, rhythm for its own sake)
  gets cut. this binds every model that runs this skill.
- lowercase register — fact lines, `description`, and all frontmatter values alike; `backticks`
  for files, commands, identifiers.
- **sectioning fires on repetition, not length**: a prefix repeated 3+ times becomes a section
  header holding those lines; an entry past ~15 fact lines gets sections.
- cross-link a related entry with `[[name]]` where a reader would actually follow it — never
  decoratively, a couple per entry at most (they render clickable in the claude.ai memory ui).
- 📌 `sources:` frontmatter is NOT provenance — it marks pre-bridge origin and is never refreshed
  on edit. `derived-from:` is the only trustworthy bridge marker.

## guardrails

- memory is written only on dima's approval or ask. no bulk writes.
- unsure whether to prune a line → ask him before writing.
- a fact with a master file in `~/frame` is a derived copy — point at the master or copy it
  exactly; never write a competing variant.
- everything under the `═══` line in account / profile / instructions is a cc master rendered by
  `memory-sync` — never copy it into an entry; a change goes to the master in `~/frame`, then
  `pnpm memory-sync:copy` and dima's paste.

## arg: `dry`

run the full pass, print every intended write as a diff, write nothing.

## arg: `check`

is the account instructions field current? read-only.

- render fresh on the mac (desktop-commander `start_process`: `cd ~/frame && node script/skill-memory-sync-mirror.ts`)
  and compare the manifest's `sha256` with the one in this session's account instructions.
- print `account instructions: current` or `account instructions: stale — run pnpm memory-sync:copy, then paste`.
  never touch his clipboard; never print the block.
- the text above the `═══` line differs from `instructions-head.md` → he typed in the field: say so,
  and offer to copy his field text into the file word for word before he runs `copy` — never
  the other way round.

## arg: `prettify <entry|all>`

**prettify is a formatter, never a de-duper: it reshapes lines and loses nothing.** in scope:
register, `[stated]` prefixes, stale descriptions, sectioning. a line that reads like flavour is
rewritten flat, its fact kept. `all` walks every entry in the listing.

it starts with `check` — its result is the report's first line.

after the per-entry walk, one **cross-entry pass**: list every entry's subjects side by side —
the account instructions count as one more entry — and flag any fact claimed by two of them — per-entry reading is structurally blind to dupes, and
every dupe found in the field test survived a full prettify walk. the pass prints one fixed
block and writes none of it:

```
🔎 dupes and conflicts
- entry-a ↔ entry-b: the fact — ➡️ proposed fix
```

every merge, move, re-route or line you want gone is a line in that block. nothing leaves
memory from a prettify run.

## arg: `dedupe [entry|all]`

the second wave, dima's word each time. input is the `🔎 dupes and conflicts` block from a
prettify run in the same session; run alone, it does a fresh cross-entry pass first. print the
fix list, stop for his word, then apply each approved fix as its own `memory_str_replace`:
a move lands in the new owner before it leaves the old one; a delete is a move to the surviving
copy, never a bare cut. report `entry: fixed / skipped`.

`dry` on either arg prints and writes nothing.
