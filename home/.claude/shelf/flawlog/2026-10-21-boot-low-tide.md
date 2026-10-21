# flawlog · 2026-10-21 · boot-low-tide

- 13:51 a first `/cclio:boot pocket-sweep-halt` ran in a tab whose cwd was `~/.local/state/ccrow`: no cclio plugin or barrel, and its transcript became the newest file in ccrow's project dir, which the harvester reads. fixed by `touch` on ccrow's transcript; root fix wanted: the boot skill (or a SessionStart hook) refuses when cwd ≠ `~/frame/cclio`. #guard-gap
- 13:51 `ccrow/AGENTS.md` «`true &` still runs» holds for a `--bg` start only; a desktop tab loads every user mod, so x-mod-guard refused it at ccrow's boot. #stale-doc
- 14:11 evergreen day left off the board's plan: the read ran in the background and the board said «report after board», but no plan line carried it, and the digest's whole point (the week's updates, printed) never reached dima until he asked «where is the evergreen?». root fix wanted: on a Wednesday or with PRs open, the board's 📋 order gets an «evergreen report» line as item 1 — a line in cclio:boot step 8, or a board-proposal check. #board-gap
- 14:14 commit and fetch blocked: the 1Password ssh agent socket is down (signing + github ssh). nothing routed around it. #env
- 14:20 the Evergreen artifact link in cclio:evergreen was dead (artifact not found); republished, link swapped. #stale-link
- 14:55 `x linear set --add-label a --add-label b` kept only the last label (BYT-128 lost agent until a second call). #automation
- 15:09 relayed wishkeeper's «Claude Design closes» claim to dima as a 📌 without opening the changelog line; it named only standalone claude.ai/design (ccrow). same shape as the 🥊 line. #unchecked-source
- 15:52 #dima-caught shape-idea spent a whole turn on step 1 (the want) before the grill; dima: «step 1 was tiny … combine it with step 2». fixed in the skill: the want and grill round 1 print in one reply. #flow
- 16:47 #dima-caught PK-173 grill round 1 ran on my own cut of the want (4 of his ~14 points dropped) instead of the pocket item's full fold; he caught it by asking whether i had all his words. root: shape-idea step 1 lets me re-summarize the wish. fix candidate: step 1 prints the pocket fold whole and every grill question cites the wish line it settles. #data-loss
