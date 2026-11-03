Ticket: none
dies-when: the plan pick for 11-05 is made and folded into memory

# claude plans, 2026-11 — the rename and what to buy

seen 2026-11-03. "primary" = anthropic / claude.com / support.claude.com / platform docs. help pages say only "updated this week", no exact date.

## verdict for dima

- buy the $200 plan, now called **ultra**. it fixes your real bottleneck, which is the 5-hour window. weekly is not your bottleneck (29 % mid-week).
- ultra (verified account): no 5-hour limit at all, 10x pro per week. max ($100): 5x pro per 5 hours, 5x pro per week. so on ultra the 5-hour wall goes away and the weekly cap is 2x yours.
- the one number that decides it: your weekly use on max is ~29 % mid-week, so maybe ~60 % at week end. on ultra that same work is ~30 % of the weekly cap, so you have ~3x headroom before the weekly cap starts to bite.
- easier path: turn auto-renew back on and upgrade max → ultra before 11-05. the upgrade is prorated. if you let max lapse and buy fresh, ultra's "temporary 5-hour limit until verified" might apply to you (unconfirmed whether a lapse resets verification).
- after you upgrade, check settings > usage. if there's still a "current session" bar, you aren't verified yet and the 5-hour limit still applies.
- fable 5 / 5.1 can use at most 50 % of the weekly cap, and it drains faster. opus 5.5 / sonnet / haiku have no per-model cap beyond the shared weekly one.
- the $100 plan did not get worse. it was renamed max 5x → max with the same rules. there is no new tier between $100 and $200 or above $200.
- the included api credits ($200 on ultra) **can't** be used in claude code, so don't count them as coding value.

## the plans now (as of 2026-10-30 rename)

- free — $0. limited usage on both windows. no claude code, no opus, no fable. (claude.com/pricing)
- pro — $20/mo monthly, or $17/mo billed annually ($200 up front). baseline 1x on the 5-hour window and the weekly window. includes claude code. fable is not in the plan limits and is paid with usage credits from the start. (claude.com/pricing; fable article)
- max — $100/mo, monthly billing only. 5x pro every 5 hours and every week. claude code included. fable included up to 50 % of the weekly limit. $100/mo api credits. old name: max 5x. (claude.com/pricing; support 11049741)
- ultra — $200/mo, monthly only. 10x pro per week across all models. no 5-hour limit for verified accounts; unverified ones get a temporary 5-hour limit that is lifted automatically once verified. phone verification at checkout does **not** count as verification. fable included up to 50 % of weekly. $200/mo api credits. old name: max 20x. (claude.com/pricing; support 17728952)
- claude code specifics: claude.ai and claude code (incl. ide plugins) draw from the same limits. if `ANTHROPIC_API_KEY` is set, claude code bills the api, not your plan. when you hit a limit it may offer api billing, which you can decline. with "usage credits" turned on you can keep going past a limit at extra cost. (support 11145838)
- fable rule (max and ultra): "up to 50% of your weekly usage limits on fable models at no extra cost". it's not an extra pool, and fable burns limits "faster than other claude models". past the 50 % cap you either pay usage credits or switch models. (support 15424964)
- api credits: max $100, ultra $200 per billing cycle. no rollover. you can claim after 7 days on the plan. they don't cover claude code or extra usage in the apps. (platform docs api-credits-for-subscribers)
- old → new: max 5x ($100) → max ($100); max 20x ($200) → ultra ($200). pro and free unchanged.

## what changed, with dates

- 2026-10-30: @claudeai announced the renames "max 5x → max, max 20x → ultra". prices unchanged. the 5-hour limit was removed for verified ultra accounts "starting today with most existing subscribers". "weekly limits remain unchanged". no action needed; you get an email when the limit is lifted. (x post as quoted by digg; x.com itself returned 402. the change itself is primary-confirmed by the help center + pricing page)
- the rollout is staged from 2026-10-30. one japanese outlet says it was announced 10-31 (secondary, per search summary).
- old max 20x was 20x pro per 5 hours. a secondary source (datastudios, ~2026-10-31) gives its weekly as 10x pro, i.e. unchanged now. pasqualepillitteri says the weekly multiple was never published before, so "10x unchanged" is an inference. unconfirmed from a primary source.
- so the $200 plan traded "20x per 5h" for "no 5h cap (verified)", with a 10x weekly cap either way. that's more usage for bursty users and the same for weekly-capped users.
- $100 plan: no change. 5x per 5h and 5x per week before and after (datastudios; current support 11049741). the old-rules side is from secondary only.
- the fable 50 %-of-weekly rule isn't new this month. the fable 5 promotion (counted in weekly limits for paid plans) ended 2026-07-19 (search summary of support 15424964; unconfirmed date).
- pricing page labels "$200 a month in api credits, up from $100 on max". that's ultra vs max, not a raise over time.

## migration

- existing max 20x subscribers are moved to ultra automatically, at the same price (support 17728952).
- existing max 5x subscribers are now on "max" with no change (pricing page + support 11049741; the max article itself doesn't say "renamed").
- max → ultra upgrade is prorated for the rest of the billing cycle (support 11049741).
- grandfathering, effects of renewal dates, auto-renew: not addressed on any primary page I read. unconfirmed.
- for google play upgrades you pay the full new price and unused value becomes extra days. an annual pro → max/ultra upgrade can credit the leftover balance (same billing address required).

## leads from theo / user report — status

- "max renamed ultra, max 5x now max": confirmed (primary).
- "half limits on fable": confirmed. fable capped at 50 % of weekly on max/ultra (primary).
- "$200 plan ≈ $12k api value / ≈ $6k with the 50 % cut": unconfirmed. no anthropic source, and i couldn't find theo's video via search.
- "no claude usage reset for 30 days": unconfirmed. nothing found; the reset search turned up only july–september 2026 items.
- lawsuit kahn v. anthropic (n.d. cal. 3:26-cv-05763, filed 2026-06-14) alleges max 20x actually gives ~6–8x pro and max 5x ~3.5x. these are allegations only, per pasqualepillitteri (secondary); i didn't open the complaint.

## sources (all seen 2026-11-03)

- primary: https://claude.com/pricing — plan cards, ultra "no 5-hour limit for verified accounts", 10x weekly, fable half-weekly
- primary: https://support.claude.com/en/articles/17728952 — "what is the ultra plan?" ("the max 20x plan is now called the ultra plan"), verification, auto move
- primary: https://support.claude.com/en/articles/11049741 — "what is the max plan?", $100, 5x per 5h and per week, prorated upgrade
- primary: https://support.claude.com/en/articles/15424964-claude-fable-models-on-your-plan — fable 50 % of weekly, faster burn, pro = credits
- primary: https://support.claude.com/en/articles/11145838 — claude code on pro/max/ultra, shared limits, api credits not usable in claude code
- primary: https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers.md — $100 max / $200 ultra, no rollover, not for claude code
- primary, refused: https://x.com/claudeai/status/2116220869479428500 — http 402, dropped; text quoted via digg
- secondary: https://digg.com/ai/e1dnwnjk — quotes the @claudeai post, dated 2026-10-30
- secondary: https://www.datastudios.org/post/claude-max-20x-renamed-ultra-removes-5-hour-limit-verified-accounts — before/after table (~2026-10-31)
- secondary: https://pasqualepillitteri.it/en/news/28617/claude-ultra-replaces-max-20x-no-5-hour-limit — weekly never published before; lawsuit
- secondary, refused: https://windowsreport.com/anthropic-renames-claude-max-5x-and-20x-plans-removes-ultras-5-hour-limit/ — http 403, dropped
- not found: theo / t3.gg ultra video; r/claudeai first-hand ultra posts from late october

## the unverified 5h window and verification time (researched 2026-11-03)

- size of the unverified 5h limit: no number published anywhere I could open. anthropic says only "a temporary limit" (@claudeai and @mboverell, both 2026-10-30, x text read via digg; support 17728952 read 2026-11-03). none found in pricing page, claude code docs or staff replies.
- one first-hand measurement: an ultra user whose settings > usage still showed "current session" on 2026-10-31 saw session +2 points vs weekly +1 point, so roughly 1 full 5h session ≈ 50 % of the weekly limit (github anthropics/claude-code#106274, 2026-10-30, with screenshot). single report, 1-point readings, so very rough. compare max 20x ≈ 20 % of weekly per session (#90816, 2026-08-30, first-hand). inference: the unverified window is not obviously the old 20x size in weekly terms; it may be bigger, or metering is off.
- verification time: anthropic gives no timeline. staff only say "rolls out in stages", "starting today with most existing subscribers" and "you'll get an email" (@mboverell, @claudeai, @edwinarbus, 2026-10-30, via digg). datastudios (~2026-10-31) also says no timing is published.
- first-hand timing: 1 migrated max 20x user verified the same day (vanja.io, 10-30, known). 1 long-paying user (hn Bender, "payments for several months", 2026-10-30 23:19 utc, news.ycombinator.com/item?id=50311399) and 1 user of unstated tenure (gh #106359, 2026-10-31) were still unverified 6-20 h after launch. no first-hand report found from a new ultra buyer, a max → ultra upgrader or someone who resubscribed after a lapse.
- "newer accounts": anthropic's own wording ("newer accounts keep a temporary limit until they're verified", @claudeai 2026-10-30). it's never defined: no cutoff date, no tenure, no rule on lapses. the only criteria named are "account and payment history" (support 17728952).
- max ($100) vs unverified ultra 5h window: no source states a difference. max = 5x pro per 5h (support 11049741). old max 20x 5h = 20x pro (@mboverell 2026-10-30). the unverified ultra figure is unpublished, so the comparison can't be made.

details

- @mboverell (says he leads product for claude subscriptions), 2026-10-30 17:31 utc: "this starts today and rolls out in stages. to help prevent fraud and abuse, a temporary limit applies until we've verified your account. you'll get an email when your limit is removed." he also confirms old max 20x = 20x pro per 5h and 10x pro per week. primary text, but read through digg's embed (https://digg.com/ai/e1dnwnjk); i didn't open x.com.
- @claudeai, 2026-10-30 17:29 utc, full text via digg: "...starting today with most existing subscribers. newer accounts keep a temporary limit until they're verified, which helps us prevent fraud and abuse. you'll get an email when it's removed."
- @edwinarbus (anthropic, per his replies) 2026-11-02: "we removed the 5 hour limit and did not change anything else." it's a reply to a complaint about weekly burn, and says nothing about timing or size.
- hn Bender 2026-10-30: says it's "not the same verification system as the ... persona" id flow, "just a verification that a person has been making payments". that's a user's opinion, not anthropic's.
- inference for a lapsed max → fresh ultra buyer: "payment history" counts, but whether a 1-2 day lapse resets it is unknown. the fact that some months-long payers waited over 6-20 h suggests it isn't always instant even with history. still unconfirmed.
- searched, nothing usable: github anthropics/claude-code issues ("ultra" + "verified" / "5-hour" / "current session" / "verification", since 10-29). hn algolia ("ultra verified", "ultra 5-hour", "ultra verification", "claude ultra", since 10-30) and threads 50308221, 50308320, 50314301, 50314506, 50320588, 50327436. web search for the email subject "your 5-hour limit has been removed" (only vanja.io). contextbolt (2026-11-02, says the window "works like max's" but gives no source for it, so dropped as a claim). datastudios. thenewstack (body not extractable).
- refused, dropped: reddit.com (http 403 to curl, and web search refuses the domain), so r/claudeai, r/anthropic and r/claudecode are unread. x.com wasn't opened directly; staff text comes via digg (secondary carrier).

## reddit, read via parallel-cli (2026-11-03, clio)

- firecrawl refuses reddit outright («we do not support this site»); `parallel-cli search --include-domains reddit.com` and `extract` reach post bodies, never the comment threads; old.reddit hits a login wall
- first-hand, an upgrader: u/unteth, r/ClaudeCode, ~2026-11-01 ([thread](https://www.reddit.com/r/ClaudeCode/comments/1xksdcp/ultra_plan_200_has_anyone_had_the_5hour_limit)) — «upgraded to the $200 Ultra plan yesterday … still have the 5-hour session limit», paying «since 2025, with no payment problems», «Current session» bar still shown; asks how long it took others. replies unread
- so: a long-paying Max → Ultra upgrader was still unverified ~1 day in. 2 reports now say tenure alone does not verify on day 1 (this one + hn Bender); 1 says same day (vanja.io, a migrated 20x user)
- reddit also shows a fresh thread «Ultra plan's $200 monthly API credit shows on claude.ai but not in my Console balance» ([r/ClaudeAI/new](https://www.reddit.com/r/ClaudeAI/new/)), unread

<!-- end -->
