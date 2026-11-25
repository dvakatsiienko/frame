# the false-open hunt — the first step of every lowtide

dima, 2026-11-25 13:26, folded: «hunt stray tickets everywhere that are in a false non-closed state: hanged in progress, and others done but forgotten to close. it is the first step of lowtide always, start with it.»

- `node script/close-net.ts` reads In Progress and the tickets moved back to Todo; a red is fixed first; its green is a label, so every In Progress ticket is opened too (hung: no live member, no commit or comment in 2 days)
- every open ticket of FRM and BYT, In Progress included, whatever its scope (`someday`, `snoozed` off; a live lane's hit goes to its coordinator), goes to a `helper` card: a hit names hard evidence (a landed sha, a done report, a part that exists at `path:line`, a past `⏰ due:`), never its title; it counts what it covered per team and state
- each hit is checked at its source by you, then: built and proven → the close flow with its ask-guard (`clio:pm` `references/closing.md`); hung with nobody on it → Todo with a dated `⏰ due:`; superseded → the close that names its successor
- done: every open ticket of both teams was covered, and the hits reach dima in one list, each with its evidence
