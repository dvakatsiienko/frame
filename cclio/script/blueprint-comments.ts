// dima's open comments on every mapped FigJam board (cclio/blueprints/AGENTS.md § the mapped areas), read before a board edit
// usage: ~/frame/script/op-run.sh node blueprint-comments.ts   (needs FIGMA_TOKEN from op.env)
import { readFileSync } from 'node:fs';
import path from 'node:path';

const frame = path.resolve(import.meta.dirname, '../..');
const token = process.env.FIGMA_TOKEN;
if (!token) {
    console.error('FIGMA_TOKEN missing: run through ~/frame/script/op-run.sh');
    process.exit(1);
}

const agents = readFileSync(
    path.join(frame, 'cclio/blueprints/AGENTS.md'),
    'utf8',
);
const boards = [
    ...agents.matchAll(
        /^- (.+?) · https:\/\/www\.figma\.com\/board\/(\w+)\S* · sources:/gm,
    ),
].map(([, name, key]) => ({ key: key ?? '', name: name ?? '' }));
if (boards.length === 0) {
    console.error('no figma boards found in cclio/blueprints/AGENTS.md');
    process.exit(1);
}

let open = 0;
for (const board of boards) {
    const res = await fetch(
        `https://api.figma.com/v1/files/${board.key}/comments`,
        { headers: { 'X-Figma-Token': token } },
    );
    if (!res.ok) {
        console.error(`🔴 ${board.name}: http ${res.status}`);
        process.exitCode = 1;
        continue;
    }
    const { comments } = (await res.json()) as { comments: FigmaComment[] };
    const unresolved = comments.filter((c) => c.resolved_at === null);
    if (unresolved.length === 0) continue;
    console.log(`💬 ${board.name} · https://www.figma.com/board/${board.key}`);
    for (const c of unresolved) {
        const where = c.client_meta?.node_id ?? '?';
        const thread = c.parent_id ? '  ↳ ' : '';
        console.log(
            `   ${thread}${c.created_at.slice(0, 16)} · ${c.user.handle} · node ${where} · ${c.message}`,
        );
    }
    open += unresolved.length;
}
console.log(
    open ? `${open} open comment(s)` : '🟢 no open comments on any board',
);

/* Types */

interface FigmaComment {
    client_meta?: { node_id?: string };
    created_at: string;
    message: string;
    parent_id: string;
    resolved_at: string | null;
    user: { handle: string };
}
