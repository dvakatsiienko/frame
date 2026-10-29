---
date: 2026-09-03
slug: the-git-and-browser-day
tickets: [DOT-159, DOT-38, DOT-17, DOT-14, DOT-39, DOT-187, BYT-59, BYT-65]
posted: { health: yes }
---

# 🗞️ cclio's gazette · the git and browser day — the overhaul lands, playwright leaves, the agents learn to wait

## shipped

- **git overhaul, one sitting, closed** — [DOT-159](https://linear.app/x-com/issue/DOT-159) + [DOT-38](https://linear.app/x-com/issue/DOT-38): every gitconfig line with its reason, delta as pager (agent-safe off-tty), nvim editor, rerere/histogram/zdiff3/fetch.prune/autosquash/updateRefs/branch.sort. recipes under one `[pretty] fleet` look: `lg ship standup br vs who last churn fixup pick pickfrom`. `gprune` rebuilt: ages, squash-merge detection via commit-tree + cherry, held-with-reason, `-D` per branch, `--stale`, `-h`, tab completion. 8 zsh aliases retired by dima's line-by-line review; his verdict on the rest: «gs-class are easier to remember, worth to keep both». research: opus coder, zero agent-side tools worth adding — plain git holds. lefthook ext unified to `.yaml`; inner-marker got the push hook; auto-assign verified dead on all three repos.
- **the headless browser settled** — a researcher picked `agent-browser` 0.36.0 (rust daemon, 30 ms attach vs playwright's 820 ms `connectOverCDP`, `--json` verbs, system chrome, zero download); the Code-tab coder re-measured with the same fan-out: 46/46 tie on points, agent-browser wins on wants. dima: «delete pw everywhere, we use only agent-browser» — 509 MB cache trashed, `x:browser-headless` shipped (x 0.11.18) with four measured hazards (swallowed flags report ✓, click does not auto-wait, shared eval scope, two token-bomb verbs).
- **trophy-sys /stats complete on prod** — [BYT-65](https://linear.app/x-com/issue/BYT-65): all 12 charts + kpi strip in visx, sort controls, heatmap→timeline link, mobile overflow fixed (390px was broken, three causes), lazy-loaded route (bundle 582 → 332 kB), colour in one file, tooltips escape panels. two coders in a row held the prod merge on a relayed word — correct; cclio merged on dima's. In Progress for his prune verdicts tomorrow.
- **the agents learn to wait** — after an alias prune ran on one word while dima was reading: every reply ends with «⏳ waiting on your word», sweeps over his tools are propose-only, a coder's reply is never an advancement sign. new fleet words: **`granular`** (label + chat word: every change needs his weighted approve) and **`mil`**. execution order rides linear's native `sortOrder`; every new mil opens with a sorting phase. the next-overhaul tail ordered by him.
- **folds** — the bureau → [DOT-14](https://linear.app/x-com/issue/DOT-14) as a cli naming option · advise-project-approach → [BYT-59](https://linear.app/x-com/issue/BYT-59) plan-time · g2i skipped, neuroarxiv a test candidate ([DOT-187](https://linear.app/x-com/issue/DOT-187)) · shell-internals walkthrough secured in [DOT-17](https://linear.app/x-com/issue/DOT-17) with the ryan baker playlist as the agent's orientation · gazette got its definition (meaningful work, ticketed or not) · cw gazette lane confirmed by dima, doc folded into the procedure · homebrew hints silenced.

## tricks gained

- squash-merged detection: `git commit-tree <branch>^{tree} -p $(git merge-base main <branch>)` then `git cherry main <tmp>` — «-» means main holds the patch · zsh collapses an empty tab-separated field, use `%1f` · a `cat <<EOF` inside a python heredoc ends the outer heredoc — pick a different outer delimiter · vitest counts a worktree's test copies (166 = 2 × 83) · the desktop Browser pane exists only in Code-tab-born sessions, and a hidden pane never lays the page out · an idle coder's «push or keep going?» is addressed to dima, not the coordinator.

## state

- dotfiles + bytes + inner-marker clean on origin · next overhaul 14/22 · tomorrow: BYT-65 verdicts in parallel with the walkthrough hoist, then the mil tail in dima's order · after the halt: the initiative question (mils utilization).
