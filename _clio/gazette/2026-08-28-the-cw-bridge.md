---
date: 2026-08-28
slug: the-cw-bridge
tickets: [DOT-210, DOT-159, DOT-88, DOT-68]
posted: { health: yes, announcements: no }
---

# 🗞️ the cw bridge — cw memory gets a spine

## shipped

- **the cw memory bridge went live end-to-end in one day** — design (cwrk's doc) → grill →
  two cw-only skills born in `plugin-x-cw` as real dirs (v0.2.0): `memory-update` (the shape
  of every cw memory edit — routing, tool mechanics, register, prettify/dry) and `memory-sync`
  (the map, up-merge, constant blocks, router-last). dry run → real run → prettify all, same
  day; field-test round 1 folded back as 9 skill edits (v0.2.1).
- **`rules/fleet-hazards.md` born** — fleet-wide pitfalls, obsidian vault section first;
  memory-sync carries it into cw memory.
- **fleet-identity glossary split** — «the members — who acts» / «the entities — what we
  handle»; `inbox` joined as an entity (cwrk's edit, reviewed + committed).
- **the procedure spec grew analysis vectors** — local-evidence sibling of research vectors;
  all five procedures gained self-analysis questions. `memory-bridge-refresh-cw` procedure
  born to own the loop.
- **voice-sync absorbed** — deleted from plugin-x (0.10.0); its job lives in memory-sync now.

## tricks gained

- cw memory tool contract mapped (cwrk): version tokens per-file read-only-obtainable,
  `memory_write` replaces whole file, descriptions not separately editable, cw cannot delete.
- device-bound scheduled tasks (claude.ai side) are UI-create-only — `create_trigger` fails
  `no_signed_approval`; encoded in the capabilities doc.
- «memory must not grow fast» clarified by dima: a quality bar, never a line cap.

## state

- regen probe armed: dima's cw scheduled task fires 2026-08-29 09:00 kyiv, diffs against
  `cclio/cw-memory-map.md` (keep untouched till then; task is daily — delete after report #1).
- cw needs a force refresh to pick up x-cw 0.2.1.

⸻ upd 19:15

# 🗞️ cclio's gazette · the autoassign day — git hooks go global, linear history goes quiet

## shipped

- **the linear auto-assign is dead for good** — [DOT-210](https://linear.app/x-com/issue/DOT-210)
  done by an opus coder in one afternoon: a global `core.hooksPath` dispatcher
  (`home/.config/git/hooks`, one script + 10 names) forwards to each repo's own hooks, and an
  own-linker attaches commits to tickets through linear's api. commit bodies now say
  `- ticket: DOT-N` / `(closes)` — measured inert to linear's parser — so the assign→unassign
  pair vanished from every ticket's history. external remotes: the hook stands down.
- **[DOT-159](https://linear.app/x-com/issue/DOT-159) first audit** — «works by luck» was wrong:
  signing is robust in every environment (1password *locked* = a touch-id prompt, an agent hangs
  on it — by design). the one broken thing was `git-lfs` armed with no binary; restored.
  `pull.rebase` + `tag.gpgsign` global. ticket back to Todo for a second angle at «next overhaul».
- **cclio's gazette** — this masthead, dima's pick over «la gazette de cclio». the wire now hands
  him one link per health post; pulse is the feed.
- **tips-and-tricks sections killed** — 5 entries, all from the seed day, zero use in 5 days; a
  failed experiment by dima's verdict. fleet-hazards gained a «git hooks» section instead.
- freebies: [DOT-88](https://linear.app/x-com/issue/DOT-88) (vercel mcp already gone, closed) ·
  [DOT-68](https://linear.app/x-com/issue/DOT-68) (`go` = browse bare, toolchain with args) ·
  12/12 projects got icon + colour · cursor markdown ux settled · dispatch dumps mined and dropped.

## tricks gained

- 🚨 `lefthook run` syncs its shims INTO `core.hooksPath`, and `lefthook install --force` writes
  there too — the dispatcher guards the first; the second killed linking for 6 minutes today.
- a dotfiles worktree cannot push (mirror gate) and must never run `pnpm` (rewrites shared hooks).
- cursor's markdown «Preview» editor rewrites file formatting on open — it reformatted a rule file.
- `x:cmt` skill text: the old keywords (`ref`, `Closes`) are now BANNED in bodies; binds next session.

## state

- coder `code-dot210-linear-hook` kept alive, idle, warm — dima's word.
- next: pm takeover milestone groom + grill, and dima's week-old prompt drop.
- regen probe report from cwrk ~09:00 kyiv 2026-08-29.
