---
name: writing-for-humans
description: >
  Load EVERY time a message for a human is about to be written — Dima says «write an email»,
  «reply to this», «compose a message», «answer the recruiter», pastes a message asking for a
  response, or an outward-facing text (health update, announcement, readme prose) is about to
  ship. Not for answering dima's own question in the chat. Pairs with matt's writing-for-agents:
  that one writes for machines, this one for people.
---

# writing-for-humans

The output is a message a real person reads without smelling a robot. Dima is the validator of
record; detectors are directional signals only.

## The process

1. **Pick the register.** `casual` (chats, messengers, friends) or `professional` (email,
   job-related, strangers). Unstated → infer from the destination and say which you picked.
2. **Reset the voice.** Whatever output style or fleet formatting is active in the session, the
   draft ignores it — no fleet emoji prefixes, no bullet skeletons, no lowercase law, no ➡️
   lines. The draft obeys only this skill and the register. (The reply *around* the draft stays
   in fleet voice; fence the draft per the copy-paste rule.)
3. **Draft in Dima's voice, not «a human» voice.** Read
   [references/dima-voice.md](references/dima-voice.md) first — few-shot samples and the tell
   list. Rewriting an AI-shaped draft never fully escapes the footprint; drafting in-voice from
   the start is the lever this skill exists for.
4. **Audit, then repair.** Run the `humanize:ai-check` skill's rubric against the draft; then fix
   the flagged spots with the `humanize:humanize` skill's levers — targeted, not wholesale. One
   audit→rewrite round; a second only when the first found heavy tells.
5. **Verify when the message matters** — job mail and anything with an audience; skip it for a
   two-line chat reply. two lanes: `humanize:ai-check`'s forensic score first, then the manual
   gold gate — [pangram.com](https://www.pangram.com) (2,000 words/day free, the accuracy leader),
   run by Dima's hand, never automated. print lane 1, hand the draft to Dima; disagreement between
   the two is itself signal. detector scores are directional, never pass/fail: light editing swings
   every tool 15–30 points. Dima is the validator of record. (🧪 on vet: he compares the lanes
   himself; the lane earns its keep after a few real runs, or goes.)
6. **Hand over fenced.** The final draft ships in a copy fence with a destination ribbon.
   Done when the draft passed the audit and reads like the samples — not when it merely
   answers the prompt.

## Register notes

- **casual** — short, warm, lowercase-friendly, an emoji where Dima would put one, contractions
  everywhere. It may trail off. It never wraps up with a summary sentence.
- **professional** — full sentences, correct casing, still direct and human: no «I hope this
  email finds you well», no «I am writing to», open with the point. Warmth through specificity,
  not through formulas.

## Standing grants

- Health updates and the gazette's outward texts may be proxied through this skill — Dima's
  standing word, given because the first health updates read «machinic».
- The voice corpus is Dima-owned: he refreshes [references/dima-voice.md](references/dima-voice.md)
  samples; agents fix only mechanical rot (dead links, renames) there.
