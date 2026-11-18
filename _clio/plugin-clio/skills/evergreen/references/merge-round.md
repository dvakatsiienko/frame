# evergreen — the merge round

read by `clio:evergreen` on the evergreen turn: **every ➡️ merge in the report runs then, by clio, no ask** (his «approve evergreen» runs it too); a steer of his («hold #61») subtracts from the round. what the round is for: [the-want.md](the-want.md).

- **the round ends with a loot in both main checkouts, frame and bytes** (`git pull --ff-only`, or a
  proposed rebase when the tree is ahead too); the boot prefetch's ahead/behind line is the tell: behind-only = loot as a freebie at boot.
- **the round upgrades everything upgradable, in one stray batch** after the PR merges (dima, 2026-11-18: «everything upgradable must be upgraded»):
  - the sweep: every non-major row of `pnpm outdated -r` in both repos → `pnpm update -r <pkg>@latest`; the 3-day `minimumReleaseAge` already hides what may not go yet
  - the majors: each one on the renovate dashboard gets its breaking notes read against our use; no break for us → upgraded in the same batch; a real migration → one orbit ask naming what it needs
  - then every touched app builds, one commit per repo, bytes pushed once
- **the round is done when `pnpm outdated -r` is empty in both repos**, or every row it prints is a major whose migration dima has in orbit, or a named hold: prisma on 7 (its latest is an 8.0 rc), graphql (a peer range, bytes `renovate.json`).
- **before a merge that moves a shared dependency's major in one app only**, check the repo's one-version
  rule (bytes: the `package-json-shape` hook) — renovate commits skip our hooks. a bump in a deployed app
  is proven by that app's local `pnpm --filter <app> build`, never its typecheck — jotai-devtools broke
  x-com-chat's prod build behind a green typecheck (2026-09-26).
- **merge** → `x lane merge-auto <n> --apply`, from that repo's checkout, only on a completed green check run of the pr's head, never on `"checks":null`; a fix pushed by the stray proves the repo's full CI set first, knip included. one back-to-back round per day: each bytes merge costs 6 prod deploys.
- a PR that answers «merge conflicts» after a sibling merged (lockfile) and carries no human commit → tick renovate's
  `<!-- rebase-check -->` box via `gh pr edit --body-file`; renovate rebases within its next scan (~hourly).
- **a red PR gets its fix in the same round**, never parked to the next wednesday: a lint, a cycle or a small migration goes to the stray lane on its branch; a bigger migration gets codie through
  `x:crew-codie` («make this bump green; migrate what the release notes say changed»).
- **a pnpm bump in bytes is a deploy risk**: the round counts as done only when every app's next head is Ready (12.16 → 12.21 moved the store, 2026-11-18).
- **hold** → a peer-range hold gets `gh pr close --comment` with the range named; renovate
  reopens it on the next release. any other hold: nothing, the age prefix carries it.
- **steam tail** → the round diffs `~/Applications/*.app` launchers (a `Contents/MacOS/run.sh` calling `steam://`) against `~/Library/Application Support/Steam/steamapps/common`: a launcher with no game folder is a steam tail every cleaner skips — listed in the digest by path, trashed only on dima's word.
- after the round: install per `x:github-contrib`'s package.json merge bullet; a merged bytes round redeploys prod, say so. `pnpm dedupe` is its own deliberate commit once in a while, never a reinstall — a wipe re-resolves peers and floats transitives, the «different lockfile» he noticed.
  then `/run` every app the round touched (dima, 2026-09-27: «use run as a sanity check everywhere»); a red run is a digest line and a hold on the next merge.
