// node lib/read-back.mjs <before.excalidraw> <after.excalidraw>
// dima's edit as a semantic diff: moves, text changes, new 💬 notes. Version churn and tombstones never print.
import { readFileSync } from 'node:fs';
import { resolveArg } from './geometry.mjs';
import { collapse } from './parts.mjs';

const SHAPES = new Set(['rectangle', 'diamond', 'ellipse']);
const NEAR = 200;

const live = (els) =>
    new Map(els.filter((e) => !e.isDeleted).map((e) => [e.id, e]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const ownerOf = (e) => e.containerId ?? /^(.*)-t\d+$/.exec(e.id)?.[1];
const gap = (a, b) => {
    const dx = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0);
    const dy = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height), 0);
    return Math.hypot(dx, dy);
};

const clusters = (ids, byId) => {
    const out = [];
    const seen = new Set();
    for (const id of ids) {
        if (seen.has(id)) continue;
        const g = byId.get(id).groupIds[0];
        const members = g
            ? ids.filter((o) => byId.get(o).groupIds[0] === g)
            : [id];
        members.forEach((m) => seen.add(m));
        out.push(members);
    }
    return out;
};

const headOf = (members, byId) =>
    members.find((m) => SHAPES.has(byId.get(m).type)) ?? members[0];

export const diffBoards = (beforeEls, afterEls) => {
    const b = live(beforeEls);
    const a = live(afterEls);
    const lines = [];
    const folded = new Set();
    const both = [...a.keys()].filter((id) => b.has(id));

    const delta = (id) => ({
        dx: a.get(id).x - b.get(id).x,
        dy: a.get(id).y - b.get(id).y,
    });
    const resized = (id) =>
        a.get(id).width !== b.get(id).width ||
        a.get(id).height !== b.get(id).height;
    const moved = both.filter(
        (id) =>
            !['arrow'].includes(a.get(id).type) &&
            !a.get(id).containerId &&
            (delta(id).dx || delta(id).dy) &&
            !resized(id),
    );
    const byDelta = Object.groupBy(
        moved,
        (id) => `${delta(id).dx},${delta(id).dy}`,
    );
    for (const ids of Object.values(byDelta)) {
        for (const members of clusters(ids, a)) {
            const head = headOf(members, a);
            const { dx, dy } = delta(head);
            const memberSet = new Set(members);
            const arrows = both.filter((id) => {
                const arrow = a.get(id);
                if (arrow.type !== 'arrow') return false;
                const bound = [
                    arrow.startBinding?.elementId,
                    arrow.endBinding?.elementId,
                ];
                const geometry = !same(
                    [arrow.x, arrow.y, arrow.points],
                    [b.get(id).x, b.get(id).y, b.get(id).points],
                );
                return geometry && bound.some((e) => memberSet.has(e));
            });
            const follows = [];
            const texts = members.filter(
                (m) => m !== head && a.get(m).type === 'text',
            ).length;
            if (texts) follows.push(plural(texts, 'text'));
            if (arrows.length) follows.push(plural(arrows.length, 'arrow'));
            lines.push(
                `moved ${head} by ${dx}, ${dy}${follows.length ? ` (with ${follows.join(' and ')})` : ''}`,
            );
            members.forEach((m) => folded.add(m));
            for (const arrowId of arrows) {
                folded.add(arrowId);
                for (const e of a.values())
                    if (e.containerId === arrowId) folded.add(e.id);
            }
        }
    }

    for (const id of both) {
        if (folded.has(id)) continue;
        const x = a.get(id);
        const y = b.get(id);
        if (x.type === 'text' && collapse(x.text) !== collapse(y.text)) {
            const owner = ownerOf(x);
            const kind =
                owner && a.get(owner)?.type === 'arrow' ? 'arrow' : 'tile';
            lines.push(
                `text ${id}${owner ? ` (${kind} ${owner})` : ''}: "${collapse(y.text)}" → "${collapse(x.text)}"`,
            );
            continue;
        }
        if (
            x.backgroundColor !== y.backgroundColor ||
            x.strokeColor !== y.strokeColor
        )
            lines.push(
                `colour ${id}: ${y.backgroundColor}/${y.strokeColor} → ${x.backgroundColor}/${x.strokeColor}`,
            );
        if (resized(id)) lines.push(`resized ${id}`);
        else if (
            x.type === 'arrow' &&
            !same([x.x, x.y, x.points], [y.x, y.y, y.points])
        )
            lines.push(`rerouted ${id}`);
        else if (
            x.type !== 'arrow' &&
            !x.containerId &&
            (delta(id).dx || delta(id).dy)
        )
            lines.push(`moved ${id} by ${delta(id).dx}, ${delta(id).dy}`);
        if (
            x.type === 'arrow' &&
            !same(
                [x.startBinding?.elementId, x.endBinding?.elementId],
                [y.startBinding?.elementId, y.endBinding?.elementId],
            )
        )
            lines.push(`rebound ${id}`);
    }

    const tiles = [...a.values()].filter(
        (e) => SHAPES.has(e.type) && e.groupIds.length,
    );
    for (const id of [...a.keys()].filter((i) => !b.has(i))) {
        const e = a.get(id);
        if (e.type === 'text' && e.text.startsWith('💬')) {
            const [near] = tiles
                .map((t) => [t, gap(e, t)])
                .filter(([, d]) => d <= NEAR)
                .sort((p, q) => p[1] - q[1]);
            lines.push(
                `note added: "${collapse(e.text)}"${near ? ` beside ${near[0].id}` : ''}`,
            );
        } else if (!ownerOf(e) || !a.has(ownerOf(e)) || b.has(ownerOf(e)))
            lines.push(`added ${e.type} ${id}`);
    }

    const gone = [...b.keys()].filter((id) => !a.has(id));
    for (const members of clusters(gone, b)) {
        const head = headOf(members, b);
        const rest = members.length - 1;
        lines.push(
            `removed ${head}${rest ? ` (with ${plural(rest, 'text')})` : ''}`,
        );
    }
    return lines;
};

const main = () => {
    const [beforeArg, afterArg] = process.argv.slice(2);
    if (!beforeArg || !afterArg)
        throw new Error(
            'usage: pnpm --dir out read-back <before.excalidraw> <after.excalidraw>',
        );
    const read = (p) =>
        JSON.parse(readFileSync(resolveArg(p), 'utf8')).elements;
    for (const line of diffBoards(read(beforeArg), read(afterArg)))
        console.log(line);
};

if (import.meta.url === `file://${process.argv[1]}`) main();
