# coderabbit — the free local reviewer on trial

Ticket: none
dies-when: the verdict line below is written (2026-10-14) — kept as a lane, or cut from crew-coder's review chain

dima, 2026-09-30: «move it into test drive for 2 weeks instead? it is not good that it does not finds anything but it
have an unobvious plus — its a free code review still. and CR as a product is actually solid — one of the best code
review tools out there. i don't know why it performs not well. maybe free tier CR's have kinda lower prio so code
review quality lower?»

the question: why does coderabbit find nothing on our prs, when the other layers each find something only they see?
crew-coder's rule cuts a layer with no unique finds after two real prs; this test drive decides with data instead.

## day 0 — to read before the next round

- the free tier vs paid: which model, which checks, what is capped (reviews per hour, file count, diff size) — its
  docs and pricing page, never a guess. the «lower priority on free» idea is dima's hypothesis, unverified
- the cli's modes: `coderabbit review --agent` (what we run) vs `--plain`-like text vs the github app on a pr —
  does the local cli see the whole branch or only the working diff?
- its config: a `.coderabbit.yaml` with path instructions and review profile (chill / assertive) — we run defaults

## stress list — one real pr each, unique finds counted against code-review, the verifier and the ci reviewer

- the local cli with defaults (today's lane)
- the local cli with an assertive profile + path instructions
- the github app on a pr, if the free tier allows it for a private repo
- a pr with a planted bug of each kind the others caught (a duplicate id, a wrong grep scope, a missing test)

## log — date · pr · mode · findings · unique · minutes

- 2026-09-30 · bytes#116 (atelier lens ring, 29 files) · cli --agent · 0 · 0 · — (the BYT-113 coder's retro)
- 2026-09-30 · bytes#117 (atelier favicon) · cli --agent · 0 · 0 · —
- 2026-10-01 · frame #52 (speak gremlins) · 2 findings (CRLF, link punctuation), 0 unique — both also found by matt code-review; verifier 15 real (9 unique), code-review 15 (5 unique) · free tier
