---
dies-when: the pocket item that cites it closes
---

Ticket: none

# deepsec: adopt for bytes / frame?

Researched 2026-10-21. Repo read at sha `4fa6722` (main, 2026-09-29), npm `deepsec@2.3.10` (published 2026-09-23, `npm view`). Below, "R:" is short for `github.com/vercel-labs/deepsec/blob/4fa6722/`.

## Headline

- **bytes: test drive, then adopt narrowly.** Start with one baseline scan of x-com-chat (it has auth, a database and LLM code), capped by file count. After that, run it for each feature on auth, API or DB diffs. Don't make it a required CI check yet.
- **frame: skip for now.** At most one cheap test run on the Go CLI and the plugin hooks, and only if bytes shows it's worth it. frame is tooling (a CLI plus plugins), not a web service, and Vercel says deepsec "works best for applications and services" (Vercel blog, 2026-05-04).
- deepsec covers first-party code. Renovate and OSV cover dependencies. The two don't overlap.

## What it does and how

- **The pipeline is `scan` → `process` → `revalidate` → `enrich` → `export/report`** (R:docs/architecture.md, 2026-09-29).
  - `scan`: regex matchers only, no AI, free. About 15 s for 2k files (vendor claim). Each file gets a FileRecord with `candidates` and `status: pending`.
  - `process`: the paid stage. It takes batches of pending files (default 5 per batch), sends them to an agent SDK with the system prompt, per-tech "highlights" and INFO.md, and stores structured findings: severity CRITICAL / HIGH / MEDIUM / HIGH_BUG / BUG / LOW, a confidence level, and a recommended fix (R:docs/data-layout.md).
  - `revalidate`: the agent reads the code again and checks git history, then gives a verdict: true-positive, false-positive, fixed or uncertain. It costs about as much as `process`. Vendor claim: it "reduces FP rate by 50%+" (R:docs/architecture.md).
  - `triage`: P0/P1/P2 buckets from the finding text alone, using Claude Sonnet, about 1¢ per finding (R:docs/models.md).
- **Agent backends** (R:packages/deepsec/src/agent-defaults.ts):
  - `codex` is the default, with `gpt-5.5`.
  - `claude` uses the Claude Agent SDK, with `claude-opus-4-8`.
  - `pi` uses GLM.
  - In all of them the tools are read-only (read, grep, find).
- **Matchers**: about 200 built-in files under `packages/scanner/src/matchers/` (tree at sha). Many are gated by tech detection.
  - `init` also asks a model to write "generated matchers" for gaps in your repo's ingress surfaces. These are stored as strict JSON data, never evaluated as code, and checked for regex safety and match explosions. They land in `.deepsec/generated-matchers.ts`, which you review and commit (R:docs/writing-matchers.md).
  - You can also hand-write TypeScript matchers, which are needed for "route without auth helper" style rules. Example: R:samples/webapp/matchers/.
- **Threat-model file**: `init` runs a read-only agent that writes `.deepsec/data/<id>/INFO.md` plus `setup/surface-inventory.json` (R:docs/architecture.md, R:docs/data-layout.md).
  - INFO.md is a few hundred words: what the app does, its auth shape, its threat model and known false-positive sources. It is injected into every `process`, `triage` and `revalidate` prompt, and you're meant to edit it by hand (R:docs/configuration.md).
  - The surface inventory lists each surface's kind (http, rpc, queue, cron, cli, webhook, agent-tool), its exposure and its expected auth primitives.
  - Example: R:samples/webapp/INFO.md (sections: Auth shape, Threat model, False-positive sources).
- **Incremental and resumable**: re-running skips files already analysed, and history is append-only (R:docs/faq.md).

## Real cost per scan

| Source | Setup | Cost | Kind |
|---|---|---|---|
| R:docs/faq.md (2026-09-29) | Claude Opus, concurrency 5, batch 5 | 100 files $25–60; 500 files $130–300; 2,000 files $500–1,200 | vendor claim |
| README (2026-09-29) | "best models at maximum thinking", large repos | "thousands or even tens-of-thousands of dollars" | vendor claim |
| [Roboto Studio](https://robotostudio.com/blog/deepsec-audit-future-of-infosec-agents) (2026-05-14, updated 2026-08-24) | Next.js pnpm monorepo, 176 candidate files, codex `gpt-5.5`, thinking level not stated | process $34.23 + retry $2.72 + revalidate $5.56 = **$42.51**; about 32 min | independent, single run |
| [DeepSecBench results.json](https://vercel.com/ai-gateway/leaderboards/deepsecbench/results.json) (fetched 2026-10-21; Vercel-hosted) | 232 known issues; 50 entry-point files per [implicator](https://www.implicator.ai/repo-radar-deepsec-one-repo-worth-your-week/) | per full run: gpt-6-sol xhigh **$12.76**, recall 35.8%, precision 96%; claude-opus-5 max **$127.93**, recall 28.0%, precision 88%; claude-opus-5 medium $31.96, recall 24.6%, precision 70%; **claude-opus-4.8 max $7.56, recall 5.6%** | vendor benchmark |

- **Thinking level**: the default is `xhigh` for `process` and `revalidate`, and for `claude` it maps to `max` effort (R:docs/models.md; CLI help in R:packages/deepsec/src/cli.ts L317).
- Inference: the `claude` backend's default model, opus-4-8, scores very low on Vercel's own benchmark. If you use Claude, pass `--model claude-opus-5` (or a newer model) explicitly. Whether that slug works in the Agent SDK on your login is ?.
- Inference: bytes has 487 non-test TS/JS source files (my `rg` count, 2026-10-21) and frame has 298 TS/Go/JS files. Only the files matchers flag get processed. A full bytes pass is likely in the range of $40–150 on API pricing, and x-com-chat alone is probably under $30. Both figures are ?.
- Claimed false-positive rate:
  - Vendor: "roughly 10–20%" (Vercel blog, 2026-05-04), and "~10–29% on HIGH+" after revalidation (R:docs/faq.md).
  - Independent: about 5%, 1 of 19 revalidated, in one Roboto run (2026-05-14).
  - Recall is the weaker side: the best benchmark run found about 31–36% of known issues (implicator 2026-08-19; results.json 2026-10-21).

## `process --diff` as a CI gate

- **Direct mode**: `process --diff <ref>` (also `--diff-staged`, `--diff-working`, `--files`, `--files-from -`) scans and AI-reviews only the listed files, including files no matcher hits. It works without `init`, because it auto-creates `data/<id>/` (R:docs/reviewing-changes.md).
- **What the docs say about exit codes**: 0 means no net-new findings, 1 means at least one net-new finding, and anything other than 1 means a runtime error. Findings that already existed on touched files don't count. `--comment-out comment.md` is written only when there are findings.
- **What the code does differently**: it also exits **1** when the quota runs out or any batch errors (R:packages/deepsec/src/commands/process.ts L344–389). So exit 1 is ambiguous. Gate on "exit 1 **and** comment.md exists" to mean findings, and treat exit 1 without comment.md as a broken run.
- **Vendor workflow** (R:docs/reviewing-changes.md): two jobs.
  - `analyze` runs PR code with only `contents: read` and the `AI_GATEWAY_API_KEY` secret.
  - `comment` has `pull-requests: write` but only posts the artifact.
  - Same-repo PRs only, `fetch-depth: 0`, and a global `@anthropic-ai/claude-code` with `CLAUDE_CODE_EXECUTABLE=claude`.
- **No cost cap on `process`**: `--max-cost-usd` and `--max-duration` exist only on `init`/`setup` (R:packages/deepsec/src/cli.ts L117, L212; the `process` options at L285–360 don't include them). For `process`, cap with `--limit <n>` files, `--filter <prefix>`, a lower `--thinking-level`, or a provider spend limit.
- **Monorepo caveat**: issue [#114](https://github.com/vercel-labs/deepsec/issues/114) (2026-07-19) says `--diff` resolved 1 of 17 changed files when the project root was a subdirectory. It was closed 2026-07-26 with only "rogue bot", so whether it's fixed is ?. `--files` worked.

## API key, Vercel Gateway or subscription

- **What the docs claim**: the README and getting-started say your own OpenAI/Anthropic key works and "no Vercel account is needed" (`--model-auth direct --ai-provider anthropic --ai-api-key-env X`).
- **What the code does**: at sha 4fa6722, `ensureConnectedWorkspace` skips the Vercel link **only for `--model-auth local`**. Direct and custom routes still call `ensureVercelLink` (R:packages/deepsec/src/auth/ensure-connected-workspace.ts L108–139). R:docs/vercel-setup.md agrees ("The Vercel project link is always required"). Issue [#164](https://github.com/vercel-labs/deepsec/issues/164) (2026-08-24, open) reproduces the Vercel login prompt when using a direct key.
- **Local subscription**: `--model-auth local` uses a logged-in `claude` or `codex` CLI with no key and no Vercel link (getting-started; code above). AI LABS ran it on a Claude Code subscription, and it printed estimated API cost per batch without billing it (video, 2026-05-08).
  - Whether Anthropic's subscription terms cover automated Agent SDK use at this volume is ?.
  - Sandbox fan-out still needs `AI_GATEWAY_API_KEY`.
- **Direct-route bugs**: issues [#55](https://github.com/vercel-labs/deepsec/issues/55) ("Invalid bearer token" with Anthropic direct, 2026-05-06, open) and [#189](https://github.com/vercel-labs/deepsec/issues/189) (Anthropic base URL path dropped, 2026-10-20, open).

## What a Claude Code agent can drive (SKILL.md)

- R:SKILL.md is the `/deepsec` skill. It also ships at `.deepsec/node_modules/deepsec/SKILL.md` after install, with version-matched docs under `dist/docs/` (README).
- The runbook it gives the agent:
  1. Ask the user for the scope: uncommitted changes, diff to main, or the entire codebase (with a cost warning).
  2. Detect onboarding state.
  3. Run `npx -y deepsec init --plan --output json`, then `init --yes --through coverage --output jsonl`, which does install, login, threat model, matchers and the regex scan, but **no paid processing**.
  4. Run `cd .deepsec && npx deepsec process --diff-working | --diff origin/main | process`.
  5. Read the results: exit 2 means input is needed (for example `VERCEL_AUTH_REQUIRED`), exit 3 means a cost or duration boundary was hit (resumable), and the agent must not run an interactive login itself.
- Fit for the crew (inference): a coder or the verifier can run `process --diff origin/main` on a PR branch and attach the export to the review. The SKILL's first step is an interactive question, so a headless verifier would call the commands directly instead of the skill.

## Languages and frameworks (R:docs/supported-tech.md + scanner tree)

- **Next.js**: first-class. 13 dedicated matchers (route handlers, server actions, middleware-only auth, and others) plus prompt highlights such as "middleware.ts is not sufficient auth" and "Server Actions are public POSTs".
- **React**: `dangerous-html`, `xss`, `postmessage-origin`.
- **Vite**: no detector. `vite` isn't in R:packages/scanner/src/detect-tech.ts. Vite apps get the React and generic JS matchers. Drizzle and Prisma are detected but have no dedicated matcher.
- **Go**: generic matchers always run (`go-http-handler`, `go-ssrf`, `go-command-injection`, `go-sql-raw`, `go-embed-asset`), plus gin, echo, fiber, chi and gorilla. `cobra` is detected, and a `go-cobra-command` matcher exists in the tree even though the docs call it roadmap. Code wins.
- **AI/agent code**: `agentic-untrusted-prompt-input`, `agent-tool-definition`, `agent-loop-no-cap` and `prompt-leaks-system-prompt` are relevant to x-com-chat and frame's plugins. They are matcher file names in the tree; how good they are is untested.
- **Infra**: `github-workflow-security`, Dockerfile and Terraform matchers always run.
- Python, PHP and Ruby are covered too. Rust, JVM and .NET are detected only.
- The AI stage reads any text source, so a thin regex layer just means more of the work falls on `process` (R:docs/faq.md).

## AI LABS video

- "This One Command Fixed The Biggest Problem Of AI Coding", https://www.youtube.com/watch?v=qkc1j3_k8gs, uploaded 2026-05-08, 10:30 long. English captions were read in full.
- It explains the pipeline: regex scan, batched agent investigation with read-only tools, optional revalidate, git-blame enrichment, and markdown/JSON export with one file per finding including fix steps and repro.
- **Test 1**, an intentionally vulnerable practice app with 10 planted bugs: deepsec reported only 3. The cause was INFO.md, which listed the 10 known bugs, so deepsec treated them as known and looked elsewhere.
- **Test 2**: deepsec found 9 issues. A plain Claude Code review found 39, and 13 of those were in scope. deepsec missed some of these, specifically runtime and CORS-style issues and logic or architecture flaws, because it only looks at what's explicit in regex-flagged code.
- It ran on the Claude Code subscription with no API key.
- The video was made with an early version (manual INFO.md prompt, before the `init` flow) and ends by plugging a paid "DeepSec skill".

## Limits and gotchas

- **Low recall**: the best benchmark run finds about a third of known bugs (results.json, 2026-10-21). It's not a substitute for the verifier or for a human pass on auth code.
- **It acts like a coding agent with shell access** on whatever machine runs it. The analysis phase is read-only and no-network. Prompt injection through vendored code is possible (README; R:docs/vercel-setup.md). A request for a fail-closed read-only profile is open: [#116](https://github.com/vercel-labs/deepsec/issues/116) (2026-07-19).
- **INFO.md**: whatever you list as "known" or "false-positive source" gets de-prioritised (video, 2026-05-08). INFO.md is committed, so in a public repo it's a written map of your auth weak spots. That last point is inference; check whether bytes is public (?).
- **`.deepsec/` is a nested pnpm workspace**: run commands from inside it. Running them from the repo root gave a missing-module error (Roboto, 2026-05-14).
- **Flaky batches**: Codex sessions dropped and needed a retry pass (Roboto). Batches whose output doesn't parse aren't retried: [#91](https://github.com/vercel-labs/deepsec/issues/91) (open). Two overlapping runs can overwrite each other's findings in `--diff` or `--reinvestigate` mode: [#182](https://github.com/vercel-labs/deepsec/issues/182) (2026-10-06, open).
- **Other open issues**: `matchers.exclude` is not honored ([#36](https://github.com/vercel-labs/deepsec/issues/36)), unknown `--matchers` slugs are silently ignored ([#34](https://github.com/vercel-labs/deepsec/issues/34)), and there's no SARIF export ([#40](https://github.com/vercel-labs/deepsec/issues/40)).
- **Doc drift**: the docs say the default concurrency is 5, but the CLI help says "cores - 1" (R:packages/deepsec/src/cli.ts L325). On a laptop, set `--concurrency 2` to keep spend predictable.

## Recommendation and first commands

### bytes: test drive on x-com-chat, $0 API cap via subscription, or about $30 via key

Inference: this uses the local subscription to avoid both the Vercel link and an API bill. Run it in a throwaway branch.

```bash
cd ~/projects/bytes
npx -y deepsec@2.3.10 init --plan --output json            # read-only preview
npx -y deepsec@2.3.10 init --model-auth local --agent claude \
  --model claude-opus-5 --thinking-level high --through coverage
# edit .deepsec/data/<id>/INFO.md: real auth shape of x-com-chat, its DB, LLM tool calls; do NOT list known bugs
cd .deepsec
pnpm deepsec process --filter apps/x-com-chat/ --limit 20 --concurrency 2   # calibrate: read per-batch cost lines
pnpm deepsec revalidate --min-severity HIGH
pnpm deepsec export --format md-dir --out ./findings
```

- If you pay through a key or the Gateway instead, put a spend limit on the provider side, because `process` has no `--max-cost-usd`. For example `init ... --max-cost-usd 30 --max-duration 1h` covers the whole `init` run including processing, if you leave out `--through coverage`.
- Go/no-go (inference): adopt if at least one revalidated HIGH is real and not already caught by the verifier. Otherwise drop it.

### Where it sits in the flow if adopted (inference)

- **Per app, once**: a baseline full scan on each app with auth or a database (x-com-chat, financial, trophy-sys, …). Use `--filter apps/<app>/` so cost stays per app.
- **Per feature or PR that touches auth, API routes, server actions or DB**: the verifier runs `cd .deepsec && pnpm deepsec process --diff origin/main --comment-out ../deepsec.md` and adds the findings to its review against the ticket's exit lines. Only investigate on "exit 1 + file exists". Expect a few dollars per PR (about $0.2–0.6 per file from the FAQ and Roboto numbers; ?).
  - Not a required GitHub check yet: exit 1 is ambiguous, and #114 (monorepo `--diff`) is unresolved.
- **Weekly or monthly**: `scan` (free) to catch new candidates, then `process` on whatever is pending. Revalidate HIGH+ when a stronger model ships, using `--reinvestigate <N>`.
- **Not per commit and not on every app**: the static or design-only apps (cv, sketchbook, design-loupe) have little attack surface (inference).

### frame: skip now, optional one-off later

- If you want a data point, run `init --model-auth local --through coverage`, then `process --limit 30 --filter <go-cli-dir>/` plus the plugin hook scripts. The matchers that fit are `go-command-injection`, `go-cobra-command` and `agentic-untrusted-prompt-input`.
- frame's real risks are prompt injection into agents and shell hooks. deepsec's regex front end and its app-centric threat model fit those less well than a targeted manual or verifier review (inference).

## Could not verify

- Whether `claude-opus-5` is accepted as a model slug through the local subscription route.
- Whether subscription terms cover automated runs at this volume.
- Whether #114 (monorepo `--diff` file resolution) is fixed in 2.3.10.
- Actual candidate counts and cost for bytes (nothing was run).
- Whether bytes is public.
- How good the AI/agent matchers are.
- Two of the cited write-ups weren't checked: dsebastien.net and contextstudios.ai (search results only, not opened).

<!-- end -->
