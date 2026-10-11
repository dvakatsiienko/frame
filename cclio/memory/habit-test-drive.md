# test drive — a tool on trial is used as often as possible, measured every time

dima, 2026-09-28: «encourage yourself to proactively use all vetted tools and ensure the widest
exploration of vetted tools … explore strong and weak sides, upfront.» sharpened 2026-09-29: «vet means
- try to use it as much as possible, not just «park» there and wait until vet period ends … each vet
is measured as much as possible, to have numbers.»

a test drive is a running measurement (`docs/test-drive/<tool>.md`). a parked test drive grades nothing, and the tool is
then dropped by silence, not by data.

- **day 0, two passes, both before the first real use**, each wide:
  - **the users**: use cases, strong and weak sides, tips and tricks, gotchas. the tool's own blog
    and cookbooks, plus what its users report.
  - **the docs, in full**: walk the whole docs index (an `llms.txt` or the api spec when there is
    one) and list EVERY product and feature, not the headline ones.
  - the output is a **stress list** in the test-drive file: every feature worth testing, each paired with
    the real fleet ask it will be tried on and the numbers the round will record.
- **every turn, the reach:** a tool on a test drive is promoted. any ask it could plausibly answer goes
  through it FIRST, beside the usual door. the tell is «i sent it to the usual door» while a test drive
  is live (09-28: a docs lookup went to a haiku agent while the `parallel` test drive was live).
- **every round is numbers:** seconds, cost, tokens or chars in context, hit or miss, and a grade
  against the usual door on the same ask. a round without numbers is an anecdote.
- **widest, not deepest:** one real try per stress-list feature beats ten tries of the one that
  already works. an untried feature at the verdict is named as untried, never folded into «fine».
- **a test drive runs alone in its lane** (dima, 2026-10-02: «don't have any parallel activities … we can only parallelize tools that we have proven by usage»): no parallel spawn and no side ask folded in mid-round; proven tools run beside it, and talk or planning in the thread is not a parallel activity.
- **the verdict closes the file:** `status:` flips to adopted or dropped and the verdict line (adopted / dropped) is written.

**the list has one home** (dima, 2026-10-11, o139: «keep the test drive list only in your single place, so it won't drift»): each `docs/test-drive/<tool>.md` carries `status:` (live · frozen · unsorted · parked · adopted · dropped · closed, for a one-shot measurement) and `until:` in its frontmatter, and `pnpm test-drive:list` prints them grouped; a new test drive is born with both, a verdict flips `status:` the turn it lands.
