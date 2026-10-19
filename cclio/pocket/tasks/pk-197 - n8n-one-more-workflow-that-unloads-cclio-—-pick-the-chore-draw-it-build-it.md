---
id: PK-197
title: 'n8n: one more workflow that unloads cclio — pick the chore, draw it, build it'
status: done
assignee: []
created_date: '2026-10-19 12:20'
updated_date: '2026-10-19 15:40'
due_date: '2026-10-21'
labels:
  - s
dependencies: []
priority: next
type: wish
ordinal: 10900
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CST 10-18 first-act 2: dima asks for one more n8n workflow that unloads cclio (after the pm flow and composer-receipts / ci-watch ones). pick the chore cclio does by hand that n8n can own, draw it (cclio:author-blueprint), build it. ids so far: pm flow Bl9E59tC1PAuKHuf, composer receipts wKzQdHFvCe4lNanM, ci watch 7RX1k5SibxFz9EAg.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
10-19 17:30, dima asked whether the skill-scan scripts could be n8n instead (exploring, no push). candidates from the FRM-238/239 scan that fit n8n (scheduled, no session, no model): (1) the github notifications sweep — mark read every notification whose pr merged or closed, now halt phase 1.7, nightly; (2) evergreen's gather — renovate prs as rows (tier, age, ci) into an n8n table each morning, so the helper card starts from a table; (3) the until:-ids check — every until: FRM-N line whose ticket closed, posted as a row. session-bound reads (dima's chat lines, the helper count) stay scripts. pick: (1), smallest and fully mechanical.

10-19 17:40, dima o55 ✓: the workflow is the nightly github notifications sweep (out of halt phase 1.7 / halt-sweep.ts's notifications part) — blueprint first (cclio:author-blueprint), then build.

18:22: blueprint drawn — n8n workflow HZP6ukVlhqSRrHDy «📭 gh notifications sweep», export cclio/blueprints/gh-notifications-sweep.n8n.json. **waiting for:** dima mints a classic GitHub token with the notifications scope (fine-grained tokens can't read notifications) → 1Password github-notifications → an n8n credential; then the build replaces the tiles and halt phase 1.7 goes.

18:27: built and live — workflow HZP6ukVlhqSRrHDy published, nightly 03:00; credential from 1Password github-n8n-notifications-sweep (dima renamed it), log table gh_notif_swept. one real run through a temporary webhook: success, 1 notification (an issue) → 0 threads to check, as it should; the mark-read and log nodes have not met a real pr or ci thread yet. halt phase 1.7 now reads the sweep's last execution instead.

18:40: dima 18:29, folded: «I also want this flow to clear out all already read notifications, regardless of notification nature» and «after you change n8n, leave a test run for me». shipped: every read thread, plus an unread merged/closed pr or a ci run of a branch with no open pr, goes to Done (DELETE), not just read; once per thread update (thread + updated_at in gh_notif_swept); Done first, logged only on GitHub's 204, any other answer fails the run. the temporary test webhook made the editor's Execute spin waiting for a call — removed at 18:39; his test run is the editor's Execute workflow. a planted test row (thread 25819296700, updated_at 2000-01-01) sits in gh_notif_swept — delete on his word.
<!-- SECTION:NOTES:END -->
