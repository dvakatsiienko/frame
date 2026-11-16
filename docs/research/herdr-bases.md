---
dies-when: dima picks the base for his herdr layout and the pick is written into PK-444's ticket
---
Ticket: none

## verdict

1. **Nothing else reaches shepherdr's level as a whole base for a herdr-app layout.** I looked at 3,653 public repos on 2026-11-16 and 355 of them have both tests and CI. Only 4 herdr-app layouts or mod sets pass the filter, and none of the 4 is as broad or as deliberate as shepherdr. A second pass on 7 repos named by the web lanes changed nothing: all 7 are dropped (section 2, "the seven repos the web lanes named").
2. **The closest is flockbook** (minchenlee/flockbook, grade **B**). It is a herdr-app layout plus one mod made of 25 small files (largest 461 lines). It has the cleanest chat-as-a-mod found: a virtual list with height guesses that are tested against measured renders. But it is a reading view with a Rust helper, not a general workspace.
3. **The others are opinionated products, not neutral bases** (all grade **C**). panorama (agents tree and swarm graph, needs a Rust binary), bercail (Pi-only agents, beads and tuicr), and sheepdog (a voice-assistant panel docked on herdr's main layout).
4. **A hidden limit on the filter.** herdr-app itself went public on 2026-10-16 ([gh api repos/herdrdev/herdr-app](https://github.com/herdrdev/herdr-app), created_at). So no herdr-app mod code anywhere has a month of history. Even the survivors' mod folders date from 2026-10-29 to 2026-11-04 (vector 2). "A month of history" was therefore measured on the repo, not on its herdr-app part.
5. **Pick shepherdr or herdr's own shipped layouts as the skeleton, and borrow from flockbook.** Borrow its chat list (`estimate.js` plus `chat.js`) and its tested-with-fake-host setup. For tool calls the best design is ovis's (a web client, so design only). The best liftable mod code is shepherdr's grouped tool rows, then flockbook's chips (vector 7).

All counts are from `gh api` and `curl` on 2026-11-16 unless a line says otherwise. Code was read at these shas, shallow-cloned on 2026-11-16:
- **FB/** = flockbook `49466a1b` = https://github.com/minchenlee/flockbook/blob/49466a1be9092bbbac82ed4634ff1c95c551845e/
- **BC/** = bercail `656d73e9` = https://github.com/simoncrypta/bercail/blob/656d73e99c4d5d8a5eb65d6e1f3c958a42d03afe/
- **SD/** = herdr-sheepdog `9bd0d6db` = https://github.com/kccarlos/herdr-sheepdog/blob/9bd0d6db5908df08c8e3988ab9cc8cb2e42a559c/
- **PN/** = herdr-panorama `02d14585` = https://github.com/LeaveMyYard/herdr-panorama/blob/02d14585a7bc81a880e3515b1ff18672afcfd3c1/
- **SH/** = shepherdr `abd5a0f1` = https://github.com/eliasstravik/shepherdr/blob/abd5a0f1aa6faf2d0ee8d6559dc7f064fdae488e/ (the same sha as the earlier report)
- **OV/** = ovis `00069b48` = https://github.com/devswha/ovis/blob/00069b485db531919469b46058795bcf99f205d1/ (newer than the earlier report's `2f954608`)
- **CO/** = collie `7d1b4faa` = https://github.com/AltanS/collie/blob/7d1b4faaf00af8399bd216beda9332912d8156b1/
- **WS/** = herdr-workspaces `b3361c33` = https://github.com/ejklock/herdr-workspaces/blob/b3361c338b3b83fcbf2e75aeb66687c85f06302e/ (read through `gh api`, not cloned)

---

## 1. the sweep: where candidates came from

| source | what I fetched | repos | new vs the rows above |
|---|---|---|---|
| plugin catalog [assets.herdr.dev/plugins/index.json](https://assets.herdr.dev/plugins/index.json) | every entry. `generatedAt` 2026-11-16T12:30Z, 2,116 plugins in 2,033 repos; its source query is `topic:herdr-plugin` | 2,033 | 2,033 |
| github topics `herdr-mod` (768), `herdr-layout` (444), `herdr-app` (41), `herdr-mods` (6), `gpui-kit` (79), via `search/repositories`, paged to the end | all of them | 1,212 (union) | 1,181 (31 were already in the catalog) |
| topic `herdr-plugin` | 2,140 total = the catalog's own source | — | 0 |
| topic `herdr` | 2,252 total; **only the top 200 by stars** were fetched (`gh search repos --limit 200`) | 200 | 69, **not tree-checked** «?» |
| [herdr.dev/gallery](https://herdr.dev/gallery/) (title "Gallery · Herdr", 1.5 MB) | parsed every card: 863 cards (299 community layouts, 556 community mods, 8 herdr examples) in 687 repos | 687 | 17 (8 of them are now 404) |
| [herdr.dev/plugins](https://herdr.dev/plugins) | redirects to `/tui/plugins/`, which is the TUI marketplace and the same catalog | — | 0 |
| code search: `"from \"gpui-kit\""` (10,640 hits), `"from \"herdr\"" gpui-kit` (8,976), `"from 'gpui-kit'"` (377), `"gpui-base" "herdr" filename:main.js` (4,232); GitHub caps each at 1,000 | the first 1,000 hits of each query | 561 | 360 |
| herdr docs [llms.txt](https://herdr.dev/llms.txt) (stable 0.9.5) and [llms-full.txt](https://herdr.dev/llms-full.txt) | grep for community projects | 0 | only the marketplace page is named; no community project |
| reddit, hacker news, x | one web search, 2026-11-16 | 0 | nothing from reddit or HN. One third-party guide, [bitdoze.com](https://www.bitdoze.com/herdr-app-layouts-mods/), names only gallery items. X and the reddit extract path were not tried «?» |
| **total unique** | | **3,653** | |

How the filter was applied: I took the file tree of 1,603 repos (every app-topic, gallery and code-search repo, plus catalog repos with 20+ stars). I counted test files (`*.test.*`, `*_test.*`, `test/`, `tests/`), `.github/workflows/*`, and `tsconfig`/`jsconfig`. 355 have both tests and CI. Those were then cut by kind (a herdr-app base, an external client, a terminal-herdr plugin, or a single feature), by age (first commit on or before 2026-10-16) and by license. The tree script and the raw JSON are in the session scratchpad only.

**The sweep was complete; the table was not.** All 7 repos the web lanes later named were already in the 3,653. Six were in the `herdr-layout`/`herdr-mod`/`herdr-app` topic pages, and `hheei/herdr-mods` (which has no topics) came in from code search. All 7 were tree-checked and fell into the unnamed bulk "dropped" rows below. So the 3,653 count stands. What was missing was a named row for each.

**Which herdr each kind is for.** Everything in the catalog carries a `herdr-plugin.toml`. Those are plugins for the **old terminal `herdr`**: TOML manifests and socket actions ([marketplace.mdx v0.9.5](https://raw.githubusercontent.com/herdrdev/herdr/v0.9.5/docs/next/website/src/content/docs/marketplace.mdx)). **None of them is a base for herdr-app mods.** A herdr-app base is a `layouts/*.json` plus `mods/*/main.js` importing `herdr`, `gpui-kit` and `gpui-base`.

## 2. the sweep table

Columns: kind (A = herdr-app layout or mod set, the real base; C = external client; T = terminal-herdr plugin only; F = a single feature or another product with a herdr mod). Then stars, contributors (anonymous included), commits, first commit → latest push, releases, test files, CI workflows, types, license, verdict. Shepherdr, collie, ovis and zoo were graded before and are not redone ([herdr-collie-ovis.md](herdr-collie-ovis.md), vector 9).

### kept (survivors)

| repo | kind | ★ | contrib | commits | first → push | rel | tests | CI | types | lic | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| [eliasstravik/shepherdr](https://github.com/eliasstravik/shepherdr) | A + web twin | 1150 | 1 | 987 | 09-18 → 11-15 | 107 | 133 | 1 | `tsc --noEmit` (service, web); mods JS | MIT | reference, **B** (earlier report) |
| [minchenlee/flockbook](https://github.com/minchenlee/flockbook) | A (layout + mod) + native mac app | 59 | 6 | 1070 | 10-10 → 11-15 | 19 | 83 (28 in `herdr-app/test`) | 4 | Swift; mods JS | MIT | **kept, B** |
| [LeaveMyYard/herdr-panorama](https://github.com/LeaveMyYard/herdr-panorama) | A (layout + 6 mods) + TUI plugin | 3 | 1 | 682 | 10-16 → 11-12 | 0 | 220 | 4 | Python, Rust; mods JS | MIT | **kept, C** |
| [simoncrypta/bercail](https://github.com/simoncrypta/bercail) | A (layout + 5 mods) + CLI | 20 | 1 | 275 | 07-05 → 11-16 | 19 | 95 bats files + TS | 3 | TS `strict` for the Pi parts; mods JS, linted | MIT | **kept, C** |
| [kccarlos/herdr-sheepdog](https://github.com/kccarlos/herdr-sheepdog) | A (one panel mod + layout) + Go daemon + iOS | 18 | 2 | 670 | 09-17 → 11-16 | 31 | 500 | 4 | Go, Swift, TS relay; mod JS | MIT | **kept, C** as a base |

When each survivor's herdr-app part began (first commit touching the mod folder, via `gh api commits?path=`): flockbook `herdr-app/` 2026-11-04 (102 commits; it was earlier `mod/`, renamed then); bercail `bercail/mods` 2026-10-29 (32); sheepdog `mods/sheepdog` 2026-10-31 (16); panorama `app/mods` 2026-11-03 (62).

### the seven repos the web lanes named (all herdr-app, all dropped)

Numbers are from `gh api` (repo, contributors, commits, releases, git tree) on 2026-11-16, with the same counting rules as above. "Found by" is how this sweep reached each repo.

| repo | found by | kind | ★ | c | commits | first → push | rel | tests | CI | types | lic | verdict and grade |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| [ejklock/herdr-workspaces](https://github.com/ejklock/herdr-workspaces) | topics `herdr-app`, `herdr-layout`, `herdr-mod`; gallery; code search | A (layout + one `workspaces` mod + an editor plugin) | 0 | 1 | 60 | 10-30 → 11-09 | 11 (v0.1.10) | 17 (`mods/workspaces/lib.test.js` 74,164 B, `bin/install.test.js` 30,163 B) | **0** (no `.github/workflows`) | TS for the editor plugin only (`plugins/editor/tsconfig*.json`); the mod is JS | MIT | **dropped: no CI, first commit after 10-16, one author. C.** Careful on paper: 3 ADRs, a `docs/constitution.md`, 16 written issue notes, and an installer that refuses to overwrite foreign files ([WS/README.md "Install"](https://github.com/ejklock/herdr-workspaces/blob/b3361c338b3b83fcbf2e75aeb66687c85f06302e/README.md)). But it is a workspace switcher (groups spaces by herdr-core machine), not a full layout: no chat, and an agents list filtered per workspace (`mods/workspaces/agents.js` 21,154 B). The exa lane's "A-, best new base" is not supported by what CI enforces: nothing runs on push. Both views are on record (exa lane, 2026-11-16; this file, 2026-11-16). |
| [CiprianSpiridon/herdr-mission-control](https://github.com/CiprianSpiridon/herdr-mission-control) | topics; gallery (11 links); code search | A (a set of mods) | 8 | 1 | 32 | 11-02 → 11-12 | 0 | 110 | **0** | — | MIT | **dropped: no CI, under a month, one author. D.** Its largest file, `mission-control-jira/mods/mission-control-jira/backend.mjs`, is 787,681 B |
| [Kai-Finds/OhMyHerdr](https://github.com/Kai-Finds/OhMyHerdr) | topics `herdr-layout`, `herdr-mod`; code search | A (a suite of mods, 108 source files) | 1 | 1 | 83 | 11-07 → 11-14 | 0 | 41 | **0** | `jsconfig.json` per mod | NOASSERTION (GitHub cannot read the license) | **dropped: no CI, a week old, unclear license. D** |
| [BowgartField/herdr-layout-worktree-bootstrap](https://github.com/BowgartField/herdr-layout-worktree-bootstrap) | topic `herdr-layout`; gallery | A (layout + chrome and menu mods) | 2 | 1 | 7 | 11-03 → 11-03 (one day) | 2 | 5 | 1 (`ci.yml`) | — | Apache-2.0 | **dropped: one day of history. D** |
| [hheei/herdr-mods](https://github.com/hheei/herdr-mods) | code search only (no topics) | A (mods, e.g. agent-manager) | 0 | 1 | 67 | 11-05 → 11-07 | 0 | 8 | 1 (`ci.yml`) | `jsconfig.json` | Apache-2.0 | **dropped: two days of history. D** |
| [enchang1017/herdr-mod](https://github.com/enchang1017/herdr-mod) | topics `herdr-layout`, `herdr-mod` | A (change-radar, agent-radar, jira mods + a site) | 3 | 2 | 10 | 11-09 → 11-16 | 0 | 2 | 2 (`mod-compatibility.yml`, `pages.yml`) | `jsconfig.json`, `gpui-kit.d.ts` | **none** | **dropped: no license, 10 commits, a week old. D** |
| [wandersouzadev/herdr-layout-hive](https://github.com/wandersouzadev/herdr-layout-hive) | topic `herdr-layout`; gallery; code search | A (layout + mods, largest `mods/git-graph/graph.js` 35,460 B) | 0 | 1 | **4** | 11-02 → 11-06 | 0 | 0 | 0 | — | MIT | **dropped: no tests, no CI, 4 commits. F** |

None of the 7 survives, so the survivors, chat and agents-list answers, and the ranked list stay as they were.

### the five layouts the operator has open (all herdr-app, all dropped)

| gallery name | maker, source | what it is (gallery blurb + tree) | ★ | contrib | commits | first → push | tests | CI | lic | grade |
|---|---|---|---|---|---|---|---|---|---|---|
| Aperture | PowershellNinja, [herdr-aperture/aperture](https://github.com/PowershellNinja/herdr-aperture/tree/main/aperture) | a skin: a Portal "Enrichment Center" frame around terminals, with themed mods (largest `announcements.js` 9 KB) | 0 | 1 | 28 | 11-02 → 11-06 | 9 files | 0 | MIT | **D**: no CI, 4 days of work |
| Agent Traffic Control | AnshulKanwar, [herdr-atc](https://github.com/AnshulKanwar/herdr-atc) | a themed agents view: agents drawn as aircraft on a radar (`mods/atc`) | — | 1 | **1** | 11-06 | 0 | 0 | **none** | **F**: one commit, no license |
| LCARS | jkuepker, [herdr-layouts/lcars](https://github.com/jkuepker/herdr-layouts/tree/main/lcars) (repo also has Board, Slate) | a skin: a Star Trek LCARS frame, spaces as slab buttons | 13 | 1 | 14 | 10-29 → 11-13 | 0 | 0 | MIT | **D**: no tests or CI; ships `gpui-kit.d.ts` for editor types only |
| Lisa | billyhunt, [herdr-lisa/lisa](https://github.com/billyhunt/herdr-lisa/tree/main/lisa) | a skin: a neon 90s restyle of the spaces list and rows | — | 1 | 13 | 11-01 → 11-02 | 0 | 0 | Apache-2.0 | **D**: two days, no tests |
| Snow Leopard | attractify-logan, [herdr-snowleopard](https://github.com/attractify-logan/herdr-snowleopard) | a full custom mod (`mods/snowleopard`): Mac OS X 10.6 menu bar, Aqua windows, a dock; "every menu, button and dock icon runs a real herdr command" | 2 | 1 | 94 | 10-30 → 11-11 | 1 | 0 | MIT | **D**: 12 releases but no CI and one test file |

Source: [gallery](https://herdr.dev/gallery/) cards (`data-name`, `data-gh`, `data-blurb`), 2026-11-16; numbers from `gh api`. A second LCARS ("Star Trek Bridge - LCARS", [eiwe/herdr-layouts](https://github.com/eiwe/herdr-layouts/tree/main/bridge)) is in the gallery too. It is in the "no CI" bulk row below.

### dropped: herdr-app layouts and mod sets with real tests and CI, but under a month old

Each is "dropped: first commit after 2026-10-16". These would be the watch-list if the age rule were lifted:

| repo | ★ | c | commits | first | rel | tests | CI | types | lic | note |
|---|---|---|---|---|---|---|---|---|---|---|
| [jlopezlira/herdr-kanso](https://github.com/jlopezlira/herdr-kanso) | 24 | 3 | 164 | 10-31 | 152 | 80 | 5 | — | Apache-2.0 | layout; `check:mods` script; largest `kanso-spaces/main.js` 163 KB |
| [ChmaraX/herdr-chat](https://github.com/ChmaraX/herdr-chat) | 18 | 2 | 37 | 11-06 | 7 | 62 | 4 | `tsc --noEmit` | MIT | a chat mod only, TypeScript built to JS; worth a look for chat later |
| [quaresc/cockpit](https://github.com/quaresc/cockpit) | 46 | 8 | 161 | 10-22 | 95 | 41 | 4 | TS | MIT | layout + TUI plugin |
| [JinJieBeWater/herdr-t3](https://github.com/JinJieBeWater/herdr-t3) | 169 | 3 | 433 | 11-01 | 0 | 0 | 0 | — | Apache-2.0 | popular, but no tests and no CI |
| [adamentwistle/orchi-build](https://github.com/adamentwistle/orchi-build) | 13 | 1 | 27 | 11-03 | 5 | 115 | 1 | — | NOASSERTION | has a claude-chat mod |
| [chanyang721/herdr-theme](https://github.com/chanyang721/herdr-theme) | 1 | 1 | 625 | 11-02 | 0 | 114 | 2 | — | Apache-2.0 | |
| [johnny4young/herdr-relevo](https://github.com/johnny4young/herdr-relevo) | 5 | 1 | 114 | 11-01 | 36 | 112 | 1 | — | Apache-2.0 | |
| [automagik-si/automagik-herdr](https://github.com/automagik-si/automagik-herdr) | 0 | 4 | 466 | 10-31 | 30 | 66 | 3 | — | Apache-2.0 | |
| [carstenlucke/herdr-roundup](https://github.com/carstenlucke/herdr-roundup) | 10 | 1 | 30 | 11-06 | 8 | 67 | 2 | — | Apache-2.0 | |
| [iangregsondev/herdr-mods](https://github.com/iangregsondev/herdr-mods) | 0 | 1 | 16 | 11-08 | 0 | 51 | 2 | TS monorepo | MIT | mods written in TS |
| [sQVe/koja](https://github.com/sQVe/koja) | 1 | 1 | 85 | 11-02 | 0 | 136 | 5 | TS | MIT | |
| [gastownhall/herdr-gascity](https://github.com/gastownhall/herdr-gascity) | 1 | 2 | 23 | 11-09 | 0 | 129 | 8 | TS | MIT | bot-written, 2 days |
| [avi2d/orc](https://github.com/avi2d/orc) | 0 | 3 | 229 | 10-18 | 17 | 336 | 6 | TS | MIT | ships herdr-app 0.1.15 type files |
| [munza/herdr-mods](https://github.com/munza/herdr-mods), [herunan/herdr-over9k](https://github.com/herunan/herdr-over9k), [dougcunha/herdr-mods](https://github.com/dougcunha/herdr-mods) | 31 / 20 / 6 | 4 / 1 / 2 | 93 / 61 / 234 | 11-01 / 11-04 / 10-19 | 0 | 0 | 0 | — | Apache / MIT / MIT | gallery favourites, no tests, no CI |
| 57 more with 10+ test files and CI, first commit after 10-16 | | | | | | | | | | e.g. ball42/scruffyherdr, MOSconfig/herdr-config, curfew-herdr/curfew, AIPIXZ/herdr-chat-plus, tahadx/herdr-setup, shoaibkhanz/emergence, saefty/herdr-corgi |

### dropped: other reasons

| repo | kind | numbers | why dropped |
|---|---|---|---|
| [AkaraChen/2code](https://github.com/AkaraChen/2code) | A | 39★, 7 c, 703 commits (the repo began as a Tauri app 2026-02-10; its `mods` were last touched 11-11) | **no license**; no real test files (the "test" hits are icon names); 1 workflow |
| [aetoneilya/berbr](https://github.com/aetoneilya/berbr) | A (one panel mod) + Rust CLI | 0★, 1 c, 96 commits, 1 release | its only workflow `preview.yml` is a manual release job (it takes a `version` input) that runs the tests; nothing runs on push; 1 author, 0 users; `main.js` 116 KB |
| [CorrectRoadH/Concord](https://github.com/CorrectRoadH/Concord) | F | 0★, 1 c, 1245 commits, 416 tests, 4 CI, strict typecheck | a spec-driven-dev tool with one mod; **no license** |
| [LeaveMyYard/herdr-inbox](https://github.com/LeaveMyYard/herdr-inbox) | F | 2★, 621 commits, 240 tests, 5 CI, first 10-14, MIT | one feature (a question-inbox popup), not a base; well split (`model/`, `view-*.js`), so worth borrowing from |
| [GaganSD/coding-agent-toolkit](https://github.com/GaganSD/coding-agent-toolkit) | F | 51★, 7 c, 381 commits, 199 tests, 7 CI, typecheck, MIT | one Insights dashboard mod plus Pi tools |
| [runkids/skillshare](https://github.com/runkids/skillshare), [skillsgate/skillsgate](https://github.com/skillsgate/skillsgate), [sodiumsun/agenttrail](https://github.com/sodiumsun/agenttrail), [fatwang2/Pulse](https://github.com/fatwang2/Pulse), [ChmaraX/herdr-nvim](https://github.com/ChmaraX/herdr-nvim), [ChmaraX/herdr-gitview](https://github.com/ChmaraX/herdr-gitview), [kryptamine/herdr-auto-title](https://github.com/kryptamine/herdr-auto-title), [DnzzL/herdr-automations](https://github.com/DnzzL/herdr-automations), mrolafsson/herdr-{recap,linear,github}, [dmnkf/herdr-omnisearch](https://github.com/dmnkf/herdr-omnisearch), [fullerzz/herdr-plugin-sesh](https://github.com/fullerzz/herdr-plugin-sesh), [thomasschafer/kiosk](https://github.com/thomasschafer/kiosk), [iml885203/orbit](https://github.com/iml885203/orbit), [yourconscience/tackroom](https://github.com/yourconscience/tackroom) | F | 3171★ … 2★; all have tests and CI, history over a month | each is one feature or another product with a small herdr mod; not a base |
| [memset0/herdr-fleet](https://github.com/memset0/herdr-fleet), [silvanshine/collie](https://github.com/silvanshine/collie) | C | 4630 / 4100 of their commits are AltanS's | copies of collie |
| [Krishnapthm/canopy](https://github.com/Krishnapthm/canopy), [SnowingFox/herdrx](https://github.com/SnowingFox/herdrx), zbarakzai/kavex, NakiriYuuzu/Yuzora, zecod/atrous | app forks | Rust `src/window.rs`; ogulcancelik's commits | copies of herdr-app itself, not layouts |
| [ZingerLittleBee/Heeler](https://github.com/ZingerLittleBee/Heeler) | C (native iOS) | 900★, 41 c, 4920 commits, 75 tests, 13 CI | an external client; its README mentions herdr-core 7 times; not a mod base |
| [0cv/herdr-mobile-relay](https://github.com/0cv/herdr-mobile-relay), [lamngockhuong/termote](https://github.com/lamngockhuong/termote), [lntvan166/paddock](https://github.com/lntvan166/paddock) | C | 381★ / 73★ / 8★; 654 / 714 / 302 tests | external clients that name herdr-core or herdr-app in their READMEs; not mod bases |
| [powerfooI/roamgate](https://github.com/powerfooI/roamgate), [arronKler/pairfob](https://github.com/arronKler/pairfob), [dcolinmorgan/herdr-remote](https://github.com/dcolinmorgan/herdr-remote), [Tomyail/herdr-connect](https://github.com/Tomyail/herdr-connect), [IvoryHeart/herdr-world](https://github.com/IvoryHeart/herdr-world) | C, **terminal herdr only** | 326★ / 185★ / 451★ / 21★ / 55★ | their READMEs name neither herdr-app nor herdr-core (0 hits) |
| zenbu-labs/terminal-browser (4679★), zenbu-labs/terminal-code, openclaw/crabbox, furkankly/zoetrope, eugenioenko/ttt, persiyanov/herdr-reviewr, plannotator/herdr-annotate, smarzban/herdr-file-viewer, alexarthurs/herdr-sidebar, cloudmanic/herdr-plus and the other 92 catalog repos with 20+ stars | T | see the [catalog](https://assets.herdr.dev/plugins/index.json) | **terminal-herdr TOML plugins**, not herdr-app bases |
| the remaining 1,931 catalog repos (<20★; 1,692 have <5★) | T | — | terminal-herdr TOML plugins; not tree-checked one by one |
| 79 `gpui-kit`-topic repos | Rust GPUI apps (BUI, ElegantClipboard, longbridge gpui-kit…) | — | not herdr builds |
| about 1,000 more herdr-app repos with tests or CI missing (of 1,603 trees checked, 1,248 lack tests, CI or both) | A or F | — | zoo-level: no tests or no CI |
| the operator's own repo (it showed up in the code search) | — | — | excluded |
| [mysteriousHerb/herdr-zoo](https://github.com/mysteriousHerb/herdr-zoo) | A | 0★, 53 commits, first 11-02 | the base being replaced, **C** (earlier report) |

herdr's own layouts: the gallery lists 8 `example` cards (`data-kind="example"`) from [herdrdev/herdr-layout-examples](https://github.com/herdrdev/herdr-layout-examples) (20★, 7 commits, 2026-10-25 → 11-01, Apache-2.0, "Not official: take them apart"). herdr.dev also has `pasture`, `mission`, `call` and `chat` layout pages ([search result](https://herdr.dev/layouts/herdrdev/mission/)), alongside main, terminals and win98 from the brief. I did not read their code «?».

## 3. per survivor

### flockbook (minchenlee/flockbook): **B**

- **What it is.** "A reading view for your Herdr coding agents", in two forms: a herdr-app layout plus mod, and a native macOS app ([FB/README.md L1-7](https://github.com/minchenlee/flockbook/blob/49466a1be9092bbbac82ed4634ff1c95c551845e/README.md)). It is unofficial and AI-written with a separate AI reviewer, and a human sets direction (same file, L5-7).
- **What it draws.** A chat with Markdown bubbles and tool chips, a floating tab bar with one status pill per agent, approval and question cards above the reply box, **Needs you** (agents waiting), **Overview** (every tab as a card), a sidebar of spaces, the real terminal on ⌃`, settings and a phone page ([FB/README.md L11-21](https://github.com/minchenlee/flockbook/blob/49466a1be9092bbbac82ed4634ff1c95c551845e/README.md#L11-L21)).
- **Structure.** One mod with several views, picked by `props.view` (`top`, `side`, `chat`, `needs`, `overview`). It is one mod "because a mod cannot import files from another mod's folder" ([FB/herdr-app/README.md](https://github.com/minchenlee/flockbook/blob/49466a1be9092bbbac82ed4634ff1c95c551845e/herdr-app/README.md)). It has 25 small modules, 3,338 lines in total. The largest is `composer.js` (461 lines, 25,289 B), then `chat.js` (386 lines, 21,346 B). Conversations come from a Rust helper, `flockbook-modfeed`, with a written protocol (`docs/protocol.md`).
- **Tests and CI.** 28 node test files run against fake `gpui-kit`, `gpui-base` and `herdr` modules (`herdr-app/test/`, `package.json` `node --import ./test/stub/register.mjs --test`). A CI job "Herdr app mod tests" runs them ([FB/.github/workflows/ci.yml L170-184](https://github.com/minchenlee/flockbook/blob/49466a1be9092bbbac82ed4634ff1c95c551845e/.github/workflows/ci.yml#L170-L184)). Row heights are checked against renders measured on herdr-app 0.1.13 ([FB/herdr-app/test/estimate.test.mjs L12, L138](https://github.com/minchenlee/flockbook/blob/49466a1be9092bbbac82ed4634ff1c95c551845e/herdr-app/test/estimate.test.mjs#L12)).
- **herdr-app version.** No minimum is stated; it was measured on 0.1.13 ([FB/herdr-app/mods/flockbook/estimate.js L24](https://github.com/minchenlee/flockbook/blob/49466a1be9092bbbac82ed4634ff1c95c551845e/herdr-app/mods/flockbook/estimate.js#L24)). Minimum: not found «?».
- **Install.** `curl -fsSL https://github.com/minchenlee/flockbook/releases/latest/download/install.sh | sh`. It checks SHA256 sums, never overwrites a layout, mod or theme it did not put there, merges `keys.json`, runs `herdr-app check`, and has `--dry-run` ([FB/herdr-app/README.md](https://github.com/minchenlee/flockbook/blob/49466a1be9092bbbac82ed4634ff1c95c551845e/herdr-app/README.md), "Install"). **Uninstall for the herdr-app part: not found** in its README «?».
- **Grade B.** It has the best-built herdr-app mod in the sweep: small modules, host-free tests in CI, and a careful installer. It is held back by one main author (998 of 1,070 commits), a herdr-app part only 12 days old, and a Rust helper being required.

### herdr-panorama (LeaveMyYard/herdr-panorama): **C**

- **What it is.** A swarm view of Claude Code and Codex agents and their subagents as one tree, for the terminal herdr (`herdr plugin install`). It also has a "herdr-app flavour": an Agents sidebar, a Swarm graph per space, and a Peek popup with a read-only transcript ([PN/README.md L59-63](https://github.com/LeaveMyYard/herdr-panorama/blob/02d14585a7bc81a880e3515b1ff18672afcfd3c1/README.md#L59-L63)).
- **Structure.** 6 mods under `app/mods/` (graph, pane, peek, spaces, tabs, panorama). The shared files (`model.js` 17,641 B, `feed-client.js`, `contract.js`) are copied into every mod by a build that CI checks (`scripts/app-build --check`, [PN/.github/workflows/app.yml](https://github.com/LeaveMyYard/herdr-panorama/blob/02d14585a7bc81a880e3515b1ff18672afcfd3c1/.github/workflows/app.yml)). That is the same answer to "no cross-mod imports" as shepherdr's `sync-shared`. The largest mod file is `panorama-spaces/main.js` (24,030 B).
- **Needs.** A reviewed Rust `panorama` binary: `scripts/app-install install --app-home … --binary …`. The installer does not pick a layout or change hooks ([PN/README.md L66-80](https://github.com/LeaveMyYard/herdr-panorama/blob/02d14585a7bc81a880e3515b1ff18672afcfd3c1/README.md#L66-L80)). herdr-app version: not found «?». Uninstall: not found «?».
- **Grade C.** A deliberate shared-file build and CI on two OSes, but one author, 3 stars, no releases, a herdr-app part 13 days old, and a native binary in the path.

### bercail (simoncrypta/bercail): **C**

- **What it is.** "An ADE on herdr". One git worktree is one space, each space has a pinned "desk" agent, and review opens in tuicr when the agent is done. An orchestrator, Shep, runs on Pi, and **"Every agent runs on Pi"** ([BC/README.md L4-14](https://github.com/simoncrypta/bercail/blob/656d73e99c4d5d8a5eb65d6e1f3c958a42d03afe/README.md#L4-L14)).
- **What it draws.** 5 mods: agents, desk, review, shep, spaces (`bercail-spaces/main.js` 44,308 B is the largest; 4,104 lines in all). There is no chat view. `bercail-agents` is "bercail's copy of Herdr's agents mod 0.1.15 (mod.clone)", with desk rows added ([BC/bercail/mods/bercail-agents/main.js L1-21](https://github.com/simoncrypta/bercail/blob/656d73e99c4d5d8a5eb65d6e1f3c958a42d03afe/bercail/mods/bercail-agents/main.js#L1-L21)).
- **Tests and CI.** 95 files in `tests/`. Mods are tested in bats with a fake `herdr` module ([BC/tests/agents_mod.bats L1-15](https://github.com/simoncrypta/bercail/blob/656d73e99c4d5d8a5eb65d6e1f3c958a42d03afe/tests/agents_mod.bats)). CI runs lint, the bats suite and TS unit tests ([BC/.github/workflows/ci.yml L24-91](https://github.com/simoncrypta/bercail/blob/656d73e99c4d5d8a5eb65d6e1f3c958a42d03afe/.github/workflows/ci.yml)). TS is `strict` for its own scripts, not the mods ([BC/tsconfig.json](https://github.com/simoncrypta/bercail/blob/656d73e99c4d5d8a5eb65d6e1f3c958a42d03afe/tsconfig.json)).
- **Install.** `mise use -g packslip:github.com/simoncrypta/bercail` then `bercail install`, or `curl -fsSL https://bercail.dev/install.sh | bash`. Switch to it with `Ctrl+Shift+L` ([BC/README.md L37-54](https://github.com/simoncrypta/bercail/blob/656d73e99c4d5d8a5eb65d6e1f3c958a42d03afe/README.md#L37-L54)). `docs/install.md` lists "what it touches". Uninstall: not read «?». herdr-app version: not found «?».
- **Grade C.** It is tested and CI'd. But its mods are patched copies of herdr's stock mods, and the workflow (Pi only, beads, tuicr) would replace his Claude Code setup rather than carry it. One author.

### herdr-sheepdog (kccarlos/herdr-sheepdog): **C as a base** (the product itself is better built)

- **What it is.** "Manage your Herdr agents by voice": a Go daemon, a voice orchestrator, an iPhone app, and a herdr-app panel plus layout ([SD/README.md](https://github.com/kccarlos/herdr-sheepdog/blob/9bd0d6db5908df08c8e3988ab9cc8cb2e42a559c/README.md)).
- **What it draws.** One 340 px panel docked on herdr-app's main layout. It shows the voice status, banners, voice controls, an agent's question as a card, a composer with suggested replies, and a timeline of what you, the voice and your agents did ([SD/mods/sheepdog/README.md L1-12](https://github.com/kccarlos/herdr-sheepdog/blob/9bd0d6db5908df08c8e3988ab9cc8cb2e42a559c/mods/sheepdog/README.md)). It is not a per-agent chat.
- **Structure.** The best-split mod in the sweep: `model/` (24 files), `ui/` (14), `net/` (4). `main.js` is 28,552 B, `model/outbox.js` 19,717 B. 2,622 lines in `main.js` plus `ui/`. CI runs Go tests and install scripts ([SD/.github/workflows/ci.yml L42-70](https://github.com/kccarlos/herdr-sheepdog/blob/9bd0d6db5908df08c8e3988ab9cc8cb2e42a559c/.github/workflows/ci.yml#L42-L70)). Mod-level tests: not found in the tree «?».
- **Install.** `sheepdog setup` installs the panel and layout ([SD/mods/sheepdog/README.md](https://github.com/kccarlos/herdr-sheepdog/blob/9bd0d6db5908df08c8e3988ab9cc8cb2e42a559c/mods/sheepdog/README.md), "Install"). It needs the daemon at `127.0.0.1:7777`. Uninstall: not read «?».
- **Grade C as a base.** One panel on the stock layout cannot be a base for a custom layout. The `model/ui/net` split is worth copying.

## 4. the chat question (survivors that have a chat)

| build | how a long conversation is drawn | evidence |
|---|---|---|
| flockbook | a **virtual list** (`v_virtual_list`) with **guessed row heights**, from a text-width model tested against measured renders. It opens at the newest message. Older rows load in pages from the helper when you scroll up past the first row (at most 5 automatic pages while all rows fit), and the feed is polled every 2 s. An opt-in timing log writes count, average and max ms per measured name, once a second. No fps figure is stated. | [FB/…/chat.js L1-3, L26-30, L122-137, L306-332](https://github.com/minchenlee/flockbook/blob/49466a1be9092bbbac82ed4634ff1c95c551845e/herdr-app/mods/flockbook/chat.js#L306-L332); [estimate.js L1-7](https://github.com/minchenlee/flockbook/blob/49466a1be9092bbbac82ed4634ff1c95c551845e/herdr-app/mods/flockbook/estimate.js#L1-L7); [timing.js L1-3](https://github.com/minchenlee/flockbook/blob/49466a1be9092bbbac82ed4634ff1c95c551845e/herdr-app/mods/flockbook/timing.js#L1-L3) |
| sheepdog (its timeline, not an agent chat) | gpui `list()`, which "draws only what is on screen and asks each row by index"; reaching the last row pages older history in | [SD/mods/sheepdog/ui/panel.js L175-200](https://github.com/kccarlos/herdr-sheepdog/blob/9bd0d6db5908df08c8e3988ab9cc8cb2e42a559c/mods/sheepdog/ui/panel.js#L175-L200) |
| bercail | no chat (the desk is a pinned terminal) | tree at BC/ |
| panorama | no chat; a read-only transcript in the Peek popup with `paging.js` (not read) «?» | [PN/README.md L61-63](https://github.com/LeaveMyYard/herdr-panorama/blob/02d14585a7bc81a880e3515b1ff18672afcfd3c1/README.md#L61-L63) |
| shepherdr (comparison) | see vector 7.4 | |

## 5. the agents-list question

| build | the list | file and size |
|---|---|---|
| bercail | herdr's own agents mod 0.1.15, patched: grouped or priority views, parents take their most urgent sub-agent's place, a desk row per space. Cleanest to clone, since it tracks upstream ("rebase it when Herdr ships a newer agents mod") | `bercail/mods/bercail-agents/main.js`, 23,141 B, 530 lines ([L1-21](https://github.com/simoncrypta/bercail/blob/656d73e99c4d5d8a5eb65d6e1f3c958a42d03afe/bercail/mods/bercail-agents/main.js#L1-L21)) |
| flockbook | **Needs you** (waiting agents on the left, the picked one's card on the right), **Overview** (every tab as a card) and a sidebar with a status mark per tab (5 shown, else 3 and "+N") | `needs.js` 4,040 B, `overview.js` 5,978 B, `side.js` 8,637 B ([needs.js L1-25](https://github.com/minchenlee/flockbook/blob/49466a1be9092bbbac82ed4634ff1c95c551845e/herdr-app/mods/flockbook/needs.js), [side.js L17-22](https://github.com/minchenlee/flockbook/blob/49466a1be9092bbbac82ed4634ff1c95c551845e/herdr-app/mods/flockbook/side.js#L17-L22)) |
| panorama | spaces with state tiles per need kind, worktrees under their checkout, grouped by machine; plus an agents and subagents tree | `app/mods/panorama-spaces/main.js` 24,030 B, `tree.js` 6,530 B ([L1-5](https://github.com/LeaveMyYard/herdr-panorama/blob/02d14585a7bc81a880e3515b1ff18672afcfd3c1/app/mods/panorama-spaces/main.js#L1-L5)) |
| sheepdog | agents counted as needs you / working / done in the panel status, not a list to click | `mods/sheepdog/model/agents.js` 2,868 B, `ui/rows.js` 8,170 B |

Best to clone: bercail's (a patched copy of upstream, easy to rebase) or flockbook's Needs-you plus Overview pair (small, tested). Outside the survivors, herdr-workspaces's `mods/workspaces/agents.js` (21,154 B) filters the agents list to the active workspace. Its sub-agent handling is per its README ([WS/README.md "Features"](https://github.com/ejklock/herdr-workspaces/blob/b3361c338b3b83fcbf2e75aeb66687c85f06302e/README.md)); its code was not read «?».

## 6. ranked bases for a custom herdr-app layout

Unchanged after the 7 web-lane repos were checked; none of them survives.

1. **shepherdr, B.** The only broad, deliberate layout architecture (`core/` plus `sync-shared`, a web twin, `features.json` in CI). Take the skeleton, not the opinions (earlier report, vector 9).
2. **herdr's own shipped layouts (main / Terminals), not graded.** Apache-2.0, maintained by the herdr team, always current with the mod API. Inference: the safest neutral skeleton. Not read here «?».
3. **flockbook, B.** Not a workspace base, but the best chat and needs-you mods to lift into one, with a host-free test setup to copy.
4. **herdr-panorama, C.** Borrow its shared-file bundle check and agents tree; it needs its Rust binary.
5. **bercail, C.** Borrow the patched agents mod; skip the Pi and beads workflow.
6. **herdr-sheepdog, C.** Borrow the `model/ui/net` split; not a layout base.

Outside the ranking (dropped by the filter, worth a look if he wants workspace grouping): herdr-workspaces, C, for its per-machine workspace switcher and its ADR and issue-note discipline. It has no CI.

Still unknown: the 69 untreed `herdr`-topic repos; X and reddit; uninstall paths for the four survivors; herdr-app minimum versions for flockbook, bercail and panorama. I ran none of these builds, so every "smooth" or "works" claim is the authors', not measured.

## 7. what he cares about (follow-up)

### 7.1 tool calls in the chat

| build | kind | how tool calls show | evidence |
|---|---|---|---|
| **ovis** | web client (design only) | each turn's calls, reasoning and progress notes fold into one **"Worked for 7s · 1 edit"** block. Inside it each call is a **row with a caret**: a verb or tool name, a summary, a "failed" or state word, and inline pictures. Opened, it shows the tool input, its images and the **output text**, with a fetch of the whole output when it was cut. Edits draw as an **`EditDiff`** (before and after). Todo calls fold as a done count. | [OV/src/lib/workBlocks.ts L11-30](https://github.com/devswha/ovis/blob/00069b485db531919469b46058795bcf99f205d1/src/lib/workBlocks.ts#L11-L30); [OV/src/components/ChatView.tsx L425 (EditDiff), L727-760 (WorkRow), L877 (WorkBlockView)](https://github.com/devswha/ovis/blob/00069b485db531919469b46058795bcf99f205d1/src/components/ChatView.tsx#L727-L760); [OV/docs/guide.md L396-398](https://github.com/devswha/ovis/blob/00069b485db531919469b46058795bcf99f205d1/docs/guide.md#L396-L398) |
| **shepherdr** | **herdr-app mod** | the log reader **groups consecutive calls** into one `tools` item with `steps: [{ id, kind, line, out? }]`. The chat draws it **collapsed as one summary line** with a chevron. Opened, it shows each call's line and, **loaded on open**, its **result lines** under a left border. Height guess: 20 px closed, 26 + 19 px per step open. No diff view. | [SH/core/chat-log.js L584-585, L661-662](https://github.com/eliasstravik/shepherdr/blob/abd5a0f1aa6faf2d0ee8d6559dc7f064fdae488e/core/chat-log.js#L584-L585); [SH/mods/chat/main.js L3228, L3476-3489, L3508-3510](https://github.com/eliasstravik/shepherdr/blob/abd5a0f1aa6faf2d0ee8d6559dc7f064fdae488e/mods/chat/main.js#L3476-L3489) |
| **flockbook** | **herdr-app mod** | a row of **chips per tool kind** (icon, one-line text, a spinner while any call runs). Opened, it shows **one line per call**: name, summary, then check, "failed" or spinner. A call waiting on a result shows "Running · …". No output preview, no diff. | [FB/herdr-app/mods/flockbook/chat.js L194-200, L225-245](https://github.com/minchenlee/flockbook/blob/49466a1be9092bbbac82ed4634ff1c95c551845e/herdr-app/mods/flockbook/chat.js#L225-L245) |
| collie | web client | tool calls are **off by default**; "what it DID is one tap away, per turn" | [CO/web/src/components/tool-calls-control.tsx L10-15](https://github.com/AltanS/collie/blob/7d1b4faaf00af8399bd216beda9332912d8156b1/web/src/components/tool-calls-control.tsx#L10-L15) |
| bercail, panorama, sheepdog | mods | no agent chat, so no tool-call rows | |

**Best:** ovis (one block per turn, a row per call, output preview, diff). It is a React web client, so it is design only. **Best liftable into a mod:** shepherdr's grouped `tools` row with results on open, plus its log grouping in `core/chat-log.js` (plain JS shared with its web side). Flockbook's chips are simpler and lighter. Inference: the clearest path for his broken zoo chat is shepherdr's `chat-log.js` grouping plus its `tools` row, styled after ovis's WorkRow.

### 7.2 model and effort picker

| build | picker | on herdr-core | evidence |
|---|---|---|---|
| shepherdr | a model button under the box opens the `chat-models` mod: agent tabs, search, pinned and recent models, **Reasoning** levels, Fast, Permissions, and one **Restart** button (it switches by restarting the agent). `/model` typed opens the picker too. | shepherdr requires herdr-core 0.1.17+, so the picker runs there; I did not run it «?» | [SH/mods/chat/main.js L15-16, L22](https://github.com/eliasstravik/shepherdr/blob/abd5a0f1aa6faf2d0ee8d6559dc7f064fdae488e/mods/chat/main.js#L15-L22); [SH/mods/chat-models/main.js L1-20](https://github.com/eliasstravik/shepherdr/blob/abd5a0f1aa6faf2d0ee8d6559dc7f064fdae488e/mods/chat-models/main.js#L1-L20) (343 lines); [SH/README.md L90](https://github.com/eliasstravik/shepherdr/blob/abd5a0f1aa6faf2d0ee8d6559dc7f064fdae488e/README.md#L90) |
| ovis | the composer status line **only displays** model and `Reasoning <level>`. Changing them goes through typing `/model` or `/effort`, which opens the CLI's own card. A one-button picker was proposed and **closed "not planned"** on 2026-10-29. | what he saw is **by design, not a documented herdr-core limit**. Whether the `/model` card itself works on herdr-core: not found in the docs or issues «?» | [OV/docs/chat-mode-audit.md L28-41](https://github.com/devswha/ovis/blob/00069b485db531919469b46058795bcf99f205d1/docs/chat-mode-audit.md#L28-L41); [OV/docs/guide.md L231](https://github.com/devswha/ovis/blob/00069b485db531919469b46058795bcf99f205d1/docs/guide.md#L231); [issue #1311](https://github.com/devswha/ovis/issues/1311) (closed NOT_PLANNED 2026-10-29: "`/model` already opens the same card mid-session") |
| flockbook | the status tag row shows model, effort, context and cost from the helper; typing `/model ` lists its values to complete | uses `hc` through its helper; I did not run it «?» | [FB/…/composer.js L1, L24-27, L85-92](https://github.com/minchenlee/flockbook/blob/49466a1be9092bbbac82ed4634ff1c95c551845e/herdr-app/mods/flockbook/composer.js#L85-L92) |
| collie | Claude's `/model` and `/effort` panels show as cards | which runtime that line covers: not checked «?» | [CO/docs/multiplexers.md L920, L943](https://github.com/AltanS/collie/blob/7d1b4faaf00af8399bd216beda9332912d8156b1/docs/multiplexers.md#L920) |
| bercail, panorama, sheepdog | not found (sheepdog's settings pick the voice and orchestrator models only) | | [SD/mods/sheepdog/README.md](https://github.com/kccarlos/herdr-sheepdog/blob/9bd0d6db5908df08c8e3988ab9cc8cb2e42a559c/mods/sheepdog/README.md) "Settings and details" |

### 7.3 phone reach

| build | what to set up for an iPhone away from the mac | same Wi-Fi alone? | evidence |
|---|---|---|---|
| shepherdr | Tailscale, signed in on both; the web app is served with `tailscale serve`, to the tailnet owner only; Settings → Web shows a QR | **no**: "It needs Tailscale" | [SH/docs/web.md L9-21](https://github.com/eliasstravik/shepherdr/blob/abd5a0f1aa6faf2d0ee8d6559dc7f064fdae488e/docs/web.md#L9-L21) |
| ovis | either the **Ovis relay** (turn it on, scan a 10-minute QR, tap Pair, add to the Home Screen) or **Tailscale** | **no** for an unpaired LAN visitor ("An open LAN visitor … No"); the server listens on 127.0.0.1:7317 (earlier report) | [OV/docs/guide.md L508-530](https://github.com/devswha/ovis/blob/00069b485db531919469b46058795bcf99f205d1/docs/guide.md#L508-L530); [OV/docs/runtime-move.md L127](https://github.com/devswha/ovis/blob/00069b485db531919469b46058795bcf99f205d1/docs/runtime-move.md#L127) |
| collie | Tailscale with HTTPS, `tailscale serve`, `collie pair` | **no** by default: the bridge refuses to bind `0.0.0.0` unless `COLLIE_ALLOW_NON_LOOPBACK_BIND=1` | [CO/docs/security.md L340-345](https://github.com/AltanS/collie/blob/7d1b4faaf00af8399bd216beda9332912d8156b1/docs/security.md#L340-L345) |
| flockbook | Tailscale on the mac and the phone (same account), MagicDNS and HTTPS certificates on, **Turn On** Tailscale Serve (port 7480 only), then **Pair a Device** by QR; input is a separate switch per device | **possibly**: a "Direct address" without Tailscale exists, marked "advanced and less safe" (a self-signed certificate) | [FB/docs/mac-app.md L104-110, L130](https://github.com/minchenlee/flockbook/blob/49466a1be9092bbbac82ed4634ff1c95c551845e/docs/mac-app.md#L104-L130) |
| sheepdog | turn on phone access (`sheepdog setup` step 4, binds 0.0.0.0), `sheepdog pair`, scan in the app; away from home it needs Tailscale or its end-to-end encrypted relay | **yes**: with no Tailscale the code holds the Wi-Fi address, "so the phone must be on the same Wi-Fi" | [SD/docs/remote-access.md L1-28](https://github.com/kccarlos/herdr-sheepdog/blob/9bd0d6db5908df08c8e3988ab9cc8cb2e42a559c/docs/remote-access.md#L1-L28) |
| bercail, panorama | no phone path found in their READMEs | — | BC/README.md, PN/README.md |

### 7.4 why shepherdr's chat scrolls cheaply (file: `mods/chat/main.js`, 279,344 B)

- **Only visible rows are drawn.** `v_virtual_list("chat-rows", rows.length, sizes, …)` calls back with a range and draws `rows.slice(range.start, range.end)`, each in a fixed-height box that clips ([L4581-4598](https://github.com/eliasstravik/shepherdr/blob/abd5a0f1aa6faf2d0ee8d6559dc7f064fdae488e/mods/chat/main.js#L4581-L4598)).
- **Heights are cached by content key.** `key(x)` encodes everything a row's height depends on: id, kind, open state, results shown, text length, pills, find match ([L3197-3203](https://github.com/eliasstravik/shepherdr/blob/abd5a0f1aa6faf2d0ee8d6559dc7f064fdae488e/mods/chat/main.js#L3197-L3203)). Sizes come from the measured `heights` map, else a guess, clamped to a finite 1–40,000 px ([L4548-4551](https://github.com/eliasstravik/shepherdr/blob/abd5a0f1aa6faf2d0ee8d6559dc7f064fdae488e/mods/chat/main.js#L4548-L4551)). The cache is cleared only when the width changes by more than 1 px or the zoom changes ([L4543-4545](https://github.com/eliasstravik/shepherdr/blob/abd5a0f1aa6faf2d0ee8d6559dc7f064fdae488e/mods/chat/main.js#L4543-L4545)).
- **Heights are measured off screen, a few at a time.** `measurer()` draws at most 30 never-measured rows, nearest the view first, plus the on-screen rows and rows measured in the last 4 s, capped at 60. They go in an invisible zero-height box. It calls `cx.notify()` only when a height actually changes ([L4639-4666](https://github.com/eliasstravik/shepherdr/blob/abd5a0f1aa6faf2d0ee8d6559dc7f064fdae488e/mods/chat/main.js#L4639-L4666)).
- **A folded long reply lays out only the lines that show**, because "a folded reply drawn whole … blanked the list (#590)" ([L141-158](https://github.com/eliasstravik/shepherdr/blob/abd5a0f1aa6faf2d0ee8d6559dc7f064fdae488e/mods/chat/main.js#L141-L158)).
- **What triggers a redraw:**
  - a 1 s timer, but it notifies only while the agent works or a helper row is under a minute old (otherwise every 30 s) ([L461-466](https://github.com/eliasstravik/shepherdr/blob/abd5a0f1aa6faf2d0ee8d6559dc7f064fdae488e/mods/chat/main.js#L461-L466));
  - hover, once per 6 px band of pointer movement ([L4566-4570](https://github.com/eliasstravik/shepherdr/blob/abd5a0f1aa6faf2d0ee8d6559dc7f064fdae488e/mods/chat/main.js#L4566-L4570));
  - the scroll wheel only when following the newest flips on or off, or older rows are asked for ([L4572-4580](https://github.com/eliasstravik/shepherdr/blob/abd5a0f1aa6faf2d0ee8d6559dc7f064fdae488e/mods/chat/main.js#L4572-L4580));
  - a blank-list check every 1.5 s that clears the heights only when the list drew nothing ([L516-523](https://github.com/eliasstravik/shepherdr/blob/abd5a0f1aa6faf2d0ee8d6559dc7f064fdae488e/mods/chat/main.js#L516-L523)).
- **The row model is rebuilt on each render** (`const rows = this.rows()` at [L4518](https://github.com/eliasstravik/shepherdr/blob/abd5a0f1aa6faf2d0ee8d6559dc7f064fdae488e/mods/chat/main.js#L4518), built in `rows()` from L2934). Only the task-news part is memoized ([L2041-2043](https://github.com/eliasstravik/shepherdr/blob/abd5a0f1aa6faf2d0ee8d6559dc7f064fdae488e/mods/chat/main.js#L2041-L2043)). Inference: scrolling stays cheap because rebuilding rows is plain JS work, while layout happens only for visible rows plus at most 60 measured ones.
- **Against flockbook:** both use `v_virtual_list`. Flockbook guesses heights from a font-width model and never measures. Shepherdr guesses, then measures off screen. Inference: shepherdr's way is safer for mixed Markdown, flockbook's is cheaper. A swap to flockbook's chat would lose shepherdr's measuring. A borrow of shepherdr's `measurer()` plus `key()` into his own chat is the smaller step.

Sources for searches: [bitdoze herdr-app layouts guide](https://www.bitdoze.com/herdr-app-layouts-mods/), [herdr.dev mission layout](https://herdr.dev/layouts/herdrdev/mission/), [herdr.dev gallery](https://herdr.dev/gallery/).

<!-- end -->
