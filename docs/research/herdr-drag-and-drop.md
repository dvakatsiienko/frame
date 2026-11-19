---
dies-when: the top-tabs drag and the agents-list drag fix are built from it
---

Ticket: none

# herdr drag and drop: what the mod api gives, why ours feels clunky, how to build a good one

wish: PK-455 (W1–W4). read on herdr-app 0.1.16 (`herdr-app --version`), 2026-11-19, by the stray codie. read-only: no mod was edited.

**the verdict**: the clunk is mostly ours, and it was copied. herdr gives a mod no drag api, only press, move-while-hovered and release. inside that api a much better drag is possible: a lifted row on press, a grab cursor, a row that follows the pointer, neighbours that slide, an insertion line. three things only herdr can fix: moves outside the element, a release outside it, and a scroll area a drag can push. an open upstream pr adds two of them ([herdr-app#769](https://github.com/herdrdev/herdr-app/pull/769)).

## 1. what the mod api offers for a drag

- **no drag api.** a mod element has `on_mouse_down(button)`, `on_mouse_up(button)`, `on_mouse_move`, `on_hover`, `on_mouse_down_out` (`~/.config/herdr-app/gpui-kit.d.ts:731-792`); no `on_drag`, `drag_over`, `can_drop` or pointer capture exists in the file (`grep -n 'on_drag\|drag_over\|capture_pointer'` finds none)
- **`on_mouse_move` arrives only while the pointer is over that element** (`gpui-kit.d.ts:732`: «delivered while this element is hovered»); its event carries `position`, `local_position`, `bounds` and `modifiers`, no button state (`gpui-kit.d.ts:474-479`)
- **no release outside the element**: `on_mouse_up` is element-scoped; only the press has an «outside» twin (`on_mouse_down_out`, `gpui-kit.d.ts:785-792`); the window-wide release is an open request ([herdr-app#276](https://github.com/herdrdev/herdr-app/issues/276))
- **the pointer anywhere, by poll**: `window.mouse_position()` in window coordinates (`gpui-kit.d.ts:20534-20535`, the global `window`, `:22270`); it is a read, never an event
- **the moves**: `tab.move {id?, index | by}` and `space.move {id, index}` (`~/.config/herdr-app/herdr.d.ts:55-59`); `space.move` stays inside its machine (`AGENTS.md:101-102`)
- **cursor**: 23 setters, `cursor_grab` and `cursor_grabbing` among them (`gpui-kit.d.ts:2862-2868`)
- **drawing a ghost**: `.relative()` / `.absolute()` with `.left()` `.top()` (`gpui-kit.d.ts:1388, 1462, 1474, 17373`), `.opacity()` (`:1418`), `shadow_sm`…`shadow_xl` (`:18471-18495`)
- **motion in native code**: `.transition(property, ms | {duration, delay, easing})` and `.spring(property)` on `opacity`, `width`, `height`, `left`, `top` (`gpui-kit.d.ts:1227-1230`, `:22060-22068`): a slide or a settle costs the script no frame
- **an anchored layer above the window**: the `Popover` / `Popup` content slot (`gpui-kit.d.ts:636-646`), opened by a trigger: no fit for a ghost that follows a pointer
- **native drags herdr owns, which a mod only configures**:
  - panes: the top-centre grip drags a pane, centre drop swaps, edge drop places beside; `movable` in the layout (`AGENTS.md:244-251`)
  - floating blocks: dragged anywhere, they spring to the nearest edge and third; the mod reads `placement().dragging` (`AGENTS.md:409-425`, `herdr.d.ts:308-315`)
  - files out: `.drag_paths([path], {on})` makes an element a file drag source for terminals (`AGENTS.md:1037-1041`, `gpui-kit.d.ts:794-798`); files in: `.on_drop` gets `event.paths` (`:800`)
  - a dock area: `DockArea` with `drag_tab(group, i)` / `drop_tab(group, i)` and a `drop_indicator` handler (`gpui-kit.d.ts:1321-1331`, `:21753-21762`, `:21880-21902`): a real native tab drag, but only for dock panels, never for herdr's own tabs or our list rows

## 2. how herdr's own lists drag, and how ours does

**herdr's spaces list** (`~/.config/herdr-app/mods/spaces/main.js:460-488`), the pattern every mod copies:

- press: `pressed = id`, no `cx.notify()`: nothing redraws
- move over another space: `over = id`, notify; the source dims to 0.5 and a 2 px accent line shows on the target's near edge
- release on the target: `space.move`; release on the source itself: a select
- that dim and line are the fix for [herdr-app#113](https://github.com/herdrdev/herdr-app/issues/113) («no visual feedback while reordering», closed 2026-10-30); before it, there was none

**herdr's tab bars** (`mods/tabs/main.js:113-116`, our `x-herdr-tabs/main.js:285-300`, shepherdr's `tabs-tasks/main.js:161`, zoo's `my-tabs/main.js:202`): press stores the index, release on another tab runs `tab.move`. **no feedback at all**: no dim, no line, no cursor.

**the top tabs dima sees** are `x-herdr-tab-pills` (the shown layout `itrout`, block `tabs`, `window_drag: true`; `herdr-app status`, `layouts/itrout.json`): **no drag**. its press is swallowed so the bar does not move the window (`x-herdr-tab-pills/main.js:86-90`); a click selects (`:179`).

**our agents list** (`home/.config/herdr-app/mods/x-herdr-agents/main.js:397-450`): the `dnd()` helper, word for word the zoo's (`herdr-zoo/mods/zoo-agents/main.js:275-313`), which itself copies herdr's spaces list. it drags three kinds: your-order rows, tabs inside a space, space headers (`:800-842`, `:947-958`); the list ends a drag on any release and on the pointer leaving it (`:1121-1125`).

what makes it clunky, each from the code:

1. **a press shows nothing** (dima's own words, below): `on_mouse_down` sets `this.drag` with no `cx.notify()` (`:423-426`); the dim needs `over` on another row (`:405-407`), so until the pointer crosses into a neighbour the row looks untouched
2. **nothing moves with the pointer**: no ghost, no follow; the source stays in place at 0.5 opacity
3. **no grab cursor**: rows say `cursor_pointer` at most; no `cursor_grabbing` anywhere in the mod (`grep -c cursor_grab main.js` → 0)
4. **no threshold**: every press is a drag, so a 1 px wobble during a click over a neighbour's edge counts as a drop; the click handler runs beside it
5. **the drop snaps**: the list re-renders in the new order with no `transition`, so the eye loses the row
6. **leaving the list cancels silently** (`:1123-1125`): needed, since a release out there never arrives (§ 1), but nothing says the drag ended
7. **no auto-scroll**: a long list cannot carry a row past the visible part; the list is `overflow_y_scrollbar` (`:1119`) and a mod cannot set a plain scroll offset (only `scroll_to_item`, `AGENTS.md:1023-1027`)
8. **the whole view re-renders per target change** (one `cx.notify()` for a 1,146-line render): inference, not measured; the Metal HUD (`mods/AGENTS.md` § the loop) is the probe

## 3. the line between herdr's limits and our code

**a better drag inside today's api** (no herdr change):

- lift on press: `cx.notify()` in the press handler, the source row raised (`bg(t.raised)`, `shadow_md`), `cursor_grabbing` on the list while dragging
- a 4 px threshold: start the drag only once a move on the list is 4 px from the press (`event.position` against the press's position), so a click stays a click
- a ghost that follows: one `on_mouse_move` on the list container (not per row) tracks `local_position.y`; an `absolute()` copy of the row at that `top`, the source slot left as a dimmed or dashed placeholder
- neighbours that make room: the target index from `y / rowHeight`; rows between source and target shift by one row height with `.transition("top", 120)`
- the drop settles: the ghost's `top` springs to its slot (`.spring("top")`), then the order commits
- escape cancels: the list's focus handle and `on_key_down` (`AGENTS.md:1022`)
- edge scroll, partly: holding the ghost on the first or last visible row calls `scroll_to_item(index ± 1)` on a timer: coarse, row by row

**only herdr can fix**:

- moves and the release outside the element: a drag dies at the list's edge (the tab bar's too); [#769](https://github.com/herdrdev/herdr-app/pull/769) adds `.capture_pointer()`, [#276](https://github.com/herdrdev/herdr-app/issues/276) asks for `on_mouse_up_out`
- a smooth edge scroll: [#769](https://github.com/herdrdev/herdr-app/pull/769) adds `ScrollHandle.offset()`, `max_offset()`, `set_offset()`
- a drag between surfaces (a tab onto a pane, a pane onto the tab bar, a thread onto a space): no mod payload exists; requests [#913](https://github.com/herdrdev/herdr-app/issues/913), [#1233](https://github.com/herdrdev/herdr-app/issues/1233), [#775](https://github.com/herdrdev/herdr-app/issues/775), [#669](https://github.com/herdrdev/herdr-app/issues/669)

so dima's 16 Nov guess («a well-known limitation of herdr») is half right: the edge and the scroll are herdr's; the missing lift, ghost, cursor and slide are ours.

## 4. github: what is reported and who drags well

- 🆕 [herdr-app#769](https://github.com/herdrdev/herdr-app/pull/769), open since 2026-11-09: «dragged tabs and spaces follow the pointer while the others make room». from [#382](https://github.com/herdrdev/herdr-app/issues/382)'s thread: the held tab follows the pointer outside the bar, its old slot a dashed box, a neighbour slides past half, release glides in, Escape glides back, the bar scrolls at its ends. it needs the two api adds above. **the single most useful thing to watch**: merged, it brings both shipped bars a good drag and gives our mods the two missing doors
- [herdr-app#382](https://github.com/herdrdev/herdr-app/issues/382) (open): «tabs snap abruptly», no indicator; the same clunk dima names
- [herdr-app#113](https://github.com/herdrdev/herdr-app/issues/113) (closed 2026-10-30): the spaces list's dim and line, the only feedback herdr ships
- [herdr-app#276](https://github.com/herdrdev/herdr-app/issues/276) (open): a window-wide release; a copy-on-select mod polls macOS through `osascript` for lack of it
- [herdr-app#18](https://github.com/herdrdev/herdr-app/issues/18) (closed): a pane drag api with a live preview
- [herdr-app#222](https://github.com/herdrdev/herdr-app/issues/222), [#326](https://github.com/herdrdev/herdr-app/issues/326) (open): mods could not start a file drag; `drag_paths` now exists in 0.1.16 (`AGENTS.md:1037`), so both look answered but stay open
- [herdr#3144](https://github.com/herdrdev/herdr/issues/3144): «drag-to-reorder agent panel entries», closed not planned 2026-08-23 (the older tui repo)
- [herdr-app#1032](https://github.com/herdrdev/herdr-app/issues/1032): on wayland a synthetic pointer is motion-dead, hover and drag included: no bearing on macOS
- `herdr-core` has no drag issue: `gh search issues --repo herdrdev/herdr-core drag` returns one hit, [#84](https://github.com/herdrdev/herdr-core/issues/84), a clipboard bug
- **community mods**: no one drags better. [herdr-zoo](https://github.com/mysteriousHerb/herdr-zoo)'s `zoo-agents` is the `dnd()` we copied, its `my-tabs` is herdr's bare press/release; [shepherdr](https://github.com/eliasstravik/shepherdr)'s `tabs-tasks` is the same bare tab move; [herdr-folders](https://github.com/chrisggraham/herdr-folders) (`mods/herdr-folders/tree.js:203-227`, pushed 2026-11-16) is the spaces pattern again, its comment the same limit: «gpui-kit has no "mouse up outside" handler, so leaving the list ends the drag» (`main.js:508`)
- [herdr-app#353](https://github.com/herdrdev/herdr-app/issues/353) (open, floating windows can't be resized) states the root plainly: `on_mouse_move` fires only over the element, no capture or drag api, so a custom grip stops tracking when the pointer leaves it

## prior art: how GPUI itself drags (the web lanes)

two web lanes (exa 124 s, parallel 229 s, `research:lanes`) on Zed's GPUI, the engine under herdr; they agree, and both name the same gap:

- 😮 **herdr's engine already has the full drag api; the mod bridge does not expose it.** GPUI's `on_drag(value, constructor)` starts a typed drag past a 2 px threshold and paints a preview view at the pointer; `drag_over::<T>` styles a target; `can_drop` and `on_drop` take it; `on_drag_move` gets moves «inside or outside the source element» ([gpui `InteractiveElement`](https://docs.rs/gpui/latest/gpui/trait.InteractiveElement.html), [div.rs](https://github.com/zed-industries/zed/blob/main/crates/gpui/src/elements/div.rs)). herdr uses it for its own pane, dock-tab and floating drags; a mod gets only `drag_paths` and the dock's `drag_tab`
- **Zed's tab reorder** (`crates/workspace/src/pane.rs`): a `DraggedTab` payload with its own render as the ghost, the insertion side drawn as a left or right border by source vs target index, and an empty drop target after the last tab for «append» ([pane.rs](https://github.com/zed-industries/zed/blob/main/crates/workspace/src/pane.rs)); Zed moved from «highlight the hovered tab» to «show the boundary» because users could not tell which side a tab would land on ([zed#18565](https://github.com/zed-industries/zed/issues/18565), [zed#34740](https://github.com/zed-industries/zed/pull/34740))
- 🧰 **the ux rules the design systems agree on**: feedback on press or lift; a threshold (GPUI 2 px, dnd-kit 10 px for a mouse); a translucent preview that follows; an insertion line (Atlassian's: 2 px with 8 px terminals); neighbours sliding; auto-scroll at edges; Escape cancels and the item springs home; a menu or key path besides the pointer ([Atlassian guidelines](https://atlassian.design/components/pragmatic-drag-and-drop/design-guidelines), [dnd-kit sortable](https://docs.dndkit.com/presets/sortable), [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop), [Material 3](https://m3.material.io/foundations/interaction/gestures))
- where the lanes split from the source read: both web lanes call auto-scroll and Escape «needs api support»; the source read finds Escape reachable today (a focus handle on the list) and a row-by-row `scroll_to_item` scroll, only the smooth scroll waiting on #769

## 5. where dima already described it

- **2026-11-16 21:04**, clio's prompt log (`~/.local/state/clio/prompts/2026-11-16.md:1183`): «drag-n-drop for tabs (top) and agents-list (left) — All drag-and-drops in Herdr currently suck. They are very basic and for example when I start dragging there is no visual indicator that an item is being dragged. The D&D actually works but it doesn't have enough visual feedback … It's just bad UX. From what I know it's a well-known limitation of Herdr»; earlier the same day, `:293`: «drag n drop still sucks»
- **[FRM-567](https://linear.app/x-com/issue/FRM-567)** (cancelled 2026-11-15): «tabs that behave — real drag», W5 (2026-11-12 21:06): «i want good working drag-and-drop for tabs, and actually for the agents list too … ask the codie to probe all doors and find the best way»; its exit line: «the tab follows the pointer, a marker shows the drop»
- **[FRM-618](https://linear.app/x-com/issue/FRM-618)** (the antenna, Todo) took FRM-567's wishes over, plus PK-424:W1 «both use drag and drop»; its re-signed line reads «drag and drop is whatever the native list brings; our hand-rolled reorder is dropped (his 21:04 word: herdr's drag is a known limit, not worth effort)». 📌 this research says the opposite of that premise: most of the clunk is ours to fix
- **2026-11-10**, `prompts/2026-11-10.md:724`: «the ability to drag and drop them and set an order myself», and `:850` «drag a row in the agents list; ← works»

## a good drag in herdr, the recipe

the steps a codie follows for any list or strip, today's api:

1. one drag state on the view, a named machine: `idle → pressed {key, from, at} → dragging {key, from, to, y} → settling → idle`; a cancel path from every state (`x:guide-code` § state)
2. press: record the key and `event.position`, `cx.notify()`; the row lifts (raised bg, `shadow_md`), the list takes `cursor_grabbing`
3. one `on_mouse_move` on the container, never per row: past 4 px from the press, `pressed → dragging`; the target index from `local_position` and the row size, a `cx.notify()` only when the index changes
4. draw: the source slot as a dimmed or dashed placeholder; an `absolute()` ghost at the pointer's offset; rows between source and target shifted one slot with `.transition("top", 120)`, or a 2 px accent line where the row lands
5. release on the container: `dragging → settling`, the ghost springs into its slot, then the move runs once (`tab.move`, `space.move`, the order write); a release with no drag is a click
6. leave the container or press Escape: `→ idle` with the ghost springing home, so a cancel is seen
7. at the edge: `scroll_to_item(i ± 1)` while held on the first or last visible row; smooth scroll waits for #769
8. a key path beside the pointer: the row's right-click menu gets «move up» and «move down» (Atlassian's rule, § prior art)
9. prove it on the real surface: a `herdr-app shot` per state (pressed, dragging, over a target, cancelled) and the Metal HUD across a drag of a 20-row list

## our agents list: what to fix

in `x-herdr-agents/main.js`, in order of what dima sees:

1. `:423-426` the press notifies and lifts the row, with `cursor_grabbing` on the list (his named pain)
2. a 4 px threshold before the drag begins
3. a ghost row on the pointer, from one container `on_mouse_move` replacing the per-row handlers in `dnd()` (`:428-435`)
4. neighbours slide with `transition("top")`; the drop springs in
5. leaving the list springs the ghost home instead of a silent cancel (`:1123-1125`)
6. the same helper for the top pills (`x-herdr-tab-pills`), horizontal, with `tab.move`: the press there is already swallowed (`:86-90`), so a drag fits beside `window_drag`
7. 📌 FRM-618's «drag is whatever the native list brings» line is for clio to re-grill: the native list brings only the dim and the line
