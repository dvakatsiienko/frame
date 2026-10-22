---
id: PK-253
title: >-
  x-ray: an «nms recipes» command beside nms-wiki, once nomansskyrecipes.com is
  back
status: done
assignee: []
created_date: '2026-10-22T16:27:00Z'
updated_date: '2026-10-22T16:35:00Z'
due_date: '2026-10-25'
labels:
  - s
dependencies: []
priority: later
type: wish
ordinal: 155000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** nomansskyrecipes.com to serve again (Vercel NOT_FOUND since ~19:20 10-22, from every client; a changedetector watch on the root flags its return)
W1 a raycast command that works like «nms wiki» but points at https://nomansskyrecipes.com/raw/YELLOW2/
W2 ❓ can one command cover both targets, the wiki and the recipes site? if not, a sibling command: nms recipes
cclio's note: the item pages use internal ids (YELLOW2 = copper); the site has a search box — its url shape decides one command vs two
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
19:3x found: the source is https://github.com/bradhave94/nms (Astro). today 15:01–16:21 UTC the owner merged «Move to Cloudflare Workers» (#123) and removed Vercel analytics (#122); the domain's DNS still answers Vercel's IPs (216.150.1.65, .16.65), whose project is gone → NOT_FOUND. a mid-migration gap, theirs to close; the changedetector watch flags the switch. item urls are /<category>/<id>/ (raw/YELLOW2 = copper); the search is client-side (no search page in src/pages) — the command likely needs the name → id map from the repo's data

correction: the site serves /search.json (src/pages/search.json.ts), the index its search modal reads — the command can fetch it, match the name, and open the item page; one command for both sites becomes possible (two actions: wiki, recipes)

19:4x built: x-ray nms-recipes (the site came back 19:33); dima tries it

close: W1 done (nms-recipes, same shape as nms-wiki), W2 done (one row opens either site; the hotkey picks recipes)
<!-- SECTION:NOTES:END -->
