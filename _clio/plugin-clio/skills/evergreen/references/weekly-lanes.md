# evergreen — the weekly lanes

read by `cclio:evergreen` on the weekly brew day: the skills and the plugins renovate cannot see.

- **skills lane, weekly with brew** — the agent skills renovate cannot see. the `skills` cli has no
  machine-wide list and no check command: `list`/`update` see the cwd's project OR global (`-g`),
  never both, so every scope runs on its own. the three lockfiles are the source of truth:
  `npx -y skills@latest update -p -y` in `~/projects/bytes` (`skills-lock.json`: next.js, shadcn,
  turborepo) and in `~/projects/bytes/apps/x-com-chat` (the convex set), then `npx -y skills@latest update -g -y` once
  (`~/.agents/.skill-lock.json`, untracked — snapshot it to the scratchpad first), and
  `npx -y skills@latest update -p -y` in `~/frame/_clio` (`skills-lock.json`: advise-project-approach). the digest line per scope is
  the lockfile diff (`git diff -- '**/skills-lock.json'` in bytes, a byte-compare for global);
  a moved hash names the skill.
- **plugins lane, same weekly slot** — a marketplace refreshes itself only where
  `known_marketplaces.json` says `autoUpdate: true` (`x`, warp today); the rest, and a disabled
  plugin, sit still (measured 2026-09-16: impeccable cached 4.2.1, upstream 4.3.1, disabled).
  `claude plugin marketplace update` then `claude plugin update <name>` for those; a bump is one
  digest line and binds next session.
  - cw updates nothing by itself: when the `humanize` marketplace moved since the last run, the
    digest carries «cw humanize: update it in cw» for dima.
