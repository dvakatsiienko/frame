---
status: live
until: 2026-11-09
fits: codie sixth-sense
---

# skill-named-load — does a skill named in plain words load in a spawned session

Ticket: none

dima, 2026-10-14: «just know that cross-message communication doesn't allow skills to expand except the very first one; you can still activate a --bg session's skills via plain words that match the skill by name — and let's measure misses.»

the shape: the spawn prompt opens with the role slash (`/x:crew-codie …`); every other skill is named in plain words («use the guide-go skill to …»). the member's first reply lists what it loaded.

## rounds

one line per spawn: date, member, named skills, loaded skills, misses

- 2026-10-29 · ⚡ 🔧 mods lane 3 coder (FRM-426, desktop thread) · named: x:crew-coder, plugin-authoring, guide-typescript, mods/AGENTS.md, api-map · loaded (its first reply): x:crew-coder, crew-dna, how-you-work, plugin-authoring, guide-typescript, mods/AGENTS.md, api-map · misses 0 · extra: a pocket read under _clio/ autoloaded cclio AGENTS.md into it (it stayed the coder)

**test card:** we believe naming every skill in plain words gets it loaded · we test it by every summon's first reply (named vs loaded) · we measure named, loaded and the misses per summon · we're right if 5 summons in a row load every named skill
**kill rule:** a summon whose first reply lists nothing twice in a row

- 2026-11-02 · ⚡ 🔧 codie mods lane 4 · named: crew-codie, plugin-authoring, guide-code, guide-typescript, crew-subagent · loaded: crew-codie, crew-dna, plugin-authoring, crew-subagent · missed: guide-code, guide-typescript (no .ts edit yet at the first reply) · extended once to 11-09 (dima's o17 tick)
- 2026-11-05 · 🌗 🔎 sixth sense cli lane 4 · `mods-verify` and `x-verify` loaded late, on the path hook, after it had started; the hook caught both · got in the way a little, keep; a stacked lane's brief names both
- 2026-11-06 · frm-514 sixth sense · `x:crew-sixth-sense` and the two guides named in the first report; the guides came only by the hook's refusal, the row working on it · keep
- 2026-11-06 · frm-514 codie · done in the first ping · misses not recorded
- 2026-11-06 · frm-517 codie · fine · misses not recorded
- 2026-11-06 · BYT-130 ci made boring · codie · fine, no friction
- 2026-11-06 · BYT-130 ci made boring · sixth sense · ci-verify loaded on the argv's ci words; its «jq pulled out and fed crafted inputs» line set the hostile shapes; helped, keep
- 2026-11-06 · BYT-94 ci made boring codie · fine
- 2026-11-06 · FRM-511 cli lane 5 codie · `mods-verify` and `x-verify` load only from a worktree's nested `.claude/skills`, so the first reply named one as missing; a brief should say so
- 2026-11-06 · FRM-511 cli lane 5 sixth sense · neutral: the role skill names what to load; a Write refusal forced `x:guide-typescript` for a probe script under a job tmp
- 2026-11-06 · lane retros (FRM-474, FRM-521) · neutral both: no effect on FRM-474; on FRM-521 `x-verify` surfaced only after cd into the tree, and the guide-code hook refused a scratch probe file once
