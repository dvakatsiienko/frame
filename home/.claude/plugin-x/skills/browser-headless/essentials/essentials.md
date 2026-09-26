# web ui essentials — the checks every web verify pass runs

Two scripts, run on every view the change touched. The coder runs them before its ping; the
verifier runs them again and its report carries the line `essentials: <n> pass · <m> fail`.
A failure is a defect like any other: the coder fixes it, the verifier re-checks.

```bash
S=<this skill's base dir>/essentials
agent-browser eval "$(cat $S/essentials.js)"            # one state of one view, ~0.5 s
$S/tab-walk.sh [--deny '<selector>'] [--list]            # one view, ~0.2 s per tab stop
```

Run `essentials.js` on every state that changed (selected, open, empty, loading, error) at 1280
and again at 390 wide (`agent-browser set viewport 390 844`). `tab-walk.sh` needs the page open in
`$AGENT_BROWSER_SESSION`; `--deny` takes an app's own opt-outs from its verify recipe.

## what each check guards — and the rule it proves

- **axe** — axe-core 4.13.0 from jsdelivr, wcag 2.2 aa + best practice, `target-size` forced on
  (it ships disabled). a page under a strict CSP: `agent-browser --init-script <axe.min.js>`.
- **overflow** — nothing passes the viewport's right edge; the page never scrolls sideways at 390.
- **ringClip** — a selected or focused element's ring fits inside every box that clips it.
  `guide-ui-ux`: a scroll box never clips a focus ring.
- **truncation** — cut text carries its full value in a `title` or an accessible name.
- **images** — every image loaded.
- **cursor** — judged on the element the pointer actually lands on at the control's centre:
  clickables `pointer`, slider thumbs `grab`, slider tracks `pointer`. `guide-ui-ux`: the cursor set.
  it judges only controls inside the viewport: scroll a long panel into view and run it again.
- **console + page errors** — `agent-browser console` and `agent-browser errors`, each cleared
  with `--clear` before the pass; any error line fails it.
- **tab walk** — real Tab presses until focus cycles (cap 200). flags a stop that is zero-size,
  invisible or inside `aria-hidden`/`inert`, has no visible ring, repeats, jumps back up and left
  against reading order, or is the second stop inside one group (radiogroup, toolbar, tablist,
  listbox, menu, grid, toggle group). `guide-ui-ux`: one tab stop per widget.

## what no script checks — drive it by hand

- empty, loading and error states: force each one (empty data, a stubbed failing request, a
  throw) and screenshot it; a blank box with no `role=status`/`alert` fails.
- section isolation: where the app has a dev-only `?crash=<section>`, load each one and confirm
  the other sections still render and answer a click. `guide-react`: one boundary per section.
- anything the app's own verify recipe lists.

A check that misfires on a real app gets fixed here, in one place, never patched in a recipe.
