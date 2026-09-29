# vet — a tool on trial is used wide and on purpose, from day one

dima, 2026-09-28: «encourage yourself to proactively use all vetted tools and to ensure the widest
vetted tools exploration … do thorough research and docs exploration to explore a tool's
capabilities and pick useful tools from it to stress test during that period. explore strong and
weak sides, upfront.»

a vet is a running measurement (`docs/vet/<tool>.md`); an unused vet grades nothing and the tool
is dropped by silence, not by data.

- **day 0, before the first real use:** a research pass over the tool's own docs and its users —
  every feature, what it is for, strong and weak sides. the output is a **stress list** in the vet
  file: the features worth testing, each with the real fleet ask it will be tried on.
- **every turn, the reach:** an ask a vetted tool could answer goes through it FIRST, beside the
  usual door, graded in the vet log. the tell: «i sent it to the usual door» while a vet is live
  (09-28: a docs lookup went to a haiku agent while the `parallel` vet was live).
- **widest, not deepest:** one real try per stress-list feature beats ten tries of the one that
  already works. an untried feature at the verdict is named as untried, never folded into «fine».
- **the verdict date is in `_reminders.md`;** the verdict line (adopted / dropped) closes the file.

live vets: `parallel` (to 10-06) · `adhd` (to 10-05) · `quicksilver` (to 10-12) · `browserbase` (to 10-05, stress list in `docs/vet/browserbase.md`) · `cc-cloud` (to 11-04, when the credit expires) · `exa` (to 10-06, head-to-head with `parallel`, stress list in `docs/vet/exa.md`).
