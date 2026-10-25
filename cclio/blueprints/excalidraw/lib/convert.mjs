// node lib/convert.mjs <in.drawio> <out.excalidraw>
// Every draw.io cell becomes the Excalidraw element of the same id; a tile's text becomes grouped parts (<id>-t0...),
// an edge label <id>-label, a dima* note <id>-note-<field>. Elbow arrows are routed by Excalidraw's own router.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { openChrome } from './chrome.mjs';
import { parseDrawio } from './drawio.mjs';
import { makeFactory } from './element.mjs';
import { checkIdMap, formatCounts } from './id-map.mjs';
import { labelCenter } from './label.mjs';
import { fitMagnet, routeSideProblems } from './magnet.mjs';
import { perimeterPoint, resolveArg } from './geometry.mjs';
import { groupParts } from './parts.mjs';
import { routeArrows } from './route.mjs';
import { LINE, makeText } from './text.mjs';

// draw.io paints an unstyled shape white with a black outline
const DEFAULT_FILL = '#FFFFFF';
const DEFAULT_STROKE = '#000000';
const NOTE_INK = '#8A5A00';
const NOTE_WIDTH = 360;
const NOTE_SIZE = 20;

const colour = (v, fallback) =>
    !v ? fallback : v === 'none' ? 'transparent' : v;
const sum = (...n) => n.reduce((a, b) => a + Number(b ?? 0), 0);

// a diamond's text box must sit inside the diamond: w/W + h/H <= 1
const diamondWidth = async (tx, parts, c) => {
    for (let f = 0.75; f >= 0.35; f -= 0.05) {
        const w = Math.round(c.w * f);
        let h = 0;
        for (const p of parts)
            for (const para of p.paragraphs)
                h += (await tx.wrap(para, p.size, w)).length * p.size * LINE;
        if (w / c.w + h / c.h <= 0.98) return w;
    }
    return Math.round(c.w * 0.35);
};

export const convert = async (board, page) => {
    const { base, text } = makeFactory();
    const tx = makeText(page);
    const elements = [];
    const boxes = new Map();
    const shapes = new Map();

    for (const c of board.cells.filter((x) => x.kind !== 'edge')) {
        const s = c.style;
        boxes.set(c.id, { x: c.x, y: c.y, w: c.w, h: c.h, kind: c.kind });
        if (c.kind === 'label') {
            const lines = c.runs.map((l) =>
                l
                    .map((r) => r.text)
                    .join('')
                    .trim(),
            );
            const size = c.runs[0]?.[0]?.size ?? Number(s.fontSize ?? 12);
            elements.push(
                text(c.id, c.x, c.y, c.w, lines.join('\n'), size, {
                    height: c.h,
                    strokeColor: colour(s.fontColor, DEFAULT_STROKE),
                    textAlign: s.align ?? 'center',
                    verticalAlign: s.verticalAlign ?? 'top',
                }),
            );
            continue;
        }
        const isTile = c.kind !== 'container';
        const groupIds = isTile ? [`${c.id}-g`] : [];
        const shape = base(
            c.id,
            c.kind === 'diamond' ? 'diamond' : 'rectangle',
            c.x,
            c.y,
            c.w,
            c.h,
            {
                strokeColor: colour(s.strokeColor, DEFAULT_STROKE),
                backgroundColor: colour(s.fillColor, DEFAULT_FILL),
                strokeWidth: Number(s.strokeWidth ?? 1),
                groupIds,
                roundness: s.rounded === '1' ? { type: 3 } : null,
                boundElements: [],
            },
        );
        elements.push(shape);
        shapes.set(c.id, shape);
        if (!isTile) continue;

        const parts = groupParts(c.runs);
        const left = sum(s.spacingLeft, s.spacing);
        const right = sum(s.spacingRight, s.spacing);
        const align = s.align ?? 'center';
        const usable =
            c.kind === 'diamond'
                ? await diamondWidth(tx, parts, c)
                : c.w - left - right;
        const originX =
            c.kind === 'diamond' ? c.x + (c.w - usable) / 2 : c.x + left;
        const wrapped = await Promise.all(
            parts.map(async (p) =>
                (
                    await Promise.all(
                        p.paragraphs.map((para) =>
                            tx.wrap(para, p.size, usable),
                        ),
                    )
                ).flat(),
            ),
        );
        const total = wrapped.reduce(
            (h, ls, i) => h + ls.length * parts[i].size * LINE,
            0,
        );
        let ty =
            (s.verticalAlign ?? 'middle') === 'top'
                ? c.y + sum(s.spacingTop, s.spacing)
                : c.y + (c.h - total) / 2;
        parts.forEach((p, i) => {
            const t = text(
                `${c.id}-t${i}`,
                originX,
                ty,
                usable,
                wrapped[i].join('\n'),
                p.size,
                {
                    strokeColor: colour(p.color, DEFAULT_STROKE),
                    textAlign: align,
                    groupIds,
                },
            );
            elements.push(t);
            ty += t.height;
        });
    }

    const labels = [];
    for (const c of board.cells.filter((x) => x.kind === 'edge')) {
        const s = c.style;
        const a = boxes.get(c.source);
        const b = boxes.get(c.target);
        const ortho = s.edgeStyle === 'orthogonalEdgeStyle';
        let exit = [Number(s.exitX), Number(s.exitY)];
        let entry = [Number(s.entryX), Number(s.entryY)];
        let elbow = ortho;
        if (ortho) {
            const [fitExit, fitEntry] = [
                fitMagnet(exit, a),
                fitMagnet(entry, b),
            ];
            if (!fitExit.fits || !fitEntry.fits) {
                const [ax, ay] = [a.x + a.w * exit[0], a.y + a.h * exit[1]];
                const [bx, by] = [b.x + b.w * entry[0], b.y + b.h * entry[1]];
                // aligned ends: the straight line is the orthogonal route; otherwise the magnets slide along their sides
                if (Math.abs(ax - bx) < 1 || Math.abs(ay - by) < 1)
                    elbow = false;
                else [exit, entry] = [fitExit.fp, fitEntry.fp];
            }
        }
        const [sx, sy] = ortho
            ? [a.x + a.w * exit[0], a.y + a.h * exit[1]]
            : perimeterPoint(a, b, a.kind);
        const [ex, ey] = ortho
            ? [b.x + b.w * entry[0], b.y + b.h * entry[1]]
            : perimeterPoint(b, a, b.kind);
        const arrow = base(
            c.id,
            'arrow',
            sx,
            sy,
            Math.abs(ex - sx),
            Math.abs(ey - sy),
            {
                strokeColor: colour(s.strokeColor, DEFAULT_STROKE),
                strokeWidth: Number(s.strokeWidth ?? 1),
                strokeStyle: s.dashed === '1' ? 'dashed' : 'solid',
                points: [
                    [0, 0],
                    [ex - sx, ey - sy],
                ],
                lastCommittedPoint: null,
                startBinding: {
                    elementId: c.source,
                    ...(elbow ? { fixedPoint: exit } : {}),
                    focus: 0,
                    gap: 1,
                },
                endBinding: {
                    elementId: c.target,
                    ...(elbow ? { fixedPoint: entry } : {}),
                    focus: 0,
                    gap: 1,
                },
                startArrowhead:
                    s.startArrow && s.startArrow !== 'none' ? 'arrow' : null,
                endArrowhead:
                    s.endArrow && s.endArrow !== 'none' ? 'arrow' : null,
                elbowed: elbow,
                fixedSegments: null,
                startIsSpecial: null,
                endIsSpecial: null,
                boundElements: [],
            },
        );
        elements.push(arrow);
        for (const end of [c.source, c.target])
            shapes.get(end).boundElements.push({ id: c.id, type: 'arrow' });
        if (c.plain) {
            const size = c.runs[0][0].size;
            const w = Math.ceil(await tx.measure(c.plain, size)) + 4;
            const lt = text(`${c.id}-label`, 0, 0, w, c.plain, size, {
                containerId: c.id,
                verticalAlign: 'middle',
                strokeColor: colour(s.fontColor, DEFAULT_STROKE),
            });
            elements.push(lt);
            arrow.boundElements.push({ id: lt.id, type: 'text' });
            labels.push(lt);
        }
    }

    const routed = await routeArrows(page, elements);
    const byId = new Map(elements.map((e) => [e.id, e]));
    for (const r of routed.filter((r) => byId.get(r.id).elbowed)) {
        Object.assign(byId.get(r.id), {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            points: r.points,
        });
    }
    for (const lt of labels) {
        const arrow = byId.get(lt.containerId);
        const [mx, my] = labelCenter(
            arrow.points.map(([px, py]) => [arrow.x + px, arrow.y + py]),
        );
        Object.assign(lt, { x: mx - lt.width / 2, y: my - lt.height / 2 });
    }

    for (const c of board.cells.filter((x) => x.notes.length)) {
        // above the tile: the gap between two tiles is narrower than a note, the gap between two rows is not
        const wrapped = await Promise.all(
            c.notes.map(async ([field, note]) => [
                field,
                (await tx.wrap(`💬 ${note}`, NOTE_SIZE, NOTE_WIDTH)).join('\n'),
            ]),
        );
        let y =
            c.y -
            12 -
            wrapped.reduce(
                (h, [, lines]) =>
                    h + lines.split('\n').length * NOTE_SIZE * LINE + 8,
                0,
            );
        for (const [field, lines] of wrapped) {
            const t = text(
                `${c.id}-note-${field}`,
                c.x,
                y,
                NOTE_WIDTH,
                lines,
                NOTE_SIZE,
                {
                    textAlign: 'left',
                    strokeColor: NOTE_INK,
                    customData: { pin: c.id, field },
                },
            );
            elements.push(t);
            y += t.height + 8;
        }
    }
    return elements;
};

export const serialize = (elements, source) =>
    `${JSON.stringify({ type: 'excalidraw', version: 2, source, elements, appState: { viewBackgroundColor: '#FFFFFF' }, files: {} }, null, 2)}\n`;

const main = async () => {
    const [inArg, outArg] = process.argv.slice(2);
    if (!inArg || !outArg)
        throw new Error(
            'usage: pnpm --dir out convert <in.drawio> <out.excalidraw>',
        );
    const target = resolveArg(outArg);
    // two writers share the board: dima saves it from the Excalidraw PWA, this script regenerates it; an uncommitted edit of his is never overwritten
    if (existsSync(target)) {
        const dirty = spawnSync(
            'git',
            ['-C', dirname(target), 'diff', '--quiet', 'HEAD', '--', target],
            { stdio: 'ignore' },
        ).status;
        if (dirty !== 0)
            throw new Error(
                `${target} differs from its last commit — dima's edit? read it back (pnpm read-back) and fold it into the .drawio, or commit it, before a redraw`,
            );
    }
    const board = parseDrawio(readFileSync(resolveArg(inArg), 'utf8'));
    const { browser, page } = await openChrome();
    const elements = await convert(board, page);
    await browser.close();
    const out = resolveArg(outArg);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, serialize(elements, 'convert.mjs'));
    const written = JSON.parse(readFileSync(out, 'utf8')).elements;
    const { counts, problems } = checkIdMap(board, written);
    problems.push(...routeSideProblems(written));
    const ortho = board.cells.filter(
        (c) => c.kind === 'edge' && c.style.edgeStyle === 'orthogonalEdgeStyle',
    );
    const straightened = ortho.filter(
        (c) => !written.find((e) => e.id === c.id).elbowed,
    );
    console.log(formatCounts(counts));
    const slid = ortho.filter((c) => {
        const bound = written.find((e) => e.id === c.id);
        return (
            bound.elbowed &&
            (bound.startBinding.fixedPoint[0] !== Number(c.style.exitX) ||
                bound.endBinding.fixedPoint[0] !== Number(c.style.entryX))
        );
    });
    console.log(
        `📌 ${slid.length} orthogonal edges had a magnet slid along its side: ${slid.map((c) => c.id).join(', ') || 'none'}`,
    );
    console.log(
        `📌 ${straightened.length} of ${ortho.length} orthogonal edges drawn straight (ends aligned, the router misreads their magnet side): ${straightened.map((c) => c.id).join(', ') || 'none'}`,
    );
    for (const p of problems.slice(0, 40)) console.log(`🔴 ${p}`);
    if (problems.length > 40)
        console.log(`🔴 … and ${problems.length - 40} more`);
    console.log(
        `${out}: ${written.length} elements, ${problems.length} mismatches`,
    );
    process.exit(problems.length ? 1 : 0);
};

if (import.meta.url === `file://${process.argv[1]}`) await main();
