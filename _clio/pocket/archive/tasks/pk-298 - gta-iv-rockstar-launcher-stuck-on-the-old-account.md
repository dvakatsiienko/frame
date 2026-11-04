---
id: PK-298
title: 'gta iv: rockstar launcher stuck on the old account'
status: done
assignee: []
created_date: '2026-11-02T12:42:00Z'
updated_date: '2026-11-04T14:41:00Z'
labels:
  - s
  - side-channel-owned
dependencies: []
priority: next
type: task
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**the problem, whole** — so dima never re-explains it (dima, 11-02 14:55: «I already redescribed it today and yesterday»; rewritten 18:31 to the live state)

- want: play GTA IV (Steam, appid 12210) in the FX Steam Launcher vm on the mac, signed in as his main Rockstar account `thankyou___`, with no stray account left on a typo email
- the old Rockstar account: `umaturman3`, created 2012-03-24, on `imagnumm.satellite@gmail.com` (two m's) — a typo address that never existed; dima registered it 15:32 and owns its inbox now; signed in 17:53; owns GTA V, Max Payne 3, L.A. Noire; Steam is linked to it (the launcher in Steam mode signs in here, server-side)
- main account: `thankyou___` on `imagnum.satellite@gmail.com` (one m), created 2013-09-16; connections: PSN `ripeluokte`, Google, Amazon; no Steam
- 2FA on umaturman3: a half-saved 1Password authenticator locked it (17:53); ticket #38245301 (Trouble signing in → lost authenticator); dima unlinked the device and set 2FA again properly in 1Password (18:20)
- Rockstar policy: Steam unlinks only through support, asked from the linked account ([article](https://support.rockstargames.com/articles/1UjsMnPSkIDsNXlF8LRbKO), [policy](https://support.rockstargames.com/articles/2oNIpiDc3LQizEOPSmPUHn), [form](https://support.rockstargames.com/request/account/account-settings/linking-unlinking-accounts)); forum reports say an unlink can drop the games' tie to the old account (inference), so the unlink note asks Rockstar to confirm the games and progress survive the relink first
- the vm: no local sign-in to reset; the link is server-side

**tickets**
- #38239985 (11-01, from the main account, «lost account»): resolved; two follow-ups 11-02 14:48/14:55
- #38245301 (11-02, from umaturman3, 2FA): resolved, chat closed
- the unlink ticket (Account → Account settings → Linking / unlinking accounts): submit fails with 500 «200.1.5» (18:28); the 425-char note is in the 18:16 reply

**next**
- file the unlink ticket (the form again in another browser, or an email reply to #38245301's thread)
- Rockstar confirms the games survive → unlink, link Steam to thankyou___, start GTA IV, measure fps via `es.fxgam.steamac/game-stats.json`
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
W1143 (2026-11-02 14:40, dima): steamos. i've installed that virtual machine for steamos, so now i can play windows games on my mac too, kinda.
W1144 (2026-11-02 14:40, dima): but it is not tested yet.
W1145 (2026-11-02 14:40, dima): most of my trial games launch (ones i've installed via fx steam launcher), but performance is not tested.
W1146 (2026-11-02 14:40, dima): i won't use it if games are unplayable in that mode.
W1147 (2026-11-02 14:40, dima): the game i'd truly like to play is gta4 (fx launcher).
W1148 (2026-11-02 14:40, dima): currently it can't bypass rockstar launcher because of a broken email.
W1149 (2026-11-02 14:40, dima): it for some reason got attached to some very old email that i do not even remember.
W1150 (2026-11-02 14:40, dima): my current is imagnum.satellite@gmail.com, the launcher ties to imagnumm.satellite@gmail.com.
W1151 (2026-11-02 14:40, dima): somewhere i saw a rockstar account name for that other email.
W1152 (2026-11-02 14:40, dima): imagnum.satellite@gmail.com acc name: thankyou___
W1153 (2026-11-02 14:40, dima): imagnumm.satellite@gmail.com acc name: habasi_the_cat ? or something like this
W1154 (2026-11-02 14:40, dima): so i actually created that account in rockstar with that email very long ago, but i don't remember when i created it.
W1155 (2026-11-02 14:40, dima): i don't remember a password, and i also tried to log in to gmail via this mm account.
W1156 (2026-11-02 14:40, dima): gmail doesn't recognize it and says the email was not found and doesn't exist.
W1157 (2026-11-02 14:40, dima): it is an issue.
W1158 (2026-11-02 14:40, dima): how is it even possible if this account is gmail and i actually created a rockstar account at some point with this mm email, and now it doesn't exist? ❓
W1159 (2026-11-02 14:40, dima): does gmail delete emails if they are not used for too long, or what? ❓
W1160 (2026-11-02 14:40, dima): how to restore it now? ❓
W1161 (2026-11-02 14:40, dima): yesterday, i created a support ticket with rockstar about account loss, but it's tricky.
W1162 (2026-11-02 14:40, dima): i'm not sure if rockstar will even solve it somehow, because now i have two rockstar accounts: my main one, the thank you account, and this old one.
W1163 (2026-11-02 14:40, dima): actually, i don't need this old one at all, although i would be interested to log in and see what i have there.
W1164 (2026-11-02 14:40, dima): essentially, i want to unbind this double-m email from my rockstar account, log in to gta 4 in fx launcher with my main account, and see if gta 4 will even work for me.
W1165 (2026-11-02 14:40, dima): imagnumm.satellite@gmail.com is now stuck into rockstar launcher inside of the vm.
W1166 (2026-11-02 14:40, dima): i cannot pop it out into signin screen to enter real email.
W1167 (2026-11-02 14:40, dima): can you get into a vm fire /x:firelink skill and try reset the launcher so it not attached to that email? ❓
W1168 (2026-11-02 14:40, dima): or sign it out somehow? ❓
W1169 (2026-11-02 14:40, dima): there is a way to get into signin page but it requires triggering a sign-in quota limit exceed.
W1170 (2026-11-02 14:40, dima): i'll attach a screenshot of what i mean, but i don't want this approach because i then can't sign in, even with my real email.
W1171 (2026-11-02 14:40, dima): i want to get to the sign-in page of the rockstar launcher without exceeding the sign-in quota to sign in normally.
W1172 (2026-11-02 14:40, dima): himalya: yesterday i created a support ticket, and have few replies.
W1173 (2026-11-02 14:40, dima): but the support request was created about the "lost account" topic, but it actually doesn't describe the problem i have right now with this double account while the old account is stuck and inaccessible.
W1174 (2026-11-02 14:40, dima): you proposed a follow-up text to me that describes my issue to send to rockstar support.
W1175 (2026-11-02 14:40, dima): the thing is that i think that this text doesn't describe an issue too precisely, because, essentially, first of all, i want to restore this account to figure it out.
W1176 (2026-11-02 14:40, dima): if it is not possible because gmail is deleted, then this account may be lost for good.
W1177 (2026-11-02 14:40, dima): in that case, how to then act properly? ❓
W1178 (2026-11-02 14:40, dima): can i assume that rockstar cannot just merge this old account into my main account and cannot restore it too because gmail is lost? ❓
W1179 (2026-11-02 14:40, dima): how to solve it then? ❓
W1180 (2026-11-02 14:40, dima): ask rockstar to delete this other old account, or what? ❓

W1181 (2026-11-02 14:55, dima): I essentially think that the thing that may not work out is actual recognition by Rockstar that the double-M account is mine.
W1182 (2026-11-02 14:55, dima): Tell them to tell me what info is needed to verify that this double-M account is actually mine, so they can proceed with unlinking.
W1183 (2026-11-02 14:55, dima): I assume that they will refuse to unlink for the same reason: they can't verify that this account is actually mine, because unlinking can cause destructive effects.
W1184 (2026-11-02 14:55, dima): Also create a pocket ticket about this problem because I already redescribed it today and yesterday.
W1185 (2026-11-02 14:55, dima): Fold all the data about the problem so I don't need to re-explain everything, and log all current states of this issue.
W1186 (2026-11-02 14:55, dima): I'm currently downloading «bully» into the FX Steam Launcher to see if it will pick up the launcher email.

state 11-02 15:04 (clio): Bully runs in the vm — its Steam install script hung on vcredist_x86 under Proton; ending the two installer processes (vcredist_x86.exe, msiexec) let it through, and the game reached its menu. Bully has no Rockstar launcher, so it can't show the linked email. A local launcher reset can't help: the vm keeps no sign-in, the link is server-side. Another launcher game (Max Payne 3, GTA V, L.A. Noire) lands on the same old account and may send another code.

state 11-02 15:18 (clio): Max Payne 3 (appid 204100) installed its own fresh Rockstar launcher and still opened «Verify your email» for imagnumm — proof the binding is server-side (Steam ticket → linked account), never local. A standalone (Platform: PC) launcher runs but stays hidden under gamescope's gaming mode. No local route left; the unlink is Rockstar support's only. Bypassing the account check is off the table (their terms, ban risk).

state 11-02 15:27 (clio): the decisive probe — dima tries to sign up imagnumm.satellite at accounts.google.com/signup. «username taken» = it existed and was deleted (Google never reissues; recovery only ~20–30 days after deletion, unconfirmed) → only Rockstar can help. available = it never existed (a typo at Rockstar sign-up) → he takes it, the old Rockstar account's codes then reach him, and he fixes the account himself. @gmail.com is Google-only (plus @googlemail.com).

state 11-02 15:32 (dima): imagnumm.satellite@gmail.com was free and he created it — so the old Rockstar account sat on a typo address that never existed. He now owns its inbox: codes reach him, the old account is recoverable by its own email. Next: verify the code in the launcher once the quota allows, reset that account's password, then choose: play on it, or have support move Steam to thankyou___ (asked from the old account itself, which their rule wants).

state 11-02 15:37 (dima): wiring the old Rockstar account to the new inbox hit «too many emails» again — paused until the lock clears. support note held: «not yet» (o30).

state 11-02 17:53 (dima): signed in to imagnumm gmail + the old Rockstar account (umaturman3, created 2012-03-24) in Safari, still signed in. owns gta v, max payne 3, la noire; steam shows linked in its profile, no unlink on the website. a 1Password authenticator setup half-failed: Rockstar registered the authenticator, but the 1P item «Rockstar Games (old dupe)» has an empty one-time password field (clio checked the shape, 17:55: no secret saved) → no codes, sign-out = locked out. his ask: still unlink steam from the old account; fix the 2FA; one support request or two?

state 11-02 17:59 (dima): Security → 2-Step device «Unlink» needs an authenticator code + password: no self-fix. he still wants the unlink (relink the games to his main account; no stray account on a typo email). order: 1) a 2FA reset request from the signed-in account (drafted 18:00), 2) a follow-up asking the unlink, with Rockstar confirming the Steam games and their progress move to thankyou___ intact.

state 11-02 18:10 (clio): 2FA ticket #38245301 filed from umaturman3 (Trouble signing in → Lost Access to or Missing Authenticator App, Steam-authenticated); its ticket chat caps at 500 chars, a short note drafted. main inbox: 4 «Sign-In Detected» alerts archived to All Mail; the #38239985 thread (5 mails) kept. the imagnumm inbox is outside himalaya.

W1315 (2026-11-02 17:53, dima): i successfully signed in into imagnumm.satellite@gmail.com — gmail and rockstar acc both.
W1316 (2026-11-02 17:53, dima): rockstar acc username umaturman3, created on Mar 24, 2012.
W1317 (2026-11-02 17:53, dima): but i created another issue accidentally.
W1318 (2026-11-02 17:53, dima): i was trying to set up a 2FA authenticator via OnePassword and messed it up in a way where the authenticator actually gets registered, and now it is connected to my Rockstar account.
W1319 (2026-11-02 17:53, dima): the actual one-time password did not hook up to OnePassword, and now i'm blocked because the Rockstar account expects an authenticator code.
W1320 (2026-11-02 17:53, dima): now it expects it from OnePassword, not from Gmail.
W1321 (2026-11-02 17:53, dima): this 2FA password is not functioning in OnePassword itself, and to remove 1p 2FA from the Rockstar account, i need to actually print the current 2FA code, which i don't have because 1p 2FA messed up.
W1322 (2026-11-02 17:53, dima): how to solve? ❓
W1323 (2026-11-02 17:53, dima): himalaya: my previous rockstar support request is not outdated.
W1324 (2026-11-02 17:53, dima): i still want to unlink my Steam account from my old Rockstar account, but now i have access to my Rockstar account, although with a twist.
W1325 (2026-11-02 17:53, dima): now i have another issue with this 2FA.
W1326 (2026-11-02 17:53, dima): how to properly reshape my request to Rockstar support to unlink my old account from Steam, and actually how to solve my 2FA problem? ❓
W1327 (2026-11-02 17:53, dima): do i need to create another request for Rockstar support, or what? ❓
W1328 (2026-11-02 17:53, dima): 3 games are attached to old acc: gta 5, max payne 3, la noire.
W1329 (2026-11-02 17:53, dima): steam is connected to old acc (shows in profile), i see no way to unlink it from rockstar acc website.
W1330 (2026-11-02 17:53, dima): i've signed in to both Gmail and Rockstar old accounts in Safari, and currently i still have signed in.
W1331 (2026-11-02 17:53, dima): i assume when i sign out of the Rockstar account, i will be logged out again because the 2FA doesn't work.
W1332 (2026-11-02 17:53, dima): while i sign in, how to properly solve everything? ❓
W1333 (2026-11-02 17:59, dima): asks 2fa and pwd.
W1334 (2026-11-02 17:59, dima): can't solve? ❓
W1335 (2026-11-02 17:59, dima): i actually still wanted to unlink (e.g., to relink my games to my main Rockstar account).
W1336 (2026-11-02 17:59, dima): how is it possible to drop access to games if i bought those games on Steam? ❓
W1337 (2026-11-02 17:59, dima): either way, let's first shape the request to Rockstar about resetting my 2FA first.
W1338 (2026-11-02 17:59, dima): it's most important, and maybe let's then create an additional follow-up for Steam unlinking that describes the current state of what i have with my account and still asks for unlinking, but to verify from Rockstar's side that my games won't be wiped? ❓
W1339 (2026-11-02 17:59, dima): i can properly relink them to my main Rockstar account? ❓
W1340 (2026-11-02 17:59, dima): if unlinking works, the whole problem is solved because i will use my main account instead.
W1341 (2026-11-02 17:59, dima): i'm not a fan of having additional broken email and some stray account on Rockstar's side.

state 11-02 18:20 (dima): 2FA unlinked ✓ on umaturman3 (ticket #38245301 can rest). unlink ticket next: Submit a Request → Account; the 425-char note drafted.

18:31 (clio): description rewritten to the live state (wishkeeper siesta high: it still told the 14:55 story). the old description's lines live in git history; dima's W-lines untouched.

W1345 (2026-11-02 18:07, dima): verify if all fields are OK.
W1346 (2026-11-02 18:07, dima): and i send.
W1347 (2026-11-02 18:07, dima): there is no text box to attach to.
W1348 (2026-11-02 18:07, dima): follow up on this clarification message right away.
W1349 (2026-11-02 18:07, dima): once i create another request, i will send it via email instead.
W1350 (2026-11-02 18:10, dima): the screenshot shows the ticket about tfa cancellation, so i just send it into that text box, right? ❓
W1351 (2026-11-02 18:10, dima): yes, your message does not fit.
W1352 (2026-11-02 18:11, dima): maybe trim? ❓
W1353 (2026-11-02 18:11, dima): or email? ❓
W1354 (2026-11-02 18:16, dima): sent to chat box.
W1355 (2026-11-02 18:16, dima): so i create a new ticket about unlinking? ❓
W1356 (2026-11-02 18:16, dima): «account linking» category sends me to «connections» page in a profile, it is not a request link.
W1357 (2026-11-02 18:16, dima): what's then? ❓
W1358 (2026-11-02 18:22, dima): 2fa i set properly now.
W1363 (2026-11-02 18:25, dima): account settings → linking / unlinking accounts? ❓
W1364 (2026-11-02 18:25, dima): this one has a textbox.
W1367 (2026-11-02 18:38, dima): i try later.
W1368 (2026-11-02 18:38, dima): meanwhile.
W1369 (2026-11-02 18:38, dima): since 2fa is working, is it worth to try gta4 with my recovered acc (double mm)? ❓
W1370 (2026-11-02 18:38, dima): or wait until unlink to not mess up any syncing? ❓

state 11-02 19:34 (dima): every new-ticket door returns 500 (200.1.5): Linking/unlinking and Other account settings issue, Safari and Firefox; plus «maximum ticket submissions». #38245301's reply got an answer pointing back at the broken form, ticket closed. next: reply to that email with the form-is-broken note (drafted 19:27); new form tomorrow.

W1450 (2026-11-02 19:23, dima): rockstar: the submit ticket door doesn't work.
W1451 (2026-11-02 19:23, dima): it provides a server-side error.
W1452 (2026-11-02 19:23, dima): i tested in firefox.
W1453 (2026-11-02 19:23, dima): how to submit a new ticket to unlink my steam account properly? ❓
W1455 (2026-11-02 19:35, dima): no, let's do today.
W1456 (2026-11-02 19:35, dima): maybe let's use the previous forms that worked to create a support request, the ones that we used to actually submit a ticket about the FA issue.
W1457 (2026-11-02 19:35, dima): it's a different area, but since no other door is working, i will just go via that route and explain what is wrong and why i, e.g., use another door.
W1458 (2026-11-02 19:40, dima): works? ❓
W1459 (2026-11-02 19:40, dima): i paste the text right after ticket is created.
W1460 (2026-11-02 19:45, dima): ok i try later.

state 11-02 20:08 (clio, inference): every form tried tonight returned 500 (linking, other account settings, sign-in; Safari + Firefox) — what was tried, not proof that every door is down; dima 19:35 «let's do today», 19:45 «ok i try later»; supersedes the 19:34 line.

side-channel-owned on dima's word (2026-11-03 19:14: «resign rockstar-related ticket to side channel-owned»)

state 11-03 19:23 (dima, side channel): GTA IV runs — he signed in to the Rockstar launcher inside the FX Steam vm and played; performance lags a bit («that's for later»). support still locked (cooldown, he thinks), so the old-account unlink waits. «Let's solve PK-298 a little later.»

state 11-03 20:57 (side channel, browser pane): the double-M Gmail shows #38245301 closed 11-02 11:44 EST by Oluwatomisin S., who only pointed back at the linking/unlinking form — the unlink was never filed. tonight's vanishing pending request fits Rockstar's banner: Support and Account Management maintenance 2026-11-03 18:00–21:00 UTC (inference: requests made in the window were not stored). dima's pick: submit the 424-char text after 23:00 local, then watch dashboard → Gmail → dashboard.

ticket: FRM-506
close: moved to FRM-506, W-lines copied verbatim into its wish block: W1143 W1144 W1145 W1146 W1147 W1148 W1149 W1150 W1151 W1152 W1153 W1154 W1155 W1156 W1157 W1158 W1159 W1160 W1161 W1162 W1163 W1164 W1165 W1166 W1167 W1168 W1169 W1170 W1171 W1172 W1173 W1174 W1175 W1176 W1177 W1178 W1179 W1180 W1181 W1182 W1183 W1184 W1185 W1186 W1315 W1316 W1317 W1318 W1319 W1320 W1321 W1322 W1323 W1324 W1325 W1326 W1327 W1328 W1329 W1330 W1331 W1332 W1333 W1334 W1335 W1336 W1337 W1338 W1339 W1340 W1341 W1345 W1346 W1347 W1348 W1349 W1350 W1351 W1352 W1353 W1354 W1355 W1356 W1357 W1358 W1363 W1364 W1367 W1368 W1369 W1370 W1450 W1451 W1452 W1453 W1455 W1456 W1457 W1458 W1459 W1460
<!-- SECTION:NOTES:END -->
