---
date: 2026-09-02
slug: the-coder-gets-a-name
tickets: [BYT-43, BYT-65, BYT-66, DOT-36, DOT-37, DOT-84, DOT-139, DOT-224, DOT-17, DOT-159]
posted: { health: yes }
---

# 🗞️ cclio's gazette · the coder gets a name — an identity, a bake-off on prod, and the shell learns to speak

## shipped

- **the coder is a linear user** — app «cclio's pet», `pnpm linear-agent-token coder`, delegate slot on every coder ticket, one comment per round. 7 comments on day one; the 09-16 vet asks whether dima reads them. brief cap ≤12 lines after his verdict: «comments are poems for me».
- **trophy-sys on prod, twice** — [BYT-43](https://linear.app/x-com/issue/BYT-43): theme toggle L•D•S, logo → `/`, `/library` opens the first game, user-select systematic, deploy notes trimmed. [BYT-65](https://linear.app/x-com/issue/BYT-65): the visx vs recharts bake-off, five fix rounds on tooltips, a live pick by dima (visx), recharts deleted, `/stats` live with the effort scatter and the circadian ring over a cached 79-title fan-out. [BYT-66](https://linear.app/x-com/issue/BYT-66) parked behind it.
- **gazette → cw bridge live** — every post carries a `cw:` digest block; `memory-sync gazette` rolls a 7-post window into cw memory, noop when unchanged; boot prefetch strips the block so cclio never reads it twice. cw dry-run + noop proven, 09:00 task set. cw's 7 wants folded (x-cw 0.2.10): first-run create, carve-outs, scoped stamps, `prettify` + `dedupe` args.
- **spawn-mechanics run #2 on cc 2.1.258** — subagents inherit the parent stack again (three builds, three answers, tagged volatile), cwd = parent's shell cwd, workflow per-call effort verified, the bleed explained for subagents and unreproduced for `--bg`. doc trimmed 321 → 291 with every claim kept.
- **dima's tools: two closed, one out** — [DOT-36](https://linear.app/x-com/issue/DOT-36) aliases audit (79 → 72, `port`, `gprune -d rmt`, `l()` collapsed); [DOT-37](https://linear.app/x-com/issue/DOT-37) vibe language: 12 words (warp spawn loot scout onward oops lore peek peeked camp decamp yolo), `chill` → `reforge`, `rules/fleet-vibe.md` mirrors the alias block under a vitest, «a word is meaning, never permission». nvim [DOT-224](https://linear.app/x-com/issue/DOT-224) left the milestone as its own session, [DOT-84](https://linear.app/x-com/issue/DOT-84) and [DOT-139](https://linear.app/x-com/issue/DOT-139) folded into it. [DOT-17](https://linear.app/x-com/issue/DOT-17) pruned, closes with DOT-38.
- **x:pm rule** — dima's words never go into a comment; a want lands in the body under «dima notes». reads that decide fetch comments.

## tricks gained

- `--remote-control` eats the next arg as its label: prompt first, flags after, or the bg session boots idle and unbridged · visx `TooltipInPortal` deletes its own node when container bounds change — render your own box · recharts sizes polar charts off the box diagonal, visx off the shorter side · `git --no-pager` goes before the subcommand · a coder may run headless chromium + playwright to verify its own ui; «unverified in a browser» is no longer an excuse.

## state

- run `cclio-memory-bridge` continues · next overhaul milestone 12/22 retired, 10 open · warm coder `12bd53ae` idles for BYT-65 pass 2 · tomorrow: git (DOT-159 + DOT-38), then the coder, walkthrough evening as the candidate · cw gazette task fires 09:00.
