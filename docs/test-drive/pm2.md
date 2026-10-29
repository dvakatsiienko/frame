---
status: adopted
until: 2026-10-27
dies-when: the verdict line below is written
---

# pm2 — a process manager for the fleet's node daemons, beside launchd

Ticket: none

born 2026-10-16 on dima's tick (o14), from PK-153 (his inbox ask: is there a tool to maintain and organise our hand-made launchd jobs, agent-friendly and free). the first job moved: `x-cc-otel` (node, needs no tcc grant). the swift tcc jobs stay on launchd: the 10-16 throwaway probe (`_clio/.scratch/launchd-tools-r2/opus.md` § probe): straight under launchd it read «unknown» (its own responsible process, no grant); under pm2 it read «granted», but that pm2 was started from cclio's session and inherits the terminal's grants, so the pm2 half is inconclusive. how tcc judges a pm2 child after a reboot is unproven.

**test card:** we believe pm2 makes a node daemon easier to run, read and restart than a hand-made plist · we test it by moving `x-cc-otel` onto it and reaching for it on every «is the tap up», «why did it stop», «restart it» ask · we measure the calls and seconds per ask against the launchd door (`launchctl print` + the log file), restarts survived, the tap's jsonl gaps · we're right if every such ask is one pm2 call, the tap survives a crash and a reboot, and no day loses telemetry
**kill rule:** a telemetry gap pm2 caused, or `pm2 startup` fails to bring the tap back after a login

dima's two questions the trial answers too: «I saw it has a pretty dashboard» (`pm2 monit` is the free terminal view; PM2 Plus, the web one, has no free plan — a free web dashboard is on the stress list) and «is it useful for yourself, or a terminal view meant for me?» (for cclio: `pm2 jlist` json, `pm2 logs <name> --nostream`, restart by name; the rounds measure it).

## stress list

day 0, 2026-10-16: three lanes (exa, parallel, opus source read), `_clio/.scratch/pm2-day0/`. pm2 7.0.4 here (stay ≥7.0.4: node 24.15 broke 7.0.1, [pm2#6111](https://github.com/Unitech/pm2/issues/6111)).

- `pm2 startup` + `save`, reboot then log in — seconds from login to `:4318` answering; a LaunchAgent, so it starts at login, never before
- the startup plist's pinned paths — the pnpm store path and `fnm/node-versions/v24.12.0` are frozen in; a node or pm2 upgrade, then a reboot: does the tap come back (y/n), `/tmp/com.PM2.err`
- `pm2 unstartup` label bug — the plist is `pm2.<user>.plist` with label `com.PM2`, unstartup removes the wrong name; after it, `launchctl list | grep PM2` still loaded (y/n)
- `pm2 jlist` from a bare agent shell — `env -i` + absolute node: median ms over 100 calls, failures, the daemon pid (a different `HOME`/`PM2_HOME` silently spawns a second, empty daemon)
- crash restart + `exp_backoff_restart_delay` — `kill -9` the tap 10×: delay per restart, restart count, jsonl gap seconds
- `max_restarts` + `min_uptime` — a tap that throws on boot: restarts until `errored`
- `max_memory_restart` — a low threshold under an OTLP burst: RSS at restart, spans lost (checked every ~30 s)
- `kill_timeout` / `shutdown_with_message` — SIGINT mid-burst: spans sent vs written
- pm2-logrotate — tiny `max_size` for 10 min: rotated files, lost lines; it rotates pm2's logs, never the tap's own jsonl
- sleep/wake — `pmset sleepnow` 10 min: restarts after wake, first span latency
- the tcc probe, reboot-shaped — the probe binary run by a pm2 daemon started the way `pm2 startup` starts it (its launchd agent → /bin/sh → node, never from a cc shell), beside the same binary as a plain launchd job — two «input-monitoring=» lines, one per parent chain
- `pm2 monit` — dima's look: one session, his verdict on the terminal dashboard
- a free web dashboard — [oxdev03/pm2.web](https://github.com/oxdev03/pm2.web) (the only live one, pushed 2026-09-18); PM2 Plus has no free plan

## rounds

- 2026-10-16 14:55 · the move (o23) · launchd job booted out + `launchctl disable gui/501/com.dima.x-cc-otel` (reversible: `enable` + `bootstrap`), `pm2 start schedule/jobs/x-cc-otel/ecosystem.config.cjs` → online, pid 29301, 0 restarts, node = fnm's `default` alias, :4318 listening · `pm2 save` → `~/.pm2/dump.pm2` · positive control: an empty OTLP export → 200, jsonl 14 → 15 lines (the probe line is mine) · the daemon is still the 14:27 one spawned from cclio's session; `pm2 startup` (dima's sudo) pending
- 2026-10-16 15:01 · startup (dima ran the sudo line) · it wrote `~/Library/LaunchAgents/pm2.dima.plist` owned by root, label `com.PM2`, loaded in no domain (`launchctl print gui/501/com.PM2` → not found), with the pnpm store path and `fnm/node-versions/v24.12.0` frozen in · fixed: the old file trashed, a dima-owned copy with `/Users/dima/Library/pnpm/bin/pm2 resurrect` and no version dir · `pm2 kill`, then `launchctl bootstrap gui/501 …/pm2.dima.plist` → the tap listening again after 1 s, daemon pid 35699 with ppid 1 and started by the job · launchd → pm2 beats launchd alone? not yet measured
- 2026-10-16 15:02 · the tcc probe, reboot-shaped · the probe binary under the launchd-started daemon (ppid 35699): `input-monitoring=unknown`, the same as plain launchd · the 14:27 «granted» came from the daemon spawned from cclio's session · verdict, measured on this mac: a pm2 started at login carries no terminal grant. whether a grant on the binary itself would count under pm2 needs a real grant, never given; the swift tcc jobs stay on launchd
- 2026-10-16 15:23 · open: no real login has run yet — «pm2 starts the tap at login» and «a pm2 at login carries no terminal grant» hold only for a `launchctl bootstrap` from cclio's shell; the next login or reboot is this trial's first real round (the kill rule) · pm2-logrotate installed (5M, keep 7, gzip), so the tap's per-export stdout line is capped
- 2026-10-16 15:09 · dima: «why is the pm2 logs pane empty while you work?» · the pane shows the tap's stdout/stderr, and the tap prints only errors (data goes to the jsonl); separately cclio's session (started 13:21) never exports — the tap came up at ~14:03, and 0 of 15 jsonl lines carry her session id; 6 sessions started after it did export (ccrow included)
- 2026-10-16 15:02 · `pm2 monit` vs `pm2 dashboard` · dima: they look identical · source `lib/binaries/CLI.js:830–846`: both call `pm2.dashboard()`; `pm2 imonit` is the legacy view

## verdict

- 2026-10-27 · **adopted** (dima's o12 tick): pm2 runs x-cc-otel and x-n8n (`pm2 jlist` 15:27: both online, 2 and 1 restarts) plus pm2-logrotate; no round was logged after 10-16, its daily use is the evidence
