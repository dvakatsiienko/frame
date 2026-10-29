---
dies-when: PK-120 and PK-235 close
---

Ticket: none

# evergreen borrows: source lane (2026-10-21)

I read every local file on 2026-10-21. The cc changelog is `CHANGELOG.md` on anthropics/claude-code main, fetched with curl on 2026-10-21; I cite it as `CL:<line>`. «inferred» marks a conclusion I reasoned to but did not read. «?» marks a claim I could not verify.

## Vector 1: cc 2.1.300–2.1.306 borrows

Running version: `claude --version` → 2.1.304. The mod types in `x-mod-guard/.claude-plugin/types/claude-code/index.d.ts:1` say «Written by Claude Code 2.1.304».

### `e.isReadOnly` on `tool.check` vs x-mod-guard

- **What it is:** CL:53 (2.1.304) adds `e.isReadOnly` to a mod's `tool.check` event. In the types (index.d.ts, ToolCheckInput, about line 13690 of the file), the engine sets it only when the tool's own check holds the input read-only. «Absent also means the tool cannot say: a careful hook reads it as a write. It is the tool's word, no proof of no effect.»
  - The same flag also sits on the tool.call **result**, after the run (index.d.ts about line 13585). It is not on the tool.call **input**.
- **How guard works today:** guard never decides «read-only». It hooks only `tool.call`: `x-mod-guard/hooks/register.ts:578` for Bash/Monitor, plus `:734`, `:768`, `:797`, `:834`. It has no `tool.check` hook. It decides what a command *writes* instead:
  - `writtenPaths()` in `hooks/rules/overwrite.ts:45` reads `>`/`>>` targets, `tee`, `sd`, `sed -i` and python `open(…,'w')` files, using the parser in `hooks/shell.ts` and `peel()`/`commands()` in `rules/command.ts:132,171`.
  - `heldBy()` (`register.ts:317`) checks those paths against x-mod-holds' store. It returns at once when the list is empty (`:324`).
  - `lookUp()` (`register.ts:519`) stats only overwritten or trashed paths.
  - The `QUICK` set (`rules/hint.ts:167`) only marks commands too fast for the slow-call memory. It is not a read-only list either.
- **Would adopting it delete code?** No:
  - For a read command, `heldBy` and `lookUp` already cost one parse and no I/O.
  - For any other command, guard still needs the named paths, and cc's flag does not give them.
  - Using the flag would mean adding a `tool.check` hook or an extra `$.tool.check` query. That is more code, not less.
- **Available on 2.1.304?** Yes. It is in the 2.1.304 changelog and in the 2.1.304-written types.
- **Verdict: skip.** x-mod-holds' Bash hook (`x-mod-holds/hooks/register.ts:342`) only releases holds after a commit, so it has no use for the flag either.

### Other entries that touch our surface

| # | entry (plain words) | ours: file · function | rank |
|---|---|---|---|
| 1 | CL:203 (2.1.301): a mod `Input` can take `rows`, giving a field several lines tall. The types say it is drawn that tall and Enter submits (index.d.ts about line 5648). | Orbit's note/steer fields in `x-mod-stash/hooks/register.tsx` (the `orbit:asteer` Input about line 4835, `orbit:csteer` about 5008, plus door/lane/plan steer at 4679, 5355, 5458). This undoes the multi-line half of the workarounds.md entry «orbit's note: a wide, roomy text field» (lines 7–14). The width bug #101089 is a separate issue and stays. The changelog says «in the terminal»; whether `rows` draws on the desktop is «?». | **adopt now** (add `rows={2}`, then a desktop probe) |
| 2 | Changelog check | `mods/workarounds.md:4–5` still says «checked against the changelog through 2.1.296». This pass found that none of its upstream issues (#101089, #101090, #99395, #99217, #100797, #101759) is fixed in 2.1.300–306. | **adopt now** (bump the line to 2.1.306) |
| 3 | CL:52 (2.1.304): a `tool.check` answer can carry `decider: "person"`. Only the dialog or a host can approve the ask, and where nobody can be asked it is refused with the mod's reason. | This could replace guard's `# dima-ok:` proof, where Dima's last prompt must name every target: `register.ts:704–731`, `namesWhole` in `rules.ts:155`, and the PROMPT state in `prompt.submit` at `register.ts:867`. It would need a new `tool.check` hook. It goes against guard's «refused with its safe door, never a dialog» (`.claude-plugin/plugin.json` description). Inferred: a --bg session would still be refused, as it is today. | **rider**, Dima's call |
| 4 | CL:256 (2.1.300): `$.ui.view({ agentId })` shows an agent's transcript in the main view. | A 👁 button on a board lane or agent row in `register.tsx` (lane rows near 5355). Inferred: it works only for agents of this session. | rider |
| 5 | CL:254 (2.1.300): `virtualText` in prompt decorations draws text in the prompt box that never enters the draft. | x-mod-stash could ghost «🪐 n asks» into the prompt box. No decoration hook exists today (I grepped `virtualText` and `decorat`: no hits). | rider |
| 6 | CL:255 (2.1.300): the OTel `api_request` event splits `cache_creation_5m_tokens` from `cache_creation_1h_tokens`. CL:204/205/147 (2.1.301–302) add `classifier_verdict`, `permission_mode` and `classifier_category` to `tool_decision`. | Our OTel goes to `schedule/jobs/x-cc-otel/server.ts`, set up in `home/.claude/settings.json:14–20` with `OTEL_LOG_TOOL_DETAILS=1`. The 1h split could measure whether the 🔥 keep-hot ping (`register.tsx:76`, a ping at 50 min) really writes and keeps the 1-hour cache. Inferred: no reader of these fields exists yet (I grepped `cache_creation` and `tool_decision` in frame; only `_clio/script/orbit-cost.sql:13` reads transcript usage). | rider |
| 7 | CL:51 (2.1.304): a transcript line now names a plugin that ran first and skipped one of our mod's hooks. | Free diagnostics for guard and holds, which both hook Bash `tool.call`. | no code (free) |
| 8 | CL:63 (2.1.304): a failed mod reload no longer removes the tools of the version that stays loaded. | This lowers the stakes of guard's «live-hook-red» rule (`register.ts:767–794`, which runs `claude plugin test` before an Edit under a live mod's hooks/). Inferred: the rule is still worth keeping, because a green reload with bad logic is not caught by this fix. | no code |
| 9 | CL:243 (2.1.301): a hook's `.catch` now runs only when the hook itself throws or times out. | Guard's `.catch(() => ({ deny: FAILED }))` at `register.ts:732`, `:794`, `:831`, `:912` keeps its meaning. Inferred: nothing to change. | no code |
| 10 | CL:64 (2.1.304): fixes a lost click on buttons that share a label and have no `key`. | Not our bug: all 34 `<Button>`s in `register.tsx` carry a `key` (awk check). It is not #99395 / pk-198 either. | skip |
| 11 | CL:260 (2.1.300): `agent.spawn` can rewrite a workflow agent's prompt and model. | Guard's `agent.spawn` (`register.ts:881`) only denies, and that already worked. | skip |
| 12 | CL:318 (2.1.300): `updatedInput` from PreToolUse and PermissionRequest hooks is now validated. | Guard rewrites through a mod `next({...e, command})` (`register.ts:614`), not through `updatedInput`. Inferred: not affected. | skip |
| 13 | CL:105 (2.1.304): `settings.read` hooks now get each settings layer. | x-mod-stash only calls `$.settings.read()` (`register.tsx:2279`) and has no hook. | skip |
| 14 | Compaction: CL:109 (the skill list is re-sent after compaction), CL:135 (the Idle compaction row in /config), CL:56 (tool names in the summary), CL:6 (2.1.306, no needless compaction with many MCP tools). | `idleCompaction: false` is already set (`settings.json:321`). Nothing for the mods. | skip |
| 15 | Desktop and bg: CL:164 (fork subagents on by default in desktop and -p), CL:165 (desktop subagents always in background), CL:74 (desktop Bash sees `~/.zshrc` exports), CL:264 (SessionEnd hooks run despite bg commands). | Inferred: CL:164 means guard's fork rule (`register.ts:899`, the why-fork line) now fires in desktop sessions too, which matters for pk-158. CL:74 may help `op-run.sh` find homebrew `op` in desktop Bash «?». Whether CL:264 covers the mod `session.end` event (x-mod-holds `register.ts:307`) is «?». | no code |
| 16 | CL:35 (2.1.305): a docked pane stays within 45% width. CL:30: `Image` draws in iTerm2. | The board opens with no `columns` (`register.tsx:3153`), and stash draws no `Image`. | skip |

- **Cross-session messaging:** 2.1.300–306 has no entry on SendMessage or cross-session messages. The closest are CL:78 (a subagent forgetting work when messaged right after finishing) and CL:88 (agent teams shutdown). I searched the changelog text for «SendMessage», «teammate» and «message».

## Vector 2: our 1Password wiring (item names and paths only)

- **The door:** `frame/script/op-run.sh:6–7` reads the `x-fleet` service-account token from the login keychain (`security find-generic-password -s op-service-account-x-fleet`). It then runs `op run --env-file=op.env -- <cmd>`, with no Touch ID.
- **The references:** `frame/op.env` is tracked in git and holds `op://dev/<item>/credential` for TYPESAFE_API_KEY (typesafe-golden), RAYCONFIG_PASSWORD (raycast-export), PARALLEL (parallel-golden), BROWSERBASE (browserbase-golden), EXA (exa-golden), ELEVENLABS (elevenlabs-golden), GEMINI (gemini-golden), FISH (fish-golden), NOTION_API_TOKEN (notion-api-golden), CODEBERG_TOKEN (codeberg-golden), N8N_API_KEY (n8n-local), FIRECRAWL (firecrawl-golden) and LINKUP (linkup-golden). Line 7, QUICKSILVER_MODEL, is a plain non-secret value.
- **Callers:**
  - `frame/package.json:17,56,58,59,75`: web-bot-blocked:fetch, jev:route/report/test, rayconfig:decrypt.
  - `script/research-lanes.sh:64` and `script/shift-checkup.ts:153`.
  - The skill-route hook (`home/.claude/shelf/hooks/skill-route.sh:15`) and cclio's `boot-prefetch.sh:72,190,268` (jev health, n8n, events), each under a timeout.
  - The x-speak daemon (`schedule/jobs/x-speak/main.swift:355–364`), once per start, about 0.8 s.
  - The quicksilver skill (`home/.claude/skills/quicksilver/SKILL.md:20`).
- **Other ways to the same vault, not through op-run:**
  - x reads secrets in-process with `op read` (`x/go/keys.go:276–289`, Dima's linear key `op://dev/linear-golden/credential`, `keys.go:61`). The comment explains why it avoids `op run`: «`op run` masks a child's stdout» (keys.go:27–28).
  - himalaya builds its own inline keychain-plus-`op read` line for `gmail-himalaya-golden` (`home/.config/himalaya/config.toml:12,17`).
- **Global CLIs:**
  - **gh:** Dima's own login. `~/.config/gh/hosts.yml` has a user and no token line. Inferred: the token sits in gh's keychain entry.
  - **gh writes as the bot:** these go through `plugin-x/bin/github-token-wrap:7`, which runs `GH_TOKEN=$(pnpm github:agent-token)`. That mints a GitHub App token from keychain keys (`keys.go:24–30`).
  - **linear:** x proxies it and passes `LINEAR_API_KEY` (`keys.go:37`). Dima's key comes from 1Password. The _clio/coder OAuth tokens are cached in the keychain.
  - **linear CLI on its own:** it has `~/.config/linear/credentials.toml` with keys `default` and `workspaces`. Where it keeps the key value is «?».
  - **vercel:** `vercel login`'s `~/Library/Application Support/com.vercel.cli/auth.json`. None of the three tokens is in 1Password.
- **bytes:** no 1Password at all (I grepped `op://`, `op-run`, `op run|read|inject`: no hits).
  - Secrets sit in plaintext `.env` files that are gitignored: trophy-sys `.env` / `.env.local` / `.env.dev.local`, x-com-chat `.env` / `.env.local`, financial `.env`.
  - There are also `.vercel/.env.*.local` pulls with `VERCEL_OIDC_TOKEN`. Inferred: they come from `vercel env pull`.
  - The tracked `.env` in `apps/space-explorer-api` (DATABASE_URL) is on purpose (that app's AGENTS.md, 2026-09-27).
- **`op inject`:** no hits anywhere.
- **Where it feels like a workaround:**
  - Every op-run command gets all 13 secrets. There is one env file and no per-command scope.
  - There are two read patterns, because `op run` masks child stdout: x uses `op read` in-process, and x-speak sets `OP_RUN_NO_MASKING` (`home/.claude/rules/fleet-hazards.md:42`).
  - himalaya copies the token-fetch line instead of using one shared helper.
  - Each op-run call spawns `op` once (about 0.8 s, x-speak main.swift:355). boot-prefetch pays that 3 times.
  - A new mac has no way to provision the `x-fleet` token (`docs/test-drive/seed-tart.md:108,123`).
  - bytes and the vercel/gh/linear logins stay outside the vault.

## Vector 3: zod in our code

- **The counts differ from the brief.** frame has **4** files that import zod, not about 8: `home/.claude/mcp-x-cw/src/{shared,cclio,transcripts,handoff}.ts`, all on zod 4.4.3 (`mcp-x-cw/package.json:13`). The other frame hits are a doc (`docs/research/harness-building.md`) and two test fixtures that only name the package (`script/lib/package-json-shape.test.ts:250`, `x-mod-guard/tests/lockfile.test.ts:35`).
- bytes has **6** files on zod 4.6.5. Three more files import only `@hookform/resolvers/zod`: financial Login, Signup and InvoiceForm.
- **frame (mcp-x-cw):**
  - shared, cclio and transcripts only build `registerTool` input schemas (for example `transcripts.ts:55`). The MCP SDK validates those, once per tool call. Not a hot path.
  - `handoff.ts:353,365,366` safeParses `x handoff` output once per call and uses `.data` and `.error.message`. It needs the data, not a boolean.
- **bytes:**
  - `space-explorer-api/src/index.ts:35`: `z.string().email().safeParse(decodedUserEmail).success` runs in the Apollo context, **on every request, boolean only**. This is the one place `.validate()` fits. Inferred: hoisting the schema out of the per-request closure is a gain of the same size, and on a demo app both are negligible.
  - `space-explorer-api/src/datasources/UserAPI.ts:20`: safeParse, then uses `parsed.data`. Needs data.
  - `design-loupe/server/plugin.ts:110,122`: safeParse per POST, then uses `body.data`. Needs data.
  - `design-loupe/server/job.ts:123,126,190`: `.parse` of JSON files on each read. Needs data.
  - `financial/src/lib/schemas.ts`: has `.transform` (line 10). Its route callers (`app/api/invoices/route.ts:9,39`) use `error.flatten()`. Needs errors.
  - `space-explorer-ui/.../LoginForm/resolver.ts`: zodResolver, which works on form events. Not hot.
- **`.validate()` itself:** it shipped in zod 4.6 (blog `packages/docs/content/blog/zod-4-6.mdx`, dated 2026-09-09, PR #6547). It returns a boolean and builds no error.
  - zod's own benchmark (a vendor claim, not an independent measurement) says it is up to 5.9× faster uncompiled and 35× with `z.compile()`, on the failure path.
  - bytes (4.6.5) has it. mcp-x-cw (4.4.3) does not until the evergreen bump to 4.6.7 (`_clio/evergreen/page.html:144`).
- **Verdict:** only `space-explorer-api/src/index.ts:35` would use it, and the gain there is too small to matter.

## Vector 4: bubbletea v2.1.0 for x

- **What x draws:** x's TUI is short-lived.
  - `x/go/run.go:121` runs one inline `tea.Program` per step: a spinner, then a still line. It is built with `tea.WithInput(nil)`.
  - `run.go:148`: `Wait` spins while work runs.
  - `x/go/pager.go:36`: a viewport pager for a board taller than the terminal.
  - `x/go/forms.go`: huh forms (missing args, approve-an-ask confirm, handoff picker).
  - All of these draw only when `r.human` and `r.interactive` are true (`run.go:43–44,87`). Agent calls print plain output.
- **v2.1.0** (release dated 2026-10-08, `gh api …/releases/tags/v2.1.0`) adds OSC 7501 «Program Status Protocol». A program sets `View.ProgramStatus` to idle, working, blocked (permission, question or auth), done or error (`programstatus.go@v2.1.0`, lines 5–34).
  - Detecting support needs input (`RequestProgramStatusSupport`, line 46). x's step programs run with input off, but the code says reports can be sent without detection.
- **Could x use it?** In theory, yes:
  - a step reports `working`, then `done` or `error`;
  - the approve-an-ask confirm (`forms.go:103–107`) reports `blocked/permission`.
  - So a terminal tab could show that x waits on Dima.
- **But no terminal Dima uses is known to support it.** The release names only Superlogical's Rex. Dima's terminals are Warp («the daily one», `frame/Brewfile:106`) and iTerm2 (`:107`). Whether either supports OSC 7501 is «?».
  - Inferred: x runs mostly under agents, where nothing draws. The gain would be the human view only.
- **Other 2.1 changes:**
  - A deadlock fix for the signal goroutine on shutdown (#1806). Inferred: worth having, since x starts and stops many short programs per verb.
  - A 0×0 terminal-size fallback (#1836). Inferred: it could matter for `pager.go` under an odd pty.
- **Verdict:** take v2.1.0 for the fixes. Skip OSC 7501 until Warp or iTerm2 supports it.

## Not verified

- whether `Input rows` draws on the desktop, or only in the terminal (CL:203 says terminal) «?»
- whether `isReadOnly` is set on a `$.tool.check` query, not only on a real call «?»
- whether CL:264's SessionEnd fix covers the mod `session.end` event «?»
- where the linear CLI keeps its key value «?»
- whether Warp or iTerm2 support OSC 7501 «?»

<!-- end -->
