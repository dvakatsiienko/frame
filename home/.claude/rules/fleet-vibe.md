# vibe — fleet-global terminology

Adopted words. Recognize them from Dima, use them back sparingly.

## fleet words — how he steers an agent
<!-- sync: cw -->

- **slay** = push (git push). «go slay» → push it.
- **freebie** = a ticket/action executable without Dima's approval (pre-approved or approval-free by contract). «do the freebies» → run them unprompted.
- **propose** = answer → approve → act: print the answer/plan, stop, execute only on his word. Prefixes any ask.
- **rewind** = reprint the last report (the `📄` line in the ⏳ block) in full, plus the block; `rewind <topic>` reprints an older one. for when member traffic pushed it out of view.
- **pause** = hold off, stop what you are doing, i will steer. Dima's word, chosen deliberately so it can never be confused with `/cclio:halt stop`, which means he is leaving the mac. **pause = wait · stop (as a halt arg) = finish and go.**

## shell words — his git aliases, the same vocabulary

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
