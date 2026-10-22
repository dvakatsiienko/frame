---
id: PK-248
title: >-
  railway breach 10-21: check space-explorer-api's railway env, rotate what's
  real, read the vercel activity log
status: done
assignee: []
created_date: '2026-10-22T11:46:00Z'
updated_date: '2026-10-22T14:54:00Z'
due_date: '2026-10-23'
labels:
  - xs
dependencies: []
priority: now
type: task
ordinal: 7999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, 2026-10-22 inbox, folded:
W1 security mails via himalaya: «Urgent: Railway Security Disclosure - Rotate Credentials» (10-21 22:36) and «Security update for your Vercel team: Dima Vakatsiienko's projects» (10-22 05:22)
W2 ❓ what's wrong?
W3 ❓ fixes?
W4 only the space explorer gql server lives on railway
facts (boot read 10-22): railway says an attacker may have read decrypted env vars; rotate all of them, review logs. vercel disabled the railway marketplace integration on his team; review the team activity log for env var writes by the integration. space-explorer-api reads only DATABASE_URL (sqlite path, tracked) and PORT (src grep).
? the railway dashboard may hold vars the code never reads — `railway variables --kv` names them (values print, so names only into chat)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-22 raw drop (inbox, first actions):
> **few railway updates**
> security issues. himalaya → «# Urgent: Railway Security Disclosure - Rotate Credentials», «# Security update for your Vercel team: Dima Vakatsiienko's projects». what's wrong? fixes? i have only space explorer gql server on railway.
correction 10-22 (wishkeeper): «nothing real to rotate» was an inference from the local .env. space-explorer-api-run/SKILL.md:71 says prod runs on railway with its own db, so prod's DATABASE_URL may be a real db credential; W3 stays open until `railway variables` names are read. the door: `railway login` (the saved login is invalid, ccrow 10-22), then `railway variables`.

2026-10-22 15:05 read (names only, no values): railway space-explorer-api@production holds APOLLO_GRAPH_ID, APOLLO_GRAPH_VARIANT, APOLLO_KEY, APOLLO_SCHEMA_REPORTING, PORT + 11 RAILWAY_* ids — no db url, so prod runs the tracked sqlite. the one real secret: APOLLO_KEY (Apollo GraphOS graph key, graph space-explorer-api-k8tzo@current). vercel space-explorer-ui holds the same 5 APOLLO_*/PORT names (1790d old). no vercel var on 8 projects is younger than 42d (`vercel env ls --project <p>`) → no recent integration write seen; the activity log is dima's eye. vault slot made: op://dev/apollo-space-explorer (empty credential, tags fleet+railway).
rotate: dima mints a new graph key in Studio → pastes it into the 1password item → cclio sets railway (--skip-deploys, builds paused) + vercel from op read → dima deletes the old key in Studio.

2026-10-22 15:14: dima minted the new key, item renamed op://dev/space-explorer-apollo-api. railway APOLLO_KEY set with --skip-deploys (fingerprint 51d4227b = vault; the running deploy keeps the old key until the next deploy, builds paused by railway). vercel space-explorer-ui: the 5 APOLLO_*/PORT vars are integration-managed (the update refuses: «cannot change the type of an integration Environment Variable»), and the ui never reads them (src grep: only VITE_GQL_URL) → proposed removal, dima's word. local .env holds only DATABASE_URL: no paste. bytes is public; git history holds the name APOLLO_KEY only (turbo env list), no value (`git log --all -p -G 'service:space-explorer'` → 0). left: dima revokes the old key in Studio, glances the vercel activity log.

2026-10-22 15:27: vercel space-explorer-ui — 5 APOLLO_*/PORT vars removed in production + preview (10/10 exit 0, re-list 0; dima's typed line). the new key is a PERSONAL key (user:gh.dvakatsiienko:…), not a graph key; the old one was 55 chars = service:space-explorer-api-k8tzo:<22> (inference from length + graph id), a graph key on the graph's API Keys page, which shows dima «Restricted area». cclio deleted railway APOLLO_KEY by mistake while probing the guard (no deploy fired; value still in 1password).

2026-10-22 15:36 close: railway now holds PORT + RAILWAY_* only (APOLLO_KEY, _GRAPH_ID, _GRAPH_VARIANT, _SCHEMA_REPORTING deleted on dima's word, no deploy fired); vercel space-explorer-ui holds no APOLLO_*/PORT; the personal key returns API_KEY_MISSING_OR_INVALID (dima deleted it). the old graph key: Studio's own api (signed-in pane) shows dima's account = 1 org «dvakatsiienko», 0 graphs, graph(space-explorer-api-k8tzo) = null — not reachable from his account, so no revoke door exists for him; «Restricted area» shows for a made-up graph id too (the page proves nothing). inference: the graph sits in a deleted or foreign account; a leaked graph key reaches only that graph. W2 answered (what's wrong), W3 answered (fixes). left on his word: archive op://dev/space-explorer-apollo-api (holds a dead key).

close: W1 done (both mails read via himalaya, on the board 10-22) · W2 done (what's wrong: railway's env breach, vercel's integration pulled) · W3 done (fixes: railway now PORT only, vercel's 5 vars removed, the personal key deleted, the old graph unreachable from his account) · W4 done (space-explorer-api was the only railway service)

2026-10-22 18:00: the 1password item was archived 16:31 (op item get → not found); the vercel activity log is dima's eye — not reported back yet, nothing in the env lists pointed at a write
<!-- SECTION:NOTES:END -->
