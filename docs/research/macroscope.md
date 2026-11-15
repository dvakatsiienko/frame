---
dies-when: dima's test-drive verdict on macroscope
---
Ticket: none

# Macroscope: worth a test drive?

Checked 2026-11-15.

**The free tier is not generous for 10–30 PRs a week. It is a one-time $100 credit, which our PR sizes burn in about 1–3 weeks. Stopped here, as the brief asked (items 2–4 skipped).**
- There is no free plan. New workspaces get "$100 in free usage" once ([docs/pricing](https://docs.macroscope.com/pricing.md), 2026-11-15). The credit does not expire.
- The only free part that recurs is 1,000 Agent credits ($10) a month. Those cover Check Run Agents and CLI reviews, not the per-KB PR review.
- On frame's last 20 merged PRs, a first Balanced review averages about $3.40. At 10–30 PRs a week that is about $35–100 a week, so roughly $150–450 a month after the credit runs out.

## 1. Free tier

- **Pricing model.** Usage-based with no seat fees, drawn from a prepaid balance ([docs/pricing](https://docs.macroscope.com/pricing.md); [macroscope.com/llms.txt](https://macroscope.com/llms.txt), "Last updated: 2026-11-14").
  - Seat pricing ($30 per active developer per month) was retired for new customers on 2026-03-27 ([docs/legacy-pricing](https://docs.macroscope.com/legacy-pricing.md)).
- **Free usage.**
  - $100 welcome credit per new workspace. "Top-ups and the welcome credit don't expire" ([docs/pricing](https://docs.macroscope.com/pricing.md)).
  - 1,000 Agent credits a month ($0.01 each), which "don't roll over" (same page).
- **Coverage limits.** No limit on repos, private repos or seats is stated. Every repo and person draws from the one balance (same page). The pricing docs and llms.txt name no open-source or individual free plan (searched both, 2026-11-15) «?».
- **PR review cost.** Billed per KB of unified diff (u3), with a 10 KB minimum ([docs/pricing](https://docs.macroscope.com/pricing.md)):

  | Mode | Per KB | Minimum per review |
  | - | - | - |
  | Budget | $0.025 | $0.25 |
  | Balanced (default) | $0.05 | $0.50 |
  | Precise | $0.06 | $0.60 |
  | Ultra | $0.20 | $2.00 |

  - Every push triggers a separately billed review against the last reviewed HEAD, and the 10 KB minimum still applies.
  - Default caps are $10 per review and $50 per PR ([llms.txt](https://macroscope.com/llms.txt)).
  - Auto Refill is ON by default ([docs/pricing](https://docs.macroscope.com/pricing.md)). Turn it off or set a monthly limit before installing.
- **Independent measurement.** `gh pr diff` on dvakatsiienko/frame's last 20 merged PRs, #152–#174, on 2026-11-15:
  - 15 diffs returned, from 4 KB to 308 KB (median about 50 KB, mean about 88 KB).
  - 5 returned nothing (#162, #163, #165–#167). These are probably over GitHub's diff size limit, which would make the cost below a lower bound «?».
  - The first Balanced review averages about $3.40 per PR. Follow-up pushes add at least $0.50 each.
  - Lockfiles and ignored paths aren't billed, so the real figure may be lower. bytes was not measured.
- **How long $100 lasts.** About 30 PRs at Balanced, i.e. 1–3 weeks at 10–30 PRs a week. Budget mode roughly doubles that.

## 2–4. Not answered

The brief said to stop if the free tier isn't generous, so fit, the t3code `.macroscope/check-run-agents` and a verdict are not answered.

One pointer for the caller: Check Run Agents (Markdown-defined custom PR checks) are billed as model cost + 5% on the Agent meter ([docs/pricing](https://docs.macroscope.com/pricing.md)). The 1,000 free monthly credits ($10) would cover a small one indefinitely. That alone might justify a narrow test drive. Not researched.
<!-- end -->
