---
name: browser-headless
description: Load BEFORE any browser check of a web app, in every session — cli-born or Code-tab with the Browser pane — «verify in a browser», «does it render», «screenshot», «hover», «check the console», «test at mobile width», a chart that renders blank in the pane — and before writing any playwright or puppeteer script.
---

# browser-headless — `agent-browser` is the fleet's headless browser

The binary is on the mac (`brew "agent-browser"` in the Brewfile), drives the system Chrome
through a daemon, and ships its own agent guide. **The HOW is one command, always
version-matched — read it before the first verb:**

```bash
agent-browser skills get core --full
```

It ships more than `core` — `agent-browser skills list` shows them, and two earn a load on
their own trigger: **`dogfood`** before any exploratory QA pass (systematic exploring, repro
evidence per finding), **`electron`** for a desktop app. The `--help` header points at them, but
nobody reads `--help` twice: check the list once per session before improvising a workflow.

## the essentials — run on every web ui change

A coder before its ping and a verifier in every round run `essentials/essentials.js` (one eval)
and `essentials/tab-walk.sh` from this skill's base dir on every view the change touched, at
1280 and 390 wide. **Run them; reading `essentials/essentials.md` is only needed when a check
fails or misfires.** The report carries `essentials: <n> pass · <m> fail`.

## the split — which browser when

- **`agent-browser`** — every loop, hover sweep, measurement, console/network tail, multi-viewport
  proof, element screenshot. Attach costs ~30 ms per call, so many small calls are the right
  shape; one daemon survives across separate Bash calls.
- **the desktop Browser pane** (`mcp__Claude_Browser__*`) — exists only in a session the Code tab
  created; a cli-born session never has it. Where it exists it is Dima's window and a one-shot
  probe. ⚠️ **`document.hidden` is true for scripts even while the pane is on screen**, so
  `ResizeObserver`/`ParentSize` never measure and every chart renders blank (measured on
  trophy-sys, 2026-09-04: pane saw 2 svgs, agent-browser 58). layout checks go through
  agent-browser, always; the pane is for Dima's eyes.
- 🚫 no playwright/puppeteer, ever — not installed anywhere in the fleet by decision (2026-09-03):
  cold start ~700 ms per run, a version-pinned browser cache, and nothing the verbs above do not
  already cover. A flaky element wants `wait <sel>` then the action, never a script.
- 🚫 no browser mcp — cli only, the resident schema is not worth it.

## hazards — measured on a chart app, 2026-09-03

- ⚠️ **an unknown flag is swallowed as a positional arg and reports success** — `screenshot
  out.png --selector x` wrote a png named `--selector` into the cwd with a green ✓. verbs are
  positional: `screenshot <selector> <path>`. check `--help` for the verb before a first use.
- **`click` does not auto-wait** — it fails in 20 ms on an element still loading. `wait <sel>`
  first, then act.
- **`eval` shares one page scope across calls** — a second `const p` dies as «already declared».
  wrap every eval in an IIFE.
- **`fill <sel> ""` does NOT clear an input** — the old value stays and the verb reports success.
  clearing is `eval` with the native value setter plus a dispatched `input` event.
- **token bombs:** `network requests` unfiltered ≈ 11k tokens, `snapshot -i` ≈ 6.5k on a dense
  page. always `--filter`, always scope to a selector.

- **a gesture is tested through chrome's real input path** — CDP `Input.dispatchMouseEvent` type
  `mouseWheel` with `modifiers` (2 = ctrl → a pinch, 4 = meta) and fractional `deltaY`, never a
  page-script `dispatchEvent`, which bypasses the input path and cannot catch an input bug; read the
  state after **every** event, never between bursts (it caught a pinch-drift regression on #96)
- **headless chrome ignores ⌘A** — select a field's text with `el.select()` in an eval before typing,
  or the new text is appended (two false «failed» repros, 2026-09-25)
- **`network route --status` filters requests, it does not set a status** — fake a failing endpoint
  with `--abort`, or a real server error

## habits

- `--json` on every verb when the output feeds a decision.
- a chart or layout check runs at 390 / 768 / 1280 wide, and reads the console after.
- a coder writes «verified in agent-browser: <what, at which widths>» in its report, or says
  «unverified in a browser» — never silence.
