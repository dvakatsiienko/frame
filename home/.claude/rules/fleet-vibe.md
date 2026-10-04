# vibe — fleet-global terminology

Adopted words. Recognize them from Dima, use them back sparingly.

## entities — what we handle
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
- **lane / shift** — a lane is our usual day: dima present, he steers, his asks fold in place. a
  shift runs from a written plan with dima `near` (a y/n ping only for a real decision) or `away`
  (no pings, decisions logged and parked); `cclio:shift` is the contract. a session name leads with
  its mode — `☕️` lane, `🎯` shift — then the role: `🎯 🔧 sys code: gremlins`.

## fleet words — how he steers an agent
<!-- sync: cw -->

- **slay** = push (git push). «go slay» → push it.
- **freebie** = a ticket/action executable without Dima's approval (pre-approved or approval-free by contract). «do the freebies» → run them unprompted.
- **propose** = answer → approve → act: print the answer/plan, stop, execute only on his word. Prefixes any ask.
- **rewind** = reprint the last report (the `📄` line in the ⏳ block) in full, plus the block; `rewind <topic>` reprints an older one. for when member traffic pushed it out of view.
- **pause** = hold off, stop what you are doing, i will steer.

## shell words — the few git aliases that are fleet vocabulary

each line is also a shell alias in `home/.config/zsh-custom/aliases.zsh`; `script/lib/vibe-contract.test.ts`
fails the commit when a listed word drifts from its alias. his other aliases are his fingers, not
a language; a word joins this list only when he starts using it with the fleet.

**a word is meaning, never permission** — the agent's own rules still apply to the ask. `decamp`
removes a worktree: one line naming the target, then his word.

- `slay` — `git push`
- `sup` — `git sup`
- `camp` — `git worktree add`
- `decamp` — `git worktree remove`
