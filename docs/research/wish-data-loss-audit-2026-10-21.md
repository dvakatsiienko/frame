---
dies-when: the pm revamp (PK-103) folds its numbers and the weekly wish-loss audit replaces it
---

Ticket: none (pocket PK-240, PK-103)

# wish data-loss audit: where dima's inbox points are lost, L0 → L4

audit run 2026-10-21, read-only. 8 inbox items from 10-15 … 10-21, each worked to L4. 139 atomic points in total.

## method and sources

- **L0, raw.** For 10-15/16/19/20/21 this comes from tool results that printed `_hq/inbox.md` at boot (`cat` / Read). The transcript files and timestamps are named per item.
  - forked transcripts repeat the same results; I deduped by timestamp
  - **10-18:** no transcript printed the raw `inbox.md`. L0 is the composer's `> [!quote]- original` blocks, printed by a Read of `inbox-composer.md` (a9a89164…jsonl, 2026-10-18T13:39:01Z). That they are verbatim is assumed «?»
- **L1, composer prep.** The groomed bullets in the same `inbox-composer.md` prints.
- **L2, pocket.** The description and notes **as first committed**, by `git show <first sha>:<file>`.
  - every current description was diffed against its first commit
  - only PK-142's «waiting for» line differs
- **L3, ticket.** `x linear read`. Only PK-214 (BYT-98) and PK-215 (FRM-401) have one.
- **L4, use.** The **first** artifact the work ran on: a grill round, a researcher brief, a skill file or a commit. If a later round restored a point, the point is marked «→ recovered» but still counted at its first-use state.
- **marks:** kept · weakened · lost · moved (→ item) · n/a. A point with no source either way is «?» and is left out of the totals.
- **point size:** one want, ask, constraint, example or reason per point. This split is finer than cclio's own («~14 points», 2026-10-21T13:47Z), so PK-173 has 27 here.

---

## 1. PK-173: intervention skill / dima-in-action (wish 10-18, worked 10-21), the calibration case

- L0: the composer quote, 10-18 (a9a89164…jsonl 2026-10-18T13:39:01Z, file lines 193–228)
- L1: the same file, W4 bullets, lines 150–163
- L2: `pk-173 …md` at 1c9d3d02 (2026-10-18 17:09)
- L3: none
- L4: grill round 1, 2026-10-21T13:32:39Z (the want quote plus Q1–Q6) in ac1fc79f…jsonl

- P1 «pairs with catch-up» — L1 weakened (only «optionally merged into catch-up») · L2 kept · L3 n/a · L4 kept (Q1) (summary-compression at L1)
- P2 «i propose rename catch-up to «sup»» — L1 lost · L2 kept · L3 n/a · L4 kept (Q2) (dropped proposal; the composer trial confirms it, `docs/test-drive/composer-inbox-prep.md` round 3, 10-18)
- P3 «dima spots that something is off in a given area (any part)» — L1 kept · L2 kept · L3 n/a · L4 kept
- P4 «suspected unfounded issues negatively influence our system … wants to hunt them» — kept · kept · n/a · kept
- P5 «dima forgot/lost the grasp over certain area» — kept · kept · n/a · kept
- P6 «strong capabilities but … often overloaded» — kept · kept · n/a · kept
- P7 «you, cclio have to want to help him … clarity of his understanding directly influences prompts … your output is influenced by prompts» — L1 kept · L2 kept · L3 n/a · L4 lost (dropped why). Round 2 later listed it as «settled by the wish itself» (2026-10-21T13:49:23Z)
- P8 «willingful and participative to help him understand, cover what he forgot» — kept · kept · n/a · L4 weakened (only «Help me understand») (summary-compression)
- P9 «smoothly introduce into unexplored areas … mods source, x cli source» — kept · kept · n/a · L4 lost (summary-compression). Cclio confirmed this one at 2026-10-21T13:42:26Z → recovered as Q7 in round 2
- P10 «do you want to recive better prompts and function well yourself?» (you gain too) — L1 kept · L2 weakened (reframed as «prompts shape your output»; the gain clause sits in the notes only) · L3 n/a · L4 lost (dropped why) → recovered in round 2
- P11 «hard for him to process large volumes of information fast. his brain have to chill» — L1 weakened («my brain needs to rest») · L2 kept (notes) · L3 n/a · L4 weakened (folded into «capable but overloaded») (summary-compression)
- P12 «he also just curious. and sometimes interested to know things» — kept · kept · n/a · L4 lost (dropped why) → recovered in the want v2 (13:42Z)
- P13 «essentially what catchup currently does but assumes an action … «intervention» part, where i go with you and fix» — kept · kept · n/a · kept
- P14 «optionally merged into catch-up. skill name to be revisited via shape-idea» — kept · kept · n/a · kept (Q1, Q2)
- P15 «pm module turned into drifted state … cluttering resolved … but not the shape and flows contracts clarity» — kept · kept · n/a · L4 weakened (Q6 names the pm module; the clutter-vs-contract diagnosis is dropped) (dropped example)
- P16 «start from top lvl highlights … few turns. not too many» — kept · kept · n/a · kept (Q4)
- P17 the tl;dr flow «ask around, tell concerns → … → plan a fix → fix» — kept · kept · n/a · kept (want + Q3)
- P18 «gradual zooming-in … zoom more if needed» — kept · kept · n/a · kept
- P19 «you are a tornado tactic, me — strategist» — kept · kept · n/a · kept
- P20 the video link `youtube.com/shorts/Vo33extKAeA` — L1 lost · L2 kept · L3 n/a · L4 lost (dropped example/link)
- P21 «the skill is intended to unfold an area for my vision and understanding, to review strategically» — L1 kept · L2 lost · L3 n/a · L4 lost (dropped why). Cclio confirmed it at 13:42:26Z
- P22 «the system changes too fast, my capacity … is limited. a good fix requires proper understanding» — kept · kept · n/a · L4 lost (dropped why). Dima re-supplied it at 2026-10-21T13:41:37Z
- P23 «your role is to pair program with me in assistive mode» — kept · kept · n/a · L4 weakened (in the want; no question until Q8 of round 2) (dropped question)
- P24 the pm list «review your all pm flows from a to b, including lane closing … weak parts, gaps … shortcuts, cut redundancies» — L1 kept · L2 moved (→ PK-103 notes, written 10-18 at 1c9d3d02) · L3 n/a · L4 moved (Q6 → PK-103)
- P25 «your pm and colors/lead flows needs sharpening» — L1 weakened (misheard word, kept as «(?)») · L2 moved (→ PK-103, corrected to «coord/lead») · L3 n/a · L4 moved
- P26 «create new or upgrade catch-up skill — try new skill on a problem right away» — kept · kept · n/a · kept (Q1, Q6)
- P27 «use shape idea over all parts … no test drive for a skill» — kept · kept · n/a · kept

**Calibration:** L2 lost 1/27 (4 %) and weakened 1 (4 %), against the known ~10 %. L4 lost 7/27 (26 %) and weakened 4 (15 %); together 41 %, against the known ~35 %. Cclio's own count, 2026-10-21T13:47:44Z: «pocket fold ~10 %», «round-1 want quote ~30 %», «grill ~35 %». Same range; the gap comes from the finer split.

## 2. PK-172: visualization tool (wish 10-18, worked 10-18)

- L0: the composer quote, W4 part 2 plus S1 (a9a89164…jsonl 2026-10-18T13:39:01Z, lines 43, 230–273)
- L2: archive `pk-172 …md` at 1c9d3d02
- L3: none
- L4: the want in `_clio/blueprints/PRODUCT.md` (first commit d764aa12, 10-18 18:40), grill round 1 (2026-10-18T14:10:11Z) and the research top 7 (2026-10-18T14:25:44Z)

- V1 «i lack such a tool … i want a tool like this for a long time» — kept · kept · n/a · kept
- V2 «me: let's review and shake your pm module → you: draw … → i see visually» — kept · kept · n/a · kept
- V3 «why not artifacts/diagrams? … basic and too scoped … no editing/collab» — kept · kept · n/a · kept
- V4 «fast, cheap to edit/read (for you) — no heavy clunky mcp» — kept · kept · n/a · kept
- V5 «easy for you to visualize any topic» — kept · kept · n/a · kept
- V6 «edit visualization by dragging/editing connectors» — kept · kept · n/a · kept (Q4)
- V7 «ideally it should look pretty» — kept · kept · n/a · kept (Q7)
- V8 «solid, work well, alive, not dead» — kept · kept · n/a · kept
- V9 «next gen, agentic friendly» — kept · kept · n/a · kept
- V10 «free or generous free tier» — kept · kept · n/a · kept (Q2)
- V11 «prototyping/reviewing our areas … doc companion … workflow spec» — kept · kept · n/a · kept
- V12 «draw a flow → show you → grill → implement; drawn flow → i edit → …» — kept · kept · n/a · kept
- V13 «excalidraw … from what i saw have a cli. to check if» — kept · kept · n/a · L4 lost (dropped question). The top 7 rates Excalidraw on layout only, and no 10-18 reply or blueprints doc answers the cli question; the research-lane output files were not opened «?»
- V14 «n8n — a high ceiling … probably overkill. or not?» — kept · kept · n/a · kept
- V15 «a middle ground between excalidraw and n8n» — kept · kept · n/a · kept
- V16 «can n8n be used locally only for free?» — kept · kept · n/a · kept (14:25Z: community edition free to self-host)
- V17 «interested in any other similar tools» — kept · kept · n/a · kept
- V18 «can [openui] help? … what does it do? … report about everything at once» — kept · kept · n/a · kept (14:25Z)
- V19 «shape-idea … print top 7 candidates to test drive» — kept · kept · n/a · kept
- V20 «memory system … if visually it looks intertwined, its not good … more linear … better» — kept · kept · n/a · kept
- V21 «tool should be helpful for you too. that's why i recalled n8n» — kept · kept · n/a · kept
- V22 «your flows visualized (n8n-like), and edit them … show you ideas» — kept · kept · n/a · kept
- V23 «core comms points … cooms between humans and agents are flawed» — kept · kept · n/a · kept
- V24 «aha moments … Do you yourself have such moments?» — kept · kept (notes) · n/a · kept (10-18 reply: «my aha moments: real, but small»)
- V25 «automate … 50/50 … translated to mods … n8n is slow … not fully discard» — kept · kept · n/a · kept (Q1)
- V26 side wish «update shape-idea … ranked ⭐⭐⭐⭐⭐ list — 7 items» — kept · moved (→ PK-174) · n/a · moved (PK-174 done 10-18)
- V27 «shape-test-drive over visualization part» — kept · kept · n/a · kept (2-week trial)
- V28 S1 «optionally shaping a recipe … refresh-visualization-cooms-tools» — kept («sic») · kept · n/a · kept (recipe refresh-blueprint-comms)
- V29 S1 «schema-diagram based … or mindmap-type, or any other» — kept · kept · n/a · L4 weakened (no mindmap-type candidate in the top 7) (dropped example)
- V30 S1 «maybe we build something custom (hopefully not)» — kept · kept · n/a · «?» (no source either way; not counted)

## 3. PK-175: memory structure rethink (wish 10-18, grilled 10-21)

- L0: the S1 quote line 48 (same 10-18 print)
- L2: `pk-175 …md` at 1c9d3d02
- L4: grill rounds 1–2, 2026-10-21T13:22:51Z and 13:28:49Z

- M1 «rethink how your memory actually structurized» — kept · kept · n/a · kept
- M2 «during memory sweep we only did grooming/trimming, and slightly sliced off few … like crew-lead» — kept · kept · n/a · L4 weakened (the context the rethink answers is gone; Q4 instead makes it a sweep step) (dropped why)
- M3 «we did not rethough your memory via another angle» — kept · kept · n/a · L4 weakened (the angle narrowed to load moment) (summary-compression)
- M4 «are all your memories modularized properly?» — kept · kept · n/a · L4 lost (dropped question). Ccrow, 2026-10-21T13:48:31Z: «"modularized" got no question» → recovered as round-2 «Q8» (13:49:23Z)
- M5 «e.g. balances acroos files well?» — kept · kept · n/a · kept (Q1 offered moment/size/topic; dima picked moment)
- M6 «pocket this item for review» — kept · kept · n/a · kept
- M7 «hint: this is where visualization tool could help» — kept · kept · n/a · kept (Q3, maps drawn)

## 4. PK-196 (+ PK-195): cw memory, the output-format switch (wish 10-19, worked 10-20)

- L0: `inbox.md` print, 10fad16c…jsonl 2026-10-19T12:14:40Z
- L1: composer W2, printed 12:17:01Z
- L2: archive `pk-196 …md` at first commit 102bea0a (10-19 16:00)
- L4: commit d24b74bb (2026-10-20 15:42) «rules: no board in reach → the asks fence, cw included», plus the pocket note «15:45 checked first»

- C1 «the diffs after that are uncommitted. review them, verify … and commit» — kept · moved (→ PK-195) · n/a · moved (PK-195's own L4 not traced «?»)
- C2 «solve cw pbcopy block» — kept · kept (verbatim, unexplained) · n/a · L4 weakened (never defined; the note says only that the pbcopy pipe exists) (misheard/opaque word «?»)
- C3 «before … Orbit mod, we were communicating via a "Waiting for your word" copy-pasted block» — kept · kept · n/a · kept
- C4 «you moved that into a mobile comms skill … since Mods doesn't work on mobile» — kept · kept · n/a · kept
- C5 «switch out of using mods like Orbit and Phases … fall back to previews» — kept · L2 weakened (missing from the description; the first-commit note reads «restored from the raw») · n/a · kept (the note says x-mod-stash 52408b84 solved it 10-13; that commit was not opened «?») (summary-compression)
- C6 «switch to print those "Waiting for your word" blocks too» — kept · kept · n/a · kept
- C7 «Mobile mode is untested … I still didn't test if that mobile-mode skill works well» — kept · kept · n/a · L4 lost (dropped ask: git history was checked, no test was run)
- C8 «mod-related habits and Orbit usage instructions in memory are scattered across a few places» — kept · kept · n/a · L4 weakened (one line reworded; the scatter was not audited) (summary-compression)
- C9 «When I get back to the keyboard on desktop, you should switch back to Mods and undo what this skill asks» — kept · kept · n/a · L4 weakened (the way back is not in the commit) (dropped constraint)
- C10 «coWork threads should work in waiting-for-your-word block mode always but not full mobile mode» — kept · kept · n/a · kept («cw always»)
- C11 «Skill content should apply to cowork memory-only reply format» — kept · kept · n/a · kept
- C12 «What I want the least is to start collating memory with stray instructions again» — kept · kept · n/a · kept («reworded in place … no new line, no copy»)
- C13 «how to gracefully solve this output format switch … for everyone» — kept · kept · n/a · kept
- **Side evidence, not counted.** Dima's 10-20 follow-up on the same subject (PK-209) lost a want at L2: PK-196's 14:52 note reads «its fold dropped his want — cw threads have no orbit, so they should print that block». Wishkeeper flagged it high, fdf67e5f…jsonl ~10-20 line «PK-209 was closed, but dima never got the answer».

## 5. PK-214: install graphite (wish 10-20, worked 10-20)

- L0: `inbox.md` print, fdf67e5f…jsonl 2026-10-20T11:00:52Z
- L1: composer W2, printed 11:04:53Z
- L2: archive `pk-214 …md`, first commit e2f7ca86 (10-20 14:44)
- L3: BYT-98, read 2026-10-21. Its 10-20 «dima notes» fold
- L4: the researcher brief «Graphite state and stacked PRs research», 2026-10-20T11:12:17Z
- dima dropped graphite at 16:41 the same day (pocket note), so the trial points after research are «not run by his call», not lost

- G1 «test drive stays parked for too long. let's install graphite … 1–2 weeks … gh stacks native switch» — kept · kept · kept · kept
- G2 «research of graphite's state. how it stands? is it alive?» — kept · kept · kept · kept
- G3 «i saw cursor bought it … does this means graphite will die» — L1 weakened (ask 12 states it as fact) · L2 weakened (wishkeeper low finding 2026-10-20T11:06Z: «His hedge turned into a stated fact», fixed before the commit) · L3 kept · L4 weakened («Cursor's acquisition») (hedge dropped)
- G4 «how it does overall compared to other similar tools?» — kept · kept · kept · kept
- G5 «eval/measure graphite's adversary code reviewer and stacked PR's» — kept · kept · kept (the adversary vector) · L4 weakened (the reviewer appears only as «what did the acquisition change … the AI reviewer») (summary-compression)
- G6 «test drive for 1 or 2 weeks (if there will be not enough data after first week)» — kept · kept · L3 weakened («first multi-layer coder job») · L4 kept
- G7 «switch to gh stacks for immediate A/B … while traces and experience are hot» — kept · kept · kept · kept
- G8 «we setted up standard gh PR-based flow so far, stackes are different» — kept · kept · L3 lost (dropped constraint) · L4 kept (the brief's context)
- G9 «how to properly use stacked PR's, while not loosing an expertise with basic PR flow?» — kept · kept · L3 lost · L4 lost (dropped question)
- G10 «what are the tricks and potential issues?» — kept · kept · L3 lost (dropped question) · L4 kept (pitfalls)
- G11 «our hazard, «known issues», cli tricks are sharpened against plain standard PR's» — kept · kept · L3 lost · L4 lost (dropped question) → recovered in the pr-flow opus lane (2026-10-20T13:18:32Z reads `fleet-hazards.md`)
- G12 «stacked PR's are somewhat exotic still. how much it will hurt» — kept · kept · L3 lost · L4 lost (dropped question). Recovered later: `recipes/refresh-pr-flow/last/brief.md` quotes it
- G13 «what are actual gains out of stacked PR's for us?» — kept · kept · L3 lost (dropped question) · L4 kept (Q5)
- G14 «is our CI compatible with stacked PR's at all?» — kept · kept · kept · kept (Q4)
- G15 «a recipe like «refresh-stacked-pr» won't hurt» — kept · kept · kept · kept (recipe refresh-pr-flow)
- G16 «how to properly use stacked PR's with agents?» — kept · kept · L3 weakened («agent fit») · L4 kept
- G17 «stacked pr's agentic power usage best practices» — kept · kept · L3 lost (dropped question) · L4 kept
- G18 «… tips and tricks» — kept · kept · L3 lost (dropped question) · L4 kept
- G19 «supportive complementary tools — what do you want to have» — kept · kept · L3 lost (dropped question) · L4 kept (Q6)
- G20 «any skill would be useful?» — kept · kept · L3 lost (dropped question) · L4 kept
- G21 «propose your's» — kept · kept · L3 lost (dropped question) · L4 kept

## 6. PK-215: the code-review human gate (wish 10-20, worked 10-20)

- L0: the same 10-20 print
- L1: composer W3
- L2: archive `pk-215 …md` at e2f7ca86
- L3: FRM-401, read 2026-10-21
- L4: the researcher brief «Anthropic code-review post vs our gate», 2026-10-20T11:12:26Z, and `docs/research/code-review-human-gate.md`

- R1 «read [this doc](…solving-code-review-at-anthropic/)» — kept · kept · kept · kept («read in full via web-bot-blocked:fetch on 2026-10-20»)
- R2 «[video](…d8QpDbBKbAU…)» — kept · kept · kept · kept («auto-subs read via yt-dlp»)
- R3 «compare ideas to our system» — kept · kept · L3 weakened · kept (summary-compression)
- R4 «borrow, or … flow simplification/unloading some burdens, reduce time for repeating operations» — kept · kept · L3 weakened · kept (summary-compression)
- R5 «i asked you to only merge after i press «approved»» — kept · kept · kept · kept
- R6 «i actually never do the code review, and simply press «approved» blindly» — kept · kept · kept · kept (FRM-401 exit 7, the want line)
- R7 «this gate presence have nearly none value» — kept · kept · kept · kept
- R8 «propose how to simplify/optimize» — kept · kept · kept · kept
- R9 «suggest if is ok to delete that human gate» — kept · kept · kept · kept
- R10 «propose other parts of our system worth to optimize» — kept · kept · L3 lost (pocket note: «sit in the doc's point 9, out of FRM-401 by its «out» line») · L4 kept (the doc proposes them) (dropped constraint/scope)

## 7. PK-230: glados mode (wish 10-21, worked 10-21)

- L0: `inbox.md` print, ac1fc79f…jsonl 2026-10-21T10:52:48Z, lines 112–115
- L1: composer A2, 10:54:59Z
- L2: `pk-230 …md` at cb993e63
- L4: researcher brief «Research GLaDOS voice for a skill», 2026-10-21T12:21:49Z, and the pocket note 15:26

- D1 «Glados mode on» — kept · kept · n/a · kept
- D2 «our conversation would be more colorful and alive» — kept · kept · n/a · kept
- D3 «a slight degree of humor» — kept · kept · n/a · kept
- D4 «do not do anything destructive to my system as Glados would do» — kept · kept · n/a · kept
- D5 «How to create a really good communication output skill» — kept · kept · n/a · kept
- D6 «the jokes are good when they are occasional» — kept · kept · n/a · kept
- D7 «set an interval … I would then recognize this interval via feeling» — kept · kept · n/a · kept
- D8 «not too much because we still have to solve quite a lot» — kept · kept · n/a · kept
- D9 «enough to make my day slightly brighter» — kept · kept · n/a · kept
- D10 «research about Glados's character qualities and character descriptions» — kept · kept · n/a · kept
- D11 «communication patterns, including jokes» — kept · kept · n/a · kept
- D12 «To seed a skill?» — kept · kept · n/a · kept
- D13 «Let's do a quick shape idea over it too» — kept · kept · n/a · n/a (not run yet: «next: shape-idea at the mac»)
- D14 «Do you want to do quick research…?» (asks cclio's view) — kept · kept («cclio's answer to his question: yes») · n/a · kept

## 8. PK-142: the remind/recall skill → catch-up (wish 10-15, built 10-15)

- L0: `inbox.md` print, cf0b9766…jsonl 2026-10-15T10:56:12Z, I1 and Q2
- L1: composer, 11:01:50Z
- L2: `pk-142 …md` at ba68a5d3 (10-15 16:06)
- L4: the shape-idea want and grill (2026-10-15T16:24:50Z–16:33Z) and `catch-up/SKILL.md` at 494670ac (10-15 19:38)

- C1 «i often ask you to «remind me how this or that works». this deserves its own skill» — kept · kept · n/a · kept
- C2 «a dedicated, recognizable name» — kept · kept · n/a · kept (catch-up)
- C3 «good output format, that should be parked in a skill itself» — kept · kept · n/a · kept
- C4 «our system grows fast and changes fast» — kept · kept · n/a · kept
- C5 «i have no capacity to keep up with everything» — kept · kept · n/a · kept
- C6 «i am curious and want to know how our system works to properly steer its optimization» — kept · kept · n/a · L4 weakened (the skill keeps «steers better», drops curious) (dropped why)
- C7 «be interested to help me learn and explore those areas» — kept · kept · n/a · kept
- C8 «optionally pipe response through «matt's teach skill», but output format is custom» — kept · kept · n/a · L4 weakened (grill: «Matt's teach skill isn't installed here», swapped for `anthropic-skills:learn`'s ladder; the 10-15 SKILL.md has no teach). The teach file's birth time is 2026-10-20 19:31 (local), so the 10-15 claim is plausible. Recovered in `dima-intervenes/SKILL.md:66` (10-21) (dropped constraint)
- C9 «help me to catch me up with where we are» — kept · kept · n/a · kept (the 🆕 line)
- C10 «no need to print a whole manual» — kept · kept · n/a · kept (≤ ~1,500 chars)
- C11 «no tech details until needed or until i ask to go deeper» — kept · kept · n/a · kept
- C12 «print actual answer what i asked to remind about» — kept · kept · n/a · kept
- C13 «add slightly wider outline-description of an area» — kept · kept · n/a · kept (3–5 neighbour parts)
- C14 «collaborative … invitive … wider/deeper» — kept · kept · n/a · kept (routes)
- C15 «lite emojis» — kept · kept · n/a · kept
- C16 «when applicable dense emojis, like in emoji battle skill» — kept · kept · n/a · kept
- C17 «clean, easy to read» — kept · kept · n/a · kept
- C18 (Q2) «let's keep «remind» only to set a reminder» — kept · kept · n/a · kept («not for setting a reminder (that is x:remind)»)
- C19 (Q2) «recall? or that's different eng translation?» — kept · kept (name options) · n/a · «?» (no answer found; not counted)
- **L1 note:** the composer filed the rhetorical «why i ask you to remind?» as an ask. That is noise, not a loss (composer trial round 1, 10-15: «two rhetorical «why i ask?» lines counted»).

---

## totals: 8 items, 139 points (L4 has 138: one n/a; two «?» are left out of all totals)

| layer | rated | kept | weakened | lost | moved |
|---|---|---|---|---|---|
| L1 composer | 139 | 133 (95.7 %) | 4 (2.9 %) | 2 (1.4 %) | 0 |
| L2 pocket | 139 | 131 (94.2 %) | 3 (2.2 %) | 1 (0.7 %) | 4 (2.9 %) |
| L3 ticket (2 items only) | 31 | 15 (48.4 %) | 4 (12.9 %) | 12 (38.7 %) | 0 |
| L4 first use | 138 | 107 (77.5 %) | 14 (10.1 %) | 13 (9.4 %) | 4 (2.9 %) |

- **Where:** L4 holds 27 of the 53 non-kept marks, and every L4 loss happened after an L2 that still held the point. The drop is between the pocket and the grill or brief written from it.
  - L3 loses a lot, but only on BYT-98: a pre-existing 09-11 ticket that took the 10-20 wish as a 3-item note
  - for PK-215, L3 lost only the deliberately scoped-out «other parts»
- **Which wishes:** long prose wishes lose the most. PK-173 has 7 of the 13 L4 losses.
  - numbered or list-shaped wishes (glados, the code-review gate, graphite's caveats) lose least, except where a brief re-asks in its own words
  - PK-172 lost little: its first use printed the want nearly whole into `PRODUCT.md`
- **Who caught it:** checkers caught the L2 losses at boot (wishkeeper: G3, the PK-209 fold; a «restored from the raw» note on C5). The L4 losses were caught by dima (PK-173, 2026-10-21T13:41Z) and by ccrow (PK-175, 13:48Z), not by a boot check.

## the 3 loss shapes that cost the most points (all layers; L4-only count in brackets)

1. **dropped question/ask: 18 points (L4: 7).** A question or ask in his text never reaches a question in the grill or a vector in the brief.
   - «are all your memories modularized properly?»: PK-175 grill rounds 1–2 asked about balance, scope, maps, sweep step and timing, never this. Ccrow flagged it 2026-10-21T13:48Z
   - «how to properly use stacked PR's, while not loosing an expertise with basic PR flow?»: PK-214. Absent from the 2026-10-20T11:12Z brief and from BYT-98
2. **summary-compression: 13 points (L4: 6).** A re-summary in cclio's words merges or blurs a want.
   - «smoothly introduce into unexplored areas. areas examples: mods source, x cli source…»: the PK-173 round-1 want (2026-10-21T13:32Z) has only «Help me understand: introduce the area gradually»
   - «eval/measure graphite's adversary code reviewer»: the PK-214 brief has only «what did Cursor's acquisition change (… the AI reviewer)»
3. **dropped why: 9 points (L4: 7).** A reason or motivation goes while the what stays.
   - «think yourself: do you want to recive better prompts and function well yourself?»: PK-173. Missing from the round-1 want
   - «the system changes too fast, my capacity of understanding all parts is limited. a good fix requres proper understanding of an area to fix»: PK-173. Missing from the round-1 want; dima typed it again at 2026-10-21T13:41Z

**Smaller shapes:** dropped constraint 4, dropped example/link 4, hedge dropped 3 (G3 at L1, L2 and L4), misheard/opaque word 2 («colors/lead», «cw pbcopy block»). Moved or split points (4 at L2, 4 at L4) all re-joined: PK-103 and PK-174 hold them, and PK-173's Q6 points at PK-103.

## could not verify

- **10-17:** no transcript I scanned (jsonl modified ≥ 10-15) printed the inbox on 10-17. That day is not sampled.
- **10-18 raw:** `inbox.md` was never printed by a tool result. L0 is the composer's «original» quotes, assumed verbatim «?».
- **10-16:** not sampled. Its long wish (W1, the cclio benchmark → PK-159) is still open and has no L4 «?».
- PK-195 (C1, the cw-diff review): its L4 was not traced.
- «solve cw pbcopy block»: what dima meant is not in any source I opened.
- PK-196 C5: the claim that x-mod-stash 52408b84 already handles mobile mode comes from a pocket note; the commit was not opened.
- PK-172 V13: whether the 10-18 research lanes answered «does excalidraw have a cli»; their output files were not opened. V30 («build custom») has no source either way.
- PK-142 C19: the remind-vs-recall answer was not found.
- The shape labels are my reading. Each point has one primary shape.

<!-- end -->
