# impeccable — the refinement recipe

the shape that worked on chords (DOT-254, 2026-09-20): an existing ui dima likes, refined never
redesigned, one codie, one sixth sense, dima judging every pass. codie pointed here by its brief
follows this file; it does not freestyle the tool. the tool's own docs stay the authority for a
verb's mechanics — this file says which verbs, in which order, with which gates.

## before the first verb

1. **plugin + hooks**: `impeccable` is enabled at user scope; its hooks fire on every ui edit in any
   session. leave them for a design lane; `hook.quiet: true` in the app's `.impeccable/config.json`
   when their output floods.
2. **`init` in the APP directory, run in the COORDINATOR's window with dima answering** — never
   in codie's session (dima 2026-09-20: the coder's noise and register made the interview
   hard to follow; the coordinator's window is quiet and its answers land on his lane), never the
   repo root of a multi-tool repo (one product record over unrelated tools steers nothing). the six categories the README names are
   all in the template under other headings; **voice is the one init tends to skip** — ask it.
   `buildPath: code` when no image generation exists. `PRODUCT.md`'s want block is ours (`clio:shape-idea`), the rest is init's: hand edits there are
   banned, a stale line waits for the next `init`.
3. **`document` on the incumbent, the coordinator's window again, dima confirming** — records the
   look as it is: tokens off `:root`,
   everything else sampled from computed style on the running page, never from the source the
   author wrote. re-run after `polish`, and whenever a pass changes what it describes.
4. **`shape` per new surface** — an interview, 2–3 questions a round, then a brief the human
   confirms. run it before the surface exists; ground it in the real data ranges first.
5. **the app's AGENTS.md** names PRODUCT.md and DESIGN.md as the authorities and says what each is
   FOR (product before changing what the app does, design before changing how anything renders).

## the passes — one verb, one commit, one A/B, dima's word before the next

order for a refinement: `layout → typeset → harden → audit → polish`. skip `bolder`, `overdrive`,
`delight`, `colorize`, `animate` unless the brief asks. `clarify` rides `polish` unless copy is
the job. **tick each verb off a written list** — `audit` was skipped once by both codie and
coordinator counting step 0 as a pass.

per pass:

- `impeccable context` from the app dir once per session (~30 KB; do not rerun)
- **the A/B baseline is an explicit ref, named in the ping** — `HEAD~1` after a multi-commit pass
  puts the pass in both tabs and reads as «identical»
- a behaviour pass (`harden`) says what to DO to see it (kill the daemon, select no key); a
  visual pass ships a per-route «where to look» list and a before/after screenshot pair
- **measure both themes** against `x:guide-ui-ux` (contrast, the enabled state, re-measure after a structural change); dark is selected per theme, never flipped
- the detector (`impeccable detect --json`) at the end of the pass; every finding closed or named
  with its reason in the ticket. prove the detector with a planted violation before trusting `[]`
- one commit, gates green, the ping: sha · links · where to look

## the sixth sense lane

- opens **at the end of the first verb**, not the phase (the HIGH sat four commits once)
- exit lines are concrete observables («204 chords, 82 + 103 apps, 13 never pressed»), re-read
  against the head when a pass removes something
- the loop and its cap are `x:crew-dna`'s pr pair; a round that closes one scoped line is free; a finding that is a decision goes to dima as a look call
- harness affordances on day one: a port override and a `--data-dir` so a round never writes to
  dima's real data; a write-path probe uses a key nothing is filed under
- the adversarial review lane (coderabbit) runs before sixth sense's first
  round, not when someone remembers (`x:crew-codie` § 3); a long-lived PR is a reason for MORE
  review, never less

## what the tool fights, and who wins

impeccable's craft floor asks for blurred shadows, themed scrollbars, browser surfaces from the
palette. DESIGN.md's committed world wins; every override is **named in the ping, never resolved
quietly**. A themed scrollbar on macos: `::-webkit-scrollbar` rules are ignored the moment a
standard `scrollbar-*` property is also set — one family only.

## measured costs (chords, 2026-09-20)

- impeccable's share of an 800k codie context ≈ 35k tokens (≈ 4.4 %): the skill ×3, six
  references, one context dump. the cost was the measuring, not the skill.
- a verb pass ≈ 25 tool calls; a sixth sense round ≈ 40 min, mostly setup until the harness
  affordances exist, then near zero.
