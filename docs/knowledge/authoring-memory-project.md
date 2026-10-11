---
researched: 2026-08-23
sources-current-as-of: cc 2.1.296 · code.claude.com/docs/en/memory · pingdotgg/t3code AGENTS.md (DOT-73 attachment) · theo's own breakdown of it · bytemonk claude.md transcript
refresh-when: a project file is written and a section here turns out to have no place to go — fix the skeleton, not the file
ticket: FRM-216
---

# project memfile authoring — how to write a project `AGENTS.md`

sibling to `authoring-memory.md` (**where** a fact goes) and `authoring-skill.md` (**how** a skill
is written). this one is the shape of ONE file: the `AGENTS.md` (or `CLAUDE.md`) at the root of a repo; ours are `AGENTS.md`.

🎯 **the reference is [`pingdotgg/t3code`](https://github.com/pingdotgg/t3code)'s `AGENTS.md`.**
dima's call: it is already distilled and fine-tuned, from a verified source. **the blocks quoted
below are copied, not rephrased.** copy them again when you write a new file; do not improve them.

claim tags: **[read]** stated by anthropic's docs or the reference · **[inferred]** our judgment.

## the thesis — it is a communication file, not a competence file

**[read]** theo, after ~16 hours of doing nothing but editing these files:

> the role of all of this is **not to make the model better at writing code**… the main point, the
> main reason i put all this time in, is to make the model better at **communicating with me**.

that reframes what belongs here. a rule that makes output easier to read, or that makes the agent
name what it did, earns its place as much as one that prevents a bug. it is also why the glossary
below is the highest-value section in the file.

## it is NOT a README, and the difference is sharp

**[read]** theo again, and this is the cleanest statement of it:

- `README.md` answers *should i pull in this code?* — for a human or agent **deciding**
- `AGENTS.md` answers *how do i change this code, and what must i know first?* — for an agent **working**

> while there is a lot of overlap between developers contributing to a project and agents doing
> those contributions, this file really should not be written for devs — it should be written for
> agents, **to help the agent interact with the dev better**.

➡️ **the test:** if a sentence would sit equally well in the README, it probably belongs there
instead. yes, some of this file describes the project — but only as much as the agent needs before
it changes something, so it does not *«spend its first four tool calls googling and reading files to
figure out what we're doing»*.

## the two jobs, and we conflate them

1. **represent the project** — what it is, how it is shaped, what its vocabulary means
2. **say how agents work in it** — how PRs get filed, how dev servers get run, how test data is
   seeded, and 🚨 **how not to kill the server the human is already using**

most of ours do only the first. different audiences, different decay rates: keep them as visibly
separate sections rather than one blended wall.

**tone continuity is a requirement.** a project file reads in the root file's voice. nothing checks
this today and the drift is invisible — each file is written alone and only feels wrong side by side.

## the budget

**[read]** target **under 200 lines**; the reference is 155. the only real relief is a `paths:`-scoped
rule in `.claude/rules/`, which fits a code convention, never an intention (`authoring-memory.md` § the mechanics).

**[read]** `/doctor` cuts what is derivable (directory layouts, dependency lists, architecture
overviews) and keeps pitfalls, rationale, and conventions that differ from tool defaults: the
correct filter, applied by hand too. the `why` of a rule goes in a block html comment with its
outcome (`authoring-memory.md` § the synthesis).

## the skeleton

in order. skip a section only when the project genuinely has nothing for it.

### 1. one paragraph — what this is

no marketing. what it is, what it is built from, who runs it. the reference:

> T3 Code is a minimal GUI for coding agents. A Node WebSocket server wraps provider CLIs (Codex,
> Claude Code, Cursor, Grok, OpenCode) and serves web, desktop, and mobile clients.

### 2. what must never be compromised

the values that outrank a clever solution. **[inferred]** this is what stops an agent
"improving" the thing the project exists to be. the reference gives four, each with a reason:
open at the core · performance without compromise · remote ready · multi-surface.

### 3. a note from the owner — in the owner's voice

the taste layer. **[read]** theo's, copy the shape and the framing verbatim:

> I like ambitious ideas, simple systems, and software that feels obvious. Do not preserve
> complexity just because it already exists. Do not introduce machinery because it looks
> architecturally impressive. Understand the real constraint, then fight for the smallest model
> that makes the correct behavior unsurprising.
>
> Channel both "measure twice, cut once" and "yagni". Fight scope creep. Try to honor the dev's
> intent in both a minimal and realistic fashion.
>
> The rest of this document is meant to help you navigate the codebase and make changes
> effectively. Think of these instructions less as "hard rules", more as "good defaults". The
> developer's preferences should be able to override anything here.

📌 **the last sentence is load-bearing.** it settles every precedence question in one line.

### 4. a glossary — the highest-value section

**[read]** theo: the glossary matters *«much more for the agent to describe things to me the way I
want it to»* than for comprehension. it is an output contract, not a dictionary.

the reference, copied — the first entry is the one everyone forgets:

> - **you** means the agent reading this file and changing T3 Code.
> - **we, us, and maintainers** mean Theo, Julius and the people building T3 Code. These are who
>   you are talking to now.
> - **user** means the person using T3 Code to direct coding agents.
> - **agent** means the coding agent a user runs inside T3 Code. Depending on context, that may
>   also include you.
> - **provider** means the agent runtime or harness T3 Code talks to.
> - **client** means the web, desktop, or mobile UI.
> - **environment** means one running T3 server and the machine, filesystem, provider credentials,
>   and state it owns.

### 5. 🚨 the ways to hurt yourself

each entry: the destructive act, why it is reachable by accident, and the safe alternative. the
reference's first two:

> **Killing by pattern.** Never `pkill -f`, `pgrep | kill`, or `kill` a PID you found by matching a
> name, path, or worktree string. Your own agent process has this worktree's path in its argv, and
> this machine runs several other dev servers at once. Kill only a PID you captured at spawn, or
> the owner of your port from `ss -H -ltnp` after confirming `/proc/<pid>/cwd` is your worktree.

📌 root `CLAUDE.md` § blast radius already holds this one for every session: a project file of ours skips it.

> **Writing to the live install.** `~/.t3/userdata` is the developer's real database, in use while
> you work. Reading it and copying from it are fine. Never start a server against it, never open it
> read-write, never clean it up.

third in the reference is a config trap that silently breaks remote clients. **[inferred]** every
project has one of these; find it before writing the section.

### 6. hit every surface

**[read]** the reference names this *«the most common defect in this repo»*: a change that works on
the path you tested and is missing everywhere else. it is a **checklist the agent must walk and
report on**, not advice:

> Before calling frontend work done, walk this list and say which entries applied:

entry points · clients · providers · contracts · **reverse states** · connection modes · docs.
copy this one verbatim:

> **Reverse states.** If you added a way in, add the way out and the way to see it. Snooze needs
> unsnooze. Close needs reopen. A one-way door is a bug.

📌 *«say which entries applied»* is a **completion criterion**. it is what makes the list do work
instead of decorating the file.

### 7. dev servers

how to start, where state goes, which ports, how to share, **and how to stop what you started**.
the rule that matters: *«Stop what you started, by the PID you tracked.»*

### 8. test data

> An empty database is a bad test.

where real data lives, the safe way to snapshot it, and the direction rule:

> Copy in, never symlink. Data flows one way: into your sandbox, never back out.

### 9. verifying

the smallest proof, and 🚫 **the ceiling** — the reference forbids repo-wide checks outright:

> **Do not run repo-wide checks.** No `vp check`, no `vp run -r test`, no `vp run -r typecheck`
> unless I ask. CI owns the full suite.

and the anti-flake rule, worth copying anywhere event-driven:

> Wait on receipts and worker drains, never on sleeps or polling. A test that needs a timeout to
> pass is wrong.

📌 root `CLAUDE.md` § background work already holds the timeout half for every session.

### 10. pull requests

the fleet's pr conventions live in `x:github-contrib` (titles, bodies, babysitting) and `x:cmt`;
a project file writes only the delta: its title scopes, its required evidence, its bots.

### 11. plans and work artifacts

> Do not commit implementation plans, research notes, or agent scratch files.

and the record rule:

> A merged PR is the implementation record. Close or update its tracking item when the work lands;
> do not preserve a second checklist in the repository.

### 12. how it works

one paragraph of the real mechanism, in the project's own nouns, then a pointer to the full
glossary. the reference does the whole architecture in six sentences.

### 13. where code lives

one line per top-level directory, with the gotcha attached, not a `tree` dump. **[read]** `/doctor`
strips directory layouts as derivable — so this section earns its place only where a line carries
something the filesystem does not say, like:

> `.repos/` - vendored read-only references. Prefer their patterns over invented ones. Never edit
> or import from them.

### 14. taste

the small aesthetic calls. and the escape hatch, copied — **[inferred]** the best single line in
the reference:

> If a rule here fights the task in front of you, say so loudly and get a human sign-off before
> breaking it.

## before you commit the file

- a rule whose why is non-obvious carries it in an html comment, with an **outcome**
- nothing `/doctor` would strip
- at least one section carries a **completion criterion** the agent must report against
- it reads in root's voice, under 200 lines
- nothing root or `rules/` already holds — a project file is read beside them
