# vet — a tool on trial is used as often as possible, measured every time

dima, 2026-09-28: «encourage yourself to proactively use all vetted tools and to ensure the widest
vetted tools exploration … explore strong and weak sides, upfront.» sharpened 2026-09-29: «vet means
- try to use it as much as possible, not just «park» there and wait until vet period ends … each vet
is measured as much as possible, to have numbers.»

a vet is a running measurement (`docs/vet/<tool>.md`). a parked vet grades nothing, and the tool is
then dropped by silence, not by data.

- **day 0, two passes, both before the first real use**, each wide:
  - **the users**: use cases, strong and weak sides, tips and tricks, gotchas. the tool's own blog
    and cookbooks, plus what its users report.
  - **the docs, in full**: walk the whole docs index (an `llms.txt` or the api spec when there is
    one) and list EVERY product and feature, not the headline ones.
  - the output is a **stress list** in the vet file: every feature worth testing, each paired with
    the real fleet ask it will be tried on and the numbers the round will record.
- **every turn, the reach:** a vetted tool is promoted. any ask it could plausibly answer goes
  through it FIRST, beside the usual door. the tell is «i sent it to the usual door» while a vet
  is live (09-28: a docs lookup went to a haiku agent while the `parallel` vet was live).
- **every round is numbers:** seconds, cost, tokens or chars in context, hit or miss, and a grade
  against the usual door on the same ask. a round without numbers is an anecdote.
- **widest, not deepest:** one real try per stress-list feature beats ten tries of the one that
  already works. an untried feature at the verdict is named as untried, never folded into «fine».
- **the verdict date is in `_reminders.md`;** the verdict line (adopted / dropped) closes the file.

live vets: `parallel` (to 10-06) · `adhd` (to 10-05) · `quicksilver` (to 10-12) · `browserbase` (to 10-05, stress list in `docs/vet/browserbase.md`) · `cc-cloud` (to 11-04, when the credit expires) · `exa` (to 10-06, head-to-head with `parallel`, stress list in `docs/vet/exa.md`).
