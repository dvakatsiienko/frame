# evergreen — gather, read, judge, report

the `helper` card's whole brief (`cclio:evergreen` day flow, step 1): run §§ 1–3, reply with the § 4 report.

## 1. gather

```
gh pr list -R dvakatsiienko/<repo> --search 'author:app/renovate' --json number,title,headRefName,createdAt,statusCheckRollup,body
brew outdated --json=v2 --greedy   # the brew lane, same digest
brew list --pinned
pnpm -C ~/frame outdated -r --format json; pnpm -C ~/projects/bytes outdated -r --format json   # the truth the bot is judged against: after a round every repo package is current (dima, 2026-10-28)
gh issue list -R dvakatsiienko/<repo> --author app/renovate --search 'Dependency Dashboard' --json updatedAt   # older than 2 days → a ⚠️ card first: renovate stopped (bytes sat silent 10-13 → 10-28 under two digests)
pnpm ls -g --depth 0 --json         # the pnpm -g lane: every global's notes over the range read like renovate's; cclio runs `pnpm update -g --latest` after the digest (dima, 2026-10-28)
(cd ~/frame/x/go && go list -m -u -json all); (cd ~/frame/home/.claude/sline && go list -m -u -json all)   # the go lane: direct modules behind, notes read; a quiet lane prints nothing
uv tool list --outdated            # the uv lane: each tool's notes read; cclio runs `uv tool upgrade --all` after the digest
fnm ls-remote --lts | tail -1; fnm current; pnpm --version   # the toolchain lane (dima, 2026-10-28): node's notes are read every run, upgraded only on his word when they bring something; pnpm is always upgraded (brew owns it); after either, `pnpm -C ~/frame toolchain:sync` repins both repos
brew --version                     # brew ITSELF — a major is a digest line; auto-update once jumped 4 → 7 unseen
gh issue list -R dvakatsiienko/<repo> --author app/renovate --search 'Dependency Dashboard' --json number,body   # its vulnerability and abandoned sections are digest lines
pnpm skill:evergreen-apps          # the apps lane — due when the boot digest says a wednesday passed since the last mark
```

**the apps lane** — the self-updating apps neither renovate nor brew reads. `cclio/evergreen/sources.json` is the index and the app list
(one entry per app: changelog url, read shape, the `marker` = newest entry the last run saw); the
reader prints every entry newer than its marker, the skill judges, then cclio's `pnpm skill:evergreen-apps
--mark` advances the markers (the helper card never runs it) — **after the digest went out, never before.** the markers make the lane
skip-proof: a run on any day prints everything since the last mark, and the boot digest's `apps
lane` line says when it is due — **a wednesday has passed since the last mark** — the run fires by itself on a wednesday boot only; any other day it waits for the next wednesday, no ask. a dead url or a
changed page shape is fixed in the index by hand, the run never searches. the os entries (`macos`, `ios`, `ipados`) are read first, every run, and print only on a new release: macOS is the system we run on, the phone and the iPad his supplementaries (dima, 2026-10-28). a new app = one hunted
entry; a `⚠️ marker not found` line means the page changed shape — re-seed that marker.

tier from the branch (`renovate/<pkg>-<major>.x` = major; grouped titles say `patch` / `minor`),
age from `createdAt`, ci from `statusCheckRollup`.

## 2. read the release — every lane, every updated entry

the judge reads notes, never titles. **every updated renovate and apps entry gets its notes read over
the whole range** before step 3 decides anything. **brew is read by use**: a formula or cask whose binary
shows in the last 14 days of our Bash calls or dima's zsh history (one `duckdb` query over the
transcripts plus `~/.zsh_history`) gets the full read, and so does a cask whose app is in `sources.json` or running (`pgrep -x`) — a gui app never shows in a shell history; every other updated one still gets a skim of its newest release headline,
promoted to a full read when the headline names a new capability, a rewrite or a perf number — the
cut saves tokens, never the news (dima, 2026-10-14: «don't cut everything, or evergreens get too bare»;
ccrow: the 96-entry brew read was most of the 350k). the apps lane and renovate keep the full read; a line that
says «notes unread» is a step skipped (dima 2026-09-28: «how this line is useful for me without
knowing whats interesting new in a major?»). the read is heavy (31 entries = ~215k tokens,
~7 min, 2026-09-28; ~350k and 10 min on 10-14), so it runs in the `helper` card (Sonnet 5.5), never a fork or a generic agent,
returning the report as its reply (capped at the printed items, never a file write), with
`parallel-cli extract --full-content` as the first door. no notes anywhere → name the urls
tried; for a major, diff the old and new npm tarballs (commands, flags) and label that inference.

the PR body embeds release notes but github truncates it. for every renovate major (and any minor
that gets a card):

```
gh api repos/<owner>/<repo>/releases --jq '.[] | select(.tag_name | test("^v?<from>|^v?<to>")) | "\(.tag_name)\n\(.body)"'
```

read the whole range, not the head tag — a `4.1 → 5.0` jump carries every breaking change in
between. a release post on the project's blog beats the github release body when both exist.

## 3. judge — the answers per card

- **brings** — the 1–2 facts he would use, numbers where the release gives them
- **breaks** — two halves, both mandatory: (a) **peer ranges of every dependant** —
  `pnpm why <pkg>` in the repo, then `npm view <dependant> peerDependencies` for each; a range
  that excludes the new major is a hold, whatever the src says; (b) grep the repo for the apis the notes
  name as removed or changed; (c) **deprecated or yanked**: `npm view <pkg>@<locked version> deprecated` and deps.dev
  (`curl -s api.deps.dev/v3/systems/npm/packages/<pkg>/versions/<ver>` → `isDeprecated`, `advisoryKeys`) for the version
  we run — a deprecated or advised one is a card line, «a yank is not a cve, and a cve needs no yank»
  (borrowed from dependency-doctor, 2026-10-20)
- **since last major** — on every major card, one clause: `<prev major> shipped <yyyy-mm-dd>, <n> months ago` (dima 2026-09-09, «for curiosity»). npm: `npm view <pkg> time --json`; others: the project's release page
- **machine** — on a pnpm / node / biome major, also grep our own repos for the cli flags we pass (`grep -rn 'pnpm -' home/.claude cclio script` and the bytes scripts): pnpm 12 reads `-s` as `--sequential`. then `packageManager`, `engines.node`, a cli he runs by hand, a brew formula. the
  repo can be green and his shell still broken
- **🌟 or 🟠** — his taste: a **rewrite** (zig → rust, a new bundler
  core), a **perf claim with numbers**, a **new capability** he could use → 🌟 with a `🔬 deep`
  block: 2–4 lines of researched facts with the numbers, one source link. a perf claim
  **without** numbers → one line, flagged unmeasured, he asks to detail if he wants. **ci-only
  majors are interesting too** (postgres container, actions) — a card, never silent.
- **💡 borrow** — the last answer, on every card that is not silent: what we could take from
  this — a flow of ours it changes, a feature that replaces something we built, a setting that
  shipped with a new default. one line; a card with nothing to borrow prints no borrow line.
  **claude code and linear get the thought on every notable entry**, not only majors — they are
  the tools we run all day.
- **a feature he or we can use** — the bar for a printed line is a new capability for dima or for
  the fleet, with the borrow it opens; «nothing to act on» never makes an entry silent, and «under
  the hood» never makes it loud. every entry is still read in full — the borrow hunt runs over
  everything — but a library (gnupg, ggml, libuv) prints only when it hands us a feature. fixes,
  minors and patches without a feature stay out, their details too (dima 2026-09-28: «fixes are
  not interesting 95 % of cases»); a fix prints only when it ends a bug we hit, **or when its notes say
  `cve-`, «security», «vulnerability», «deprecated», «will be removed» or «yanked»** — that one prints even on an
  automerged patch, since nothing else shows it (the signal terms of release-radar's ranker, 2026-10-20). every printed
  entry carries its 1–4 facts as nested bullets — a name with a version and no facts is an empty
  line.
- **every borrow carries a tag**: `apply` — a revertible change on the fleet's side (a cc setting, a hook
  flag, an agent's frontmatter, a doc fact); `ask` — his tools, his money, or a workflow change
- **every number on a card links its source**; a model price or limit is checked against
  `x:crew-lead`'s `references/model-cards.md`, and a disagreement prints as ⚠️ on the card
- **the rest is one count line per section** — `+ 14 more read, nothing to borrow`. an entry that did not update is never printed (dima
  2026-09-21: «if formulas didn't update, do not print them»). the apps lane obeys the same rule:
  a feature change is a 🟠 line with its facts, a rewrite or a capability we would use is a 🌟
  card with the borrow line.

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

🍺 brew — <n> formulae + <m> casks outdated, <pinned or none pinned>, <k> with news
- 🟠 <formula> a → b — [notes](url)
  - 1–4 facts: what is new, numbers, what broke
  - 💡 **borrow** — …
- + <k> more read, nothing to borrow

📲 apps — <n> apps read, <k> with something to say
- 🌟 <app> <entry> — [notes](url)
  - 1–4 facts
  - 💡 **borrow** — …
- 🟠 <app> <entry> — [notes](url)
  - 1–4 facts

🍺 brew upgrade ran: <n> upgraded, <failures or none>

✅ applied: <borrow> — undo: <one line>   ← every `apply` borrow, run before the report

(one orbit ask) the `ask` borrows: all except … ➡️ yes; merge round: <pkgs> ➡️ yes
```

- the labels are fixed words in a fixed order so his eye lands on the same spot per card.
- a red ci on any tier → ⚠️ on the card and ➡️ coder. age ≥ 7 days unmerged → `⏳ 9d` before
  the name; the number is the reminder.
- **pick, never paste.** the facts are the few a reader would want from the whole range; the
  release page is one click for the rest.
