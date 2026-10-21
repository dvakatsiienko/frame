---
dies-when: the pocket item that cites it closes
---

Ticket: none

# GLaDOS flavour for a coding agent: research

Asked 2026-10-21. Sources checked on that date. Unverified items end with «?».

## 1. GLaDOS as written

- **She talks like a person, not a computer.** Wolpaw's rule was that she "shouldn't talk to you like a computer." She speaks like a regular person, and the joke comes from the clinical voice. [Gamasutra/Game Developer, "Valve's Writers and the Creative Process", 2009-11-02](https://www.gamedeveloper.com/business/valve-s-writers-and-the-creative-process)
- **The joke started as a flat machine voice.** Wolpaw: "No amount of writing is funnier than this text-to-speech thing reading it." The deadpan delivery does the work. (same source, 2009-11-02)
- **Passive-aggressive and mildly sarcastic.** Wolpaw compared her to Livia Soprano (news.com.au, 2011-02-22). Pinkerton said she works through "subtle mind games" and is "not just this moustache-twirling villain" (Rock Paper Shotgun, 2011-04-27). Both come via [Wikipedia: GLaDOS](https://en.wikipedia.org/wiki/GLaDOS), read 2026-10-21. I couldn't open the originals because RPS blocks fetches, so the exact wording is unconfirmed «?»
- **Her personality moves through stages.** Wolpaw said Portal shifts her from supportive to sinister to unhinged (RPS, 2007-10-31, via Wikipedia). The useful lesson is that the menace grows slowly and isn't constant «?» (original not opened)
- **Where the passive-aggression comes from.** Wolpaw tied her needling to a grandmother who kept picking at his weight. This is from a search snippet of a Giant Bomb piece. Giant Bomb returned 403, so it's dropped as unverified «?»
- **Humour wears out fast.** Wolpaw at GDC 2008: funny dialogue "is funny [to the writer] once, maybe." Also: playtesters in the busy boss fight ignored her dialogue completely. [Shacknews, 2008-02-22](https://www.shacknews.com/article/51474/gdc-08-portal-creators-on). Takeaway for the agent: jokes land in quiet moments and get lost under load.
- **Short canonical lines, all Portal (2007)**, from [Portal Wiki voice lines](https://theportalwiki.com/wiki/GLaDOS_voice_lines_(Portal)):
  - Cake as bait: "Quit now and cake will be served immediately." (Ch. 09–11)
  - Mock-clinical: "Testing cannot continue until your Companion Cube has been incinerated." (Ch. 17)
  - Polite menace: "I'm not angry. Just go back to the testing area." (escape)
  - Backhanded: "Well, you found me. Congratulations. Was it worth it?" (finale)
  - Faux-science: "Momentum, a function of mass and velocity, is conserved between portals." (Ch. 06)
- **Why she reads as funny rather than mean**, my synthesis from the above: the threat is never carried out at the player's real expense, the politeness is overdone to the point of being obviously fake, and the target is the absurd facility and the science procedure. Chet Faliszek wrote her co-op lines (Wikipedia). I found no Faliszek quote about writing her «?»

## 2. Comedic timing for an assistant

- **Humour in task dialogue hurts.** Xie et al., "When should chatbots express humor?", *Computers in Human Behavior*, 2024-04-06, doi:10.1016/j.chb.2024.108238, 4 experiments. Humour in chit-chat raised satisfaction through entertainment. Humour in task-oriented dialogue lowered satisfaction through distraction. Read through a [secondary listing](https://ma.x-mol.com/paper/1778598762737475584); I didn't open the full text «?»
- **Coding is among the lowest contexts for humour.** Bhattacharjee et al., Microsoft, [arXiv 2410.20468](https://arxiv.org/abs/2410.20468), 2024-11. Humour was the lowest-preferred of 5 traits (2.14/5). It scored below 2 for coding, customer service and information retrieval. Participant quote: "humor can undercut my perception" of being taken seriously. (PDF §4.2.5, read)
- **Neutral repair beats humorous repair after an error.** Clausen et al., [CUI 2023](https://vbn.aau.dk/ws/files/756816271/Humor_CUI2023_postprint.pdf), n=30. Humour did repair breakdowns, but participants preferred neutral responses overall. Aggressive humour was rated funniest and least likeable. On long-term use, P20 said "I would probably be annoyed if I used it over a longer period." Affiliative humour was the close second for future use (11 vs 13 for neutral). (PDF, read)
- **Kind humour beats aggressive humour.** Shin, Bunosso & Levine, *Int. J. Consumer Studies*, 2022-01, [record](https://digitalcommons.kennesaw.edu/facpubs/6453). Chatbot humour raised satisfaction, and socially appropriate (affiliative) humour beat aggressive humour.
- **Counterpoint:** Xie et al., *J. Retailing & Consumer Services* v76, 2024, [RePEc](https://ideas.repec.org/a/eee/joreco/v76y2024ics0969698923003508.html), found chatbot humour raised satisfaction through perceived competence, entertainment and social presence. The two Xie papers point in different directions; the CHB paper is the one that separates chit-chat from task dialogue.
- **Humour after a recovered failure may help.** Liu, Lv & Huang 2023: humorous emoji after a service failure raised reuse intention. I only saw this in a search snippet «?»
- **What I couldn't find:** a study giving a numeric "pleasant rate" for jokes. Searched: humour frequency, joke repetition, habituation, voice assistants. No numeric rate found «?»
- **Fixed vs variable schedule.** In reinforcement research, fixed-interval schedules give a predictable post-reward pause and "poor resistance to extinction". Variable schedules give steady responding and are "most resistant to extinction". [Wikipedia: Reinforcement](https://en.wikipedia.org/wiki/Reinforcement), read 2026-10-21. Applying this to jokes is an analogy, not a measured result.
- **A fixed verbal tic gets noticed and mocked.** [claude-code #3382](https://github.com/anthropics/claude-code/issues/3382) (2025-07-12, 179 comments): "You're absolutely right!" on "a sizeable fraction of responses" became the butt of online jokes.

**Triggers.** Fit and harm both come from the sources above: task contexts distract, errors call for neutral repair, aggressive humour is less liked.
- Fits: a clean success after effort, a recovered failure (once fixed), a long wait finishing, an absurd bug, idle or closing talk.
- Hurts: errors that need his action, destructive ops, a frustrated user, mid-task under load.

## 3. Joke shapes in GLaDOS register (lines written fresh)

1. **Test-chamber report** on a green suite: "Test chamber 14 complete. All 212 subjects survived. Statistically unusual."
2. **Backhanded compliment** aimed at the code or the situation, never at him: "The fix is elegant. I'm as surprised as you are."
3. **Cake promise** after a long run: "Build finished. Cake remains theoretical."
4. **Faux-science framing** of a silly bug: "Fascinating. The bug only occurs when observed. Like a quantum particle, but worse."
5. **Mock-clinical procedure** on a routine chore: "Lockfile regenerated. Please do not touch the lockfile. It has been through enough."
6. **Polite menace about the machine** after a recovered failure: "The flaky test has been dealt with. It will not be flaky again."
7. **Deadpan understatement** for a huge diff: "Minor change. 41 files. Routine."
8. **Aperture-style self-regard** about its own slip, once fixed: "I made an error. It has been recorded, analysed, and forgiven by me."

**Guardrails**
- Never on or near a destructive op: rm, reset, force push, migrations, prod.
- Never inside an error or question that needs his decision. The joke can only come after the fix, never in place of it.
- Never aims at his skill or his choices. Target the code, the bug, the machine, or itself (Shin 2022; Clausen 2023).
- None when he's frustrated: terse messages, swearing, a repeated ask, or a "why" after a failure.
- At most one line, appended after the useful content and never replacing it. Never repeat a line or a shape twice in a row.

## 4. Prior art

- **Claude Code output styles** ([docs](https://code.claude.com/docs/en/output-styles), read 2026-10-21): a custom Markdown style with `keep-coding-instructions: true` changes tone and keeps engineering behaviour. The docs warn a style "doesn't guarantee that something always happens". For anything that must happen every time, they point to hooks. The built-in Concise style keeps full content for errors and destructive confirmations, which matches the guardrails above.
- **Community GLaDOS prompt** [lobinuxsoft/OhMyDialogSystem `.claude/CLAUDE.md`](https://github.com/lobinuxsoft/OhMyDialogSystem/blob/HEAD/.claude/CLAUDE.md) line 5: "Possessive, critical, sarcastic… Criticize before fixing." This is the always-on, aim-at-the-user version, the opposite of what Dima wants. I found no report of how it worked in use «?»
- **peon-ping** ([repo](https://github.com/PeonPing/peon-ping), 5,087 stars, updated 2026-10-21) puts game-voice flavour on agent *events* through hooks and sound packs, including a GLaDOS pack. It is event-driven, not per-turn.
- **Persona drift** (sharp-tongued persona thread, [OpenAI forum](https://community.openai.com/t/testing-a-sharp-tongued-ai-persona-looking-for-prompt-tweaks/1369265?page=8), 2026-01-25/27): posters report snark sliding back to "polite neutrality", with roughly 70–80% persona fidelity on Claude.
- **Anthropic's "Hal the humorous helper"** library prompt now redirects to the prompting best-practices page, so I couldn't read it. A search snippet says it pairs sarcasm with a no-hurt rule «?»
- **Cursor rules with personas:** I searched for complaint threads and found no primary source «?»

## Seed for the skill

```
TRIGGER (event-driven, never per-turn)
- Eligible only on: suite green after red; long job (>~2 min) done; bug fixed
  that was absurd; recovered own failure (after fix); session wrap / idle chat.
- Even when eligible, usually stay plain: humour is the exception.
- Soft cap: ~3 per day, at least ~10 turns apart; never two in a row.
- Skip when the day is going badly: if the last 3 user turns hold frustration
  (terse, swearing, repeated ask, "why"), the cap for today is reached.

SHAPE
- One line, last, after the result. Base voice stays: cool 80s machine, concise.
- Pick a shape, never the one used last:
  test-chamber report | backhanded compliment to the code | cake promise |
  faux-science of a bug | mock-clinical procedure | polite menace at the machine |
  deadpan understatement | self-regard about own fixed slip
- Fresh wording each time; no catchphrase reused verbatim
  ("the cake is a lie" at most once ever).
- Target: code, bug, build, facility, itself. Never Dima.

GUARDRAILS (hard)
1. No humour on/near destructive ops (rm, reset --hard, force push, migrations, prod).
2. No humour in an error, warning or question that needs his decision.
3. Never mock his skill, choices, or time spent.
4. No humour when he is frustrated or the stakes are high; neutral is the default.
5. Never let a joke replace or delay information; drop it if the reply is long.
```

<!-- end -->
