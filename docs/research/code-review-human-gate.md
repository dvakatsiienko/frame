---
dies-when: dima decides the pr approval gate
---

# code review at anthropic vs our pr flow, and the human gate

Ticket: none

## sources

- post: «how the claude code team does code review», addy osmani, morgan westlee lunt, qing wang, claude.dev, published 2026-10-15. https://claude.dev/blog/solving-code-review-at-anthropic/ (read in full via `web-bot-blocked:fetch` on 2026-10-20; webfetch only returned a summary). section names below point into the post.
- video: «anthropic barely reads claude's code anymore», better stack, uploaded 2026-10-19, 7:56. https://www.youtube.com/watch?v=d8QpDbBKbAU (auto-subs read via yt-dlp on 2026-10-20). it's a third-party walkthrough of the same post, so it's a secondary source. it adds a little: one critique, one cost figure, one hn mention.
- «our flow» means the setup as described in the brief (2026-10-20). i didn't read our repo config to check it.

## 1. main ideas

### goal and how they measure it

- they swap the question «did a human read it?» for «which check is the right one to catch what could go wrong?». post, «rethinking the purpose of code review»: "«did a human read the code?» is an imprecise proxy for «what could go wrong with this change, and which check—automated or human—is the right one to catch it?»". video 00:00:49.
- target: "most pull requests ... merge with at most one human in the loop, who can be the author, with no increase in reverts or incidents" (post, «the scarce resource»). video 00:00:58.
- human-time metrics: "human approvals per PR (median and 95th percentile), human comments, and how long a PR waits on a person". guardrail: "revert and incident rates ... if they rise, we haven't saved human time, we've only moved it" (post, same section).
- headline result: from june to september, merged prs more than doubled and the revert share fell by more than 40% (post, intro; video 00:00:15).
- critique (video only, 00:06:44): the 40% is a share, so "if you exactly double your PRs while your revert rate drops by 40%, you still end up with about 20% more reverts overall". the arithmetic holds (2 × 0.6 = 1.2). the post doesn't give absolute counts.

### what they automate (layers, "swiss cheese")

- before the pr: claude runs tests, build and lint and shows the output, "instead of saying it's done"; then "a subagent reviews the diff with fresh context" (post, layer 1; video 00:01:37).
- a finding that keeps coming back gets fixed at the source: "in the skill, with a lint rule, or with updates to instructional files" (`CLAUDE.md`, `REVIEW.md`). a good `REVIEW.md` names what failure looks like ("for docs it's «it lies,» for config it's «it misroutes»"), caps nits, lists paths to skip, asks for file and line as evidence, and asks for a summary "that starts with a count and says plainly when there's nothing to fix" (post, layer 1; video 00:02:08–00:02:55).
- ai review on every pr: parallel bug-hunting agents, then "a separate group votes on each finding, and it only gets posted if enough of them agree". style, diagnostics and cleanup findings are dropped. each finding is tagged important, nit or pre-existing (post, layer 2; video 00:02:01).
- "every finding has to be answered": you fix it or resolve it with a reason (post, layer 2).
- a separate security review. "a PR can't merge while any finding from the bug review or the security review is still open" (post, layer 3; video 00:02:57).
- required ci: lint, types, tests on every platform, build. the pr template asks how the change was tested and how to undo it, and "Claude can fill that in, but the person who asked for the change signs off on it" (post, layer 4; video 00:03:12).
- merge queue re-runs checks on latest main "so two PRs that pass separately can't combine into a broken main". also flags, internal use first, then the `latest` channel before `stable` (post, layer 6).
- review effort is set per repo: quick, standard or deep. "deep is worth it where one missed bug costs more than the extra review time" (post, layer 2).

### what humans still gate (risk tiers)

- low (docs, copy, internal-only, additive behind a flag): no human "once automated review and security checks are green". medium (ordinary product changes, plus caching, auto-updater, system prompts): one person. high: two people (post, layer 5; video 00:03:36).
- "the change sets the tier, not the author". a classifier picks the tier and a second classifier asks whether this change needs a person anyway. "some paths always need a person, anything owners have listed as sensitive and any CI workflow file" (post, layer 5; video 00:04:04).
- only trusted authors get the lighter paths. "an agent's approval never counts as a person's" (post, layer 5; video 00:07:30 lists it as worth copying).
- "whoever prompted the change is on the hook for it" (post, layer 5).
- "an approval covers one specific commit". new commits it can't vouch for, like an agent's push, need re-approval (post, layer 5).
- what humans keep: whether to build it at all, risky code (billing, auto-updater, ci workflows), architecture others will copy, "reading the evidence", and owning the outcome. "if you can't say what the checks would miss, ask for a real review rather than a quick approval" (post, «where humans stay in the loop»; video 00:06:02).
- gap they admit: "we don't yet have circuit breakers that tighten approval when those numbers move; engineers here want them before more code moves to zero-human merges" (post, layer 7).

### how they measure review quality

- incident eval: past incident and revert prs, each bug confirmed by an engineer who knows the code, run daily. every change to the reviewer's prompts, tools or model is scored against it: kept if the score goes up, dropped if not (post, «how we make the reviewer better»; video 00:04:21).
- noise: every comment is sorted by how the author responded (fixed it, said it was wrong, said it was intentional, or said it didn't matter). they also run the reviewer on known-clean prs and count harmful false alarms. "our priority, written down, is catching real bugs first and cutting review rounds second" (post, same section; video 00:04:53).
- "noise costs more when the author is an agent ... an agent fixes it, which means another commit and another round of review" (post; video 00:05:05).
- convergence: one pr ran "more than fifty rounds" overnight. "about 59%" of the repeat flags were code that was already there at the first pass. fixes: a three-round cap, after which "the reviewer asks the author to step back and reconsider the approach", diff-only re-review after the first few passes, flagging the whole bug class, and no repeat findings. results: pass after one round went 65% → 78%, five or more rounds went 8.9% → 1.5%, and mean reviews to pass went 2.08 → 1.32 (post, fig d; video 00:05:21–00:05:59).

### cost (video only)

- the video says the hn top comment pointed at anthropic's "virtually unlimited tokens", and that their paid reviewer "averages around $15 to $25" per review (video 00:07:04). neither the hn comment nor the price was checked against a primary source «?».

## 2. what we could borrow, mapped to our flow

- coder self-verify, then a fresh-context review before the pr (post, layer 1). we already have this: the coder works in a worktree and the verifier checks the exit lines. borrow the "show the output" rule: the verifier should paste the command it ran and what came back, not just "pass" (post, layer 1 and «reading the evidence»).
- a `REVIEW.md` for the verifier and coderabbit (post, layer 1 and «how you can adopt»). per repo: what failure looks like there, paths to skip, nit cap, file and line evidence, and a summary that opens with a count and says "nothing to fix" plainly.
- the same finding twice means fix it at the source (post, layer 1; video 00:02:08). when the verifier or coderabbit flags the same thing across prs, the coordinator turns it into a lint rule, a `CLAUDE.md` line or a skill edit, not another fix round.
- the pr template gets «testing», «risk» and «how to revert» (post, «how you can adopt»). the coder fills them in. this is what dima reads instead of code (post, layer 4: the person who asked signs off).
- severity tags (post, layer 2). the verifier tags each finding important, nit or pre-existing. only «important» blocks. pre-existing goes to a pocket note, not the pr.
- every thread answered (post, layer 2 and 3). merge needs no open coderabbit or verifier threads, each fixed or closed with a one-line reason.
- approval tied to a commit (post, layer 5). whatever clears the merge (verifier verdict, or dima's yes) records the head sha. a later agent push voids it.
- merge queue, or a rebase-and-recheck before merge (post, layer 6). parallel worktrees can each pass and still break main together. the coordinator re-runs ci on the pr rebased onto current main before it merges.
- revert rate as the guardrail (post, «the scarce resource»). count reverts and fix-forward commits on main per week, before and after any gate change.
- incident eval, small version (post, «how we make the reviewer better»). each revert on main becomes a saved case (the pr, the bug, the file and line). when we change the verifier prompt or model, re-run it on those cases.

## 3. the human approval gate: safe to delete?

- what it is today: dima says he presses «approved» without reading. so the gate is already a zero-human merge, labeled as a human one. the post's test for an approval is "if you can't say what the checks would miss, ask for a real review rather than a quick approval" (post, «where humans stay in the loop»). a blind press fails that test.
- deleting the click on low-risk changes is in line with the post: "none required once automated review and security checks are green" for docs, copy, internal-only work and additive changes behind a flag (post, layer 5). most of our pocket notes, docs, skill text and plugin chores look like that tier. that's my mapping, not something the post says about us.
- deleting it everywhere isn't what the post does. two rules there still apply to a solo dev:
  - "some paths always need a person, anything owners have listed as sensitive and any CI workflow file" (post, layer 5).
  - "an agent's approval never counts as a person's" (post, layer 5; video 00:07:30).
- proposed replacement (risk-tiered, set from the change's paths, not from who wrote it, per post layer 5):
  - low tier, auto-merge: verifier clean on the current head sha, ci green, no open coderabbit or verifier threads, and no file on the risky list touched. no click. the coordinator merges and posts a one-line note.
  - risky tier, dima reads evidence, not code: any pr touching a named path. dima reads the pr's «risk» and «how to revert» lines, the verifier's evidence (command and output), and the open-finding count, then says yes or no. 2–3 minutes, not a diff read (post, «reading the evidence»).
  - starter risky list, my proposal, to tune: `.github/workflows/**`, hooks, guard and permission settings (`settings*.json`, `CLAUDE.md`, `agents.md`), anything holding secrets or tokens, release and version-bump scripts, installers, anything that deletes or rewrites data, and the verifier's own prompt or skill. the post names ci workflows, auth, billing, release workflows and installers (post, «how you can adopt»).
  - a second check, like the post's second classifier (post, layer 5): the verifier also answers "does this need dima anyway?" with one reason. a yes sends it to the risky tier even when the paths don't.
  - start strict and loosen with evidence (post, «how you can adopt»): run auto-merge on the low tier only for a few weeks, watching reverts.
  - a circuit breaker, which the post says it still lacks (post, layer 7): if reverts on main pass a set count in a week, every pr goes back to the risky tier until it's reviewed.
- the failures this guards against:
  - an agent edits the checks themselves (a workflow, a hook, a guard setting, the verifier's prompt) so everything turns green. that's why ci workflow files "always need a person" (post, layer 5).
  - agent author and agent reviewer share blind spots, so an agent's clean verdict can't stand in for a person on sensitive paths (post, layer 5: "automated review can clear a low-risk change, but it can't fill a slot that calls for a human").
  - a push after the verdict slips in unreviewed. fixed by tying approval to the sha (post, layer 5).
  - two clean prs break main together. fixed by re-checking against current main (post, layer 6).
  - "should we even build this?" machines don't answer that (post, «where humans stay in the loop»). for us it's already decided when dima writes the ticket, so the pr gate adds nothing there.
- ownership stays with dima either way: "whoever prompted the change is on the hook for it" (post, layer 5), and "you land it, you own it" (post; video 00:06:13). deleting the click doesn't move responsibility.

## 4. other things to simplify

- two ai reviewers can loop. "noise costs more when the author is an agent" (post). the verifier and coderabbit can each set off fix rounds. pick one to block (the verifier, tied to exit lines) and make the other advisory, or make only coderabbit «important» findings block. that's my proposal, based on the post's noise argument.
- keep the 3-round cap, but change what happens at the cap. the post's cap doesn't just stop: the reviewer "asks the author to step back and reconsider the approach" (post, convergence list). at round 3 our verifier should send it back to the coordinator or dima with "approach looks wrong because ...", not another patch.
- diff-only re-review after round 1, and no repeat findings (post, convergence list). round 2+ verifier passes read only the new commits plus the old unresolved findings.
- flag the bug class, not the line (post, convergence list). the verifier says "every call to x lacks y", so the coder fixes all of them in one round.
- watch rounds-to-pass next to catches (post: "tracks rounds-to-pass alongside recall"). log rounds per pr and how each verifier and coderabbit finding was resolved (fixed, wrong, intentional, didn't matter), so we can see which reviewer is noise.
- set review depth by tier (post, layer 2: quick, standard, deep). low-tier prs get one verifier pass, risky-tier prs get the full loop. don't run several rounds by default ("this can be worthwhile on a risky change, but not on every PR", post, convergence section).
- quick lane (main, no pr, verifier on dima's yes or no) already matches the post's "review runs continuously, more like spellcheck" (post, «rethinking»). keep it for the low tier. route anything touching the risky list to a pr.
- learning the code without reading diffs: "they ask Claude to write an explainer for exactly that slice" (post, «sharing context»). if dima wants to know a module, an on-demand explainer beats skimming prs.
- cost: the video says this setup is pricey for non-anthropic teams (video 00:07:14, «?» on the price). so don't add more ai reviewer passes. cut rounds first.

## could not verify

- the video's per-review price "$15 to $25" and the hn top comment (video 00:07:04) «?».
- the video's "boris ... was shipping 20 to 30 PRs a day" back in march (video 00:00:41). the post doesn't say it «?».
- whether our verifier, coderabbit and coordinator behave as the brief describes. i didn't read our config «?».

<!-- end -->
