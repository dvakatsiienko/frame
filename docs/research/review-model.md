---
dies-when: the review model is decided and folded into x:crew-codie
---

Ticket: none

# how many reviews an agent coder runs, and what runs last

📌 adopted 2026-11-05 (dima's tick): CodeRabbit runs once and last, the rest as below. Headline: one pass per angle before the first verifier round, no full reruns, the verifier last and bound to a sha, a test-only gate at merge. No study compares seal orders or measures reruns on agent fix diffs, so this rests on adjacent evidence.

Keys, read 2026-11-05: `rr` = docs/test-drive/review-rounds.md, `wh` = docs/test-drive/wisphunter.md, `brief` = .scratch/review-model/brief.md. Undated docs carry that date.

## 1. rerun: no full rerun; the next verifier round reads the fix diff

Strength: weak. Searched arXiv and the web for findings per round on agent fixes; none. Our log does not split it either (rr:29-50).

- Human fixes: 14.8–24.4% of sampled post-release OS fixes incorrect, 39% for concurrency ([Yin, 2011](https://www.eecg.utoronto.ca/~yuan/papers/incorrect_fix_abstract.html)). Bad fixes reach 9% of bugs ([Sun, 2010](https://www.cs.ucdavis.edu/~su/publications/icse10-badfix.pdf)).
- Agent fixes: 21 regressions from 130+ merged Codex-written PRs, 16 functional ([Trail of Bits, 2026-10-21](https://blog.trailofbits.com/2026/10/21/your-ai-agent-fixed-the-bug-but-what-else-did-it-change/)), about 16% at most (inference). 11.0% of plausible SWE-bench patches wrong ([ICSE '26](https://arxiv.org/html/2503.15223v2)). These measure different things.
- Small diffs yield little: under 50 lines, 31% get findings, 0.5 issues; over 1,000 lines, 84%, 7.5 ([Anthropic, 2026-03-09](https://claude.com/blog/code-review), vendor).
- Humans: two inspections with repair between showed no significant gain and doubled the premeeting interval ([Porter, 1997](https://www.cs.umd.edu/~atif/Teaching/Spring2003/inspection5.pdf)).
- Cost: a card run has a 2.2 min median, 65–216k tokens (wh:40); full axes 5–8 min (wh:49). Two reruns of a pair cost roughly 4–16 min, 5–18% of the 88-minute chunk (brief:16; inference).
- Against: [superpowers](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/subagent-driven-development/references/fix-loop.md) (2026-11-03) re-reviews the fix diff every round. Yield unmeasured.

## 2. how many: one pass per angle; cut repetition first

Strength: moderate on overlap, weak on the stopping point.

- Cross-family: 56.5% of 154 defects found by one model only, Jaccard ~0.37, coverage 33.6 → 57.1 → 74.6 → 88.7 → 100% for 1–5 providers. Authors advise 2–3 and say false positives grow ([Zenodo, June 2026](https://zenodo.org/records/20519585/files/LLM_Code_Reviews.pdf): one organisation, preprint, denominator is the union of finds).
- Ours, same family, different angle: the card found 5 real bugs the built-in missed, the built-in 2 low ones the card missed (wh:44, 2026-10-29). The spec axis made the only catches nothing else made (rr:43).
- Humans: two reviewers beat one, four add nothing over two (Porter). Rigby and Bird converged on two; Google usually requires one ([Sadowski, 2018](https://sback.it/publications/icse2018seip.pdf)).
- Repetition is untested: Zenodo had no identical reruns. Cursor used eight shuffled passes with voting to filter false positives, then went agentic ([2026-01-15](https://cursor.com/blog/building-bugbot)). A fresh subagent is "not a smarter answer" ([Claude docs](https://code.claude.com/docs/en/best-practices.md)).
- False positives split: under 1% marked incorrect ([Anthropic](https://claude.com/blog/code-review), vendor); 12 of 13 review agents below 60% signal ([MSR '26](https://arxiv.org/pdf/2604.03196)); ~36% precision before a run-based proof (Trail of Bits). Ours: 46 of 48 (wh:41), 15 of 20 (rr:29), 4 of 7 (rr:34).

## 3. the seal: verifier last holds, on four conditions

Strength: no controlled comparison found (searched seal-order terms). The view rests on logic plus practice (inference).

Why it holds: a verifier loop ends on the head it cleared, so its fixes go unread, not unverified. A review last leaves its fixes unverified, and Anthropic's reads without running ([docs](https://code.claude.com/docs/en/code-review.md)).

Where I tried to break it:
- Criteria blindness: half of 22 confirmed wrong patches passed all developer tests ([ICSE '26](https://arxiv.org/html/2503.15223v2)). Condition: the last round also reads the fix diff and probes its callers.
- Readers catch what it misses: a P1 the verifier missed, plus 6 + 3 highs from pm review, order unstated (rr:48); a verifier-less chunk's post-hoc read found 6 bugs (brief:16, n=1). Condition: full reads come before round 1.
- Leniency: an evaluator is still an LLM ([Anthropic, 2026-03-24](https://www.anthropic.com/engineering/harness-design-long-running-apps)); some exits only prove live (rr:50). Condition: a clean names what it did not exercise.
- Drift: code after clean voids it. Condition: clean binds to a sha.

How others close it, and they split:
- Strict: stale approvals dismissed, or the latest push needs approval ([GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)).
- Carry only if nothing changed: clean rebase, message edit ([Gerrit](https://gerrit-review.googlesource.com/Documentation/config-labels.html)).
- Trust small fixes: LGTM with comments ([Google](https://google.github.io/eng-practices/review/reviewer/speed.html)).
- Review last, one scoped re-review, no second wave ([superpowers](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/subagent-driven-development/references/final-review.md), 2026-11-03).
- Hard gate at test/CI, humans own approval ([Anthropic, 2026-07-21](https://claude.com/blog/how-anthropic-secures-its-ai-native-software-development-lifecycle)).

## 4. verifier against reviewer: different classes, not redundant

Strength: moderate on classes, weak on size; no direct measurement found.

- Readers: 75% of review defects do not affect visible behaviour ([Mäntylä, 2009](https://mmantyla.github.io/wiki/What+Types+of+Defects+Are+Really+Discovered+in+Code+Reviews%253F.html), humans), so a run rarely shows them (inference). Real bugs also sat in gate-green trees (wh:41).
- Runners: a renovate dry run (rr:30), a `-json` recount, 185 against 160 (rr:37), 27 escapes proven on disk (rr:47), a live failure at the cap (rr:50).
- Combining: reading and testing "consistently much more effective" together ([Wood, 1997](https://strathprints.strath.ac.uk/2665/), 47 students).
- Size: frame#95, verifier 3 real, local 15 useful (rr:29). My count of rr:29-50: 8 of 14 chunks sent back at least once, 4 clean on round 1, 2 unstated (inference; the brief says 12).
- Redundancy: an evaluator pays "beyond what the current model does reliably solo": $9 against $200 ([Anthropic, 2026-03-24](https://www.anthropic.com/engineering/harness-design-long-running-apps), Opus 4.6). Eight of 14 says we are there (inference). Low-risk chunks alone: «?».

## 5. practitioners: small batches, a separate judge, a round cap

Strength: consistent on shape, split on the number.

- Caps: stopping conditions are common ([Anthropic, 2024-12-19](https://www.anthropic.com/engineering/building-effective-agents)). Two CI rounds, citing diminishing returns ([Stripe, 2026-02-19](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2)). Five fix rounds, a stronger model from round 4 (superpowers). Two consecutive clean passes, 31 audits, $2,430 ([Abenhaïm, 2026-07-31](https://arxiv.org/pdf/2608.12440), one case, 189 files).
- Google: over 80% of changes take at most one iteration, median 24 lines (Sadowski).
- DORA: small batches amplify AI's benefit ([capability page](https://dora.dev/capabilities/working-in-small-batches/)); AI still correlates with instability ([Splunk, 2025-10-09](https://www.splunk.com/en_us/blog/learn/state-of-devops.html), secondary; report not opened).
- Agent review, 1.02M PRs: faster decisions, no better quality ([2026-07-14](https://arxiv.org/abs/2607.13196)).

## recommended model

All inference; thresholds are mine and untested.

1. Coder builds; own gate green.
2. Once, whole chunk, in parallel: spec + standards, `/code-review`, CodeRabbit when quota allows. Findings carry evidence; style dropped. Matches the 2026-11-05 base (rr:52).
3. Verifier round 1 on a named sha.
4. On a refute: coder fixes, reruns covering tests. No review rerun.
5. Verifier rounds 2–3: re-run exits, read the fix diff, probe its callers.
6. One scoped read of the fix diff, once a chunk at most, only if the fix exceeds 50 lines or 20% of the chunk, adds a file, or touches concurrency, persisted state or a fail-open path.
7. Cap at 3. Unclean at 3: stop, escalate, no seal.
8. Last: the verifier's clean on the head sha, then a test-only gate. A clean rebase or message edit keeps it; any code change reopens a round.

Test: a post-hoc read of one chunk in five. Two escapes a scoped read would have caught make step 6 unconditional.

Bigger, over 500 lines: split first; else review per slice (rr:44) and run step 6 always.

Riskier (auth, data loss, irreversible steps): step 6 always, a before-and-after proof per finding, a human tick at the end. The cap stays 3.

Sources split on: review or verifier last; re-review every round or never; caps from 2 to 5; false positives from under 1% to 64%.

<!-- end -->
