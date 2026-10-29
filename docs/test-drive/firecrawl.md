---
status: adopted
until: 2026-11-02
dies-when: the verdict line below is written
---

# firecrawl — whole-site crawl into clean markdown, for knowledge files and recipe research

Ticket: none

**test card:** we believe a firecrawl crawl turns a whole docs site into one markdown corpus our agents read cheaper and more completely than a researcher fetching page by page · we test it by the doc sets our recipes re-read: the Claude Code docs for `refresh-cc-mods` first, then n8n and Backlog.md · we measure pages covered against the site's sitemap, credits, our agent's tokens, wall time, and 5 questions answered right from each path, against the usual door (a `researcher` on WebFetch, exa `subpages`, parallel extract) · we're right if coverage ≥ 90 % of the sitemap, answers at least as right, and our agent's tokens ≥ 30 % lower than the usual door on the same questions
**kill rule:** two rounds where the usual door answers as well for under 30 % more tokens, or no recipe reaches for it in 2 weeks — drop it; the free tier's 1,000 credits a month run out on one job — drop it

## day 0
- the users and the docs pass is the 2026-10-18 research: `_clio/.scratch/research-firecrawl/` (opus, exa, parallel lanes; verdict: one narrow job, never a third search lane)
- key: `op://dev/firecrawl-golden/credential` → `FIRECRAWL_API_KEY` in frame `op.env`; probe 2026-10-19: one scrape 200, 16.8k chars of markdown, 1 credit

## stress list
- `/v2/crawl` — the Claude Code docs for `refresh-cc-mods` — pages vs sitemap, credits, wall time (tried r1: the site serves llms-full.txt, so the crawl is redundant there)
- `llms.txt` check first — before any crawl, `curl -sI <site>/llms.txt` and a `.md` page: a site that serves them needs no crawl
- `/v2/map` — list a docs site's urls before a crawl — urls vs sitemap, credits
- `/v2/scrape` (markdown, one page) — a single changelog or doc page — chars, against WebFetch's summary
- `/v2/crawl` with `includePaths` — only one section of a large site (n8n's node docs) — pages, credits
- a bot-blocked site (PSNProfiles) — a trophy page cw cannot reach — reach, chars, credits (round 4: the only win)
- `/v2/search` — one research question — hits, against exa and parallel (expected weaker: an unnamed upstream provider)
- `/v2/agent` (spark-2) — a «find me X across the web» ask — credits, answer quality, against the researcher card

## rounds
- 2026-10-19 · round 1, `/v2/crawl` of the Claude Code docs (en) for `refresh-cc-mods`, 5 doc questions both ways · crawl: 227/227 sitemap pages + 33 extra, 13.2M chars (median 25k a page), 140 s, 260 credits (741 left); path A, a `researcher` on WebFetch: 31.7k tokens, 83 s, 7 pages, 5/5 answered, missed that `/skill-doctor` shipped in 2.1.261; path B, a `helper` grepping the crawl: 48.3k tokens, 60 s, 10 pages, 5/5 answered, missed `idleCompaction` and `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` though the crawl holds both (a reader miss, not a coverage miss) · grade: **no gain on this site** — answers tie, path B cost 52 % more tokens, and the site already serves `llms-full.txt` (9.5 MB) and a raw `.md` per page for free, so a `curl` does the crawl's job at 0 credits
- gotchas (round 1): v2 crawls only children of the start url — a leaf start page returned 1 page, the docs root returned all; a page slugged «agents» lands as `agents.md`, which macOS treats as `AGENTS.md`, so our loader hook offered a scraped page as instructions — prefix every crawled file (`page-…`)
- next round must pick a site with no `llms.txt` and no `.md` export (n8n node docs, Backlog.md) — the only place the crawl can earn its keep
- 2026-10-19 · round 2, n8n docs · `docs.n8n.io/llms.txt` (288 KB) and `llms-full.txt` (806 KB) are served free — no crawl needed, no credits spent · grade: firecrawl not needed
- 2026-10-19 · round 3, the No Man's Sky wiki (miraheze, MediaWiki, 3,535 articles) for dima's cw games thread · firecrawl `/v2/map`: 91 links in 15 s (2.6 % of the articles); 3 `/v2/scrape` pages, 1 credit each, 2–5 s, markdown keeps the wiki chrome (login, nav, page actions) even with `onlyMainContent`; the free MediaWiki api: `list=allpages` lists every article in ~8 calls, `prop=extracts&explaintext=1` returns clean plain text per page; WebFetch reaches the wiki fine from cc · grade: **the MediaWiki api wins** — complete, free, cleaner
- 2026-10-19 · round 4, trophy guides (dima's platinum work) · PowerPyx guide: curl 200, firecrawl 200 (35.5k chars, difficulty and missables intact, 2 s); **PSNProfiles: plain curl 403, WebFetch 403, firecrawl 200** (29k chars, 5 s, 1 credit; the trophy id 4500 was cclio's guess and is a different game, so this proves reach, not content) · grade: **the one real gain so far** — firecrawl reaches bot-blocked game sites our fetchers cannot
- credits after round 4: 732 of 1,000

## verdict

- 2026-10-20 · **adopted, narrowed** (dima o54): firecrawl is the fetcher for bot-blocked pages only — 1 real gain in 4 rounds (PSNProfiles: curl and WebFetch 403, firecrawl 200), 3 rounds where llms.txt or a site api answered better; 732 of 1,000 free credits left. the door stays `pnpm web-bot-blocked:fetch`; discovery stays with exa, parallel and linkup
