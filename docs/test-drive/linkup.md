---
status: live
until: 2026-11-04
dies-when: the verdict line below is written
---

# linkup — a free backup research lane beside exa, parallel and the researcher

Ticket: none

dima, 2026-10-20 (o53): «let's try how to set it up. install the cli and everything needed to make it work. shape a test drive and set up measurement properly, to compare it against the other complementary research tools and against the main researcher as well.»

**test card:** we believe linkup's free $20 a month buys a research lane that finds what exa and parallel miss, at no cost · we test it by running it as a fourth lane on every research of the 2 weeks (recipe runs and his plain asks), same brief, and by sending single-fact lookups through `linkup search` instead of WebSearch · we measure per run its seconds, dollars of credit, sources cited, and the finds no other lane made (the lane-agreement score of `recipes/refresh-research-lanes`), against exa, parallel and the researcher on the same brief · we're right if it makes at least one unique, correct find in half its runs and its monthly spend stays inside the free $20
**kill rule:** the free credit does not land on a gmail signup, or two runs in a row come back with no unique find and a wrong claim

## setup

- cli: `linkup-search-cli` 1.4.1 (`pnpm add -g`, binary `linkup`, official, LinkupPlatform/linkup-cli); `--json` for raw output
- key: 1password `dev/linkup-golden`, read as `LINKUP_API_KEY` through `script/op-run.sh` (op.env line); account imagnum.satellite@gmail.com
- prices (pricing page, 2026-10-20): search $0.005 (flash/fast/standard) · $0.05 (deep) · fetch $0.001–$0.01 · research S $0.25, M $0.50 · free: $20 on signup, topped back up to $20 each month, «for a professional email address» (open: does gmail count)
- gemini cli joined 2026-10-20 and left the same day: google serves the cli only to paid api keys since 2026-06-18 (rounds below); uninstalled, its lane and Brewfile line removed
- not tried: x402 pay-per-request (needs USDC), the mcp (cli first, his rule)

## day 0

- docs walked whole through `docs.linkup.so/llms.txt`: search (4 depths, 3 output types), fetch (js render, pdf, schema), research (async, reasoning depth S/M), tasks (async batch), extract (closed beta), migrating-from-exa and from-tavily guides, an «for AI agents» knowledge pack per endpoint
- users and cookbooks: not read yet — the first round reads the «for AI agents» pages and the exa migration guide before the first run

## stress list

- `linkup research` (depth S) — the next recipe research, as a fourth lane on the same brief — seconds, $, sources, unique finds vs exa / parallel / researcher
- `linkup search --depth deep` — the next prior-art or «is X alive» question — seconds, $, hit or miss vs exa's agent run
- `linkup search` (standard, sourcedAnswer) — a one-fact lookup — seconds, $, right or wrong vs WebSearch
- `linkup fetch --render-js` — a page our fetch could not read — content or not vs `web-bot-blocked:fetch` (firecrawl)
- `linkup tasks` — a batch of 5 lookups at once — seconds, $ vs 5 serial calls
- the free top-up — the 2026-11-01 reset — credit back at $20 or not

## rounds
- 2026-10-20 · probe 1, `linkup search` standard + sourced answer, «when did github stacked prs go ga» · 5 s, $0.006, right (10-06), 3 sources (all secondary news sites) · vs WebSearch: same answer, linkup cited no primary source
- 2026-10-20 · probe 2, `linkup research` depth S, «does gh-stack define an exit code for stacks not enabled» · 153 s, $0.25, right (9), cited gh-stack's `skills/gh-stack/SKILL.md` and said it could not surface the go file · vs the researcher today: same verdict, the researcher read `cmd/utils.go`; linkup beat my own readme-based «correction» · the gmail signup got the free $20 (balance 19.994 before the probes, 19.744 after) — the kill rule's gmail clause is off

- 2026-10-20 · gemini probe, api key (`dev/gemini-golden`), after dima's ok removed 5 dead vibemon hooks from `~/.gemini/settings.json` · the default model and `gemini-flash-latest`: 503 «high demand» until the 120–180 s cutoff; `gemini-2.5-flash`: «no longer available to new users» · 0 answers · retry 10-21 with `gemini-3-flash-preview` before it counts as a lane
- 2026-10-20 · gemini retry on `gemini-3-flash-preview`, api key · 429 «You exceeded your current quota» ×13 in 300 s, 0 answers · why (google's blog, 2026-06): gemini cli serves only paid api keys and enterprise since 2026-06-18; the free key gets no quota · **gemini dropped from this trial** (free tiers only, his rule); `brew uninstall gemini-cli` and the lane come out
- 2026-10-20 · first real lane run, the evergreen vet (release-radar + dependency-doctor), same brief as exa, parallel and the researcher · 147 s, $0.25, 13.3k chars · same verdict as all (install neither); unique finds: dependabot alerts assignable to ai agents (2026-04), socket's `optimize` cli; one miss: called release-radar gemini-dependent, while the researcher read that its scheduled path calls no model · grade: useful fourth voice, below the researcher

## verdict
