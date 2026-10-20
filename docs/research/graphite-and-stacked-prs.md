---
dies-when: the graphite test drive (docs/test-drive/graphite.md) writes its verdict line
---

Ticket: none

# graphite and stacked prs: the state in 2026, the rivals, and how an agent fleet would run stacks (2026-10-20)

all links read on 2026-10-20 unless a different date is given. «?» means not verified. «inference» means my reasoning from the cited facts, not a source.

## 1. graphite in 2026: alive, maintained, and what cursor changed

**the deal**
- cursor signed a definitive agreement to acquire graphite on 2025-12-19. graphite "will continue to operate independently with the same team and product". integration ideas: "tighter integrations between local development and pull requests" and "smarter code review that learns from both systems". [cursor blog, 2025-12-19](https://cursor.com/blog/graphite)
- graphite's own post says "graphite's product and brand aren't going anywhere", and "on closing, the entire graphite team will join cursor". it makes no commitment on pricing, the free tier, the cli or open source. [graphite blog, 2025-12-19](https://graphite.com/blog/graphite-joins-cursor)
- price: not disclosed. axios is reported as saying "way over" the last $290m valuation, but that number comes second-hand. [siliconangle, 2025-12-19](https://siliconangle.com/2025/12/19/cursor-acquires-ai-code-review-startup-graphite/) · [techcrunch, 2025-12-19](https://techcrunch.com/2025/12/19/cursor-continues-acquisition-spree-with-graphite-deal)
- closing date: not found «?».

**what has shipped since**
- 2026-03-02: "introducing cursor cloud agents in graphite". the graphite home page and pricing page still carry the banner "cursor cloud agents are now in graphite". [graphite blog index](https://graphite.com/blog) · [graphite.com](https://graphite.com/)
- 2026-04-01: "introducing code tours". this is the last post on the graphite blog. nothing has been posted from april to october 2026. [graphite blog index](https://graphite.com/blog)
- gt cli: the latest release is 1.8.6 on 2026-05-04. from january to may, releases came every 1–3 weeks (1.7.16 on 01-20 through 1.8.6 on 05-04). 1.8.0 (2026-03-02) moved metadata to sqlite. 1.8.4 (2026-04-13) made gt commands "only affect the current worktree". [cli changelog](https://graphite.com/docs/cli-changelog) · npm `@withgraphite/graphite-cli` dist-tag latest 1.8.6, last modified 2026-05-05 (`npm view`, run 2026-10-20) · homebrew tap last commit "release v1.8.6 to stable" on 2026-05-05 (`gh api repos/withgraphite/homebrew-tap/commits`)
- so the cli has had no release for about 5.5 months, after a steady cadence. that does not prove it is dead, but it is the strongest signal on this list.

**where cursor's energy went**
- cursor origin is "a git forge for the agentic era". it is in early beta on paid plans only, not on free or plus. [cursor.com/origin](https://cursor.com/origin) · [cursor docs: origin](https://cursor.com/docs/origin)
- infoq reports a beta launch in august 2026 and cites venturebeat on "stacked pull requests and agent aware merge queues", "helped by cursor's acquisition of graphite". [infoq, 2026-08-25](https://www.infoq.com/news/2026/08/cursor-origin-alternative-github/)
- origin's docs list "code tours" for reviewers. that is the name of graphite's 2026-04-01 launch. [cursor docs: origin](https://cursor.com/docs/origin) · inference: graphite features are moving into origin.
- several secondary outlets say graphite's co-founder tomas reimers demoed origin at compile on 2026-06-16. no primary source found «?». [learncursor.dev](https://www.learncursor.dev/learn/cursor-origin/graphite-acquisition)
- cursor's changelog on 2026-09-23 still names bugbot as the quality reviewer ("style and quality stay with bugbot"). no 2026 cursor changelog entry mentions graphite. [cursor changelog](https://cursor.com/changelog)
- a merged bugbot and graphite agent reviewer: not found.

**pricing and the free tier today**
- hobby is free. it includes "personal-account repo support", the "cli for stacked prs", mcp, the vs code extension, "limited ai reviews" and limited chat. starter is $20 per user per month and team $40 (both billed annually). unlimited ai reviews start at team. merge queue starts at team. [graphite pricing](https://graphite.com/pricing)
- the hobby ai-review quota is not on the pricing page. graphite's own guides say 100 pr reviews a month, but that is marketing copy and may be stale «?». [graphite guide](https://graphite.com/guides/free-options-for-ai-code-review)
- the ai reviewer was renamed: diamond became "graphite agent" on 2025-10-07. existing plans moved to team at their first renewal after 2026-01-08. [graphite blog, 2025-10-07](https://graphite.com/blog/introducing-graphite-agent-and-pricing)
- dima's repos sit under a personal account (dvakatsiienko/frame, dvakatsiienko/bytes), so hobby should apply. whether hobby's ai review runs on them: «?», to be measured in the test drive.

**risk**
- the service is up, signup is open, and pricing is published. gt still installs, and `gt mcp` (beta, needs ≥1.6.7) adds to claude code with `claude mcp add graphite gt mcp`. [gt mcp docs](https://graphite.com/docs/gt-mcp)
- inference, medium-to-high risk of folding into cursor or origin within a year: the blog and cli have been silent since spring, graphite's features are showing up in origin, cursor keeps bugbot as its reviewer, and sales links point to cursor.com/contact-sales. no shutdown notice has been found.
- for a 1–2 week drive the risk is small. for adopting it as a base layer it is real.

## 2. graphite next to similar tools

**github native stacked prs** (the main rival)
- timeline: private preview from 2026-04-13 [infoq, 2026-04-29](https://infoq.com/news/2026/04/github-stacked-prs); public preview from 2026-07-30 [github changelog](https://github.blog/changelog/2026-07-30-stacked-pull-requests-are-now-in-public-preview/); generally available on 2026-10-06 "on all github.com plans", with ghes in a later release. [github changelog, 2026-10-06](https://github.blog/changelog/2026-10-06-stacked-pull-requests-generally-available)
- how it works: each pr targets the branch below it, with a stack map on the pr page. branch protection, required checks, codeowners and code scanning are all "evaluated against the stack base". all branches must be in the same repo, and cross-fork stacks are not supported. [docs: reference](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests)
- merging: bottom-up only. "you cannot merge a mid-stack pull request in isolation". merging a pr lands it and every pr below it "as a single operation". afterwards, the next pr is rebased to target the base. [docs: merging](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-stacked-pull-requests)
- the sources disagree on auto-merge. the docs say "auto-merge is not supported for stacked pull requests" ([docs: merging](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-stacked-pull-requests)). the changelog says "auto-merge for stacks rolling out over the next few weeks" ([changelog, 2026-10-06](https://github.blog/changelog/2026-10-06-stacked-pull-requests-generally-available)). the current state is «?».
- the ga release added: approvals are kept on a rebase when the code is unchanged, even with "dismiss stale approvals"; replacement commits are signed; a stack lands through the merge queue as one group; gh stack supports worktrees. [changelog, 2026-10-06](https://github.blog/changelog/2026-10-06-stacked-pull-requests-generally-available)
- gh cli: `gh extension install github/gh-stack`, an mit-licensed go repo (1.7k stars). releases: v0.1.0 (2026-07-29), v0.2.0 (2026-10-02), v0.2.1 (2026-10-09). last push 2026-10-19. (`gh api repos/github/gh-stack`, run 2026-10-20)
- gh stack verbs: init, add, view `--json`, checkout, modify (tui only), unstack, submit `--auto`, sync `--prune`, rebase `--upstack/--downstack/--continue/--abort`, push (force-with-lease per branch, "not atomic"), link, merge `--yes`, up/down/top/bottom/trunk `--print-path`. typed exit codes run 0–10 (3 = rebase conflict, 8 = stack locked, 9 = stacks not enabled). [docs: cli commands](https://docs.github.com/en/pull-requests/reference/stacked-prs-cli-commands)
- api: a rest stacks api (list, read, create, extend, dissolve), a `stack` object on prs, an async merge endpoint, read-only graphql fields, and a `stack` property in webhooks. [docs: apis and webhooks](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests-apis-and-webhooks)

**ghstack** (ezyang)
- one commit becomes one pr. it pushes synthetic `gh/<user>/N/{base,head}` branches. "you will NOT be able to merge these commits using the normal github ui". landing goes through `ghstack land`. it is pytorch's tool. [readme](https://github.com/ezyang/ghstack)
- last release v0.14.0 (2025-12-30), last push 2026-09-24 (`gh api`, 2026-10-20).

**spr**: there are two tools with this name
- ejoffe/spr (go): one commit per pr on a single branch. `git spr merge` merges the top mergeable pr with everything below it and closes the intermediate prs, to "avoid triggering redundant ci runs". v0.17.6 (2026-04-22). [readme](https://github.com/ejoffe/spr)
- spacedentist/spr (rust, formerly getcord/spr): `spr diff --all` makes one pr per commit, and `spr land` squash-merges. v2.0.0-beta.1 (2026-10-12). [readme](https://github.com/spacedentist/spr)

**git-branchless**
- strong at local stack editing. its github forge (`git submit --forge github`) is, in its own changelog's words, "too buggy for general use". [changelog in repo](https://github.com/arxanas/git-branchless/blob/master/CHANGELOG.md) · [git submit wiki](https://github.com/arxanas/git-branchless/wiki/Command:-git-submit)
- v0.11.1 (2026-05-21), last push 2026-10-01.

**sapling / reviewstack** (meta)
- `sl pr` makes "overlapping" prs that "may be confusing to reviewers using the github pull request ui", and reviewers are told to use reviewstack instead. [sapling docs](https://sapling-scm.com/docs/git/github/)
- sapling ships releases (2026-09-29), and reviewstack.dev answers http 200. it is a different vcs to learn.

**jj (jujutsu) with github**
- the docs describe pushing bookmarks and two ways to handle review feedback (add commits, or rewrite and force-push). there is no built-in stacked pr feature and no third-party tool is named. [jj docs: github](https://docs.jj-vcs.dev/latest/github/)
- v0.46.0 (2026-10-07). stacks on github need a separate tool «?».

**aviator**
- `av` cli for stacked prs: create, sync, split, reorder, and it works with plain `gh pr merge`. it has an official claude code plugin with an `av-cli` skill. [av readme](https://github.com/aviator-co/av) · [agent-plugins](https://github.com/aviator-co/agent-plugins) (last push 2026-10-19)
- pricing: free with up to 3 repos and 10 verify runs a month; merge queue starts at team, $20 per dev per month. [aviator pricing](https://www.aviator.co/pricing)

**honest comparison for one operator with an agent fleet**
- native gh stack fits best. it needs no new vendor, the stacks are real github objects, branch rules are checked against main, agents get json output and typed exit codes, it has an official agent skill, worktrees are supported, and it is shipping releases every week. its gaps: auto-merge (unclear, see above), tui-only reorder, and a very young cli (v0.2).
- graphite's real extras are its web review inbox, the ai reviewer (hobby quota «?») and a stack-aware merge queue (team plan only). against that: a stalled cli and a parent company building a rival forge.
- aviator `av` is a fallback if gh stack lets you down. it is alive and has an agent plugin.
- ghstack, spr and sapling: each needs a non-standard landing path (land command, synthetic branches, or overlapping prs). git-branchless and jj are local tools with weak github stack support. none of them is worth it once native stacks exist.

## 3. stacked prs with ai coding agents: practices, pitfalls, plugins

**documented practices (vendor sources)**
- plan the layers before writing code. "the failure mode to avoid is writing everything on one branch and trying to split it afterwards", because there is "no non-interactive in-place reorder". [gh-stack skill: stack-design.md](https://github.com/github/gh-stack/blob/main/skills/gh-stack/references/stack-design.md)
- fix in the layer that owns the change, then `gh stack rebase --upstack`. "never commit a lower layer's concern on the current top branch". [gh-stack SKILL.md](https://github.com/github/gh-stack/blob/main/skills/gh-stack/SKILL.md)
- stage on purpose (`git add <paths>`, not `add -Am`), and name branches `<topic>/<concern>`. [stack-design.md](https://github.com/github/gh-stack/blob/main/skills/gh-stack/references/stack-design.md)
- "a mistake in the bottom layer propagates to every branch above it". "if a layer feels like it needs a long description to review, it is probably too big". review from the bottom up. [github docs: stack ai-generated code](https://docs.github.com/en/copilot/tutorials/stack-ai-generated-code-in-pull-requests)
- github maps agent work directly onto stacks: when "an agent completes one task, then starts the next task that builds on it", each task becomes one pr. [docs: about stacked prs](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs)
- graphite's skill says "do NOT worry about creating TOO MANY pull requests". that is a vendor push toward more prs, not a measured result. [withgraphite/agent-skills](https://github.com/withgraphite/agent-skills/blob/main/skills/graphite/SKILL.md) (last push 2026-02-18)

**pitfalls, with the guard each source gives**
- interactive traps: under a pty, bare `gh stack view/submit/init/add/checkout/switch/modify` "open a prompt or a full-screen tui and block forever". always pass `--json`, `--auto`, `--yes` or an explicit target. [SKILL.md](https://github.com/github/gh-stack/blob/main/skills/gh-stack/SKILL.md)
- a silent no-op: when non-interactive and the local and remote stacks have diverged, `sync` "exits 0 with `Sync aborted`". exit 0 does not mean it synced. [troubleshooting.md](https://github.com/github/gh-stack/blob/main/skills/gh-stack/references/troubleshooting.md)
- rebase conflicts: `rebase` stops mid-flight (exit 3), while `sync` restores every branch first. turn on `git rerere`, because one low change conflicts again in every layer above it. [troubleshooting.md](https://github.com/github/gh-stack/blob/main/skills/gh-stack/references/troubleshooting.md)
- squash merges: `gh stack sync` detects them and rebases `--onto`, with no manual step. [troubleshooting.md](https://github.com/github/gh-stack/blob/main/skills/gh-stack/references/troubleshooting.md) graphite handles the same false conflicts in its merge job, but only when you merge from the graphite app. "does not work when merging from github". [graphite docs: merge](https://graphite.com/docs/merge-pull-requests)
- force-pushes: `gh stack push` uses force-with-lease per branch and "is not atomic", so some branches can update while others fail. [cli commands](https://docs.github.com/en/pull-requests/reference/stacked-prs-cli-commands)
- merge order: native stacks merge bottom-up only. `gh pr merge` "cannot merge a stack"; use `gh stack merge <pr> --yes`, which is all-or-nothing. [SKILL.md](https://github.com/github/gh-stack/blob/main/skills/gh-stack/SKILL.md)
- worktrees: gh stack keeps one catalog per clone. use `--print-path` so you don't steal another worktree's checkout. `rebase`/`sync` update clean worktrees but do not stash. `--continue/--abort` act on the worktree recorded in the journal. [cli commands](https://docs.github.com/en/pull-requests/reference/stacked-prs-cli-commands) · gt is worktree-scoped since 1.8.4 and blocks `gt modify --into` on a branch checked out elsewhere since 1.8.2. [gt changelog](https://graphite.com/docs/cli-changelog)
- concurrency: exit 8 "stack is locked by another process", so give one agent per stack. [cli commands](https://docs.github.com/en/pull-requests/reference/stacked-prs-cli-commands)
- restructuring has no non-interactive path. you have to unstack, fix git ancestry, `init` again and `submit --auto`. [troubleshooting.md](https://github.com/github/gh-stack/blob/main/skills/gh-stack/references/troubleshooting.md)
- independent first-hand reports of claude code running stacks: not found. what exists are vendor docs and a codex blog on merge conflicts from stale branches. [codex blog, 2026-04-25](https://codex.danielvaughan.com/2026/04/25/codex-cli-merge-conflict-prevention-resolution-worktrees-clash/) (secondary)

**skills, plugins and mcp for claude code**
- official: `gh skill install github/gh-stack` (skill v0.2.0, with references commands.md, stack-design.md and troubleshooting.md). [repo skills dir](https://github.com/github/gh-stack/tree/main/skills/gh-stack)
- official: `withgraphite/agent-skills`, a single `graphite` skill (7 stars, last push 2026-02-18) [repo](https://github.com/withgraphite/agent-skills), plus `gt mcp` in beta [docs](https://graphite.com/docs/gt-mcp)
- official: aviator `agent-plugins` with an `av-cli` skill. [repo](https://github.com/aviator-co/agent-plugins)
- community: georgeguimaraes/claude-code-graphite is archived (`gh api`, 2026-10-20). other gt skills sit in registries (claudskills.com, skills.sh), unvetted «?».

## 4. ci compatibility: github actions and renovate

**github actions**
- native stacks: "workflows trigger as if each pull request in the stack targets the base of the stack". a `pull_request` workflow filtered on `main` runs for every layer. `github.event.pull_request.stack` exposes number, size, position (1 = bottom) and base.ref/sha, so expensive jobs can be gated to the lowest unmerged pr or the top pr. [docs: optimizing ci](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/optimizing-ci-for-stacked-pull-requests)
- graphite stacks are plain prs whose base is the parent branch. the actions `branches` filter matches the branch a pr "targets" [workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), so a `branches: [main]` filter would skip upstack prs. inference from that wording.
- graphite's ci optimizer (an api call that says skip or run) "fails open". it is "unlikely" to help organisations "with fewer than 10 stackers". if branch protection covers every base branch and upstack ci is skipped, upstack prs show "missing required ci". [graphite docs: stacking and ci](https://graphite.com/docs/stacking-and-ci)
- graphite creates temporary `graphite-base/*` branches during merges, and its docs say to make ci ignore them. [graphite docs: merge](https://graphite.com/docs/merge-pull-requests)
- required checks: native stacks check them against the stack base, and a pr below that is failing or pending blocks every pr above it. [docs: troubleshooting](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-stacked-pull-requests)
- merge queue: a native stack enters as one group, and the group may go 50% over its max size. ejecting one pr ejects every pr above it. [docs: merging](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-stacked-pull-requests) graphite's stack merge supports label-based queues, "github's merge queue is not yet compatible". [graphite docs: merge](https://graphite.com/docs/merge-pull-requests)

**dima's repos, read 2026-10-20**
- both `frame/.github/workflows/ci.yml` and `bytes/.github/workflows/ci.yml` use a bare `pull_request:` with no branch filter, so ci runs on every layer with either tool. `push` is limited to `main` and `renovate/**`, so stack branches and `graphite-base/*` never trigger push ci (ci.yml lines 3–10 in both).
- neither repo has rulesets, and neither requires reviews or a merge queue. both have auto-merge on (`gh api repos/dvakatsiienko/{frame,bytes}`).
- required checks: frame needs `check + typecheck + test` and `Test x`. bytes needs `lint + typecheck + test + build`, `review:clean`, `apps essentials` and `skip-marker` (`gh api .../branches/main/protection`).
- bytes risk, inference to measure: `review:clean` is a check run published on one head sha (`review-approved.yml` header, `review.yml` lines 39–41). every cascading rebase gives each upper layer a new sha, so `review:clean` goes back to pending on all of them. github's "approvals preserved" covers github reviews, not a custom check run, and whether a preserved approval fires `pull_request_review` again is «?». one fix low in a 3-pr stack could cost 2 new review rounds against the two-round cap.
- with auto-merge on, stacked layers may not land on their own (see the disagreement in section 2).

**renovate**
- renovate opens its own single prs on the default branch (`baseBranchPatterns` default `[]`, "only the repository's default branch"), and `platformAutomerge` defaults to true. [renovate config options](https://docs.renovatebot.com/configuration-options/) renovate docs about stacked prs: not found.
- inference: renovate prs never join a stack. the cost is indirect. frame's patches automerge overnight (`renovate.json`, schedule `* 0-5 * * *`). each merge moves `main`, native stacks then need a linear history again ("the stack has a fully linear history" [reference](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests)), so each morning means one cascading rebase and full ci on every open layer.

## 5. real gains for a solo dev with agents, and when stacks are not worth it

**gains**
- an agent can build on work that has not merged yet, instead of idling until dima merges. this is the use case github names for agents. [about stacked prs](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs)
- smaller diffs per review, both for the verifier agent and for dima. smaller prs being easier to review is a vendor claim, not a measured one. [copilot tutorial](https://docs.github.com/en/copilot/tutorials/stack-ai-generated-code-in-pull-requests)
- partial landing: the bottom layers can merge while the top is still being reworked. [docs: merging](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-stacked-pull-requests)

**when not worth it**
- independent changes. "either changes are independent and you use separate prs" (hacker news, quoted in [infoq, 2026-04-29](https://infoq.com/news/2026/04/github-stacked-prs)). most of the fleet's lanes are parallel and independent, which is plain one-branch-one-pr work.
- small, fast-merging work. if dima merges within hours, nothing waits, so a stack adds rebase overhead for no gain (inference).
- ci cost on a small team: graphite's own docs expect no ci win under 10 stackers. [graphite docs](https://graphite.com/docs/stacking-and-ci)
- per-head review gates like bytes' `review:clean`, where each rebase re-spends review rounds (section 4, inference).
- trunks that move every night through renovate automerge, so stacks rebase daily (section 4, inference).
- a sweet spot to test: one feature of 3–4 dependent layers (schema, then api, then ui), built by one agent in one worktree, with the stack held for less than a day.

## 6. tooling an agent would want: a concrete proposal

a thin wrapper, `x stack` (name open), over `gh stack`, picked for its json output, exit codes, rest api and official skill. each verb is non-interactive and prints json.

**verbs**
- `x stack plan <topic> <layer>...`: write the layer plan (names and owned paths) before any code. runs `gh stack init <topic>/<layer1>` and sets `rerere.enabled` and `remote.pushDefault`.
- `x stack add <layer>`: `gh stack add <topic>/<layer>`, but refuses if there are uncommitted changes outside the layer's planned paths.
- `x stack where`: `gh stack view --json` plus the ci state and `review:clean` for each layer, in one json document.
- `x stack fix <layer>`: check out the owner layer (`gh stack checkout <b> --print-path`, then cd), let the agent edit, then commit, `gh stack rebase --upstack`, `gh stack push`, and return to the top.
- `x stack restack`: `gh stack sync`. it treats stdout "sync aborted" as a failure even when the exit code is 0, and maps exit 3 to "conflict, run fix", exit 8 to "locked, back off". (corrected 2026-10-20: the gh-stack readme lists exit codes 0–8 only, and docs.github.com says stacks need no setup or enablement — there is no «stacks not enabled» code.)
- `x stack submit`: `gh stack submit --auto` (drafts), then checks that every layer has a pr and a `stack` object via the rest api.
- `x stack gate`: green only when every layer has required checks passing on its current head, a linear history (`needsRebase` false everywhere) and size under the cap.
- `x stack land <pr>`: dima only. `gh stack merge <pr> --yes`, never `gh pr merge` on a stacked pr, then `gh stack sync --prune`.
- `x stack abort`: `gh stack rebase --abort` (restores every branch) and a report of the state.

**guards (hooks or deny rules)**
- deny bare `gh stack view|submit|init|add|checkout|switch|modify` (they hang a pty), and deny `gh pr merge` on any pr that carries a `stack` object.
- one agent per stack: a lock named after the stack, alongside gh stack's own exit 8.
- caps: depth ≤ 4 layers and ~400 changed lines per layer (to be tuned). the hook refuses `add` beyond them.
- ownership check before commit: staged paths must match the current layer's planned paths, which enforces the skill's "never commit a lower layer's concern on top".
- the verifier reviews layers bottom-up, and any finding is fixed in the owning layer, never on top.
- after a nightly renovate merge, one scheduled `x stack restack` per open stack, rather than having each agent rebase on its own.
- bytes: decide whether `review:clean` should survive an unchanged-diff rebase (compare the patch-id between the old and new head) before stacks go live there. «?» needs a design.

## linear with stacked prs

- linear supports "github-native stacks and linked pull requests inferred from their branch relationships". stacks are made outside linear: it "doesn't create, reorder, rebase, or restack them". [linear docs: diffs](https://linear.app/docs/diffs#stacked-prs)
- 2026-10-08: stacked prs appear in linear diffs with review, ci and merge status for each pr. related prs are grouped into one row in reviews, and you can preview every affected pr before merging the current one and those below. only github-native stacks are named, not graphite. [linear changelog, 2026-10-08](https://linear.app/changelog/2026-10-08-stacked-pull-requests)
- merging differs: for native stacks, "merging a pull request also merges every pull request below it". linked branch chains (graphite or plain stacks) "merge individually, not as a single stack". [linear docs: diffs](https://linear.app/docs/diffs#stacked-prs)
- setup: the docs list no stack-specific setting. the normal requirements apply: the github integration with code access, and a personal github connection for prs and code. [linear docs: diffs](https://linear.app/docs/diffs#stacked-prs) so it should work on day one for display. that depends on the existing integration «?», to be checked on the first stack.
- linking: an issue id in the branch name, or a magic word plus id in the title or body. [linear docs: github](https://linear.app/docs/github) dima's rule links by branch name and a `- ticket: FRM-N` line, never a closing keyword (`home/.claude/rules-lazy/linear-flow.md` lines 30–31).
- state moves for each layer: by default an issue moves to in progress when a pr opens and to done when it merges. with several prs linked to one issue, "the linear issue status will be updated when the final linked PR moves to the required state". [linear docs: github](https://linear.app/docs/github) so one issue for the whole stack works if every layer's branch carries the id. if only the bottom branch carries it, the bottom merge closes the issue early (inference).
- branch naming tweak: gh stack names are verbatim `<topic>/<concern>` [stack-design.md](https://github.com/github/gh-stack/blob/main/skills/gh-stack/references/stack-design.md). use the issue id as the topic (`frm-123/schema`, `frm-123/api`) so every layer links. whether linear finds an id in a `frm-123/…` prefix: «?», test it on the first stack.
- branch rules look at the target branch only ("the branch a pr is being merged into"). [linear docs: github](https://linear.app/docs/github) mid-stack prs target a feature branch. with no branch rules (the default) this changes nothing. a rule keyed on `main` would not fire for upper layers until they are retargeted (inference). whether a native stack merge reports each layer as merged into `main`: «?».
- a ticket per layer instead: give each layer its own child issue with its id in the branch, which matches dima's "a round on it is a child ticket" pattern (`linear-flow.md` lines 32–34). each child closes when its own layer lands.

<!-- end -->
