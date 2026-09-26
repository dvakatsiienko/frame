---
name: evergreen
description: load when dima types /cclio:evergreen, asks «updates?», «what's new in deps», «anything to merge?», says «approve evergreen», or when the boot finds open renovate PRs — the news layer over renovate + brew, and the merge hand.
---

# /cclio:evergreen 🧬 — the news layer over renovate and brew

renovate opens the PRs (`renovate.json` in `bytes` and `frame`: patches daily + automerge on
green, minors monday 09:00 kyiv, majors one PR each with no schedule so they land as found after
the 3-day cooldown, 0.x never automerges). this skill is the half a bot cannot do: **read, judge,
tell dima only what he would want to know, act on his word.** 🌲 is her commit prefix (renovate
writes it), 🧬 her voice here. cadence: **daily, at boot, whenever PRs exist** (dima 2026-09-09:
«try daily first, refine, then loosen»). the digest itself runs in a fork — the boot path stays
light.

## 1. gather

```
gh pr list -R dvakatsiienko/<repo> --search 'author:app/renovate' --json number,title,headRefName,createdAt,statusCheckRollup,body
brew outdated --json=v2 --greedy   # the brew lane, same digest
brew list --pinned
brew --version                     # brew ITSELF — a major is a digest line; auto-update jumped 4 → 7 unseen (2026-09-14)
pnpm skill:evergreen-apps          # the apps lane — due when the boot digest says a monday passed since the last mark
```

**the apps lane** — the self-updating apps neither renovate nor brew reads: raycast, claude code,
wispr flow, cursor, linear, claude desktop / cowork, superwhisper, obsidian, notion, things,
cleanshot x, 1password, bartender, newton, chrome. `cclio/evergreen/sources.json` is the index
(one entry per app: changelog url, read shape, the `marker` = newest entry the last run saw); the
reader prints every entry newer than its marker, the skill judges, then `pnpm skill:evergreen-apps
--mark` advances the markers — **after the digest went out, never before.** the markers make the lane
skip-proof: a run on any day prints everything since the last mark, and the boot digest's `apps
lane` line says when it is due — **a monday has passed since the last mark** — so a missed monday
is caught on the next boot, and a tuesday catch-up still leaves the next run on the coming monday. a dead url or a
changed page shape is fixed in the index by hand, the run never searches. a new app = one hunted
entry; a `⚠️ marker not found` line means the page changed shape — re-seed that marker.

tier from the branch (`renovate/<pkg>-<major>.x` = major; grouped titles say `patch` / `minor`),
age from `createdAt`, ci from `statusCheckRollup`.

## 2. read the release, not the PR body

the PR body embeds release notes but github truncates it. for every major (and any minor that
gets a card):

```
gh api repos/<owner>/<repo>/releases --jq '.[] | select(.tag_name | test("^v?<from>|^v?<to>")) | "\(.tag_name)\n\(.body)"'
```

read the whole range, not the head tag — a `4.1 → 5.0` jump carries every breaking change in
between. a release post on the project's blog beats the github release body when both exist.

## 3. judge — five answers per card

- **brings** — the 1–2 facts he would use, numbers where the release gives them
- **breaks** — two halves, both mandatory: (a) **peer ranges of every dependant** —
  `pnpm why <pkg>` in the repo, then `npm view <dependant> peerDependencies` for each; a range
  that excludes the new major is a hold, whatever the src says (graphql 17 vs `@apollo/server`
  `^16.11.0`, missed by a src-only grep on 2026-09-09); (b) grep the repo for the apis the notes
  name as removed or changed
- **since last major** — on every major card, one clause: `<prev major> shipped <yyyy-mm-dd>, <n> months ago` (dima 2026-09-09, «for curiosity»). npm: `npm view <pkg> time --json`; others: the project's release page
- **machine** — on a pnpm / node / biome major, also grep our own repos for the cli flags we pass (`grep -rn 'pnpm -' home/.claude cclio script` and the bytes scripts): pnpm 12 dropped `-s` and broke every token snippet the same evening (2026-09-09). then `packageManager`, `engines.node`, a cli he runs by hand, a brew formula. the
  repo can be green and his shell still broken
- **🌟 or 🟠** — his taste (interview 2026-09-09): a **rewrite** (zig → rust, a new bundler
  core), a **perf claim with numbers**, a **new capability** he could use → 🌟 with a `🔬 deep`
  block: 2–4 lines of researched facts with the numbers, one source link. a perf claim
  **without** numbers → one line, flagged unmeasured, he asks to detail if he wants. **ci-only
  majors are interesting too** (postgres container, actions) — a card, never silent.
- **💡 borrow** — the fifth answer, on every card that is not silent: what we could take from
  this — a flow of ours it changes, a feature that replaces something we built, a setting that
  shipped with a new default. one line; a card with nothing to borrow prints no borrow line.
  **claude code and linear get the thought on every notable entry**, not only majors — they are
  the tools we run all day (dima, 2026-09-20).
- **silent means absent** — a silent item is never printed, not even as a name (dima 2026-09-21: «if
  formulas didn't update, do not print them»); a section with nothing notable is its header line
  alone (`🍺 brew — 22 outdated, nothing notable`). silent: patches, minors without a notable api, brew patch bumps, libs nobody drives by
  hand. minors fold into one monday line: `k minors, notable: …`. **the apps lane obeys the
  same silence**: a fix-only release prints nothing, a feature change or a new feature is a
  🟠 line, a rewrite or a capability we would use is a 🌟 card with the borrow line.

## 4. the report — cards, plain reply, never a fence

```
🧬 evergreen — <weekday dd-mm>, <n> majors open, <n> minors, <n> patches merged since <last>

🌟 <pkg> <from> → <to> — [repo #N](url) (+ [repo #M](url) when one release hits both), ci ✅
- **brings** — …
- **breaks** — nothing we use | <what>, <where>
- **since** — <prev> shipped <date>, <n> months ago
- 🔬 **deep** — 2–4 sentences with numbers. [source](url)
- ➡️ merge | coder | hold

🟠 <pkg> <from> → <to> — [repo #N](url), ci ✅
- **brings** — …
- **breaks** — …
- ➡️ merge

🍺 brew — <n> formulae + <m> casks outdated, <pinned or none pinned>, <k> worth a look
- 🟠 <formula> a → b — one line why (a major, or a tool he drives by hand with a notable change) [notes](url)
- 🟡 <formula> a → b — same, for a notable minor

📲 apps — <n> apps read, <k> with something to say
- 🌟 <app> <entry> — one line what changed [notes](url)
  - 💡 **borrow** — …
- 🟠 <app> <entry> — one line why he cares [notes](url)

📋 copy → terminal 📋   ```brew upgrade```   ✂️ end ✂️   ← kept for the day he wants his own hands on it

⏳ waiting on your word: (the ⏳ fence) 1. merge round: <pkgs> ➡️ yes  2. brew upgrade ➡️ yes
```

- the four labels are fixed words in a fixed order so his eye lands on the same spot per card.
- a red ci on any tier → ⚠️ on the card and ➡️ coder. age ≥ 7 days unmerged → `⏳ 9d` before
  the name; the number is the reminder.
- **never restate the changelog.** the release page is one click; the card says why he cares.
- a big week (≥5 cards, or a 🌟 with a real story) → the same cards as an **artifact** with a
  chart where a perf claim has numbers; the chat keeps the ⏳ fence only.
- his knob: «too much» / «missed X» → tighten or widen in `memory/craft-evergreen.md` (create on
  first steer, one line per rule).

## 5. act on his word — «approve evergreen» is the whole round

a plain «approve evergreen» (or «ok» on the ⏳ fence) means: **every ➡️ merge in the report AND
`brew upgrade` (all outdated, pinned never) run now, by cclio, no second ask.** steers inside the
same message («hold #61») subtract from the round.

- **the round ends with a loot in every repo it merged into** (`git pull --ff-only`, or a
  proposed rebase when the tree is ahead too) — patches automerge without anyone saying so, and
  the boot prefetch's ahead/behind line is the tell: behind-only = loot as a freebie at boot.
- **before a merge that moves a shared dependency's major in one app only**, check the repo's one-version
  rule (bytes: the `package-json-shape` hook) — renovate commits skip our hooks, so #95 put jotai 3 in
  atelier beside 2.20.3 in x-com-chat and the next human commit tripped on it. a bump in a deployed app
  is proven by that app's local `pnpm --filter <app> build`, never its typecheck — jotai-devtools broke
  x-com-chat's prod build behind a green typecheck (2026-09-26).
- **merge** → `gh pr merge <n> -R dvakatsiienko/<repo> --squash --delete-branch` — the title
  already wears `🌲 evergreen:`. one back-to-back round per day: each bytes merge costs 6 prod
  deploys, so never one per PR across the day.
- a PR that answers «merge conflicts» after a sibling merged (lockfile) → tick renovate's
  `<!-- rebase-check -->` box in the PR body via `gh pr edit --body-file`; renovate rebases
  within its next scan (~hourly); report it as pending, never rebase by hand.
- **coder** → a red or held-for-migration PR gets a coder on its branch through
  `x:coder-brief` («make this bump green; migrate what the release notes say changed»).
  renovate stops rebasing once a human commit lands, which is right.
- **hold** → a peer-range hold gets `gh pr close --comment` with the range named; renovate
  reopens it on the next release of the package. any other hold: nothing, the age prefix
  carries it.
- **brew** → `brew upgrade` in the background (a long run), the result line in the next reply.
  the same round diffs `~/Applications/*.app` launchers (a `Contents/MacOS/run.sh` calling `steam://`) against `~/Library/Application Support/Steam/steamapps/common`: a launcher with no game folder is a steam tail every cleaner skips — `trash` it, one line in the digest.
- after the round: `git pull` both mains, then `pnpm install` in each (his tree is stale until then; lockfile-driven, fast); a merged bytes round redeploys prod, say so. `pnpm dedupe` is its own deliberate commit once in a while, never a reinstall — a wipe re-resolves peers and floats transitives, which is the «different lockfile» he noticed.
- **skills lane, weekly with brew** — the agent skills renovate cannot see. the `skills` cli has no
  machine-wide list and no check command: `list`/`update` see the cwd's project OR global (`-g`),
  never both, so every scope runs on its own. the three lockfiles are the source of truth:
  `npx -y skills@latest update -p -y` in `~/projects/bytes` (`skills-lock.json`: next.js, shadcn,
  turborepo) and in `~/projects/bytes/apps/x-com-chat` (the convex set — sat 5 months stale
  because nobody looked there), then `npx -y skills@latest update -g -y` once
  (`~/.agents/.skill-lock.json`, untracked — snapshot it to the scratchpad first). frame has
  no project skills. the digest line per scope is
  the lockfile diff (`git diff -- '**/skills-lock.json'` in bytes, a byte-compare for global);
  a moved hash names the skill.
- **plugins lane, same weekly slot** — a marketplace refreshes itself only where
  `known_marketplaces.json` says `autoUpdate: true` (`x`, warp today); the rest, and a disabled
  plugin, sit still (measured 2026-09-16: impeccable cached 4.2.1, upstream 4.3.1, disabled).
  `claude plugin marketplace update` then `claude plugin update <name>` for those; a bump is one
  digest line and binds next session.

## completion criterion

every open renovate PR is a card or silent with a green ci; every card carries all
five answers, the breaks answer names the peer-range check; every ➡️ is one of merge / coder /
hold; on a monday every app in the index was read and is a line or silent, and the markers
advanced after the digest; on «approve evergreen» every merge and the brew upgrade ran and the
reply names what landed, what waits on a rebase, and the new prod deploy count.
