---
dies-when: the parallel vet verdict (2026-10-01) settles exa as a lane or drops it
---

Ticket: none

# exa — the rival lane for parallel (parallel core, 2026-09-28)

## Exa for Claude Code terminal sessions (as of 2026-09-28)

### 1. Features and API surface

Exa is more than a SERP endpoint: its current product surface includes web search, URL content extraction, cited answers, code context, agentic research, Websets, and scheduled monitoring.

- **Search (`POST /search`)** returns ranked pages and can return page content in the same call. Current search modes are `auto` (default), `fast`, `instant`, `deep-lite`, `deep` (“Exa Deep”), and `deep-reasoning`. The coding-agent reference says to treat **`neural` as legacy terminology**; `keyword` is not in the current search-type list. Use `auto` by default, not old `neural`/`keyword` examples. Search can also filter by domains/paths, publication dates, category and location; categories include `company`, `people`, `publication`, `news`, `personal site`, and `financial report`. [Search API guide](https://exa.ai/docs/reference/search-api-guide) · [coding-agent reference](https://exa.ai/docs/reference/search-api-guide-for-coding-agents)
- **Contents (`POST /contents`)** extracts from known URLs: full Markdown `text`, query-focused `highlights`, LLM `summary`, and linked subpages. Freshness is now controlled with `maxAgeHours`: `0` forces a live crawl, `-1` is cache-only, and omitting it leaves Exa’s default behavior. The older `livecrawl` option is deprecated in favor of `maxAgeHours`. [Contents guide](https://exa.ai/docs/reference/contents-api-guide)
- **Answer (`POST /answer`)** returns a direct answer or summary with citations. **Deep Search** is available through `/search` types `deep-lite`, `deep`, and `deep-reasoning`, with synthesis and optional structured JSON via `outputSchema`. The old asynchronous `/research/v1` API was retired; for its deeper-research use case, Exa directs developers to `/search` with `type: "deep-reasoning"`. Exa Agent is the current asynchronous option for long research, list-building and enrichment. [Answer reference](https://exa.ai/docs/reference/answer) · [Changelog](https://exa.ai/docs/changelog) · [Agent guide](https://exa.ai/docs/agent/quickstart)
- **Code search / “Exa Code” (`POST /context`)** returns token-efficient code snippets and examples from GitHub repositories, documentation, Stack Overflow and other technical sources. Set `tokensNum` to `"dynamic"` or a desired token budget. The API reference says this capability is also available through Exa MCP. [Context / Exa Code](https://exa.ai/docs/reference/context) · [Code & Docs search guide](https://exa.ai/docs/search/data/code)
- **Find-similar:** I could not verify a standalone find-similar method among the current API reference and official JavaScript SDK’s documented methods. For new work, don’t assume older `findSimilar` examples describe the current supported surface; use current `/search` or `/context` as appropriate. [API reference](https://exa.ai/docs/reference/search) · [official `exa-js` README](https://github.com/exa-labs/exa-js)
- **Websets** builds verified, enriched result sets from a natural-language query and criteria. It requires a paid Websets plan, with Websets credits separate from Search API credits. **Monitors** schedule searches and surface new results. [Websets guide](https://exa.ai/docs/websets/api-guide) · [Monitors guide](https://exa.ai/docs/monitors/quickstart)

**Rate limits:** standard `/search`, `/answer`, and `/chat/completions` are 10 QPS by default; deep search modes are 5 QPS; `/contents` is 100 QPS; Agent runs are 5 QPS with 50 active runs; and `/websets/*` is 20 QPS. Limits are team-wide and can vary by plan. Purchasing $1,000 in credits within 30 days raises the team limit to 25 QPS for 90 days. Separately, the **unauthenticated hosted MCP** tier is limited to 3 QPS and 150 calls/day. [Billing and Rate Limits](https://exa.ai/docs/admin/billing) · [MCP-related changelog entry](https://exa.ai/docs/changelog)

### 2. Free tier and pricing

**Free API credits:** a new team starts with **$10** available on signup; the first team for a user also receives a **one-time $10 onboarding bonus** after dashboard onboarding. That makes **$20 initially when the bonus is earned**—roughly 2,800 basic searches at the standard $0.007/search rate. The free tier then resets to **$10 on the first of each calendar month**; unused monthly credits do not roll over. The one-time onboarding bonus does not expire. Free credits pay for API calls at standard rates; only the user’s first team gets the recurring grant. [Pricing](https://exa.ai/docs/reference/pricing) · [Billing details](https://exa.ai/docs/admin/billing)

| API / mode | Published rate |
|---|---:|
| Standard `/search` | **$7 / 1,000 requests** (up to 10 results; $0.007/request) |
| `/search` with `deep-lite` or `deep` | **$12 / 1,000 requests** ($0.012/request) |
| `/search` with `deep-reasoning` | **$15 / 1,000 requests** ($0.015/request) |
| `/answer` | **$5 / 1,000 requests** ($0.005/request) |
| `/contents` | **$1 / 1,000 pages per content type** ($0.001/page/type) |
| `/monitors` | **$15 / 1,000 requests** ($0.015/request) |
| Fixed-effort Agent runs | `minimal` $0.012; `low` $0.025; `medium` $0.10; `high` $0.50; `xhigh` $1.00 per run |

For Search and Monitors, each additional result above 10 costs $1/1,000 results; AI-generated page summaries cost $1/1,000 pages. Contents charges by content type requested. Metered Agent `auto` instead bills usage (including $0.10/ACU and $0.005/search) up to its default $5 run cap; beta `max` uses a $20 default cap. The published pricing table does **not** give `/context` a separate line item, so do not infer its unit rate from standard `/search`; the Context response includes a `costDollars` field. Websets has its own plan/credits. [Full current rate card](https://exa.ai/docs/reference/pricing) · [Billing and rate limits](https://exa.ai/docs/admin/billing) · [Context API response/pricing field](https://exa.ai/docs/reference/context)

### 3. Using it from Claude Code in a terminal

**Recommended by Exa for Claude Code:** install the official Exa plugin from the terminal:

```bash
claude plugin install exa@claude-plugins-official
```

Or run Claude Code and use `/plugin`, search for **Exa**, and install. Exa’s plugin bundles its MCP integration and skills; the listed skills are `search` (multi-step web research, competitive analysis, etc.) and `exa-agent` (Agent runs, enrichment and structured output). The plugin is the most turnkey choice for a terminal Claude Code session. [Exa’s Claude instructions](https://exa.ai/claude) · [Claude plugin listing](https://claude.com/plugins/exa) · [official MCP repository](https://github.com/exa-labs/exa-mcp-server)

If you want **MCP without the plugin**, add the hosted server directly:

```bash
claude mcp add --transport http exa https://mcp.exa.ai/mcp
```

The hosted server’s default listed tools are `web_search_exa` and `web_fetch_exa`; optional tools include `web_search_advanced_exa` and `agent_run`. The product/docs advertise code search via MCP, while the repository’s tool table does not list a distinct code-context tool name—use the dedicated `/context` API if your MCP client does not expose code context. Anonymous MCP has the 3-QPS/150-calls-per-day limit; OAuth or an API key provides authenticated access, and Agent use requires authentication. [MCP setup and tools](https://exa.ai/docs/reference/exa-mcp) · [GitHub README/tool list](https://github.com/exa-labs/exa-mcp-server)

**CLI versus SDK:** I found no official standalone Exa command-line search client in Exa’s current install docs. The `claude` command above is Claude Code’s plugin installer, not an Exa search CLI. For application code, Exa’s official JavaScript/TypeScript SDK is **`exa-js`** (`npm install exa-js`); it supports search, contents, answers, Agent and tool-calling patterns. The official Python SDK is `exa-py`. For one-off shell use, the API can also be called over HTTP/cURL. [SDK quickstart](https://exa.ai/docs/sdks/quickstart) · [official `exa-js` GitHub](https://github.com/exa-labs/exa-js) · [Exa MCP package/org](https://github.com/exa-labs)

### 4. Query writing and type selection

- Write **natural-language queries with the exact product/library and operation**—for example, “Stripe webhook signature verification documentation,” rather than a broad “Stripe API” query. For coding, specify the artifact/task and, where relevant, version, language, error or desired behavior. Exa specifically recommends naming the product and exact operation so it can favor implementation documentation over general discussion. [Code & Docs query examples](https://exa.ai/docs/search/data/code)
- Start with **`auto` + `contents.highlights: true`**. Exa recommends `auto` unless you have a latency or synthesis reason to choose another mode. Highlights are compact, relevant excerpts suited to repeated agent calls; the coding-agent guide says they use substantially fewer tokens than full text. [Search API guide](https://exa.ai/docs/reference/search-api-guide) · [coding-agent reference](https://exa.ai/docs/reference/search-api-guide-for-coding-agents)
- Choose **`fast`** for a quick, ordinary lookup; **`instant`** for latency-sensitive autocomplete/chat; **`deep-lite`** for lighter synthesis; **`deep`** for multi-step research/structured output; and **`deep-reasoning`** for the hardest analysis. Use full `text` when you need broad context or close reading, rather than sending full pages on every repeated agent search. Use `summary` for a compact overview or structured extraction.
- Scope with `includeDomains`/`excludeDomains` (which can take paths such as `docs.example.com/api`) and date/category filters; don’t repeat a domain restriction as a `site:` query operator. Set `maxAgeHours: 0` only when freshness is essential; it can increase latency. Use Exa Agent rather than expecting one search pass to find every item in a long-list or multi-stage research task. [Coding-agent reference](https://exa.ai/docs/reference/search-api-guide-for-coding-agents) · [Search best practices](https://exa.ai/docs/search/best-practices)

### 5. Comparisons, reviews, strengths and weaknesses

**The requested OpenBenchmarks coding-agent result is real, but specific to one task setup:** on search-plus-fetch for 100 held-out enterprise-documentation tickets, Exa Deep scored **83.0% ± 1.0** completion versus **77.0% ± 1.0** for Parallel Advanced. Exa Auto scored 81.7%; Perplexity Search with high context scored 77.7%. The test held the model, tasks and budgets fixed and repeated runs three times. In that run, Exa Deep took a 37-second median task time and cost $0.127 per task versus Parallel Advanced at 33 seconds and $0.096—so Exa won completion, not speed or task cost. This is **not a universal overall ranking**: on search-only (no fetch), Perplexity low led at 77.3%, while Exa Fast scored 66.3%; the benchmark explicitly keeps those boards separate. [OpenBenchmarks coding-agent benchmark](https://openbenchmarks.com/web-search-for-coding-agents) · [open benchmark harness/data](https://github.com/openbenchmarks-labs/web-search-for-coding-agents)

- **Parallel:** a strong alternative when you want multi-step search/research workflows. In the coding-agent fetch benchmark above, Exa Deep beat Parallel Advanced on task completion but was slower and more expensive per task. The winner changes by task: in OpenBenchmarks’ separate multi-hop company-search test, Parallel Basic led search-only F1 while Exa Deep led the search-and-fetch version. [OpenBenchmarks methodology and boards](https://openbenchmarks.com/web-search)
- **Tavily:** its own comparison describes Tavily as agent-oriented retrieval and Exa as semantic discovery/specialized search; Firecrawl focuses more on crawling/extraction. In the coding-docs search-and-fetch test, Tavily Advanced scored 60.0% versus Exa Deep’s 83.0%. Treat vendor-authored comparison claims as positioning, not neutral review. [Tavily’s comparison](https://www.tavily.com/blog/tavily-vs-exa-vs-parallel-vs-firecrawl-vs-perplexity-vs-brave-choosing-the-right-web-search-api) · [independent coding benchmark](https://openbenchmarks.com/web-search-for-coding-agents)
- **Perplexity / Sonar:** the cited coding benchmark evaluates Perplexity’s Search API, not a separately identified Sonar model configuration. Perplexity was best in its search-only setup and competitive with Exa in search-and-fetch; don’t read that as a direct Sonar-model comparison. [Benchmark configurations](https://openbenchmarks.com/web-search-for-coding-agents)
- **Brave:** the third-party comparison characterizes Brave as a traditional independent web index suited to broad coverage, quick lookups and conventional search. It is a sensible alternative to test for straightforward factual queries, but it did not lead the cited hard coding-documentation benchmark. [Comparison overview](https://www.tavily.com/blog/tavily-vs-exa-vs-parallel-vs-firecrawl-vs-perplexity-vs-brave-choosing-the-right-web-search-api) · [coding benchmark](https://openbenchmarks.com/web-search-for-coding-agents)
- **Firecrawl:** strongest when the job is crawling/scraping known sites and extracting their content; Exa is more search/discovery-first. In the benchmark, Firecrawl did well on search-only token use, but Exa Deep led task completion when the agent could search and fetch. [Comparison overview](https://www.tavily.com/blog/tavily-vs-exa-vs-parallel-vs-firecrawl-vs-perplexity-vs-brave-choosing-the-right-web-search-api) · [coding benchmark](https://openbenchmarks.com/web-search-for-coding-agents)
- **Context7 for library docs:** think of it as complementary, not simply another general web-search API. Context7 is designed to resolve a library and retrieve current, version-specific documentation/code examples; Exa searches broadly across web, code repositories and technical content. OpenBenchmarks explicitly says its general web-search coding board does **not** benchmark Context7 or other docs/code-search tools, so the Exa-versus-Context7 question is not answered by the 83% score. For exact versioned framework/API docs, Context7 may be the more purpose-built first lookup; use Exa when discovery must extend beyond its supported library-doc corpus. [Context7](https://context7.com/) · [benchmark scope note](https://openbenchmarks.com/web-search-for-coding-agents)

**Bottom line:** Exa’s advantages are semantic search, search-plus-clean-content in one API, research/synthesis modes, and unusually broad code/web retrieval; the OpenBenchmarks coding-agent fetch result is a meaningful strength. The trade-offs are that deep modes cost more and add latency, rates are constrained on free access, and search quality remains task-dependent. A real Reddit user reported that Exa search results missed important links; that is a single anecdote, not a measured general defect. For ordinary implementation help, try `auto` + highlights; use `/context` for code examples, and keep Context7 available when you specifically need a library’s current versioned docs. [Reddit user discussion](https://www.reddit.com/r/Rag/comments/1gr8jnr/which_search_api_should_i_use_between_tavilycom_exa.ai_and_linkup.so_building_a_rag_app_that_needs_internet_access/)
