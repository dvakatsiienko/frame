# evergreen — the want

dima's words, folded, the one home of what evergreen is for. read first, every run; the report is checked against it before it prints. a new wish of his about evergreen joins here the turn he says it.

## what a run does (dima, 2026-11-18 19:23)

1. refreshes every lib that can go to its latest, for pnpm, go, python and brew, in frame and bytes, the designer's folder if it needs it, plus `pnpm -g`. the exceptions are the ones already discussed: a major that waits for another major, or another tricky migration
2. resolves and fixes the update issues and regressions it causes
3. prints a pretty, well formatted, clean, easy to read update digest: what interesting updates we now have, plus borrows and action items, only where they matter and help

## the digest — what to hide

- chore fixes: noise
- a lib's internal updates: a lib gets its own package updates, i don't care. the exception is a change like bun moving from zig to rust: then it matters, and it is very interesting
- features that never reach me: a parser's new api to batch-optimize something is a feature, but too far under the hood. i want the feelable features, the ones that matter for me

## the digest — what to show

interesting features that reach me, for example:
- new cc features, like a model's context window going from 1m to 2m
- new cc slash commands and other cool stuff
- vite moving from go to rust
- vite shipping proper react compiler support
- greensock going fully free
- react query api changes: how queries are written
- interesting typescript releases: new language features
- zod updates with perf gains
- turbo updates like [native support for Rust, Python and Go (experimental)](https://turborepo.dev/blog/2-11#native-support-for-rust-python-and-go-experimental) and [`devEngines.packageManager` support](https://turborepo.dev/blog/2-11#devenginespackagemanager-support)

## the delta

the manual source checks (raycast and the other apps that update themselves, outside brew and pnpm) and every other lane cover the whole delta since the previous evergreen. a missed run means the next one covers both weeks, for everything: brew, pnpm, go, python and the self-updating apps.

## how it reads

easy to read, never a wall of text, 1–2 lines per item (i'll say if i want more), few tech details. a human read: the overall description of what it does; i ask when i want to dig deeper.

## action items

proposed only when they matter, are relevant and actually help, never a useless move: what to borrow, adopt or change.

## the finish line (dima, 2026-11-18 18:45, 19:09, 19:14)

- after evergreen, `pnpm outdated` prints nothing in frame and bytes, if every merge succeeds and no upgrade is blocked by something tricky, like a complex or cross-major migration
- no ignore list: a held major stays visible; i accept what the 3-day release age holds back, but everything upgradable must be upgraded
- a stray lane fixes the merge and upgrade issues a long cadence brings, even one or two weeks of it
