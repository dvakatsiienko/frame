---
dies-when: the verdict line below is written (2026-10-19) — mods become a fleet-aware layer (rules line + contracts), stay dima's own toy, or get pruned
---
Ticket: [FRM-303](https://linear.app/x-com/issue/FRM-303)

# mods — cc function-hook plugins on trial

- **what:** `home/.claude/plugin-x/mods/` — stash (asks · afk · holds · keep-hot) and breather today; docs in `mods/AGENTS.md`, stash's in `stash/{PRODUCT,FTR,CONTEXT}.md`
- **dima's want:** «mods would allow us to solve lots of issues, including my UX and DX, and maybe even some issues from flowlog or fleet flow issues» · «I still explore them myself and can't tell for sure how much fleet should be aware of mods»
- **the question the verdict answers:** does the fleet need to know about mods, and how much — a rules line, a per-mod contract, or nothing
- **window:** 2026-10-05 → 2026-10-19
- **every halt:** one log line — which mod fired for real, what it saved or broke, any fleet miss that a mod could have caught

## stress list — one real try each

- holds: two live sessions on one file, the second refused with the holder named · a Bash-written file (heredoc, `sd`) — the Edit/Write hook never sees it, so a hold is never taken: measure how often the fleet writes through Bash
- holds across a `--bg` coder and cclio on frame main (the CST's mods-coder plan)
- asks: the ⏳ block in stash matches the reply's bucket, resolved items leave (FRM-303 item 3)
- keep-hot: a ping keeps the switch on (FRM-302 — the untick may be a reload reset, not a bug)
- afk: on → a shift's pings go bare; off → the missed-brief prints
- the surfaces: terminal session, Code-tab session, a `--remote-control` view ([claude-code#99217](https://github.com/anthropics/claude-code/issues/99217): mods draw only on the host)
- a fleet flowlog miss a mod would have caught — name it when it happens

## log — date · session · mod · real use · note

- 2026-10-05 · cclio · holds · none yet · FTR: every holds line ✅ (verify recipe), none 🔎 (dima's use) — the collision guard is built but unproven in a real two-session clash
