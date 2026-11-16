---
status: draft
dates: 2026-11-09 → 2026-11-16
tickets: [FRM-556, FRM-562, FRM-567, FRM-573, FRM-618, FRM-628, FRM-632, FRM-635]
tags: [herdr, zoo, base, borrow, shepherdr, chatter, wrong-call]
fed-by: incidents
---

# the zoo base: a feasibility proof that became the foundation, 2026-11-09 → 11-16

times are local (+02:00); transcript times were UTC and are converted. pk-363 = `_clio/pocket/archive/tasks/pk-363 - herder-explore-a-full-move-off-the-desktop-app-mvp-probe.md`, pk-444 = `_clio/pocket/tasks/pk-444 - herdr-foundation-off-the-zoo-base-…md`.

## the story, short

- clio's 11-09 research asked whether anyone had built a rendered chat in herdr. herdr-zoo was the answer: proof that it could be done. clio turned that proof into the base without grading it: «fork Zoo's chat into our own panel» (grill round 1, Q2, 11-09 18:03, `~/.local/state/crow/packets/202611091826/packet.md:230`)
- zoo at the time: one author, first commit 11-02, 0 stars, no tests, no CI, grade C (graded only on 11-16, `docs/research/herdr-collie-ovis.md:159-160`)
- dima doubted it three times (11-10 21:52, 11-11 00:13, 11-11 20:42). each time the zoo-derived chat was kept
- 11-16: «zoo was the wrong foundation» (PK-444:W6). a code read found 6 of our 7 herdr mods are zoo code under our names. the plan changed to a new chat built in egg-basket, herdr's Terminals tabs cloned, parts borrowed from shepherdr, and zoo's leftovers cut

## the numbers (11-16, `.scratch/herdr-lane-2/cuts/zoo-debt.md:12-20`, code and git only, the app was not run)

- share of each mod that is still zoo's code, word for word: chat 44 % (12,624 lines, 89 % of zoo's chat still in it), agents list 80 %, terminal header 36 %, chat header 30 %, status 28 %, tabs 17 %, deck 0 % (written fresh)
- the chat is one class in one file of about 8,700 lines, and no test can reach it (`zoo-debt.md:27`). every redraw rebuilds the whole conversation (`:28`). type errors: 467 copied in on 11-10 (commit `049b2303` body), 574 today (`zoo-debt.md:12`)
- kept as is: about 2,300 lines in 20 small tested chat files (`zoo-debt.md:67`, `:75`)
- frame: herdr's Terminals layout is 49 lines; ours is 344 and began as zoo's (`.scratch/herdr-lane-2/cuts/terminals-borrow.md:19-21`)
- 260 commits touched `home/.config/herdr-app/mods` since 11-08 (`git log --since=2026-11-08 --oneline -- home/.config/herdr-app/mods | wc -l`, 11-16). about +36.8k / −11.2k lines (summed from `--shortstat`, so approximate). not all of it is zoo-derived: the deck is fresh
- 173 of those commits touched the chat (`x-herdr-chatter` or `fleet-chatter`). they cite 24 distinct tickets, FRM-519 to FRM-635
- the herdr-lane-2 plan (`~/.local/state/x/lanes/herdr-lane-2/lane-plan.md`, 11-16 17:40) names 17 distinct tickets. 8 of them sit on lines that name the chat
- his hours spent on zoo-derived parts: not checked, no source counts them

## the arc, by date

- **11-09 16:39, the brief.** clio's research brief, vector 3, asks for «any project that already did this»: a feasibility question, not a base hunt (`~/.local/share/research-lanes/herdr/2026-11-09-round-1/brief.md:22`). the lane's answer: «a real Herdr Desktop chat pane has been built: Herdr Zoo» (`…/parallel.md:24`). shepherdr is not in any round-1 file (grep, 0 hits)
- **11-09 16:53, told to dima.** clio: «someone already built one last week … Herdr Zoo already shows a live Claude Code session as a chat» (clio transcript `58db26e0…jsonl`, 14:53Z)
- **11-09 17:28.** a helper's read of zoo covered safety only: «Verdict: safe to install on mac» (`…/zoo-read.md:3`). it graded nothing: no tests, authors or age were looked at
- **11-09 17:33 → 17:43, installed.** clio printed the install fence, and dima ran it in rex (`~/.local/state/clio/prompts/2026-11-09.md:177`). probe 1 patched zoo's chat in place (pk-363:178)
- **11-09 18:03, grill round 1.** clio's pick on Q2: «fork Zoo's chat into our own panel, instead of following its single author» (crow packet 202611091826:230)
- **11-09 18:21, his reply.** «zoo (where we borrow from) - how to gradually reconnect borrowed parts to our own? … i want it to be fully branded as ours» (PK-363:W45). «approve plan» (W54) was for the probe ladder, whose rung 4 reads «Install Herdr Zoo» (pk-363:234)
- **11-09 18:30 → 18:43, grill round 2.** clio's pick on Q8: «claude-chat and agent-board move into our frame source today» (`_clio/.scratch/herdr/grill-2-proposal.md:14`). dima: «i replied to first grill. so i will not reply to second grill» (PK-363:W73)
- **11-10 16:35 → 17:20, taken in.** codie copied zoo's agents list and chat into frame (commits `221ca644`, `049b2303`, FRM-556)
- **11-10 17:08 → 17:13.** clio's line: «keep zoo's tab bar, pane header and status bar» (PK-363:W412). dima: «tabs: ok, let's keep zoo's copy» (W413), «status bar: ok, let's keep zoo's» (W415), «i want everything rebranded, so «zoo» appears nowhere» (W416)
- **11-10 21:52, first doubt.** «zoo could be not a good pick for borrowing» (W672). «what i do not want — that we build around wrong foundation» (W674)
- **11-10 22:04.** clio's pick: «keep ours, move the list» (`grill-chat-1-proposal.md:41-43`). its own notes in the same file: the read was «not wide … it never opened zoo's source» (`:34`) and «zoo was a poor base» (`:73`). dima: «i am lost with a grill» (W704)
- **11-11 00:13, second doubt.** «I actually would be glad if we would start it with this not with Zoo … but we already built around zoo» (W806)
- **11-11 15:50.** dima accepted o14 «keep our column … the fast list waits for herdr» (`prompts/2026-11-11.md:398`)
- **11-11 20:42, third doubt.** «i wish we would start with this chatter as a base instead of zoo» (W1046). clio's next grill still picked «keep our chat and copy their best parts in, piece by piece» (`grill-borrow-1-proposal.md:12`)
- **11-12, renamed.** zoo's parts became `x-herdr-*`, and the docs said zoo was «fully set aside» (commits `a1d31b38` … `6e3eebf7`, codie). the code stayed
- **11-16 14:46 → 17:38, the turn.** a count by name said «no zoo is left», and it was wrong: it was corrected at 14:50 on his word (`cuts-list.md:23`). zoo-debt.md measured the shares (15:08). he approved the new chat in egg-basket (W46, 16:36). the Terminals tab pills landed (`08a772ee`, 17:22). his read of egg-basket: «wow i like egg basket ui MUCH better» (W118)

## the wrong calls, who made each, what it cost

- **clio made a feasibility proof the base** (11-09 18:03, Q2). it was clio's pick. his word W45 called zoo «where we borrow from». no tick of his on Q2 was found in pk-363 or `prompts/2026-11-09.md`. cost: 7 days of building on a grade-C, single-author repo that was one week old
- **clio moved zoo's chat into frame as ours** (11-09, round 2 Q8). it was clio's pick, and he said he would not answer round 2 (W73). codie did the copy (FRM-556). cost: 467 type errors and one 4,677-line class taken in as our code
- **clio kept zoo's clones over herdr's own** (11-10 17:08, W412). it was clio's line, with his tick (W413, W415). cost: today the tabs are replaced by a Terminals clone, and the frame is 344 lines where 49 would do
- **clio answered «wrong foundation?» with «keep ours»** after a read that was not wide (11-10 22:04). it was clio's call. he gave no tick and said he was lost (W704). cost: 6 more days on the zoo-derived chat, and the antenna (FRM-618) was planned on an agents list that is 80 % zoo (`foundation-state.md:32`)
- **«keep our column»** (o14, 11-11 15:50). dima's tick. whose recommendation it was: not found in `prompts/2026-11-11.md:398` (the ask came «from herdr» and carried the herdr codie's 15:42 note). cost: the chat's lag stayed («long-chat lag stays with a», same line)
- **clio kept the zoo chat after his third doubt** (11-11, `grill-borrow-1-proposal.md:12`). it was clio's pick. his answer: not found
- **the rename hid the lineage** (11-12, codie commits). dima asked for the rename himself (W416). the wrong step was saying zoo was «set aside» from names, and the 11-16 «no zoo is left». who said that: not found in `cuts-list.md:23`. cost: he had to catch it himself: «we still have more zoo parts than the count shows» (PK-444:W1)

## his word on it (11-16, pk-444)

- «zoo was the wrong foundation. We started a week ago from zoo, rebranded much of it, and it carries dead weight and poorly written code that codie keeps copying.» (W6, 14:58)
- «I would have been much happier starting from shepherdr, ovis or collie» (W7, 14:58)
- «and now we have a pile of crap borrowed from zoo.» (W32, 15:10)
- «Zoo-level builds are not allowed.» (W30, 15:10)
- «We even planned an antenna built on top of 80% of zoo scrap … Is zoo truly so bad as I predict?» (W35, 15:10)
- clio proposed zoo, and «he never wanted it as the base» (`_clio/.scratch/herdr/foundation-state.md:25`)

## what changed (11-16)

- a new chat is built beside the old one in egg-basket, TypeScript first: «Okay, I approve this move» (W46, o29, 16:36). the plan: «Pull only clean, decided features» (W47) and «New chatter in egg-basket, no crap! SOLID» (W68). the shape is in `_clio/.scratch/herdr/grill-1-proposal.md:17-31`
- the tab bar: «delete zoo crap and wire Terminals version» (W65). the pills landed as `x-herdr-tab-pills` (`08a772ee`, `fea53969`, FRM-635)
- the base is not one product: Terminals as the frame, shepherdr's chat as the model, our deck kept (`foundation-proposal.md:25`). shepherdr stays installed «until … nothing is left to borrow» (W2)
- the cuts were ticked: D2 fleet-board and D3 zoo leftovers (o11, o12, `foundation-state.md:33`). D3 covers 36 dead state folders, 4 zoo keys and `herdr-aside` (`cuts-list.md:122-131`)
- the antenna will not be built on the 80 % zoo list (`foundation-state.md:32`). FRM-628 hardening is held: «do not harden what gets replaced» (`:51`)
- not checked: whether the old chat now takes breakage fixes only (grill-1 Q3). that rule's tick was not found, and two chat commits landed after 16:36 (`b1de3ed5`, `5e4301cd`)

## the lines that keep it away

- a third-party repo proposed as a base, and not as a one-part borrow, gets a grade line in the same ask: age, authors, stars, tests, CI, types (the `docs/research/herdr-bases.md` filter). below the bar it can be a reference, never a base. clio's ask then says «base» or «borrow» in so many words
- «is X still in our code?» is answered by lineage (the first import commit plus the word-for-word share, as `zoo-debt.md` measured it), never by a grep for names. a rename commit says «renamed», never «set aside»
- when dima asks «are we on the wrong foundation?», clio's answer opens with the measured share and a sweep that names its own width, before any «keep» pick

<!-- end -->
