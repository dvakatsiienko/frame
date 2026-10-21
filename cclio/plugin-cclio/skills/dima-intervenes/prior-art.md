# Prior art: catch-up / pair-with-Dima skill

Researched 2026-10-21. Primary sources opened unless marked "(secondary)". «?» = not verified.

## 1. Pair-programming roles with an AI

- Strong-style pairing: "for an idea to go from your head into the computer it MUST go through someone else's hands". The navigator talks at the highest level the driver can follow, drops to concrete steps when the driver looks lost, and adjusts as the driver's energy changes. The driver holds "why" questions until the section is done. [Falco, 2014-06-30](https://llewellynfalco.blogspot.com/2014/06/llewellyns-strong-style-pairing.html)
- People use AI in two modes. In acceleration mode they already know the next step. In exploration mode they are unsure and use the AI to look at options. The interface should serve the mode the person is in. [Barke et al., Grounded Copilot, 2022-06/10](https://arxiv.org/abs/2206.15000)
- Assistants help with getting unstuck, onboarding and knowledge sharing. They do not give shared ownership or the tacit history of a codebase. [Böckeler, martinfowler.com, 2023-08-10](https://martinfowler.com/articles/exploring-gen-ai/05-not-your-pair-programmer.html)
- Evidence on human-AI pairing is mixed and measured more narrowly than for human pairs. A gap in expertise between partners hurts human pairs, so a good assistant should adapt to the partner's level. [Ma, Wu, Koedinger, 2023-06-08](https://arxiv.org/abs/2306.05153)
- Copilot users mostly slid into the navigator role, reviewing code rather than typing (Bird et al., 2023). Copilot as driver traded quality for volume (Imai, 2022). Both seen only as citations in [an APSEC 2024 search summary](https://conf.researchr.org/details/apsec-2024/apsec-2024-software-engineering-education/1/Pair-Programming-in-Programming-Courses-in-the-Era-of-Generative-AI-Students-Perspe), not the originals «?»

## 2. Progressive disclosure / zoom-in onboarding

- C4 is "a set of hierarchical abstractions". It has four levels: system context, container, component, code. [c4model.com, read 2026-10-21](https://c4model.com/) The "maps of your code" analogy and the advice that levels can be skipped come from secondary write-ups only. [Vaadin docs, undated](https://origin.vaadin.com/docs/v24/building-apps/deep-dives/architecture/design) «?»
- CodeTour: tours are ordered steps pinned to a file, line or directory. A text-only step can open a tour as an introduction. Tours can be chained ("1: …", `nextTour`), and one "primary" tour is the one a newcomer should see first. [microsoft/codetour README, read 2026-10-21](https://github.com/microsoft/codetour)
- DeepWiki auto-plans wiki pages ("cluster-based planning") with architecture diagrams, source links and summaries. Pages can be nested under a parent. Ask Devin then answers deeper questions grounded in the wiki plus code search. [Devin docs, read 2026-10-21](https://docs.devin.ai/work-with-devin/deepwiki) The ToC is built from concepts first, then code. [ZenML case study, undated (secondary)](https://www.zenml.io/llmops-database/building-an-autonomous-ai-software-engineer-with-advanced-codebase-understanding-and-specialized-model-training-6bnir) «?»
- Claude Code's Explanatory style adds `Insight` blocks of 2–3 points next to the work. Learning mode leaves `TODO(human)` only where a real design decision sits, then stops and waits. Concise mode leads with the result and gives full length only when asked or when safety needs it. [Claude Code docs, output-styles, read 2026-10-21](https://code.claude.com/docs/en/output-styles)
- None of these tools has a written rule for when to go deeper. They go deeper when the user clicks a page, asks or picks the next tour. Cursor, Greptile and Cody were not examined «?»

## 3. Plain language first for an overloaded expert

- Expertise reversal: guidance that helps novices adds redundant load for people who already have schemas. Detailed walkthroughs can hurt experts. [Wikipedia summary, read 2026-10-21 (secondary)](https://en.wikipedia.org/wiki/Expertise_reversal_effect) The reversal did not show up on less structured tasks. [Utrecht, 2013](https://research-portal.uu.nl/en/publications/the-worked-example-and-expertise-reversal-effect-in-less-structur/)
- Working memory holds about 4 chunks in adults. [Cowan, BBS, 2001](https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/magical-number-4-in-shortterm-memory-a-reconsideration-of-mental-storage-capacity/44023F1147D4A1D44BDC0AD226838496) Others argue for 5–7. [J. of Cognition, read 2026-10-21](https://journalofcognition.org/articles/387)
- Progressive disclosure: show the frequently needed items first and defer the rest. More than 2 levels usually has low usability. Label the door to the deeper level so people know what is behind it. [Nielsen, NN/g, 2006-12-03](https://www.nngroup.com/articles/progressive-disclosure/)
- Showing correct examples before erroneous ones lowered mental load. [Frontiers in Psychology, 2022-10](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.1032003/pdf)

## 4. Diagnosing together, with the human as judge

- Five-whys is linear, stops wherever the asker chooses, and drifts toward blame. Ask "how" instead. Collect the person's own account ("what were you seeing / trying to achieve?"), play it back to confirm, then turn to forward-looking fixes. [Allspaw, 2014-11-14](https://www.kitchensoap.com/2014/11/14/the-infinite-hows-or-the-dangers-of-the-five-whys/)
- Blameless postmortems assume everyone acted reasonably on what they knew. The record is factual, "things that went poorly", then action items. [Google SRE Workbook ch.10, read 2026-10-21](https://sre.google/workbook/postmortem-culture/); [SRE Book ch.15](https://sre.google/sre-book/postmortem-culture/)
- Socratic debugging: LLMs tend to hand over the answer. TreeInstruct plans a tree of questions based on what the person already knows, so the person finds the bug. Tested only on students. [Kargupta et al., EMNLP Findings 2024](https://arxiv.org/abs/2406.11709)
- In an RCT, people who asked conceptual questions kept learning (~65% on the quiz). Delegating (~39%) and "iterative AI debugging" (~24%) did worst. Overall the AI group scored 50% vs 67% without AI (n=52). [Anthropic, 2026-01-29](https://www.anthropic.com/research/AI-assistance-coding-skills)

## 5. Pitfalls

- Explanations alone do not reduce over-reliance. Cognitive forcing (deciding before you see the AI's answer, waiting, choosing on request) does reduce it, but users liked it least. [Buçinca et al., CSCW 2021](https://arxiv.org/abs/2102.09692) A counter-finding: explanations do help when they make checking cheaper than just trusting the AI. [Vasconcelos et al., CSCW 2023](https://arxiv.org/abs/2212.06823)
- Ironies of GenAI: the user moves from producing to evaluating with too little context. Interruptions and reshuffled workflows cost productivity. Suggested fixes: clear task allocation and task stabilisation. [Simkute et al., 2024-02](https://arxiv.org/abs/2402.11364)
- On AI-authored PRs, human review mostly turns into steering the agent rather than evaluating the code. [arXiv 2605.02273, 2026-05](https://arxiv.org/pdf/2605.02273) (abstract via search only «?»)
- The output-styles docs say Explanatory and Learning give longer answers by design. A style is an instruction, "nothing enforces it". [Claude Code docs, read 2026-10-21](https://code.claude.com/docs/en/output-styles)

## Borrow for our skill

1. **Navigator talks at his level.** Start at the highest level Dima can follow. Drop one level only when he asks or looks lost (Falco). Hold "why" until the end of a layer.
2. **First, ask which mode.** Recall and tour are acceleration-like. Fix is exploration (Barke). One question, then commit to the mode.
3. **≤4 chunks per turn.** Each layer shows at most 4 highlights in plain words (Cowan). Tech details sit behind a labelled door ("details: hooks wiring") and are shown only on request (NN/g, Concise style).
4. **Two levels visible at once.** The current layer plus one named next step, never a full tree (NN/g 2-level rule, CodeTour's primary tour and next tour).
5. **Ask "how", not "why".** In fix mode, start with "what made you feel it's off / what were you seeing?" and play his account back before you dig (Allspaw).
6. **He states his guess first.** Before the agent shows its issue list, Dima names his suspicion in one line, or skips (cognitive forcing, Buçinca). Then the list puts his guess next to the agent's findings.
7. **Issue list in postmortem form.** Each item is a fact, the evidence (file:line), the effect in plain words and one proposed fix. No blame, no history lesson (SRE).
8. **Make checking cheap.** Every claim links to a file and line he can open in one click, so verifying is easier than trusting (Vasconcelos).

## Avoid

1. **Over-explaining.** Explanatory-style essays push an expert into redundant load (expertise reversal). Default to the Concise style and give detail only when asked.
2. **Deciding silently.** The agent must not fix anything outside the decision round. A fix he did not pick is out of scope (task allocation, Simkute). Instructions are not enforced, so check scope before every edit (output-styles note).
3. **Rubber-stamping.** "Approve all?" leads to steering without evaluating (arXiv 2605.02273, Buçinca). Present fixes as named choices with their trade-offs, and keep the batch small.

<!-- end -->
