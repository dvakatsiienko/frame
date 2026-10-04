---
dies-when: the first fleet mods ship and their lessons fold into a rule or an x: skill line
---

Ticket: none

# mods — opus source lane (2026-10-04, cc 2.1.289)

Lane edge: read source and the local types, not search snippets. `T` = this build's types,
`/private/tmp/claude-501/bundled-skills/2.1.289/6156c12e2eb6b77efb237349678f3416/plugin-authoring/types/claude-code.d.ts`
(20,422 lines). `R` = `reference.md` beside it. Fetched source copies live in `./src/`.

## 1. prior art — collections and notable mods

**the catalogue that matters: [karanb192/awesome-claude-code-mods](https://github.com/karanb192/awesome-claude-code-mods) ★127**, pushed 2026-10-04.
- scans GitHub nightly, runs `claude plugin validate` on each, grades reach L0–L3; **1740 mods** at the 2026-10-04 scan; site [mods.aidojo.si](https://mods.aidojo.si/) (src/awesome-karanb.md:11).
- categories it uses: dashboards+usage · while-you-wait · git/PR/CI · safety+privacy · memory+context · rendering · agents+workflows · building mods.
- the older list [ray-amjad/awesome-claude-code-function-hooks](https://github.com/ray-amjad/awesome-claude-code-function-hooks) ★3 is pre-rename, 2 plugins, last push 2026-09-10.

**official samples** (unsupported): [claude-code-playground/claude-code/mods](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods) ★99 — `token-weather`, `blast-radius`, `replay-theater`.

**most relevant for a multi-session fleet** (stars from `gh search repos`, 2026-10-04):
- [Nongfsq/frank-claude-cockpit](https://github.com/Nongfsq/frank-claude-cockpit) ★3 — `context-card` (ctx %, cache warm/half/cold dot, weekly %, a «PRs» button) + `pr-pane`: every session in the sidebar group sorted **Needs you / Working / Done / Loose worktrees**, «Ask here» reads another session's transcript without messaging it, refresh 15 s. Closest prior art to a fleet board.
- [nateherkai/claude-code-mods](https://github.com/nateherkai/claude-code-mods) ★7 — Cache Keeper (warm/cold, `/keepwarm`, cold-send guard over 150k, `/board` of all local chats), Recording Mode (masks keys/PII **on screen**), Goal Meter, **Collision Guard** (asks before editing a file another open chat changed in 30 min).
- [hamzafer/claude-code-mods](https://github.com/hamzafer/claude-code-mods) ★64 — mission-control (agents + tool calls + touched files pane), where-am-i, next-steps, agent-radar, browser-lanes («who holds the browser»), merge-gate, session-saver.
- [hoobnn hud](https://github.com/hoobnn/hoobnn-agent-mods/tree/main/claude-code/hud) — «the claude-hud statusline as a mod», quota alerts, forecast, detail pane. Prior art for vector 5c.
- [xuanji86/claude-statuspane](https://github.com/xuanji86/claude-statuspane) — status card above prompt with CI rows «any script or mod can feed».
- [JayDoubleu/aside](https://github.com/JayDoubleu/aside) — read-only side chat in a pane over a tool-less fork (`$.model.fork`).
- [xuanji86/claude-agentpane](https://github.com/xuanji86/claude-agentpane), [Charlie0113-T/agent-flow](https://github.com/Charlie0113-T/claude-agent-flow) — subagent panes.
- [sezaakgun/cc-pr-tracker](https://github.com/sezaakgun/cc-pr-tracker) — watched PRs above the prompt, toast on change (overlaps our `pr-watch.sh`).
- [darrell-tw/darrelltw-mods](https://github.com/darrell-tw/darrelltw-mods) ★57, [zycck/claude-mods](https://github.com/zycck/claude-mods) ★13 (plan progress bars), [oikon48/prompt-rail](https://github.com/oikon48/prompt-rail) ★19 (rail of the session's prompts, click to jump).

Quality signals: most repos are days old (mods GA'd 2026-10-01); star counts are tiny; the scanner's validator pass is the only cross-repo quality bar (src/awesome-karanb.md:154).

## 2. the official material

- **status:** GA in 2.1.287+, on by default; `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` is **ignored** from 2.1.287 ([overview](https://code.claude.com/docs/en/plugins/mods/overview#turn-mods-on-or-off)). Launch post dated 2026-10-01 ([blog](https://claude.com/blog/claude-code-mods)). Issue [#91870](https://github.com/anthropics/claude-code/issues/91870) is still OPEN; «Oct 1: We're live!».
- **what it is:** a plugin with `hooks/hooks.json` → `{"modules": ["./register.ts"]}` (one path, relative to hooks.json) exporting `register(on, options)`; each hook `($, e, next)`, Koa/Express onion (R:20–33; issue: «It is just a middleware»). No DOM, no Node, no npm imports, no dynamic `import()`; everything through `$` (R:23,32).
- **what only a mod can do** (overview): draw panes / the band above the prompt; redraw built-in sites (tool rows, spinner, AskUserQuestion — **not** the permission prompt); hold/answer a tool call; immediate `/command` with no turn; share data between hooks.
- **surfaces:** hooks run everywhere incl. `claude -p`, SDK, cloud, Remote Control; drawing only in terminal + desktop Code tab; VS Code chat panel and `-p` draw nothing; WSL desktop sessions load no plugins (overview «Where mods run»).
- **trust:** not sandboxed; runs as you; can approve tool calls an `ask` rule or your own PreToolUse would stop; sandboxing does not cover processes a mod starts (overview «What a mod can reach»).
- **built-ins:** `cc-plugin-diff`, `-agents-md`, `-sec-default`, `-telemetry`, `-plugin-authoring` (skill only), `-you-should-know` (side agent, notes above prompt, disabled by default; `/plugin enable cc-plugin-you-should-know@builtin`) (overview table). Source of four: [anthropics/claude-code/mods](https://github.com/anthropics/claude-code/tree/main/mods) — diff is the best-written example of a pane (README «What it hooks» table, src/official-diff-README.md).
- **limits** ([reference](https://code.claude.com/docs/en/plugins/mods/reference#limits)): hook 10 s own time (50 ms for `prompt.edit`), `.catch` 1 s, `$.process.run` 30 s default / 10 min max, `$.store` 4 MiB total, fs 4 MiB/file, Text child 10k chars, redraws throttled 10/s (30/s visible pane+band), unasked pane placed only from 144 cols (110 after first open).
- **tooling:** `claude plugin validate <dir>` (`hooks:` / `calls:` lines = the footprint), `claude plugin test <dir>` (`*.test.ts`, kit from `claude-code/testing`, loop surfaces `['terminal','desktop']`), `claude --debug` (R:83–86).
- **the «four habits worth keeping»** ([Addy Osmani, 2026-10-01](https://claude.dev/blog/getting-started-with-claude-code-mods)):
  1. «Lean on the types Claude Code writes for you.» (`.claude-plugin/types/` per load)
  2. «Read props from `e.props`.» (`hasSurvey`, `bodyColumns` are not top-level)
  3. «Plan for hot reload.» (`$.state`, not module variables)
  4. «When a drawing doesn't show, read the log.» (`claude --debug`)

## 3. the four mods dima liked

**halluton/Mindful-Claude** ★92 (repo from 2026-03 as bash/tmux; mod port, last push 2026-09-14), MIT.
- breathing animation in the band while `isWorking`; spinner word becomes the breath phase; `/breathe` settings in `$.store` (src/mindful-register.tsx).
- built on `AbovePrompt` + a `Client` surface module (`./breathe.tsx`, 10 fps) posting `ui.message` back; terminal only (`if (e.surface !== 'terminal') return next(e)`).
- install: `claude plugin marketplace add halluton/Mindful-Claude` → `claude plugin install mindful-claude@mindful-claude`.
- API fit: current shape (`hooks.json` modules, `on`, `$`), tests via `bun test` on pure functions, CI present. README still tells you to set the dead env flag (harmless). Breaks habit 3: state in module `let`s. 📌 a 10 fps animation is exactly the continuously-repainting kind CLAUDE.md warns about.

**ray-amjad/.../plugins/secret-redactor** ★3 (repo), last push 2026-09-10.
- three hooks: `prompt.submit` scrubs the typed prompt; `tool.call` restores real values into tool input and scrubs the result; `prompt.context` scrubs first-message blocks, secrets only (src/redactor-redact.ts:331–365).
- detection: vendor prefixes → entropy ≥3.6 bits/char + mixed case + ≥24 chars → entropy ≥3.0 next to a key name; four noise rules (public ids, word-built names, charsets, bare hex needs a name). Claim: «a large Next.js monorepo down to two hits … both real secrets» — author's claim, no published FP rate (src/redactor-README.md).
- placeholder `[REDACTED-SECRET-164d0c98]`, stable per value, vault in a **module-level** variable.
- install: `/plugin marketplace add ray-amjad/awesome-claude-code-function-hooks` → `/plugin install secret-redactor@awesome-claude-code-function-hooks`.
- API fit: current shape; options via `userConfig`; README still on the dead env flag. Gaps below (vector 4).

**pleaseai/honmoon packages/claude-plugin** ★5, pushed 2026-09-28.
- the plugin is a thin shell over a Rust gateway binary (`cargo install --path crates/honmoon-cli`); without `honmoon` on PATH, command hooks no-op (src/honmoon-README.md).
- ships **both** command hooks (PostToolUse redact via `updatedToolOutput`, UserPromptSubmit **block**, PreToolUse deny of `.env*`/`*.pem`/keys) and a mod `hooks/honmoon.ts` that **rewrites** prompts instead of blocking and **fails closed** (tool output withheld when the engine is down), 8 s budget inside the host's 10 s (src/honmoon.ts:17–22, README:166–183).
- verified on 2.1.263 that a redacted PostToolUse output leaves **zero** raw values in the session `.jsonl` (README «Transcript hygiene — verified»).
- maturity: heavy review machinery, ADRs, tests; but written against the 2.1.263 prototype (note: «a second `on("tool.call")` from the same plugin silently replaces the first», src/honmoon.ts:661) — re-check on 2.1.289. Overkill unless you want the egress firewall.

**augbastos/afkswitch** ★1, v0.6.6, pushed 2026-10-02, MIT.
- `[ AFK □■ ]` switch in the band; click = runs the `/afk` or `/back` **skill** (a model turn); a Python helper is the only writer of `~/.afkswitch/state.json`; command hooks on SessionStart/UserPromptSubmit sync presence; `/afk` notifies reachable peer sessions, `/back` collects a summary (src/afk-README.md, src/afk-hooks via `hooks/hooks.json`).
- rules: «Presence is not permission»; only `/back` ends AFK; no timeout.
- install: `/plugin marketplace add augbastos/afkswitch` → `/plugin install afkswitch@afkswitch` → `/reload-plugins`; needs `python3`.
- API fit: current; terminal-only switch; the mod part is small (`switch.tsx`, 209 lines), the logic lives in skills + Python. Directory copy ships **without** the switch while the directory reviews mods.

## 4. secret redaction

- **typed prompt: yes.** `prompt.submit` may rewrite `text` before the turn and before queueing; «the user message on screen follows» (T:3976–3983). The reference says a plugin that must change a prompt's words everywhere does it here, because the queue's own `queue-operation` record is stored as typed otherwise (R:124). ⇒ the rewrite also changes what dima sees in his own transcript.
- **pasted images: no rewrite, only drop.** `prompt.submit` sees `attachments: [{ type, mediaType?, filename? }]` — «its kind, never its bytes» (T:8531–8561). The bytes are reachable at `session.append` (door `prompt`, Messages-API blocks, media inline) but «an image or document block may be dropped or moved, not changed or added» (R:122). ⇒ blur/redact-in-place is impossible; the possible design is OCR → if a secret is found, **drop the image** and append a text note.
  - OCR path (inference, unbuilt): base64 from the block → `$.process.run({ argv: ['sh','-c','base64 -d | tesseract stdin stdout'], stdin })` (`stdin` exists, T:7680) or a macOS Vision CLI; 30 s run limit, 10 s hook budget excludes `$` call time (reference limits).
  - `$.fs.write` is text only (T:3147) — no binary temp file from the mod itself.
- **what existing redactors do:**
  - secret-redactor: regex + entropy; skips keys named `data`/`base64`/`imageData` — **images untouched** (src/redactor-redact.ts:261); does not hook `session.append`, so a secret that arrives by another door (a delivery, a peer message, a hook's context) is not scrubbed; vault dies on every hot reload/`/reload-plugins` (module `let`) → placeholders already in context can no longer be restored into tool input.
  - honmoon: Tier-1 detectors from a Rust core; image/PDF records «passed through untouched» (README:178); command-hook path can only block prompts, mod path rewrites.
  - nateherk Recording Mode: masks secrets on **screen** (render-side), not what the model reads.
- **false-positive data:** none published by any of the three; secret-redactor ships a keep/hide fixture list (`test/detect.test.mts`).
- **model sees its own writes:** a `tool.call` rewrite means «the model sees what it asked to write» (poteat in #91870); add `context` so it is not confused.

## 5. ideas for this operator

### 5a. a persistent «open asks» stash band (replaces reprinting ⏳)

Feasible, no agent cooperation required.
- **capture, zero tokens:** hook `turn.complete` (`next(e)` resolves `{ text }`, the answer, T:12690–12697) or `classic.Stop` (`last_assistant_message`, T:11570) → parse the fenced `lane` block → write.
- **or explicit write:** `$.tool.register` a model tool `mcp__asks__set` (listed by turn one if awaited in `session.start`, R:139–141, R:186–191) — costs a tool call per reply; the parse route costs none.
- **shared across sessions: yes, with care.** `$.store` is «a key-value store that every session on the machine shares», one JSON file under `~/.claude/plugins/store/` ([reference](https://code.claude.com/docs/en/plugins/mods/reference#mods-api-methods), [interface «Save from more than one session»](https://code.claude.com/docs/en/plugins/mods/interface#save-from-more-than-one-session)).
  - get+set is **not atomic**; the docs' fix is one key per item → key per session id (`asks:<session-id>`), each session writes only its own key.
  - there is **no change event** for another session's write (no watch in `T`); each session polls `$.store.keys()`/`get` on `$.clock.every(…)` and `$.ui.invalidate`.
  - the types say «This plugin's own key-value store» (T:3243–3248) — «own» = per plugin, not per session.
- **draw:** `AbovePrompt` band (terminal + desktop, `maxRows` capped at half the terminal, scrolls beyond; `isWorking`, `hasSurvey` to yield) (T:9703–9757); or a `Pane` for the aggregated cross-session view.
- **copy button:** `Button onPress → $.ui.copy({ text, surface: e.surface })` → `{ isCopied }` via OSC 52/clipboard tool (R:145).
- **verdicts in place:** an `Input` per ask whose `onSubmit` calls `$.prompt.submit({ text, asUser: true })` (T:8516–8528) — answers without dima typing the ask number.
- **hide the reprint:** `ui.render` on `AssistantMessage` can fold the ⏳ fence in the transcript (display only) once the band carries it.

### 5b. AFK toggle + «what you missed» digest

- presence: `$.store` key shared by every session (same race rules) or reuse afkswitch's file.
- terse mode while away: `prompt.compose` appends a `session`-scope section («dima is away: system-only output») (T:4044–4051 docs) — no prompt rewriting needed; or `prompt.submit` context.
- digest: on `turn.complete` while AFK append `{session, time, text summary}` to the store; on back, a pane lists them; `$.model.complete` (Haiku) can compress; `$.model.fork` answers «what happened here» over the cached transcript cheaply (R:144).
- peers: `$.session.send` / `session.receive` exist ([reference «Session»](https://code.claude.com/docs/en/plugins/mods/reference#session)); afkswitch shows the pattern.

### 5c. replacing sline (Go, `statusLine` command, 60 s refresh) with a mod

- **there is no StatusLine render site** (RenderComponent list, T:8841). The settings `statusLine` command stays the only thing in that slot.
- what a mod has instead: `$.ui.status(text)` — one plain-text line per plugin under the prompt (T:2365–2375); `PromptHint` `tail` (dim, terminal only, T:9675–9700); the band (full tree, colour, buttons, Raster).
- data in-process, no stdin JSON: `$.session.usage()` → `{ startedAt, context{tokens,window,percent}, rateLimits[{kind,percentUsed,resetsAt}], cost }` (reference); `session.measure` fires after each turn and on limit changes.
- 📌 `disableAllHooks: true` stops both mods and the custom status line (overview). A mod adds clickable controls and live updates without a 60 s poll; sline's git/focus logic would need `$.process.run` git calls. Verdict: augment (band for the live/actionable bits), keep sline until a mod proves parity — prior art: hoobnn `hud`.

### 5d. other fleet-shaped mods

- **fleet board pane:** sessions × state (needs you / working / idle-with-dirty-tree / done), from `~/.claude/sessions/*.json` + `git status` via `$.process.run`; prior art frank-claude-cockpit `pr-pane`. Directly serves the «hang is mine to break» rule.
- **collision guard:** `tool.call` on Edit/Write checks a store map `path → session` and asks (`$.ui.ask`) before a second session edits the same file; prior art nateherk Collision Guard. Serves the shared-tree hazards.
- **cache keeper:** warm/cold indicator + cold-send guard over N tokens; prior art nateherk, karanb192 `cache-tax`.
- **pr watch band:** move `pr-watch.sh` output into the band (cc-pr-tracker shape).
- **⏳ / format enforcement:** `turn.complete` regex checks (md tables, bare ids) as a toast — the reply-check test drive's natural successor, but it sees text only after the turn.
- **wispr fix-ups:** `prompt.submit` applies the misheard → meant map before the model reads it (shown on screen too).

## 6. does the agent need a dedicated authoring skill?

**Built-in coverage is strong.** `cc-plugin-plugin-authoring` ships with every build:
- SKILL.md: where to write (`~/.claude/dev-mods/<session>/<mod>/`), the three files, hot-reload consent flow, ask→shape table pointing at `examples/pane.tsx`, `band.tsx`, `tool-call.ts`, validate/test/debug loop.
- `reference.md` (182 lines, dense), and the build-exact `claude-code.d.ts` (20k lines with doc comments and examples) regenerated per build — the doc can never drift from the engine.

**What community skills add** (gaps the built-in leaves):
- [BeLazy167/claude-mods-skill](https://github.com/BeLazy167/claude-mods-skill) ★5: a version-tagged **gotchas** table (`$` must not be bound/destructured; one plain hook per event per module; deny after `next` still runs the tool; `{}` return = skipped; denies not logged; empty-deny bug 2.1.260) — written for the early-access flag era, partly stale.
- [karanb192 mod-builder](https://github.com/karanb192/claude-code-mods/tree/main/plugins/mod-builder): a footprint **budget** (plan the `calls:` line, diff it against `validate`), reach levels L0–L3, a drift check of its own references against the build's types, isolated-load proof, threat model.

**Verdict (inference):** no general «how to write a mod» skill needed — the built-in plus types suffice and stay current. Worth a **thin `x:` skill or a rule section** only for *our* conventions: where fleet mods live in `~/frame` (one home per feature), marketplace-as-folder install so `/reload-plugins` re-reads it (R:81), the validate footprint check, red-proof tests looped over both surfaces, no repainting animations, `$.state` over module vars, and the gotchas we hit.

## gotchas

- 📌 the dead flag: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` is ignored from 2.1.287; most READMEs (Mindful, secret-redactor, BeLazy167) still say to set it.
- 📌 module variables die on every reload: secret-redactor's vault, Mindful's config cache. Use `$.state`/`$.store` (habit 3).
- 📌 `$.store` is shared by all sessions, non-atomic, no change event — key per session, poll to see peers.
- 📌 `$.state` resets on `/clear`, `/resume`, `/branch`, and `session.start` does **not** fire again; reload from store on `classic.SessionStart` with `source: clear|resume|fork` ([interface](https://code.claude.com/docs/en/plugins/mods/interface#load-a-saved-value-again-after-clear)).
- 📌 installed-from-git copies don't hot-reload: nateherk: «`/reload-plugins` does not reload it», open a new chat. The exception is a folder marketplace with a relative `source`, re-read on `/reload-plugins` (R:81).
- 📌 per-account gating: nateherk says Anthropic turns mods on gradually; `claude plugin test` «served off» = not yet.
- unasked panes don't appear under 144 cols; open them from a user action.
- `focus`, `closeOnEscape`, `holdToasts`, `autoFocus` accept only `true` — `false` throws.
- the band is shared: returning a tree replaces later mods' drawings; wrap `await next(e)` to keep theirs.
- `Client`, `Raster`, `Image` are terminal-only; `Svg` desktop-only; test both surfaces.
- a failed hook is skipped and the chain continues (fail-open) unless `.catch` answers — matters for any guard.
- `prompt.submit` rewrite is visible to dima, not only to the model.
- permission prompt is not a render site.
- telemetry hooks in an installed mod need `{ to: 'collector' }` or validate fails.
- the GitHub copy of `claude-code.d.ts` can lag the installed build; trust the local one ([reference note](https://code.claude.com/docs/en/plugins/mods/reference)).

## ranked candidates (effort)

1. **open-asks band** — parse ⏳ on `turn.complete`, store per session, band + copy button + per-ask input; cross-session pane later. **M** (S for single-session band).
2. **fleet board pane** — sessions/worktrees/PRs by «needs dima»; adapt frank-claude-cockpit ideas. **M**
3. **collision guard** — store map of recently edited paths per session, ask on overlap. **S**
4. **AFK mode** — presence key, `prompt.compose` terse section, digest pane on return; or adopt afkswitch and add the digest. **M** (S if adopting afkswitch)
5. **usage/cache band beside sline** — `$.session.usage()` + cache warm/cold; keep sline. **S**
6. **secret redaction** — install secret-redactor as-is for text; its reload-lost vault could move to `$.state`, but «any plugin reads any value» there (T:3276–3281), so secrets would be readable by every other mod — keep it in memory and accept the loss; image OCR-and-drop is **L** and unproven.
7. **wispr prompt fix-up** — `prompt.submit` dictionary map. **S**
8. **thin `x:` mods convention skill/rule** — only after the first fleet mod exists. **S**


## web lanes (exa + parallel), 2026-10-04

exa added: datumbrain/claude-code-privacy-guard, unsafe9/claude-tmux-hop, ccplugins/awesome-claude-code-plugins. parallel named no repos.
