# vibe — fleet-global terminology

Adopted words. Recognize them from Dima, use them back sparingly.

## fleet words — how he steers an agent
<!-- sync: cw -->

- **slay** = push (git push). «go slay» → push it.
- **freebie** = a ticket/action executable without Dima's approval (pre-approved or approval-free by contract). «do the freebies» → run them unprompted.
- **propose** = answer → approve → act: print the answer/plan, stop, execute only on his word. Prefixes any ask.
- **rewind** = reprint the last report (the `📄` line in the ⏳ block) in full, plus the block; `rewind <topic>` reprints an older one. for when member traffic pushed it out of view.
<!-- i simplified this line (look git diff), simply your halt instead. i never used «halt stop» ever once. remove «stop» from halt skill. -->
- **pause** = hold off, stop what you are doing, i will steer.

## shell words — his git aliases, the same vocabulary

<!-- are you sure we want this entire section? from my cross-zsh-alias overlap i use only «slay» when talk to you. keep only: slay, camp/decamp. suggest what other common vibe word we use if i missed one. otherwise let's keep my vibe aliases for me, and only gradually grow the list if i decide to add it to our comms. currently it continas an almost full list if my vibe words, which is a dead weight. we only use onces i printed above. -->

Each line here IS a shell alias in `home/.config/zsh-custom/aliases.zsh`; `script/lib/vibe-contract.test.ts` fails the commit when the two drift. Only these words are fleet vocabulary; his other shortcuts (`gs`, `gprune`, …) are his fingers, not a language.

**A word is meaning, never permission.** When Dima says one of these, it is the ask for that command, in one syllable, and the agent's own rules still apply to the ask. The plain words (`grab`, `sup`, `peek`, `lore`, `warp`, `loot`, `scout`, `onward`, `camp`) are one-to-one, no ceremony. The irreversible ones (`slayer`, `yolo`, `oops`, `reforge`, `decamp`) get one line naming the target, then his word — and an agent never reaches for one of them on its own. Words compose with skills: `/cmt y slay` = commit without the message confirm, then push. Agents may use the words back when talking to him.

- `grab` — `git add .`
- `mana` — `git commit`
- `vibe` — `git commit -m`
- `vibetune` — `git commit --amend`
- `slay` — `git push`
- `slayer` — `git push --force`
- `yolo` — `git push --force-with-lease`
- `sup` — `git sup`
- `warp` — `git switch`
- `spawn` — `git switch -c`
- `loot` — `git pull`
- `scout` — `gprune -d`
- `onward` — `git rebase --continue`
- `oops` — `git reset --soft HEAD~1`
- `lore` — `git --no-pager lg -20`
- `peek` — `git diff`
- `peeked` — `git diff --staged`
- `camp` — `git worktree add`
- `decamp` — `git worktree remove`
- `reforge` — `git rebase -i $(git merge-base HEAD main)`
