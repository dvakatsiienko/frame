/* ── clio mode ──────────────────────────────────────────────────────────────
 * cloud-chat has no way to boot as the coordinator, so the coordinator's resident
 * context is compiled into one file at every clio halt (script/skill-clio-mode-snapshot.ts)
 * and served here in pages: cloud-chat caps a single tool result (the whole 160 kB errors out), so the
 * snapshot is split on section edges into even ≤ PAGE_CHARS pages. Every page arrives,
 * nothing is trimmed — Dima's ruling.
 */

/* Core */
import { join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import {
    CLAUDE_HOME,
    readOrNull,
    sizeLabel,
    statOrNull,
    text,
} from './shared.js';

const SNAPSHOT_PATH = join(CLAUDE_HOME, 'shelf', 'clio-mode-snapshot.md');
/** cloud-chat carries ~20k chars of a tool result inline; past that the harness spills it to a file (measured 2026-09-21: 70k and 87k pages both spilled) */
const PAGE_CHARS = 20_000;

/**
 * even pages on section edges: the page count is ceil(total / PAGE_CHARS), every page fills up to
 * its even share and never past PAGE_CHARS, and every cut sits before a `# `, `## ` or `---` line,
 * so the pages joined by '\n' are the snapshot byte for byte.
 */
export const paginate = (body: string, budget = PAGE_CHARS) => {
    const blocks = body.split(/\n(?=# |## |---\n)/);
    const pack = (share: number) => {
        const pages: string[] = [];
        let current = '';
        for (const block of blocks) {
            const grown = current ? `${current}\n${block}` : block;
            if (current && (current.length >= share || grown.length > budget)) {
                pages.push(current);
                current = block;
            } else current = grown;
        }
        if (current) pages.push(current);
        return pages;
    };
    // the smallest page count whose even share packs without a fragment page at the end
    for (let count = Math.ceil(body.length / budget); ; count++) {
        const pages = pack(Math.ceil(body.length / count));
        if (pages.length <= count) return pages;
    }
};

export function registerClioTools(server: McpServer) {
    server.registerTool(
        'clio_mode',
        {
            description:
                "BECOME CLIO — Dima's coordinator — for the rest of this thread. Returns the coordinator's whole resident context (fleet rules, clio memory barrel, the live board and queue as of the last compile), ~40k tokens, in pages. " +
                'Call it ONLY when Dima says "clio mode", "become clio", "enable clio", or runs /clio-mode — never on your own, the read is deliberately expensive. ' +
                'Call page 1 first; the header names totalPages. Call every page up to totalPages IN THIS THREAD (never a subagent — the snapshot must be resident here), THEN act as the document says — its preamble (page 1) names what differs on this surface. Pages are ≤20k chars so each arrives inline. Read-only.',
            inputSchema: {
                page: z
                    .number()
                    .int()
                    .min(1)
                    .optional()
                    .describe('1-based page; omit for page 1'),
            },
            title: 'clio mode — load the coordinator snapshot',
        },
        async ({ page = 1 }) => {
            const body = readOrNull(SNAPSHOT_PATH);
            const stat = statOrNull(SNAPSHOT_PATH);
            if (!body || !stat)
                return text(
                    `no snapshot at ${SNAPSHOT_PATH}. it is compiled at every clio halt; ask Dima to run \`pnpm skill:clio-mode-snapshot\` in ~/frame.`,
                );
            const ageH = ((Date.now() - stat.mtimeMs) / 3_600_000).toFixed(1);
            const pages = paginate(body);
            const chunk = pages[page - 1];
            if (chunk === undefined)
                return text(
                    `page ${page} does not exist — totalPages: ${pages.length}`,
                );
            const next =
                page < pages.length
                    ? ` — call again with page: ${page + 1}`
                    : ' — last page, now act as clio';
            return text(
                `<!-- snapshot ${sizeLabel(body.length)}, compiled ${ageH} h ago · page ${page}/${pages.length} (${chunk.length} chars)${next} -->\n\n${chunk}`,
            );
        },
    );
}
