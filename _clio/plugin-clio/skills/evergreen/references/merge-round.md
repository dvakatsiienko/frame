# evergreen — the merge round

read by `clio:evergreen` § act on his word when dima says «approve evergreen» (or ticks its orbit ask).

a plain «approve evergreen» (or a 🛎️ on its orbit ask) means: **every ➡️ merge in the report runs
now, by clio, no second ask.** steers inside the
same message («hold #61») subtract from the round.

- **the round ends with a loot in every repo it merged into** (`git pull --ff-only`, or a
  proposed rebase when the tree is ahead too) — patches automerge without anyone saying so, and
  the boot prefetch's ahead/behind line is the tell: behind-only = loot as a freebie at boot.
- **before a merge that moves a shared dependency's major in one app only**, check the repo's one-version
  rule (bytes: the `package-json-shape` hook) — renovate commits skip our hooks, so the next human commit trips on it. a bump in a deployed app
  is proven by that app's local `pnpm --filter <app> build`, never its typecheck — jotai-devtools broke
  x-com-chat's prod build behind a green typecheck (2026-09-26).
- **merge** → `gh pr merge <n> -R dvakatsiienko/<repo> --squash --delete-branch` — the title
  already wears `🌲 evergreen:`. one back-to-back round per day: each bytes merge costs 6 prod
  deploys, so never one per PR across the day.
- a PR that answers «merge conflicts» after a sibling merged (lockfile) → tick renovate's
  `<!-- rebase-check -->` box in the PR body via `gh pr edit --body-file`; renovate rebases
  within its next scan (~hourly); report it as pending, never rebase by hand.
- **coder** → a red or held-for-migration PR gets a coder on its branch through
  `x:crew-codie` («make this bump green; migrate what the release notes say changed»).
  renovate stops rebasing once a human commit lands, which is right.
- **hold** → a peer-range hold gets `gh pr close --comment` with the range named; renovate
  reopens it on the next release of the package. any other hold: nothing, the age prefix
  carries it.
- **steam tail** → the round diffs `~/Applications/*.app` launchers (a `Contents/MacOS/run.sh` calling `steam://`) against `~/Library/Application Support/Steam/steamapps/common`: a launcher with no game folder is a steam tail every cleaner skips — listed in the digest by path, trashed only on dima's word.
- after the round: install per `x:github-contrib`'s package.json merge bullet; a merged bytes round redeploys prod, say so. `pnpm dedupe` is its own deliberate commit once in a while, never a reinstall — a wipe re-resolves peers and floats transitives, which is the «different lockfile» he noticed.
  then `/run` every app the round touched (dima, 2026-09-27: «use run as a sanity check everywhere»); a red run is a digest line and a hold on the next merge.
