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

Codie before its ping and sixth sense in every round run one command from this skill's base dir
on every view the change touched:

```bash
<base dir>/essentials/run.sh <url> [--wait <ready selector>] [--deny <selector>] [--allow <check>=<regex>]
```

It runs `essentials.js` and the tab walk at 1280 and 390, scrolls back to the top, counts console
and page errors, and prints one line — the report quotes it as the `essentials:` line. Exit 1 on any
fail. `essentials/essentials.md` is read only on a fail or a misfire; the flags live in `run.sh`'s header.
- `--wait` names what the page shows once its data landed — without it the checks can hit a
  half-rendered page and flake
- `--allow` is the only way a baseline fail stays green, and the line counts every item it allowed —
  an app's `<app>-verify` names its allows with the reason (the page-level sticky bar, chords' n cap)
- a single state (a popover open, an item selected) is one `essentials.js` eval on the open page, or
  `tab-walk.sh` alone
📌 essentials skip `[aria-disabled=true]` — dnd-kit sets it on every draggable item (61 of 84 chords
caps), so a drag-and-drop view needs its own checks for those.
📌 an `outcome_unknown` reply (0.39+) means the daemon lost the answer to a command that may have run: inspect the page state, never retry a click or a type blind.
📌 the tab walk scrolls the page: a screenshot taken after it can lie — scroll back to the top, or shoot before the walk.

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
- 🚫 no playwright/puppeteer for a check — by decision: ~700 ms cold start, a pinned browser cache,
  nothing the verbs above miss (an app may ship one for its own output, as atelier's shots do). A flaky element wants `wait <sel>` then the action, never a script.

## hazards — measured on a chart app, 2026-09-03

- **`press <key>` reaches every window-level key handler, not only the focused element** — inside a
  Base UI popover it fired ~3,000 keydowns, and the last lands after the popover closes and reads as
  «a key leaks through the list». count the keydowns before blaming the app.
- **a long-lived agent-browser session drifts to `visibilityState: hidden`** — css fades freeze at their start, focus-visible buttons read invisible (8 false essentials flags at 390 px), requestAnimationFrame stops. start a fresh session per verify; a suspicious run checks `document.visibilityState` first.
- ⚠️ **an unknown flag is swallowed as a positional arg and reports success** — `screenshot
  out.png --selector x` wrote a png named `--selector` into the cwd with a green ✓. verbs are
  positional: `screenshot <selector> <path>`. check `--help` for the verb before a first use.
- **`click` does not auto-wait** — it fails in 20 ms on an element still loading. `wait <sel>`
  first, then act.
- **`eval` shares one page scope across calls** — a second `const p` dies as «already declared».
  wrap every eval in an IIFE.
- **in a worktree, the isolation guard refuses any command text naming `eval`** — write the js to a
  file and run `ab-js <file> [--session <name>]` (plugin bin): it pipes the file through `eval --stdin`
  and exits with agent-browser's code.
- **`fill <sel> ""` does NOT clear an input** — the old value stays and the verb reports success.
  clearing is `eval` with the native value setter plus a dispatched `input` event.
- **headless chrome ignores ⌘A** — select a field's text with `el.select()` in an eval before typing,
  or the new text is appended.
- **a gesture is tested through chrome's real input path** — CDP `Input.dispatchMouseEvent` type
  `mouseWheel` with `modifiers` (2 = ctrl → a pinch, 4 = meta) and fractional `deltaY`, never a
  page-script `dispatchEvent`, which bypasses the input path and cannot catch an input bug; read the
  state after **every** event, never between bursts.
- **`network route --status` filters requests, it does not set a status** — fake a failing endpoint
  with `--abort`, or a real server error.
- **token bombs:** `network requests` unfiltered ≈ 11k tokens, `snapshot -i` ≈ 6.5k on a dense
  page. always `--filter`, always scope to a selector.

## habits

- `--json` on every verb when the output feeds a decision.
- a page that opens files through the browser's picker (excalidraw.com): override `window.showOpenFilePicker` to hand back the file, then press its Open; the picker itself never shows headless.
- a chart or layout check runs at 390 / 768 / 1280 wide, and reads the console after.
- codie writes «verified in agent-browser: <what, at which widths>» in its report, or says
  «unverified in a browser» — never silence.
