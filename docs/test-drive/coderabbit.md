# coderabbit — the free local reviewer on trial

Ticket: none
dies-when: the verdict line below is written (2026-10-16) — kept as a lane, or cut from crew-coder's review chain

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
- 2026-10-02 · bytes#119 (design-loupe v1, 55 files) · cli --agent --committed --base main · 3 findings (2 the same README avatar gap, 1 «validate Host» major) · 0 unique real — the avatar gap was already a known skip, the Host finding is false: vite 8's host check answers 403 before plugin middleware (probed with a foreign Host + matching Origin) · free tier · ~4 min
- 2026-10-02 · frame coder/FRM-278 (lane --repo + design:states, branch, no pr) · cli on an older head · 1 unique real (`--ftr` at a dir crashed with a stack trace → exit 2) · matt code-review found the only high (`--repo` into a mid-merge repo would conclude its merge) · free tier
- 2026-10-02 · frame coder/FRM-294 (ab-js + red-proof --pairs, branch, no pr) · cli · 1 finding, 0 unique — the same defect the code-review fork found · free tier
- 2026-10-02 · bytes#120 (design-loupe verify kit, 5 files) · cli --agent --base main · 1 finding, 1 unique real (`kit.sh boards` read green on an empty board list) · matt code-review found 4 others, the ci reviewer 1 (a red-proof claim with no proof on record) · free tier · ~3 min
- 2026-10-05 · frame coder/FRM-268 (jev skill router, 5 files) · cli --agent --base main · 3 findings, 0 on the branch's files — it read ~40 files of other work beside ours · matt code-review found 8 real (an empty router passing the precision refusal, a ms column that was not latency) · free tier · ~2 min
