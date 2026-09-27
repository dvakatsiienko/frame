# gh-stack adoption — the plan

**owner:** cclio · **audience:** cclio + every coder briefed into this area
**status:** locked 2026-09-08 · steps 0–2 done, step 3 wired 2026-09-09 (greptile app + cli + filters), measurement run pending (step 3b; overnight pre-run 2026-09-10 folded)

**dies when:** step 5 closes — we land on gh stacks and dima approves it. at that moment this
doc is **deleted**, not archived. what survives it moves first:

- the coder guardrails (see [where the coder will struggle](#where-the-coder-will-struggle)) fold into `x:crew-coder`
- the stack hazards fold into `rules/fleet-hazards.md` as a new section
- the open probes that got answers fold into the gazette's «tricks gained»
- the probes that never got answers get raised once, then dropped

until then this is the working reference. **the point of the window is to exhaust the failure
modes listed here, not to reach step 5 fast.** a step that passes without surfacing anything is a
step that was tested too gently.

---

## what dima asked for — his words

kept verbatim so he never has to re-type his wants, and so a follow-up research round starts from
his framing rather than a paraphrase of it. **his words outrank any restatement below them.**

**the premise**

- *«recently we adopted PR-first start. and now considering stacked PR's.»*
- *«with chaotic nature of our flow, and frequent surface are switching i suppose stacked PR's is
  the solution»* — the observed symptom: ~3-4 PRs in one day, one merged, the coder drifted.
- the two needs, as he framed them: **1. stacked PR's · 2. adversary code review on ci**

**the hard constraints**

- *«any tool we find should be free, or have generous free tier. i don't have plans to buy another
  subscription.»*
- *«ideally have CLI. not MCP. mcp is nice to have but MCP's are slow and we do not need that. we
  don't have scale to justify MCP usage. CLI's are best friends for us currently due to speed, lower
  trash call data that mcp have with all that verbose jsons.»*
- *«have good, well tested community feedback»* · *«be SOLID and well crafted»*
- *«i want it automated»* — a review he has to trigger by clicking a checkbox does not count.

**his taste, which is a real criterion here**

- on coderabbit: *«it seem to be SOLID it terms of issues caught, they truly tweaked the models to
  catch real issues»* · *«but - it is so slow, even for small PR's it takes like ~5 min, very slow»* ·
  *«the coderabbit UI side so so ugly… they revamped it and it became ugly but from different
  angle»* · *«i like pretty UI's so this is a bit of a minus»*
- on greptile: *«looks like a really solid option. theo recommended it at some point… the admin looks
  sleek, like it»*
- on graphite: *«i like the admin - it is sleek»*
- on drafts: *«i don't like them :D»* · on labels: *«well maybe this way not so bad. another coder
  habit. will test»*

**how he wants the exploration run**

- *«we would start with presumably worse option and proceed to presumably better option so we land
  there»* — hence graphite before `gh stack`, and cclio is expected to **predict** which is better
  and order accordingly, not to test blind.
- *«the adversary code review tool can be picked from a pool - we can connect all tools… so we see
  whole picture»* · then: *«yes yes we will filter out adversaries after some amount of turns»*
- *«i'd like to test graphite reviews too, wana full picure»*
- on greptile's CLI: *«test flight of its cli won't hurt - test, measure the quality and adverted
  noise»*
- on the trigger: *«try find better approach along the way»* — b is locked, the search stays open.
- the gate rule, his shape: **we move to the next point once the current point is fully set up,
  tested and approved.**

**the flow he described wanting, verbatim**

> 1. coder first codes, slays into PR as he goes
> 2. then does checks himself, uses CR and Greptile CLi's against his code, fixes
> 3. then final slay — and only here somehow triggers CI claud action

**context he supplied that changes decisions**

- on ci fan-out: *«we kinda solved this by disabling previews. a tradeoff accepted to not burn 100
  deploy qouta in a wink of an eye. so we will only load gh actions CI.»*
- on the org: *«we move to ORG because blacksmith works only via ORG, plain repos are not
  supported.»*
- on going private: *«currently public, not having reason to make them private yet. aside from
  possibility of my repos being fed to LLM's as training data. only to counter that i'd move repos to
  private mode.»*
- on this doc: *«the doc will serve as a ref for some time until we explore the area in practice, and
  adopt your proposals, explore.»*

**follow-up research vectors — his standing wants, in his framing**

more research rounds are expected. these are the questions already voiced and not yet closed, so a
next round starts here instead of from a fresh prompt:

- is there a better trigger than a label or a draft
- what other *«cool tools… only solid craft»* exist in this space that we have not seen
- whether the private-repo move is worth what it costs, given the training-data concern
- whether an org locks us out of further free tiers beyond graphite's

---

## how to run it

- **the steps are gates, not a backlog.** a step opens only when the previous one is set up,
  tested and **approved by dima**. no parallel starts.
- each step carries: the goal, the moves, **the command that proves it**, the exit criteria, and
  what to watch.
- a step's exit criteria are the checkbox. an unmet criterion is not «mostly done».
- ❓ marks a claim nobody has verified. **never quote one as fact** — it is a probe with a home in
  [open probes](#open-probes).
- 📌 marks a thing that will bite. 🚨 marks a thing that will bite the coder specifically.

---

## the shape we are building toward

three layers of review, cheapest first, each one allowed to fail open:

1. **local, by the coder, before the push** — `coderabbit` CLI, then `claude /code-review`
2. **ci, on the pull request** — the claude code action, triggered explicitly by the coder
3. **dima** — reading a pr that two layers already cleaned

and underneath it, **stacked pull requests** so dependent work stops racing the merge queue.

the whole thing costs `$0`. that is a hard constraint, not a preference.

---

## step 0 — uninstall the coderabbit github app

- [x] **goal:** stop paying attention to a bot that returns summaries, not reviews. — done 2026-09-09: app uninstalled by dima, only linear webhooks remain on both repos.

**why:** coderabbit's free plan is *«pr summarization only; code reviews are available through the
vs code extension and cli»* (their docs). the 14-day advanced trial for new orgs has passed. and
automatic review is gated on **10+ stars for public repos** with **no `.coderabbit.yaml` override** —
which is the manual-checkbox friction dima has been clicking.

**moves**

- remove the coderabbit github app from `dvakatsiienko` (and from `bytes` + `dotfiles` if installed per-repo)
- `.coderabbit.yaml` deleted from bytes (`4633b37e`): the cli does not auto-read it — repo instructions reach a local review only via `-c <files>` (`CLAUDE.md` is the intended input). the cr skills package (`coderabbitai/skills`) is dead weight: thin wrappers, one skill needs the gh bot, flags stale against 0.7.6 — not installed

**proves it:** the app no longer appears under github → settings → applications, and the next
opened pr carries no coderabbit comment.

**exit:** dima confirms a pr opened after the removal is clean.

---

## step 1 — the claude code action

- [ ] **goal:** one permanent adversary on every pull request, running on the max subscription.

**why:** anthropic's own docs, verbatim — *«if you authenticate with an oauth token, runs use your
claude subscription instead of api billing.»* no star gate, no per-review quota, no vendor. github
actions minutes are unlimited on public repos, and `bytes` + `dotfiles` are public.

**moves**

- [x] `claude setup-token` locally to mint the oauth token → repo secret `CLAUDE_CODE_OAUTH_TOKEN` (bytes, 2026-09-09)
- [x] the claude github app installed on all repos; the workflow is hand-written (bytes #63): `review` job = code-review plugin on `@claude review`, `assist` job = interactive on any other `@claude`; opus-5 `--effort high`, `--max-turns 30`; the round-2 rule: re-review only after a critical/warning fix, cap 2, then `--add-reviewer dvakatsiienko`
- 🚨 **before merging the workflow pr, add `allowed_bots`.** the action rejects bot actors on every
  event. `x-coder-bot[bot]` opens the coder's PRs and `renovate[bot]` opens the evergreen ones —
  **without this line the action reviews nothing our lane actually produces.**
- set the trigger (see [the trigger question](#the-trigger-question) — option b is locked, c is the
  live alternative)
- add a `concurrency` group keyed on the pr number with `cancel-in-progress: true`, so a fast second
  push cancels a running review instead of stacking two
- repeat in `dotfiles` only after `bytes` is proven

**proves it:** open a throwaway pr from a `coder/*` branch pushed by `x-coder-bot`, trigger the
review, and see an inline comment land. **a summary comment saying «no issues» also proves it** —
that is the documented shape when it finds nothing.

**exit**

- [x] a bot-authored pr gets reviewed — bytes #64, 2026-09-09: `x-coder-bot` opened it and commented `@claude review`; one inline finding (the planted off-by-one), 18 turns, 198 s of claude, 3m49s job wall time. the first attempt skipped: the title said «throwaway» and the skill skips prs it judges trivial/automated — probe prs must look real
- [ ] a human-authored pr gets reviewed — dima's next pr
- [x] the trigger fires when we ask and not before — pushes are silent (no `pull_request` trigger); noise comments (vercel) get their own concurrency group after #65, the first run was cancelled by one
- ❓ the round-2 question is answered (see probes) — we know whether a fix push re-reviews or needs
  a re-request

**watch**

- 📌 anthropic's *managed* «code review» is a different product: team/enterprise only, **$15–25 per
  review**. same name, wrong doc page. we are not using it.
- ❓ [claude-code-action#727](https://github.com/anthropics/claude-code-action/issues/727) reports
  oauth tokens expiring in ~1 day; current docs promise a year. **test this on day two, not day
  thirty** — a silently dead token looks exactly like a quiet pr.

---

## step 2 — the local guard

- [ ] **goal:** the coder cleans its own work before ci ever sees it.

**why:** the cheapest review is the one that happens before the push. and this is already the 🔧
item on the queue — *«matt's `code-review` runs BEFORE the last push: review → fix → push → report
ready»*.

**moves**

- [x] `brew install coderabbit` (cask, 0.7.6, in the Brewfile), authenticated 2026-09-09
- [x] the fall-through + chain written into `x:crew-coder` 0.11.46
- wire it into the coder's done-sequence with `--agent` (structured findings for agents; 0.7.6 —
  `--prompt-only` no longer exists) and `-c CLAUDE.md` so house rules reach the review.
  📌 probe on the first real run: `coderabbit review --show-prompts` — does the yaml or
  `CLAUDE.md` get read without `-c`?
- keep `claude /code-review` as the second local pass — **it has no quota to exhaust**
- write the fall-through contract into `x:crew-coder`:
  **a review tool that rate-limits is skipped, named in the report, and never waited on**

**the chain, in order**

1. `coderabbit` CLI — free tier is ~3 reviews/hour, 150 files
2. `claude /code-review` — unmetered on the subscription
3. push, then trigger the ci review

**proves it:** a coder's done-report names both local passes and what each returned, and the ci
review afterwards finds nothing the local passes should have caught.

**exit:** two consecutive assignments where the ci review adds something *new* rather than
repeating the local findings. if ci keeps repeating them, the local step is theatre.

**watch**

- 📌 greptile is **not** in this chain. its free tier is 50 *reviews per month* total and the CLI
  probably spends from the same pool (❓) — burning it locally leaves nothing for the comparison in
  step 3.

---

## step 3 — greptile

- [ ] **goal:** one honest comparison against the claude action on identical input.

**why:** dima rates the admin and wants the full picture. the independent signal disagrees — hn
calls it noisier than coderabbit, and greptile's own cofounder concedes the nitpick problem in
those threads. **that disagreement is the reason to measure rather than to skip.**

**moves**

- connect greptile to `bytes`, starter plan (free: 50 credits/month, 1 active developer, unlimited
  repos; 1 credit = 1 standard review, 3 = trex)
- **budget the 50 explicitly** before the first review: reserve ~5 for a CLI test flight, the rest
  for the pr lane
- run it as a **pr bot** on the same PRs the claude action reviews
- one **CLI test flight** — dima's amendment: measure its terminal quality and noise, and answer
  whether CLI reviews spend the same credits

**proves it:** two tools' comments on one pr, scored on the four axes in
[the measurement contract](#the-measurement-contract).

**exit:** three PRs measured, and a keep-or-scrap verdict from dima.

---

### step 3b — the measurement run → `docs/vet/review-stack.md`

the plan, the pr 1 sheet (bytes #67 / BYT-83) and the pr 2 slot (BYT-81) live in
[review-stack.md](../../docs/vet/review-stack.md); its dies-when folds the decisions back
into the decision log below. one-line state: pr 1 says matt → coderabbit → greptile-or-dropped,
greptile's ci pass added nothing; pr 2 decides.

---

## step 4 — graphite, timeboxed probe

- [ ] **goal:** learn the stacking mental model on the tool with the nicer ui, and see its reviews.

**hard stop: one multi-layer assignment, or 5 days, whichever comes first.** this is a probe, not
an adoption.

**why the stop is hard**

- 🚨 **cursor acquired graphite in december 2025.** cursor's blog says *«graphite will continue to
  operate independently with the same team and product»* — but graphite's co-founder now leads
  **origin**, cursor's own forge, launched 2026-08-17. graphite is not shut down; its team's
  flagship is a competing product.
- 📌 **hobby is personal-account repos only.** the day `bytes` moves to a github org (step 6),
  graphite becomes `$20/user/mo`. the probe must end before the org exists.
- the standing reminder already reads *«retire graphite from the list when it works»*.

**moves**

- `gt` CLI, one real stack on the next multi-layer coder assignment — **not a synthetic test**
- graphite's ai review **on** (dima's amendment: he wants the full picture, not stacks only)
- 📌 hobby's review quota is *«limited ai reviews»* with **no published number**. «it ran out after
  N» is a valid measurement and should be recorded as one.
- ❓ `gt` is graphite's *stacking* CLI. whether a separate *review* CLI lane exists is unverified —
  find out, don't assume.

**exit:** one stack carried end to end, the reviews scored on the same four axes, and a written
comparison of `gt`'s verbs against `gh stack`'s.

**watch:** do not migrate anything to graphite. no config committed to the repos that assumes it.

---

## step 5 — gh stack · we land here

- [ ] **goal:** stacked pull requests as the standing shape for dependent work.

**why here and not graphite:** the stack is a **first-class github object**. branch protection and
codeowners are enforced on every pr in the stack, ci runs on every layer, the cascading rebase and
bottom-up merge are github's own. no second account, no second web ui, no vendor. public preview
since 2026-07-30, rolled out to **all repositories**, **no plan restriction** — free, pro and team.

**prerequisites, before the first stack**

- 📌 **name stacked branches under `coder/`** — e.g. `coder/BYT-N-<slug>-1`, `-2`, `-3`. the
  `vercel.json` deployment gate on `coder/*` then already covers them and **no new gate is needed**.
  a distinct `stack/*` prefix would need its own gate in all six `vercel.json` first.
- **one worktree per stack, not per layer.** the coder moves between layers with
  `gh stack up` / `down` / `checkout` inside one worktree at `<repo>/.claude/worktrees/`.
- resolve ❓ the `.git/gh-stack` worktree question before two coders ever stack in one repo.

**moves**

- `gh extension install github/gh-stack` (needs `gh` ≥ 2.0)
- the same assignment shape as step 4 — same depth, same repo — so the comparison is real
- the coder's stack verbs: `init` → `add` → `submit` → `rebase` → `push` → `merge`

**proves it**

- a three-layer stack opened, reviewed, and merged bottom-up
- `gh stack view` after the merge shows what actually landed — **not the merge command's exit code**

**exit**

- one stack merged cleanly end to end
- merge queue coexistence with branch protection on `main` measured (❓ today)
- the ci fan-out cost measured: how many workflow runs one cascading rebase actually triggers
- conflict behaviour seen at least once on purpose
- dima approves

**this is the step the doc dies on.**

---

## step 6 — org + blacksmith

- [ ] **goal:** faster ci, and only after stacking is settled.

**why after:** `gh stack` behaves identically on a personal repo and is free there. moving to an
org mid-test adds a variable to the measurement.

**the org facts**

- ✅ **blacksmith is org-only** — their docs: *«Blacksmith is limited to GitHub organizations and
  not available for personal repositories.»* free tier **3,000 min/mo**.
- ✅ **an org is a separate account, not a conversion.** creating one does not move `dvakatsiienko`.
  transfer `bytes` in; leave `dotfiles` personal.
- ✅ **both repos are public, so branch protection stays free on either side.** that question is
  closed.
- ❌ what org-free lacks vs personal-free: github packages storage (500 MB), codespaces free hours,
  and pages is not listed. **keeping `dotfiles` personal preserves all three as a fallback.**
- 📌 gained: org-level actions secrets — one `CLAUDE_CODE_OAUTH_TOKEN` for every repo. anthropic's
  caveat: an oauth token is tied to the subscription of whoever ran `claude setup-token`. fine for a
  one-person org.
- ❓ greptile starter is worded *«1 active developer»*, not «personal repos» — likely survives the
  move, unverified.

**the reversal cost, so nobody panics if blacksmith misses**

- transferring org → personal is supported: needs org owner perms plus owning the target account
- survives: issues, PRs, wiki, stars, watchers, webhooks, secrets, deploy keys, releases, forks,
  git-lfs, **and url redirects from the old path**
- breaks: **github pages does not redirect** · read-only collaborators are dropped · issue types may
  be dropped
- 📌 **the real cost is re-pointing, not git**: vercel ×6, mend/renovate, `x-coder-bot`,
  `TURBO_TEAM`, the linear link, remotes. **one afternoon each way.** an empty org costs nothing —
  blacksmith missing is not a wasted move, re-pointing twice would be.

**moves**

- create the org, transfer `bytes` only
- re-point the six integrations, verify each
- install blacksmith, migrate runner tags (`ubuntu-latest` → `blacksmith-2vcpu-ubuntu-2404`)

**exit:** ci green on blacksmith runners, all six vercel projects deploying, renovate and the coder
bot still working, and a measured before/after on ci wall-clock.

---

## the trigger question

**the problem:** the coder pushes freely as it works. every push is a `synchronize` event. the
shipped review workflow fires on every one of them, so the reviewer reads unfinished work and burns
runs. we want the review to run **once, when the coder says it is ready**.

three options. **c is locked (dima, 2026-09-09: labels are friction; one workflow covers review + assist); b is the fallback.**

**a — draft → ready for review**

- coder opens a draft, pushes freely (claude skips drafts by design), last act is `gh pr ready`
- the `ready_for_review` event fires the review
- ➕ fully native, zero extra config
- ➖ 🚨 **collides with a standing rule** — `x:crew-coder` says *«real PR at first push, never a
  draft — dima's word»*. and dima's own read: *«i don't like them»*.
- **not chosen. recorded so nobody re-proposes it as new.**

**b — label-driven · fallback**

- workflow triggers on `pull_request: types: [labeled]`, guarded by
  `if: github.event.label.name == 'review'`
- coder's final act: `gh pr edit --add-label review`
- ➕ keeps a real pr live from the first push
- ➕ «ready» becomes an explicit, visible state on the pr timeline
- ➕ **remove-and-re-add the label is a clean re-trigger** — which also solves the round-2 problem
- ➖ one more coder habit to teach, and a label taxonomy to maintain

**c — `@claude review` comment · LOCKED — bytes #63**

- the review workflow triggers on `issue_comment: types: [created]`, guarded by
  `if: contains(github.event.comment.body, '@claude review')`, still passing the `/code-review`
  prompt so it runs the same skill in automation mode
- coder's final act: `gh pr comment --body "@claude review"`
- ➕ no new label taxonomy
- ➕ re-review is just another comment — the most natural round-2 handle of the three
- ➖ the readiness signal lives in the comment thread, not as pr state
- ➖ needs the same `allowed_bots` line as b, since the bot-actor check applies to every event

**all three need `allowed_bots`.** that is not a differentiator, it is a prerequisite.

---

## the measurement contract

every tool in the adversary pool is scored on the **same four axes**, on the **same PRs**, recorded
in the ticket comment. agreed before the first comparison, not after.

- **true findings** — real defects it caught
- **noise** — comments that were wrong, trivial, or restated a lint rule
- **time to first comment** — coderabbit publicly admits *«up to five minutes»*; g2 reports 20+ on
  large PRs; anthropic's managed review averages 20 minutes. latency is a property of multi-agent
  review, not one vendor's defect.
- **uniqueness** — did it catch anything the others missed. **this is the only axis that justifies
  keeping a second reviewer at all.**

**the pool at peak: claude action, greptile, graphite, plus coderabbit CLI locally.** four
reviewers on one pr is exactly the comment-wall every noise complaint describes.

- 📌 run the full-picture phase on **one or two PRs deliberately**, never as a steady state
- after the measurement turns, cut to **one ci reviewer + the local CLI chain**

---

## gotchas — stacked pull requests

all from [github's troubleshooting doc](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-stacked-pull-requests)
and the [public preview thread](https://github.com/orgs/community/discussions/201439) unless marked.

**the one that matters most**

- 🚨 **stacks fix dependency, not chaos.** the drift dima hit — 3-4 independent PRs, one merged, the
  coder's base gone stale — is *not* what a stack solves. stacking independent work **invents** a
  dependency: layer 2 cannot merge until layer 1 does, and one stuck pr blocks everything above it.
  **the declaration of what depends on what happens before the first branch.**

**the mechanics that break**

- 🚨 **lower-layer changes do not propagate by themselves.** after committing to layer 1 you must run
  `gh stack rebase --upstack`. this is the first thing a coder will get wrong.
- ⚠️ **server-side rebases produce unsigned commits.** rebasing from the pr interface runs on
  github's servers and does not sign. **always `gh stack rebase` locally, then `gh stack push`.**
  the preview thread's «all my commits went unverified» reports are this.
- ⚠️ **a stack needs linear history between branches before it can merge.** any merge commit or
  stray rebase blocks the merge until `gh stack rebase` repairs it.
- ⚠️ **closing a pr in the middle blocks everything above it.** recovery is `gh stack modify` or
  unstacking on the web.
- ⚠️ **`gh stack merge` can stop mid-stack.** lower PRs stay merged, the rest wait. **not atomic in
  practice** — verify with `gh stack view`, never with an exit code.
- ⚠️ **merge-queue ejection cascades** — one pr ejected ejects every pr above it.
- ⚠️ **`gh stack modify` refuses to start** on a dirty tree, an active rebase, a queued pr, or
  non-linear history. `--abort` restores a pre-modify snapshot. **reordering cannot be mixed with
  structural changes (drop, fold, insert, rename) in one session.**
- ⚠️ **conflicts stop the cascade.** `gh stack rebase --continue` / `--abort`. a conflict during
  `gh stack sync` leaves branches in a partial state.
- ⚠️ **merged PRs stay in the stack.** a stack dissolves entirely only when none of its PRs merged
  or are queued.
- ⚠️ **conflicts are invisible in the ui until you attempt the merge**, and there is no web conflict
  editor for them.
- ⚠️ **merge-queue support was still rolling out** at announcement. both mains have branch
  protection + auto-merge — verify before trusting a stack there.
- ⚠️ no cross-fork stacks · not supported in github desktop · the api needs the async merge endpoint.

**ours specifically**

- 📌 **ci fan-out**: a cascading rebase pushes every branch above the merged one, so each fires
  `synchronize` — and therefore a **review per layer, per merge**. previews are already gated on
  `coder/*`; keeping stacked branches under that prefix keeps them gated too. **the review trigger
  is what still needs gating**, and the label/comment trigger solves it as a side effect.
- 📌 actions minutes are **unlimited on public repos**, so the fan-out costs wall-clock and noise,
  not money — until step 6 makes anything private.
- ❓ `rebase.updateRefs` has been on since 2026-09-03. that is git's own cascading ref update, and
  `gh stack rebase` is a second mechanism doing the same class of work. **interaction unmeasured.**

**graphite vs gh stack — how much transfers**

- **the git-level gotchas are identical.** both do local rebase cascades over one repo: conflict
  handling, linear history, never force-push out from under the tool, one branch per layer.
- **the platform-level gotchas are not.** graphite's stack is graphite's own metadata plus pr-body
  comments — github does not know it is a stack and enforces nothing per layer. graphite's merge
  queue is a paid feature.
- **no state migrates.** finish the graphite stacks, then start new ones with `gh stack`. the
  branches underneath are just branches.
- the verbs map near one-to-one: `gt create/submit/restack/sync` → `gh stack add/submit/rebase/sync`.
  **the graphite days buy the mental model; that is the whole return.**

---

## where the coder will struggle

these are **assumptions**, not measurements. each one is a guardrail candidate for `x:crew-coder`,
and each should be **tested during the window** — a guardrail that never fired is a guardrail to
delete, not to keep.

**stack mechanics**

1. 🚨 **forgets `gh stack rebase --upstack` after editing a lower layer.** it will commit to layer 1,
   see layer 2 unchanged, and either force-push layer 2 by hand or report done on a stack that does
   not build.
   → **guardrail:** any commit to a non-top layer is immediately followed by
   `gh stack rebase --upstack`, then `gh stack push`. never a bare `git push` on a stacked branch.
2. 🚨 **reaches for plain `git rebase` / `git push --force`.** its muscle memory is plain git, and a
   manual force-push desyncs `.git/gh-stack` from the remote.
   → **guardrail:** on a stacked branch the only push is `gh stack push`. **`slay`, `slayer` and
   `yolo` are suspended while a stack is active** — a deliberate carve-out from the fleet
   vocabulary, and it must be said out loud in the brief because those words normally mean go.
3. 🚨 **stacks work that is not dependent.** it will stack whatever it happens to do next.
   → **guardrail:** the layers are declared in the assignment before the first branch. if the coder
   discovers mid-flight that a layer is independent, **it stops and reports** — it does not
   restructure silently.
4. **closes a middle pr** when it decides a layer is unneeded, blocking everything above.
   → **guardrail:** never close a pr inside a stack. report it; `gh stack modify` is a coordinator
   action.
5. **rebases from the pr interface**, producing unsigned commits.
   → **guardrail:** rebases are local only.
6. **runs `gh stack modify` on a dirty tree** and lands a half-restructured stack.
   → **guardrail:** `git status` clean first; `--abort` is the recovery and it restores a snapshot.
7. **reports «stack merged» when the merge stopped mid-stack.**
   → **guardrail:** `gh stack view` after every merge. three ends, not two — merged, failed, or
   partially landed.
8. **two coders stacking in one repo.** `bytes` is one shared checkout and ❓ the stack state may be
   shared across worktrees.
   → **guardrail:** one active stack per repo. a second coder gets a different repo or waits.

**review loop**

9. 🚨 **fixes every bot comment on sight**, implementing noise.
   → **guardrail:** answer every comment; fix what it agrees with; **reply with a reason where it
   disagrees.** it already did this correctly on `#46` — the habit exists, it needs naming.
10. 🚨 **waits on a rate-limited review tool**, blocking the foreground.
    → **guardrail:** a tool that rate-limits is skipped, named in the report, never waited on.
11. **loops «until LGTM» forever.**
    → **guardrail:** **cap at 2 rounds**, then report and stop. the spawning rule already says three
    round trips means the brief was wrong.
12. **assumes the ci review re-fires after a fix push.** ❓ anthropic's doc says claude skips PRs it
    has already commented on.
    → **guardrail:** re-request explicitly (re-add the label, or a new `@claude review` comment).
13. **triggers the review too early, or forgets to trigger it.** the label is a new habit and new
    habits fail first.
    → **guardrail:** the trigger is a **named final step** in the brief's done-sequence, after both
    local passes report clean.

**reporting**

14. **relays a reviewer's finding as fact.** a bot's comment is a candidate, same as a coder's
    report.
    → **guardrail:** the done-report pairs every claim with the command that proved it — already the
    🔧 queue item, and stacks make it matter more because a claim can now be true on one layer and
    false on the next.

---

## open probes

each needs one command or one run to settle. **none may be quoted as fact until then.**

- ❓ **`.git/gh-stack` and worktrees** — worktrees share the common git dir, so is stack state shared
  across `<repo>/.claude/worktrees/` or per-tree? decides whether two coders can ever stack in
  `bytes`. **probe before step 5's first stack.**
- ❓ **`rebase.updateRefs` × `gh stack rebase`** — two cascading-ref mechanisms on the same branches.
- ❓ **does the claude action re-review after a fix push?** the doc says it skips PRs it already
  commented on. **this decides whether the review loop runs at all.** probe in step 1.
- ❓ **oauth token lifetime** — issue #727 says ~1 day, docs say one year. probe on day two of step 1.
- ❓ **greptile CLI credits** — same 50/month pool as pr reviews, or separate? answered by the step 3
  test flight.
- ❓ **graphite hobby's «limited ai reviews»** — the actual number. no vendor publishes it.
- ❓ **graphite review CLI** — does a review lane exist outside `gt`'s stacking commands?
- ❓ **greptile starter after the org move** — «1 active developer» reads as person-scoped, not
  account-scoped. verify before step 6, not after.
- ❓ **merge queue × stacked PRs** on our branch protection — support was still rolling out.
- ❓ **sourcery's engine and typescript** — see bench candidates.

---

## bench candidates

not installed, not in the pool. **swap-ins if one of the four gets cut after the measurement turns.**

- **sourcery** — free on **public repos**, in their words *«fully free to use on open source
  projects… working on a project that lives in a public repo»*, giving pro features plus limited
  security scans on 3 repos, biweekly. ⭐ **the interesting part is not its LLM review — it is the
  rule-based python refactoring engine it began as**, which is a different tool class from every
  other name here: deterministic refactors, not opinions. ❓ whether that engine speaks `ts`/`tsx`
  is unverified and is the only thing worth ten minutes. cheapest swap-in of the two.
- **korbit** — **korbit max, their top tier, free for all open source repositories**: unlimited pr
  reviews and repos, custom coding-policy enforcement, codebase chat. the most generous free tier in
  the whole sweep. ❌ **no CLI**, and its differentiator is **team analytics dashboards** — a
  one-person fleet measured against itself. 📌 «open source» is stricter wording than sourcery's
  «public repo» and likely needs a real licence, which waits on
  [DOT-26](https://linear.app/x-com/issue/DOT-26).
- **pr-agent** — ex-qodo, **now community-owned and mit**, 12.9k stars. self-hosted github action
  with `auto_review: true`, plus `/describe`, `/improve`, `/ask`, plus a real CLI. model-agnostic.
  **the argument for it is a second vendor's model**, not more features.
- **gemini `code-review` extension** — official google, apache 2.0, CLI-native
  (`gemini extensions install`, then `/code-review`), free on an ai-studio key. same argument:
  non-anthropic eyes on anthropic's code. built by the team whose hosted github app google shut down
  on **2026-07-17** — the craft is proven, the hosted product is not coming back.

---

## decision log

what was decided and why, so it does not get re-litigated.

- **land on gh stack, not graphite** — graphite's hobby tier dies on the org move, cursor owns
  graphite, and the standing reminder already said to retire it when native works.
- **graphite still gets tested, first** — dima wants the ui measured honestly rather than assumed,
  and the mental model transfers.
- **graphite gets reviews too, not stacks only** — dima's call: full picture.
- **greptile is pr-bot-first with one CLI test flight** — 50 credits cannot serve two lanes, but
  measuring the CLI's noise is worth ~5 of them.
- **label trigger (b) over draft (a)** — keeps the never-draft rule intact; option c stays live.
- **org comes after gh stack is proven** — gh stack is free and identical on a personal repo, so
  moving early only adds a variable.
- **both repos stay public** — going private is a bundle, not a switch: it costs unlimited actions
  minutes, branch protection on any free tier, and every «free for open source» plan in this doc.
  the training-data motive is real and deserves its own decision, not a side effect of this one.
- **four reviewers is a phase, not a steady state** — cut to one ci reviewer plus the local chain
  after the measurement turns.

---

## sources

- [claude code github actions](https://code.claude.com/docs/en/github-actions) — oauth vs api key, the review workflow, `allowed_bots`, the skip rules
- [about stacked pull requests](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs)
- [managing stacked pull requests](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/managing-stacked-pull-requests)
- [troubleshooting stacked pull requests](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-stacked-pull-requests)
- [gh stack cli commands](https://docs.github.com/en/pull-requests/reference/stacked-prs-cli-commands)
- [github/gh-stack](https://github.com/github/gh-stack)
- [public preview thread](https://github.com/orgs/community/discussions/201439) — the community's complaint list
- [coderabbit plans](https://docs.coderabbit.ai/management/plans) — summary-only free tier, the 10-star threshold
- [coderabbit, «the rise of slow ai»](https://www.coderabbit.ai/blog/the-rise-of-slow-ai-why-devs-should-stop-speedrunning-stupid) — the five-minute admission
- [coderabbit cli](https://www.coderabbit.ai/blog/coderabbit-cli-free-ai-code-reviews-in-your-cli)
- [greptile pricing](https://www.greptile.com/pricing)
- [graphite pricing](https://graphite.com/pricing)
- [graphite is joining cursor](https://cursor.com/blog/graphite)
- [blacksmith quickstart](https://docs.blacksmith.sh/introduction/quickstart) — the org-only line
- [blacksmith pricing](https://www.blacksmith.sh/pricing)
- [transferring a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository)
- [github's plans](https://docs.github.com/get-started/learning-about-github/githubs-products)
- [sourcery pricing](https://sourcery.ai/pricing) · [korbit pricing](https://www.korbit.ai/pricing.html)
- [pr-agent](https://github.com/The-PR-Agent/pr-agent) · [gemini code-review extension](https://github.com/gemini-cli-extensions/code-review)
