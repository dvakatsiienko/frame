// node ticket-flow/build.mjs <board.excalidraw> [ticket-flow.build.py]
// Rewrites the tf- section of a board from the draw.io builder's own data (its build() runs through cells.py, the
// result goes through the same converter as every other cell). Only tf- elements are touched; a 💬 pinned to a tf- tile
// is kept and rides its tile.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openChrome } from '../lib/chrome.mjs';
import { convert } from '../lib/convert.mjs';
import { parseDrawio } from '../lib/drawio.mjs';
import { indexKey } from '../lib/element.mjs';
import { resolveArg } from '../lib/geometry.mjs';
import { collapse } from '../lib/parts.mjs';
import { checkWraps } from '../lib/wrapcheck.mjs';

const CELLS = new URL('cells.py', import.meta.url).pathname;
const PREFIX = 'tf-';
const ADOPT_GAP = 120;
const SHAPES = new Set(['rectangle', 'diamond']);

const gap = (a, b) => {
    const dx = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0);
    const dy = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height), 0);
    return Math.hypot(dx, dy);
};
const isNote = (e) =>
    e.type === 'text' && !e.isDeleted && e.text.startsWith('💬');
const byReading = (a, b) => a.y - b.y || a.x - b.x;

const diffLineCount = (a, b) => {
    if (a === b) return 0;
    const dir = mkdtempSync(join(tmpdir(), 'tf-diff-'));
    writeFileSync(join(dir, 'a'), a);
    writeFileSync(join(dir, 'b'), b);
    const out = spawnSync('diff', [join(dir, 'a'), join(dir, 'b')], {
        encoding: 'utf8',
        maxBuffer: 1 << 28,
    }).stdout;
    return out.split('\n').filter((l) => /^[<>]/.test(l)).length;
};

/** @returns {Promise<{file: object, written: object[], diffLines: number, problems: string[]}>} */
export const rebuildTicketFlow = async (file, builderPath, page) => {
    const before = `${JSON.stringify(file, null, 2)}\n`;
    const all = file.elements;
    const live = all.filter((e) => !e.isDeleted);
    const byId = new Map(live.map((e) => [e.id, e]));
    const tiles = live.filter((e) => SHAPES.has(e.type) && e.groupIds.length);
    const tileTitle = (id) => collapse(byId.get(`${id}-t0`)?.text ?? id);

    // every note on the board, pinned to a tile by its pin or by sitting beside one
    const notes = live
        .filter(isNote)
        .sort(byReading)
        .map((n) => {
            const pinned = n.customData?.pin && byId.get(n.customData.pin);
            const near = pinned
                ? null
                : tiles
                      .map((t) => [t, gap(n, t)])
                      .filter(([, d]) => d <= ADOPT_GAP)
                      .sort((p, q) => p[1] - q[1])[0]?.[0];
            return {
                note: n,
                tile: pinned ?? near ?? null,
                adopted: !pinned && Boolean(near),
            };
        });
    const keep = notes.filter(({ tile }) => tile?.id.startsWith(PREFIX));
    const keptIds = new Set(keep.map(({ note }) => note.id));

    const list = notes.map(({ note, tile }) => ({
        cid: tile?.id ?? null,
        title: tile ? tileTitle(tile.id) : 'a note',
        field: note.customData?.field ?? 'dima',
        note: collapse(note.text).replace(/^💬\s*/, ''),
    }));
    const xml = execFileSync('python3', ['-I', CELLS, builderPath], {
        input: JSON.stringify(list),
        encoding: 'utf8',
        maxBuffer: 1 << 28,
    });
    const fresh = await convert(parseDrawio(xml), page);
    const freshById = new Map(fresh.map((e) => [e.id, e]));

    const rest = all.filter(
        (e) => !e.id.startsWith(PREFIX) || keptIds.has(e.id),
    );
    const top = rest.reduce((m, e) => (e.index > m ? e.index : m), '');
    const plain = /^[a-z](\d+)$/.exec(top);
    if (!plain && top)
        throw new Error(
            `index ${top} is fractional: re-run convert before the tickets-flow twin`,
        );
    const start = plain ? Number(plain[1]) + 1 : 0;
    fresh.forEach((e, i) => {
        e.index = indexKey(start + i);
    });

    const written = [...fresh];
    const ordinal = new Map();
    for (const { note, tile, adopted } of keep) {
        const moveTo = freshById.get(tile.id);
        if (!moveTo) continue;
        const [dx, dy] = [note.x - tile.x, note.y - tile.y];
        const next = ordinal.get(tile.id) ?? 0;
        ordinal.set(tile.id, next + 1);
        const patch = {
            x: moveTo.x + dx,
            y: moveTo.y + dy,
            customData: {
                ...note.customData,
                pin: tile.id,
                field: note.customData?.field ?? 'dima',
            },
        };
        if (adopted && !note.id.startsWith(PREFIX))
            patch.id = `${PREFIX}note-${tile.id.slice(PREFIX.length)}-${next}`;
        if (
            patch.x !== note.x ||
            patch.y !== note.y ||
            patch.id ||
            JSON.stringify(patch.customData) !== JSON.stringify(note.customData)
        ) {
            Object.assign(note, patch);
            written.push(note);
        }
    }

    const out = { ...file, elements: [...rest, ...fresh] };
    const problems = [];
    for (const e of written.filter((w) => !w.id.startsWith(PREFIX)))
        problems.push(`${e.id}: written without the ${PREFIX} prefix`);
    for (const a of fresh.filter((e) => e.type === 'arrow')) {
        const ends = [
            a.startBinding?.elementId,
            a.endBinding?.elementId,
        ].filter((id) => id?.startsWith(PREFIX));
        if (ends.length === 1)
            problems.push(
                `${a.id}: binds a ${PREFIX} element to one without the prefix`,
            );
    }
    const { past } = await checkWraps(out.elements, page);
    problems.push(...past.filter((p) => p.startsWith(PREFIX)));
    return {
        file: out,
        written,
        diffLines: diffLineCount(before, `${JSON.stringify(out, null, 2)}\n`),
        problems,
    };
};

const main = async () => {
    const [boardArg, builderArg] = process.argv.slice(2);
    if (!boardArg)
        throw new Error(
            'usage: pnpm --dir out ticket-flow:build <board.excalidraw> [ticket-flow.build.py]',
        );
    const board = resolveArg(boardArg);
    const builder = builderArg
        ? resolveArg(builderArg)
        : new URL('../../ticket-flow.build.py', import.meta.url).pathname;
    const { browser, page } = await openChrome();
    const result = await rebuildTicketFlow(
        JSON.parse(readFileSync(board, 'utf8')),
        builder,
        page,
    );
    await browser.close();
    for (const p of result.problems) console.log(`🔴 ${p}`);
    if (result.problems.length) process.exit(1);
    writeFileSync(board, `${JSON.stringify(result.file, null, 2)}\n`);
    console.log(
        `${board}: ${result.written.length} tf- elements written, ${result.diffLines} diff lines`,
    );
};

if (import.meta.url === `file://${process.argv[1]}`) await main();
