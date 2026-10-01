---
dies-when: the ftr ↔ tests checker is built as a skill (or dropped), and this baseline is its first fixture
---

# ftr ↔ tests — does every feature line have a test that proves it?

Ticket: [FRM-286](https://linear.app/x-com/issue/FRM-286) (a child of [FRM-268](https://linear.app/x-com/issue/FRM-268), «next jev builds»)

the checker is skill-shaped first; a hook only if the gaps are real and greenable.

## rounds — date · app · lines · mapped · unmapped · orphan tests · cost · verdict

- 2026-10-01 · atelier (bytes) · 49 ftr lines (18 ✅, 31 🔎) · 20 mapped, every one partial (logic under the line, never the ui) · 29 unmapped · 22 of 67 tests prove no line · 3 min, ~35k tokens of reading (opus medium, one-shot) · **yes, build the checker as a skill, no hook yet**
  - why: 0/49 lines proven end to end; the 5 ✅ error lines rest on manual checks; test names never use the ftr words, so a grep would miss most links — the mapping needs meaning (a skill or a jev pass); most gaps are ui behaviour a node unit test cannot reach → the fix is a browser test lane, not more unit tests; a hook would be red on day one
  - finds: `build.test:17` tests a real feature with no ftr line (the list of other ateliers in sibling worktrees, `server/build.ts:62`); `build.test:9` asserts the 8-char sha while `FTR.md:51` says the ui never shows one — `sha` may be dead data
