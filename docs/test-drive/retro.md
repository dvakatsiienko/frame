# test drive — mattpocock retro

window: 2026-10-06 → 2026-10-20. the skill: `mattpocock-skills:retro` (v1.3.1) — a fresh agent reads a session transcript and proposes environment fixes in 7 areas: navigation, automated checks, reviewer rules, AGENTS.md size, tool economy, no-ops, information access. human in the loop, never auto-fixed.
why (dima, 2026-10-06): «very-very useful». the question: does an outside reader of the transcript find more than the coder's own self-retro?

## how it runs

- 📌 changed 2026-10-07 (dima): no retro session, ever — a spawned reader pays the whole transcript again (an 800k coder → an 800k retro). coders and verifiers read the SKILL.md at their last act; cclio's runs in its own thread, typed by dima. the old shape, kept for the record: user-only (`disable-model-invocation`), so it ran through the spawn door: a `--bg` session whose prompt starts with `/mattpocock-skills:retro <transcript path>` — or dima types `/retro` in a session
- at each halt: retro over the day's coder transcripts, beside the coders' self-retros; count findings each side, overlap, and how many dima keeps

## log

one line per run: date · sessions read · retro findings · self-retro findings · overlap · kept by dima · tokens · note
- 2026-10-06 · run 1 · 6 transcripts (go coder, verifier, quick-lane coder, 3 spec implementers) · 9 proposals · the brief said «cclio pushes» against crew-coder's `x lane push`, 4 push relays and a 17-min stall on unpushed main · retro-runner (opus) · 5
- 2026-10-07 · in-thread, cclio (dima typed `/mattpocock-skills:retro` before the checkpoint) · read from context, ~0 extra tokens · 6 findings: inline coding bloats context, a refused chain runs nothing, raw push beside `x lane push`, stale usage in desktop sessions, guessed facts, unknown-cli `--help` · dima: «retro was interesting»; finding 1 judged too self-critical (a freebie inline is cheaper than a helper)
