---
dies-when: BYT-85 closes or is reshaped
---

Ticket: BYT-85

# npsso renewal — what a browser can and cannot do (parallel core, 2026-09-28)

## Bottom line

A persistent Sony browser profile can make NPSSO retrieval convenient, but repeatedly fetching `https://ca.account.sony.com/api/v1/ssocookie` is not documented as a way to renew the token or extend its lifetime. The best-supported reading is that the endpoint exposes the NPSSO associated with the browser’s current Sony sign-in session. If Sony has not rotated that cookie through a new sign-in or other Sony-side action, expect the existing value—not a newly minted token with a fresh expiry. The documentation describes extracting a token from the current session, and PSNTools’ instructions say to log out and back in to refresh it.

**The reported 10–15-day NPSSO life is shorter than the lifetimes in the docs I found.** The psn-api guide, Home Assistant docs, PSNAWP docs, and PSNTools guide describe roughly two months or 60 days. That is not a guarantee: Home Assistant users report tokens becoming invalid earlier, and logging out is specifically identified as an invalidation trigger. NPSSO lifetime and the lifetime of the separate browser login session should not be treated as the same thing.

I could not substantiate a published Sony duration for the website’s browser-login session, or whether ordinary activity extends it on a sliding basis. A saved cookie jar preserves cookies locally; it cannot prevent Sony from expiring or revoking the server-side session. So a logged-in profile may let your app retrieve the current NPSSO for some time, but there is no documented reliable duration or activity-based renewal guarantee.

## Scripted login and bot checks

A password-plus-TOTP browser flow may be scriptable in some circumstances, but the evidence does not support calling it dependable—especially in headless or cloud environments. A SeleniumBase discussion about signing into PlayStation describes Sony/ArkoseLabs detection; the user reported being detected while entering credentials, even after trying several browser and automation configurations. That is firsthand but anecdotal evidence, not a measured rate or proof that every headless login will be challenged. I found no authoritative Sony source specifying a CAPTCHA threshold or a supported automated-login method. Plan for an interactive challenge or failed login rather than assuming automation will work, and do not count on TOTP alone to avoid those checks.

## What libraries and tools do about expiry

- **psn-api:** Its manual-authentication guide says to retrieve another NPSSO after about two months. The refresh-token flow is for replacing short-lived access tokens; it postpones another browser sign-in only until the refresh token expires. In a maintainer discussion, a user reported that refresh returned the same refresh token and its expiry kept counting down. The maintainer said they knew of no public-facing endpoint to obtain a new refresh token without NPSSO. So the library does not provide an unlimited rolling session.
- **Home Assistant’s built-in integration:** Its docs describe an NPSSO valid for two months and say the integration prompts for reauthentication after expiry. They also warn that logging out of the PlayStation website invalidates the token. A reported “every 7 days” problem was discussed as premature invalidation rather than proof that the normal NPSSO lifetime is seven days; users described inconsistent reauthentication after restarts and suspected logout/session interactions.
- **A community Home Assistant alternative:** Its documentation says it stores and silently renews OAuth tokens after initial NPSSO setup, but the relevant token lifetime is still about 60 days; it calls for reauthentication if the integration is offline too long or Sony revokes the session. This automates the refresh cycle, not indefinite reauthentication.
- **PSNAWP and Discord-style bots:** PSNAWP’s docs say the refresh token lasts about two months, then a new NPSSO is needed, and the bot warns when fewer than three days remain. That is a warning-and-human-renewal model, not unattended renewal forever. PSNTools also documents a Discord bot, but that page does not establish its expiry-handling policy.
- **PSNProfiles- or Exophase-like services:** The public pages I found describe trophy tracking or gaming activity, but do not explain their internal Sony authentication or NPSSO-renewal mechanisms. It would be speculation to claim they use your personal NPSSO flow or to say exactly how they reauthenticate.

## Terms and account risk

There is a material Terms-of-Service concern even when automating your own account: the US PlayStation Terms prohibit using automated methods such as bots or scripts to interact with Content or otherwise in connection with an account. The same terms reserve the ability to restrict, suspend, or terminate accounts for violations. That does not establish that Sony will take action against every personal script, but it means automation is not clearly authorized and carries account risk. Separately, NPSSO is a sensitive bearer credential: PSNTools warns that it can expose personal account data and recommends treating it like a password. Avoid giving it to untrusted apps, sites, or cloud services.

**Practical conclusion:** the lower-friction approach is to use a securely stored, persistent browser profile for an initial human sign-in and later token retrieval while that session remains valid, then plan for occasional human reauthentication. This is still not a supported or guaranteed Sony renewal mechanism, and automated login itself may conflict with the Terms.
