# web-bot-blocked-fetch — game wikis and psnprofiles through the mac

moved here 2026-11-02 from the «stuff» project file `tools/web-bot-blocked-fetch.md` (dima: every game door lives in firelink). script `~/frame/script/web-bot-blocked-fetch.ts`, data dir `~/.local/share/web-bot-blocked-fetch/`.

## why it exists

- the cloud proxy refuses `psnprofiles.com`, `nomanssky.miraheze.org` (pages and `api.php`) and fandom with `connect_rejected`, before the site answers. WebFetch fails there too, and WebSearch doesn't index miraheze
- the mac reaches them: `"web-bot-blocked:fetch": "./script/op-run.sh node ./script/web-bot-blocked-fetch.ts"` in `~/frame/package.json`

## how to run

- always a login shell: `zsh -lc 'pnpm -C ~/frame --silent web-bot-blocked:fetch "<url>"'`
- a long page → `--out ~/.local/share/web-bot-blocked-fetch/<game>/<name>.md`, then `rg` over the file, never read it whole
- `--index <wiki host>` lists a mediawiki's articles, `- Title — URL` per line (miraheze nms: 3,535 articles, 6.7 s)

## the paths inside

- a `.md` / `.txt` url (a site's `llms.txt`) → read as is, no crawl
- a mediawiki host → `api.php` `prop=extracts&explaintext=1&redirects=1`, live, no cache, free, ~2.5 s an article. the script prints `== Infobox ==` first; the extract alone drops the infobox (value, rarity, type), and `action=parse&prop=wikitext` keeps it but leaves use tables as raw templates
- anything else → firecrawl, 1 credit a page of 1,000 a month

## what was measured

- psnprofiles nms guide via firecrawl: 5.2 s, 117,646 chars, complete. tables come as md pipes, icons as noisy image links
- raw mediawiki api: search 0.76 s, extract 0.78 s, wikitext 0.68 s
- a tiny result can be the wiki itself: nms «corvette» was a 294 B stub page, not a tool fault

## other wikis

- wiki.gg (terraria, 2026-10-19): its `api.php` answers a plain script user-agent (`<name>/1.0 (…)`) but blocks a `Mozilla/5.0` one («Blocked - wiki.gg»). the script's agent is `Mozilla/5.0 (frame web-bot-blocked:fetch)`, untested there, so it may fall to firecrawl. fix: a script user-agent on the api probe
- fextralife has no mediawiki api → firecrawl only

## caches on the mac

- `~/.local/share/web-bot-blocked-fetch/no-mans-sky/wiki-index.md` and `psnprofiles-guide.md` beside it. no cloud copy: without the mac no article is readable anyway
