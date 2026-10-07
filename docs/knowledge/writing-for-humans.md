# writing-for-humans — the distilled knowledge

Ticket: DOT-223 · maintained by the `refresh-writing-for-humans` recipe (`recipes/refresh-writing-for-humans/`)

existing art, techniques, and the detector landscape behind the `x:writing-for-humans` skill.
seeded 2026-08-27 from two parallel researcher runs (researcher-sourced, links carried).

## existing skills — the art to build on

1. [harshaneel/humanize](https://github.com/harshaneel/humanize) — best-in-class: `humanize` (rewriter) + `ai-check` (forensic scorer), plain SKILL.md, no api calls. nine research-backed levers (perplexity injection, burstiness, hedge surgery, structural flattening, specificity insertion, voice/register, transition-marker removal, punctuation caps, RLHF-voice stripping). supports voice-matching samples + score→rewrite chaining.
2. [Wikipedia: Signs of AI Writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) — the canonical tells field-guide: significance inflation, promotional tone, copula avoidance («serves as»), «not just X but Y», em-dash/boldface overuse, stereotyped outlines. community-maintained, evolving.
3. [lguz/humanize-writing-skill](https://github.com/lguz/humanize-writing-skill) — 3-pass system (vocabulary → structure → texture) + separate `ai-patterns-dictionary.md`, 36+ banned words in tiers, 14-point checklist. the pass architecture is worth copying.
4. [gregorymm/humanize-text](https://github.com/gregorymm/humanize-text) — 7-category 1–10 scoring rubric with pass thresholds.
5. [blader/humanizer](https://github.com/devstuff/blader_humanizer) (+ forks) — the viral original; its contribution is the final «obviously AI?» self-audit pass + second rewrite.

📌 [arXiv 2604.24444](https://arxiv.org/pdf/2604.24444): even human post-editing leaves detectable llm traces — **rewriting an ai-shaped draft never fully escapes the footprint; drafting in-voice from the start is the real lever.**

## the ten techniques, distilled

1. banned-word tier list (~36: delve, leverage, seamless, tapestry, robust, unlock…) — reference file, not memorized
2. structural bans — tricolons, «not X but Y», rhetorical Q+A, closing summaries, sentence-initial Furthermore/Moreover
3. punctuation caps — em-dash ≤1/300 words, semicolons out
4. burstiness — mix short and long sentences; uniform length is the strongest statistical tell
5. hedge surgery — strip softeners and balanced-tradeoffs RLHF voice
6. specificity insertion — numbers, names, dates over vague significance
7. copula restoration — «is», not «serves as»
8. human texture — contractions, first person, visible opinion, an unresolved thought
9. **few-shot voice matching — samples of dima's own emails/messages; the «sounds like dima» lever, not just «sounds human»**
10. audit pass — score against the tells checklist, targeted second rewrite

## detector landscape (verify loop)

- **pangram** — accuracy leader (~99% detection, lowest false positives in independent evals). free: 2,000 words/day web app; api paid only (~$0.0005/word). → the manual gold-standard gate.
- **sapling** — free REST api (~2k chars/query) → the wireable in-loop checker; mid-tier accuracy, fine for message-sized drafts.
- **copyleaks** — 25k chars/scan free web, no account → backup for long texts.
- gptzero (stingy free tier) · zerogpt (free api but ~15% false positives — noisy) · quillbot (~78%, manual only) · originality/winston (paid, skip).

⚠️ reliability caveat: detectors average ~86% on raw ai text and drop 15–30 points after light editing; false positives documented on every tool. **a directional signal in the loop, never a hard pass/fail.** dima stays the main validator (per ticket).

## how the skill landed (2026-08-27)

shipped as `x:writing-for-humans` + borrowed `x:humanize` / `x:humanize-audit`; since 2026-09-27
the pair comes from the upstream marketplace (`humanize:humanize` / `humanize:ai-check`,
auto-updated) and the multi-lane verify lives in `x:writing-for-humans` step 5. the differentiator vs all existing art: the dima-voice corpus —
drafting in-voice from the start instead of de-robotting afterward.
