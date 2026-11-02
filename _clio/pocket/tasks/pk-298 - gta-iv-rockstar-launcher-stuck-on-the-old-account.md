---
id: PK-298
title: 'gta iv: rockstar launcher stuck on the old account'
status: open
assignee: []
created_date: '2026-11-02T12:42:00Z'
updated_date: '2026-11-02T13:37:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**the problem, whole** — so dima never re-explains it (dima, 11-02 14:55: «I already redescribed it today and yesterday»)

- want: play GTA IV (Steam, appid 12210) in the FX Steam Launcher vm on the mac, signed in as his main Rockstar account, and see whether it runs well enough
- block: in Steam mode the Rockstar Games Launcher signs in to the Rockstar account linked to his Steam account, and that is an old one on `imagnumm.satellite@gmail.com` (two m's), name maybe «habasi_the_cat», password unknown; Gmail says the address does not exist (deleted for inactivity, or a typo that never existed — inference), so «Verify your email» never gets its code; a few retries hit «too many emails» (ref dc482472-ddca-4332-b118-93fd86828d63, #1.1900.5)
- main account: `thankyou___` on `imagnum.satellite@gmail.com` (one m), created 2013-09-16; connections: PSN `ripeluokte` (2022-01-07), Google, Amazon; no Steam. Steam persona is also `ripeluokte`
- the vm: no local sign-in to reset — GTA IV prefix `compatdata/12210`, Social Club `Profiles/` empty, log «DeleteAutoSignInData: Exists: failed»; the link is server-side (clio, 11-02)
- Rockstar policy: Steam is never on the web Connections page; it links only in the launcher at a Steam game's first start, and unlinks only through support, asked from the linked account itself, with a written consent line ([article](https://support.rockstargames.com/articles/1UjsMnPSkIDsNXlF8LRbKO), [policy](https://support.rockstargames.com/articles/2oNIpiDc3LQizEOPSmPUHn), [form](https://support.rockstargames.com/request/account/account-settings/linking-unlinking-accounts))
- steam's Rockstar titles: GTA V Legacy 17 h (its progress may sit on the old account — inference), Bully 15.3 h, Max Payne 3 11 h, Max Payne 6.5 h, GTA IV 5.9 h, Max Payne 2 3.3 h, L.A. Noire 0.6 h, the GTA III / VC / SA pairs under 0.3 h

**state log**
- 11-01 16:08 request #38239985 «lost account»; 16:11 closed solved: «unable to recover … cannot verify that you are the owner»
- 11-02 14:48 reply sent (dima's text): not recovery, unlink Steam from the imagnumm account, link to thankyou___; Steam proof offered
- 11-02 14:55 2nd reply sent: the consent line + «tell me what information you need to verify it»
- 11-02 14:55 dima downloads Bully in the vm to see if it shows the launcher email (clio's guess: Bully SE runs without the Rockstar launcher, so likely nothing — inference)
- dima's fear: Rockstar refuses the unlink for the same reason (can't verify the old account)

**next**
- watch the inbox for Rockstar's answer; no GTA IV launch until then (quota)
- answered yes → start GTA IV from Steam, sign in as thankyou___, then measure fps via `es.fxgam.steamac/game-stats.json`
- refused → ask which proof works (Steam purchase receipt, the Steam login on the request); last resort: the dedicated linking form above
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
<!-- SECTION:NOTES:END -->
