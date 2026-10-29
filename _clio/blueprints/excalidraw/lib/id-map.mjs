// The converter's check: every draw.io cell maps by id to its Excalidraw element. Counts print on both sides.
import { groupParts, collapse } from './parts.mjs';

const TOLERANCE = 2;
const CATEGORIES = [
    'containers',
    'tiles',
    'diamonds',
    'labels',
    'edges',
    'edgeLabels',
    'textParts',
    'notes',
];

const hex = (v) => {
    const s = (v ?? 'transparent').toLowerCase();
    return /^#[0-9a-f]{3}$/.test(s)
        ? `#${[...s.slice(1)].map((c) => c + c).join('')}`
        : s === 'none'
          ? 'transparent'
          : s;
};
const clip = (s) => (s.length > 60 ? `${s.slice(0, 57)}...` : s);

const drawioCounts = (board) => {
    const cells = board.cells;
    const kind = (k) => cells.filter((c) => c.kind === k).length;
    return {
        containers: kind('container'),
        tiles: kind('tile'),
        diamonds: kind('diamond'),
        labels: kind('label'),
        edges: kind('edge'),
        edgeLabels: cells.filter((c) => c.kind === 'edge' && c.plain).length,
        textParts: cells
            .filter((c) => c.kind === 'tile' || c.kind === 'diamond')
            .reduce((n, c) => n + groupParts(c.runs).length, 0),
        notes: cells.reduce((n, c) => n + c.notes.length, 0),
    };
};

const excalidrawCounts = (elements) => {
    const live = elements.filter((e) => !e.isDeleted);
    const n = (f) => live.filter(f).length;
    const grouped = (e) => e.groupIds.length > 0;
    return {
        containers: n((e) => e.type === 'rectangle' && !grouped(e)),
        tiles: n((e) => e.type === 'rectangle' && grouped(e)),
        diamonds: n((e) => e.type === 'diamond'),
        labels: n(
            (e) =>
                e.type === 'text' &&
                !e.containerId &&
                !grouped(e) &&
                !e.customData?.pin,
        ),
        edges: n((e) => e.type === 'arrow'),
        edgeLabels: n((e) => e.type === 'text' && e.containerId),
        textParts: n((e) => e.type === 'text' && grouped(e)),
        notes: n((e) => e.type === 'text' && e.customData?.pin),
    };
};

export const checkIdMap = (board, elements) => {
    const problems = [];
    const byId = new Map(
        elements.filter((e) => !e.isDeleted).map((e) => [e.id, e]),
    );
    const textOf = (id) => {
        const parts = [];
        for (
            let i = byId.has(`${id}-t0`) ? 0 : Infinity;
            byId.has(`${id}-t${i}`);
            i++
        )
            parts.push(byId.get(`${id}-t${i}`).text);
        return collapse(parts.join(' '));
    };
    const same = (id, what, want, got) => {
        if (want !== got)
            problems.push(
                `${id}: ${what} expected "${clip(String(want))}" got "${clip(String(got))}"`,
            );
    };

    for (const c of board.cells) {
        const el = byId.get(c.id);
        if (!el) {
            problems.push(`${c.id}: no element`);
            continue;
        }
        if (c.kind === 'edge') {
            same(c.id, 'start binding', c.source, el.startBinding?.elementId);
            same(c.id, 'end binding', c.target, el.endBinding?.elementId);
            same(
                c.id,
                'stroke',
                hex(c.style.strokeColor ?? '#000000'),
                hex(el.strokeColor),
            );
            same(
                c.id,
                'text',
                c.plain,
                collapse(byId.get(`${c.id}-label`)?.text ?? ''),
            );
            continue;
        }
        const box = [c.x, c.y, c.w, c.h];
        const got = [el.x, el.y, el.width, el.height];
        if (box.some((v, i) => Math.abs(v - got[i]) > TOLERANCE))
            problems.push(
                `${c.id}: bbox expected ${box.join(',')} got ${got.join(',')}`,
            );
        if (c.kind === 'label') {
            same(c.id, 'text', c.plain, collapse(el.text));
            same(
                c.id,
                'text colour',
                hex(c.style.fontColor ?? '#000000'),
                hex(el.strokeColor),
            );
        } else {
            same(
                c.id,
                'fill',
                hex(c.style.fillColor ?? '#FFFFFF'),
                hex(el.backgroundColor),
            );
            same(
                c.id,
                'stroke',
                hex(c.style.strokeColor ?? '#000000'),
                hex(el.strokeColor),
            );
            same(c.id, 'text', c.plain, textOf(c.id));
        }
        for (const [field, note] of c.notes) {
            const n = byId.get(`${c.id}-note-${field}`);
            if (
                !n ||
                !n.text.startsWith('💬') ||
                collapse(n.text) !== collapse(`💬 ${note}`)
            )
                problems.push(`${c.id}: note ${field} missing or changed`);
        }
    }
    return {
        counts: {
            drawio: drawioCounts(board),
            excalidraw: excalidrawCounts(elements),
        },
        problems,
    };
};

export const formatCounts = ({ drawio, excalidraw }) =>
    CATEGORIES.map(
        (k) =>
            `${drawio[k] === excalidraw[k] ? '✅' : '🔴'} ${k} — drawio ${drawio[k]}, excalidraw ${excalidraw[k]}`,
    ).join('\n');
