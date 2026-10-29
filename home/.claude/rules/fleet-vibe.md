# vibe — fleet-global terminology

Adopted words. Recognize them from Dima, use them back sparingly.

## entities — what we handle
<!-- sync: cw -->

- **turn / step / tool call** — a **turn** is dima's message plus the agent's whole reply (claude code's own word: «finished a turn»); a **step** is one model request inside it, which may batch tool calls; a **tool call** is one invocation. «saves a turn» = one message of dima's; «saves a step» = tokens and latency.

- **CST** — a handoff transcript, the thing that carries a thread to its successor.
- **`inbox`** — `_hq/inbox.md` in the obsidian vault: dima's drop point and cclio's plan source. cclio
  edits it; anyone else reads, and edits only on his ask, fixing obvious errors, never his phrasing.
- **granular** — an area or ticket where every agent change needs Dima's weighted approve, step
  by step, with adoption notes for anything his own fingers will use (aliases, gitconfig, nvim,
  the vault). A Linear label and a chat word. Day-to-day areas (deps, docs, freebies) stay free.
- **🎑 mil** — a Linear milestone: the unit we plan and retire in, always opened with a sorting phase so it starts ordered (badge: dima, 2026-10-22).
- **run id** — the thread of one continuous piece of work, continued across sessions, never minted
  mid-story.
- **✨ wisp** — a bug: a small glow to tend before it burns, a will-o'-the-wisp that leads the app
  astray (dima, 2026-10-08, replacing «gremlins»). each app keeps a «<app> wisps» stash ticket; the
  inbox's ✨ section is the drop point.
- **blueprint** — a picture of one part of our system (a flow, a structure, a map) that cclio draws
  and dima edits to show an idea; cclio reads the edit back and builds from it (dima, 2026-10-18).
  home: `_clio/blueprints/`.
- **🪐 orbit** — the board list of a session's asks, ticked instead of pasted; its next moves sit apart, in the board's 🌔 phases (`rules/fleet-mods.md`). <!-- cc -->
- **💨 slipstream** — a send that waits and joins the next turn instead of waking one: an orbit tick, a held `[progress]` ping; «slipstreamed» = delivered that way; its opposite is **push**. <!-- cc -->
- **🐦‍🔥 second wind** — a session's context reset onto its own handoff: dima presses a session's 🐦‍🔥 on the board (or says the word), the session finishes its step, writes a CST, and the mod compacts and ingests it at the turn's end (`cclio:checkpoint` for cclio, x-mod-stash). <!-- cc -->
- **🌠 wish** — what dima wants, in his words (dima, 2026-10-08: the word replaces «todo»). he prints
  wishes in the inbox and mid-prompt; the inbox's wishes section is the drop point; the pocket, then linear, is where a wish lives; a spec points at its wish, never copies it.
- **🌤️ siesta** — the pause between batches (dima, 2026-10-08; was «pit stop»): he reads and steers, the fleet checks what just landed (cclio: `wishkeeper` 🐬, `cclio:siesta`), and the reply ends with one light line — a fact with a twist, a dry joke, or «meanwhile i did <freebie>». never inside a ticket's build.
- **lane** — any flow of work, of any kind (dima, 2026-10-22, groomed 10-23); four kinds, and a `lane:` line holds only
  the kind word: the **main lane** is ours, this thread, where the operational work is solved; a **side lane** is any
  lane that is not ours, usually a coder and a verifier with a pr, spawned while we work the main lane; a **quick
  lane** is a coder on main without a pr, a verifier optional; a **shift** is a lane run from a written plan while his AFK tick is on, day or night alike; a shift
  asked with the tick off gets one line asking why. `cclio:shift` is the contract. a session name leads with
  its mode — `🌗` a side lane, `⚡` a quick lane, `🌘` shift — then the role: `🌘 🔧 sys code: wisps`.
- lane init (dima, 2026-10-23, PK-263; the contract: `craft-fleet-flow`):
  - **🍫 chunk** — one ticket a lane takes; a lane runs one or more in order, one glide step each
  - **✍️ signed** — dima's yes on a chunk in `cclio:shape-lane`: a `signed` label, a dated `## signed` line; a change after it asks a re-sign
  - **dispatch** — dima's pick of signed chunks, which starts their lane; «what can we dispatch?»
  - **🦭 sealed** — a chunk whose spec and exit lines are written, at dispatch, before the coder starts
  - **🟢 greenlight** — cclio's yes on a coder's lane plan, after the spawn
  - **📐 spec** — a lane's technical synthesis of its chunks, exit lines inside; every lane with a member has one
  - **🎯 done test** vs **exit lines** — the done test is dima's «how i'll know it works», in the ticket; exit lines are the verifier's checkable lines, in the spec, the done test seeding the last one

## fleet words — how he steers an agent
<!-- sync: cw -->

- **slay** = push (git push). «go slay» → push it.
- **🍀 freebie** (badge: dima, 2026-10-08) = a ticket/action executable without Dima's approval (pre-approved or approval-free by contract). «do the freebies» → run them unprompted.
- **☘️ almost-freebie** (dima, 2026-10-25) = past a freebie's 5 calls, short of a coder: one helper card cclio briefs and proves. <!-- cc -->
- **propose** = answer → approve → act: print the answer/plan, stop, execute only on his word. Prefixes any ask.
- **rewind** = reprint the last report (the `📄` line at a report's end) in full; `rewind <topic>` reprints an older one. for when member traffic pushed it out of view.
- **pause** = hold off, stop what you are doing, i will steer.

## shell words — the few git aliases that are fleet vocabulary

each line is also a shell alias in `home/.config/zsh-custom/aliases.zsh`; `script/lib/vibe-contract.test.ts`
fails the commit when a listed word drifts from its alias. his other aliases are his fingers, not
a language; a word joins this list only when he starts using it with the fleet.

**a word is meaning, never permission** — the agent's own rules still apply to the ask. `decamp`
removes a worktree: one line naming the target, then his word (cclio's own scratch: root invariant 8).

- `slay` — `git push`
- `sup` — `git sup`
- `camp` — `git worktree add`
- `decamp` — `x lane decamp` (removes the worktree, then points the shared hook shims back at the main checkout; plans only without `--apply`)
