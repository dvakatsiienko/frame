# TRK-0004 — label system: the needs family, project-meaning ban, standing reversal

status: accepted (dima, 2026-08-19)
supersedes: parts of [TRK-0002](TRK-0002-label-vocabulary.md) — L4's reading, and the role slot it defined.
context: TRK-0002 split `needs-info` by block direction and introduced `standing` and `vet`. a day of use showed three gaps: the block-direction split was incomplete (a third direction exists), one label had started to name a *project* rather than a property of the ticket, and L4's stated reason for `standing` turned out to be backwards in practice.

decision:

- **the needs family is closed at three.** a `needs *` label names what the ticket is waiting on, and the family is now complete: `needs human` (agent blocked on dima's info or decision) · `needs agent` (dima blocked on agent knowledge or research) · `needs data` (no data pool exists yet — gather before deciding). the first two were TRK-0002's L1/L2; `needs data` is the rename of `research`, which described the *activity* instead of the *block*. resist a fourth.
- **`standing` sits In Progress between rounds.** recurring work with no last round — a rolling review, a periodic sweep (DOT-82) — is open by nature, and In Progress is what its state honestly says. this **reverses** TRK-0002's L4, which claimed the label replaced perpetual In Progress. the exception is written into `rules/linear-flow.md`; the label is what marks the state honest, and an In Progress ticket without it is stale, not standing.
- **`vet`** — 🧪 trial an approach before committing to it. unchanged from L5, still on trial: it mutates into `investigate` if the shorter name does not survive use.
- **`walkthrough`** — kept, and it is dima's mark, not an agent's: he wants to be walked through the work as a learning session, never a delegation. an agent applies it only when he says so.
- **labels never name a project.** `harness: home baked` is deleted for exactly this — it named an area of work, which is what projects are for. a label describes a property of the ticket (who does it, what it is, what it waits on); the area lives in the project field. this ban is the general rule, not a note about one label.

consequences: the role slot in `docs/tracker/GLOSSARY.md` becomes `agent · human · needs human · needs agent · needs data`, and the triage role bridge in `docs/tracker/GLOSSARY.md` maps the mattpocock `needs-info` role onto all three by direction. TRK-0002's L3 (`needs-info` retired) and L6 (no hyphens, workspace-level only) stand unchanged. ⚠️ the `standing` label's own description in linear still carries L4's old reasoning and wants a one-line edit — a tracker op, so dispatch's.
