# herdr — threads — tabs

wish: PK-363 · legend and the other areas: [FTR.md](../FTR.md)

- ⬜ the agents list is one flat list in dima's own order
  - given threads come, go and change state
  - then no Unread or Working section shows, a new thread joins at the end, and a row never moves when its state changes; the dot, the tick and the spinner stay (shot 1932)
  - and dima drags a row to set its place, the order kept across restarts
  - and nothing but his drag changes it: a herdr start that reads no agents yet, a thread that goes, or one restarted in a new terminal (it takes its old place by name)
  - and with one space, no row names it: the «· frame» suffix shows only once a second space exists (shot `looks/PK-363/2001-agents-list-no-space.png`)
  - decision: the order is never trimmed on a read; past 200 addresses the oldest gone ones leave (dima, 19:59: «do not break or change under any circumstances»)
  - not checked: the drag itself, by his hand; a herdr restart with the new code
- ⬜ each tab shows its thread's emoji and session name, with no zoo creature (x-herdr-tabs, FRM-567)
  - given x-herdr-tabs is placed in the layout
  - then every agent tab reads as that thread's row in the agents list and on the deck, a long name cut with an ellipsis and whole on hover; the dot, the tick and the spinner match the agents list's
  - and the tab drops the member word after the badges, «⚡ 🔧 codie: herdr lane | PK-363» → «⚡ 🔧 herdr lane | PK-363», so a cut tab keeps what tells it apart (shot 2025)
  - and an inactive tab shrinks to 110 px at least, so its badge and a readable name both stay (dima's tick, 20:28; shot 2028)
  - and past the bar's width a sideways swipe moves it one tab, and a newly active tab is brought into view (his word, 20:52: the scroll was too fast)
  - and a click, the ×, the + menu and a right-click do what they did under zoo's tabs
  - decision: the agents list reads each session name once and publishes it (`x-herdr-agents.names`); the tab bar reads that, never a second naming rule
  - not checked: in his tab bar, until the layout switch his tick allows (shots 1942 before and after, drawn as an overlay)
- ✅ a sidecar thread starts in its own named tab
  - given helga or crow starts in herdr
  - then it shows in the agents list in a tab named after it, never a number

- ✅ a layout switch closes no tab
  - given a layout is switched or the tab mod reloads
  - then every tab stays open, the focused one too (three switches with a throwaway tab focused, 14:08)
  - decision: our tab mod's own close() took herdr's cleanup call for a tab close and ended the focused tab (herdr-app#861); renamed closeTab
- ⬜ one swipe on the tab strip moves one step
  - given many threads are open
  - when dima swipes the strip sideways or scrolls up or down over it
  - then sideways scrolls the strip by one tab and up or down shows one tab over, once per gesture, however long its momentum runs
- ✅ crow's 🐦‍⬛ draws whole
  - given a session name holds an emoji with a zero-width joiner, which cc's registry stores as a space
  - then the agents list and the deck draw 🐦‍⬛, 🐦‍🔥 and 🙋‍♂️ as one glyph (shot 1416)
