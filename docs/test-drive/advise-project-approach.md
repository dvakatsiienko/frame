---
dies-when: a verdict line lands (adopted or dropped) after three real uses
---

# advise-project-approach — on trial

`AaravKashyap12/advise-project-approach` v0.7.2, installed 2026-09-27 at cclio scope through `npx skills`
(upstream ships no marketplace; `cclio/skills-lock.json` pins it). a project-planning skill: intake →
comparables → a recommendation with receipts, a first action that can be proven wrong, and a stop after two
lookups that add nothing.

**the question the test drive answers:** does it change a decision we would have made without it, at a cost worth
paying? three real uses, then a verdict. adopted → evergreen's skills lane learns the cclio scope.

**where it fits:** a project-approach question — a stack, build-or-not, a vendor pick, a mid-build course
correction. not a process question (round 1 showed its report shape bends there).

## rounds

one line each: date · ask · mode · what it changed · cost · gates held?

- 2026-09-27 · the fleet sdlc and a night-shift mode · mid-build, narrow route · 2 comparables (kiro specs + autopilot, copilot cloud agent), the plan-file-is-the-queue idea and «move the merge gate, never delete it» went into the fleet shift plan · 6 tool calls, ~227k tokens (a fork carrying the parent context; the skill's own fetches were small) · yes: intake skipped with stated assumptions, cap held, disprovable first action given
- 2026-09-29 · readaloud tts approach, run «blind» in a fresh opus agent against the day's 3-lane plan · pre-build asked, but it found `speak/` v0 through its cwd and switched to mid-build (the blind setup leaked — a blind run needs a cwd without the work) · matched: the normalizer is the fix · added 4 we lacked: sentence chunking so a mid-text quota death falls back per chunk, a quota pre-flight (`/v1/user/subscription`), a golden normalizer set from real text, and a blind listening test as the disprovable first action · wrong: fish free = «7 min/mo, 500 chars/request» (a stale secondary page; the s2.1-pro-free promo has no cap), gemini «20 rpd» (a text-flash number) · 16 tool calls, ~138k tokens, 101 s · gates held: yes (assumptions stated, comparables with receipts, disprovable first action)
- 2026-09-29 · design process for the fleet (brief + designer skills, first job an atelier redesign) · pre-build, blind by instruction (no local reads) · the load-bearing call: 4 takes on 2 operator-named axes, a brief gate, a vague-brief control run as the disprovable first action; flagged that Claude Design's «import your design system» step breaks the blinding — nobody else caught it · 10 tool calls, ~129k tokens, 97 s · gates held: yes (assumptions stated, comparables with receipts, disprovable first action)

**verdict — adopted (2026-09-29, dima).** three real uses, each changed a decision: the shift's queue model, the chain critique on speak (chunking, quota pre-flight, the blind listening test), and the design process (4 takes on named axes, the blinding trap). a standing habit in `craft-spawning`; the test drive closes here.
