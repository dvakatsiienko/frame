---
status: adopted
until: 2026-10-27
dies-when: the verdict line below is written
---

# launchyard — a free mac app to see and drive our launchd jobs

Ticket: none

born 2026-10-16 on dima's pick (PK-153): he A/B'd [Launchyard](https://github.com/jayhickey/Launchyard) v1.0.1 against [LaunchManager](https://github.com/Sean10000/LaunchManager) v1.7.1 and liked Launchyard; cclio's recommendation matched (notarized — `spctl` accepted, Developer ID Final Bits LLC; no admin prompt; no network calls; MIT). installed by hand into `/Applications` from the github release; LaunchManager was uninstalled the same day on dima's word («uninstall LaunchManager, keep Launchyard»). a sibling trial, `pm2.md`, ends the same day.

**test card:** we believe one window that lists, starts, stops and shows logs for our ~10 jobs saves dima the `launchctl` + log-file hunt · we test it by dima opening it whenever he wonders «is X running / why did X stop», and clio asking him to check a job there instead of pasting a command · we measure the asks it answered, the ones it could not (and why), any wrong state it showed · we're right if dima reaches for it on his own and it never shows a wrong state
**kill rule:** a wrong running/stopped state, or an edit through the app that breaks a plist

## stress list
- the job list — does every `com.dima.*` job show, with the right state (x-cc-otel is disabled on purpose while pm2 runs it)
- start / stop / kickstart one job — `x-autoclean-screenshots` run on demand
- logs — a job's stdout/stderr files and the unified log for one job
- the editor — read a plist in the form view; never save one during the trial (frame owns the plists)
- `com.PM2` — how it shows a run-once job

## rounds

## verdict

- 2026-10-27 · **adopted** (dima, 15:15: «launchyard ← keep»): no rounds logged; his use of the window is the evidence
