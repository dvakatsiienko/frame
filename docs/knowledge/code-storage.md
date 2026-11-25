---
fed-by: incidents
when:
  - { kind: command, value: git remote }
  - { kind: command, value: git push --mirror }
---

# code storage — where our code lives, its backup, and what is emerging

## core

- home today: github, two public MIT repos, `frame` (~66 MiB pack, git-crypt) and `bytes` (~55 MiB); no LFS
- the git-crypt key lives in 1password (`git-crypt-dotfiles-golden`, vault `dev`), byte-identical to the local key (checked 2026-10-13); any mirror holds ciphertext only
- backup pick (2026-10-13, three lanes agree): codeberg as a push mirror — a second push url, since codeberg refuses pull mirrors; 750 MiB free per user
- what a mirror never keeps: issues, prs, actions history, releases, secrets (linear holds our tickets)
- github under agent load (its blog, 2026-04-28): agent workflows «accelerated sharply» since 2025-12, planning for 30× scale; content creation capped at 80 requests/min, 500/h; 10 incidents in 2026-04, 9 in 05, 5 in 08

## someday homes, ranked (2026-10-13)

1. tangled — atproto social forge, free, jj-friendly, $4.5M round 2026-03
2. mesa — built on jj, free tier 50 GB / 1,000 repos, github sync via api
3. code.storage — strongest agent features, two-way github sync, $20/mo minimum, no free tier
4. cloudflare artifacts — open beta, paid workers plan only
5. depot code — free in public beta, pull mirror from github ?
then codeberg, radicle, sourcehut, gitea cloud

## beyond git

- jj (jujutsu) is the agents' favourite: no staging area, `jj undo` for any operation, conflicts stored in commits so a rebase never stalls; runs on a git repo. our test drive waits for the next bytes codie (pocket PK-114); frame stays on git (git-crypt, inference)

## runs

each run rewrites the sections above and appends one line here: date · the headline delta.
- 2026-10-13 · seeded from two research rounds (`~/frame/.scratch/research/code-hosts/`, `repos-backup/`)

## dima's want

his words from the recipe deleted on 2026-11-25 (PK-472:W32: «i ask for it once per 6 months maybe»):

> what if github dies suddenly? how to have a synced backup mirror of my repos, just in case? no budget, a generous free tier is really nice to have. ideally solid. (2026-10-13)

> backup only for now, but hunt for github alternatives as well, out of curiosity: everyone says github is not so good anymore because of how agents work and how often they push, the ecosystem is changing, even git is not seen as agent-grade. new platforms appear. hunt for places we could migrate to someday, paid or free, prefer a generous free tier. i want code storage that is agent-friendly, looks pretty, and is ideally next gen. (2026-10-13)

> it's good to have a prepped recipe to see what's happening via a run, instead of me explaining every time why and what to research. keep it compact. (2026-10-13)

> i wish code storage had a cli, ideally, like gh. (2026-10-14)

his standing calls: gitlab is out (archaic); the backup is codeberg-first until a run says otherwise; jj is tried in a bytes lane only.
