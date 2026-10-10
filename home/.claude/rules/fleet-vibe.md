# vibe — fleet-global terminology

Adopted words. Recognize them from Dima, use them back sparingly.

## entities — what we handle

- **turn / step / tool call** — a **turn** is dima's message plus the agent's whole reply (claude code's own word: «finished a turn»); a **step** is one model request inside it, which may batch tool calls; a **tool call** is one invocation. «saves a turn» = one message of dima's; «saves a step» = tokens and latency (dima, 2026-10-05).
<!-- sync: cw -->

- **CST** — a handoff transcript, the thing that carries a thread to its successor.
- **`inbox`** — `_hq/inbox.md` in the obsidian vault: dima's drop point and cclio's plan source. cclio
  edits it; anyone else reads, and edits only on his ask, fixing obvious errors, never his phrasing.
- **granular** — an area or ticket where every agent change needs Dima's weighted approve, step
  by step, with adoption notes for anything his own fingers will use (aliases, gitconfig, nvim,
  the vault). A Linear label and a chat word. Day-to-day areas (deps, docs, freebies) stay free.
- **mil** — a Linear milestone: the unit we plan and retire in, always opened with a sorting phase so it starts ordered.
- **run id** — the thread of one continuous piece of work, continued across sessions, never minted
  mid-story.
- **✨ wisp** — a bug: a small glow to tend before it burns, a will-o'-the-wisp that leads the app
  astray (dima, 2026-10-08, replacing «gremlins»). each app keeps a «<app> wisps» stash ticket; the
  inbox's ✨ section is the drop point. printed as **✨ wisp**, badge and word together, never a bare ✨.
- **🪐 orbit** — the board list of cclio's asks and planned moves, ticked instead of pasted (FRM-381, 2026-10-10); printed as **🪐 orbit**, bold with its badge (dima, 2026-10-10).
- **🌠 wish** — what dima wants, in his words (dima, 2026-10-08: the word replaces «todo»). he prints
  wishes in the inbox and mid-prompt; a wish is folded with its spelling fixed and its meaning and
  manner kept — never verbatim, never flattened into machine shape. the inbox's wishes section is the
  drop point; the pocket, then linear, is where a wish lives; a spec points at its wish, never copies it.
- **🌤️ siesta** — the pause between batches (dima, 2026-10-08; was «pit stop»): he reads and steers, the fleet checks what just landed (cclio: `wish-review` 🐬, `cclio:siesta`), and the reply ends with one light line — a fact with a twist, a dry joke, or «meanwhile i did <freebie>». never inside a ticket's build.
- **lane / shift** — a lane is our usual day: dima present, he steers, his asks fold in place. a
  shift runs from a written plan with dima `near` (a y/n ping only for a real decision) or `away`
  (no pings, decisions logged and parked); `cclio:shift` is the contract. a session name leads with
  its mode — `☕️` lane, `🎯` shift — then the role: `🎯 🔧 sys code: gremlins`.

## fleet words — how he steers an agent
<!-- sync: cw -->

- **slay** = push (git push). «go slay» → push it.
- **🍀 freebie** (badge: dima, 2026-10-08) = a ticket/action executable without Dima's approval (pre-approved or approval-free by contract). «do the freebies» → run them unprompted.
- **propose** = answer → approve → act: print the answer/plan, stop, execute only on his word. Prefixes any ask.
- **rewind** = reprint the last report (the `📄` line at a report's end) in full; `rewind <topic>` reprints an older one. for when member traffic pushed it out of view.
- **pause** = hold off, stop what you are doing, i will steer.

## shell words — the few git aliases that are fleet vocabulary

each line is also a shell alias in `home/.config/zsh-custom/aliases.zsh`; `script/lib/vibe-contract.test.ts`
fails the commit when a listed word drifts from its alias. his other aliases are his fingers, not
a language; a word joins this list only when he starts using it with the fleet.

**a word is meaning, never permission** — the agent's own rules still apply to the ask. `decamp`
removes a worktree: one line naming the target, then his word — except cclio's own scratch trees,
which the guard lets her remove (FRM-356).

- `slay` — `git push`
- `sup` — `git sup`
- `camp` — `git worktree add`
- `decamp` — `x lane decamp` (removes the worktree, then points the shared hook shims back at the main checkout; plans only without `--apply`)
