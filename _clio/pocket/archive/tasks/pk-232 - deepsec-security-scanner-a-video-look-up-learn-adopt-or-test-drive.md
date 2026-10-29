---
id: PK-232
title: 'deepsec security scanner + a video: look up, learn, adopt or test drive'
status: done
assignee: []
created_date: '2026-10-21 10:55'
updated_date: '2026-10-25T11:45:00Z'
due_date: '2026-10-26'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 99999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
inbox 2026-10-21, dima, folded: read this video https://youtu.be/y2ifUC9_zuU. deepsec security scanner: look it up, learn it — adopt, or test drive? (composer read «rest drive» as likely «test drive».)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: behind PK-223, dima's plan for 10-21 (low tide, then the coordinator and pm reviews); the board proposes its slot

2026-10-21 15:32 read: the video (AI LABS, «Vercel's CEO Just Unveiled The Greatest AI Coding Workflow Ever», shelf yt-transcripts/ai-labs-vercels-ceo-…-y2ifUC9_zuU, captions ar-orig) = Rauch's 7 agent habits; tip 3 is deepsec. deepsec = vercel-labs/deepsec (Apache-2.0, 8.2k stars, npm 2.3.10): an agent-powered vulnerability scanner; npx deepsec init in a repo, state in .deepsec/; scan (pattern, free) → process (AI review) → revalidate → export; --max-cost-usd caps a run; process --diff gates CI; models via Vercel AI Gateway or our own Anthropic key (--model-auth direct). verdict: test drive on one deployed bytes app (x-com-chat: auth + data) with a cost cap, beside BYT-128 when bytes is touched; frame skips. parked: waits on the next bytes session.

2026-10-21 15:36 deep read (docs/research/deepsec-scanner.md): our own Anthropic key still needs a Vercel login (issue #164); only --model-auth local (the logged-in claude cli, our Max plan) skips it. cost: vendor $25–60 / 100 files on opus; one independent run $42.51 / 176 files, ~5 % false positives after revalidate; the best model finds ~⅓ of known bugs on DeepSecBench; pass --model explicitly (the claude default is old). --max-cost-usd exists on init/setup only; process caps with --limit/--filter. vite apps get only React + generic JS checks; Next.js and Go well covered. process --diff exits 1 on a quota fail too. the second video (AI LABS qkc1j3_k8gs): a plain Claude Code review found runtime/CORS and logic bugs deepsec missed. proposal: a test drive on x-com-chat, --model-auth local, --limit 20, then the verifier runs --diff on auth/api/db PRs.

2026-10-21 15:43 dima: not x-com-chat (touched not soon) — atelier or trophy-sys. pick: trophy-sys — it has a server (src/server/routes.ts) holding a real secret, the PSN NPSSO token; atelier is a local-only vite tool. both are vite, so deepsec runs only its generic React/JS + server checks there. rides the next trophy-sys session (the redesign, BYT-86).

**waiting for:** the trophy-sys redesign session (BYT-86) — the deepsec test drive rides it (dima, 15:43).
re-dated 2026-10-25 from 2026-10-24: no activity on 10-24; the pocket/linear grill (FRM-419 step 2) decides its home today

close: moved to BYT-86 — folded under «from the pocket» (0 of 0 W-lines copied, the rest already in a ticket) (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
