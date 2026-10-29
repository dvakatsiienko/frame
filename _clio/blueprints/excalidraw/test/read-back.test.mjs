import { describe, expect, test } from 'vitest';
import { diffBoards } from '../lib/read-back.mjs';

const el = (id, type, x, y, extra = {}) => ({
    id,
    type,
    x,
    y,
    width: 100,
    height: 50,
    isDeleted: false,
    groupIds: [],
    containerId: null,
    version: 1,
    versionNonce: 1,
    updated: 1,
    seed: 1,
    index: 'a0',
    boundElements: null,
    ...extra,
});

const before = () => [
    el('T', 'rectangle', 0, 0, {
        groupIds: ['g'],
        boundElements: [{ id: 'A', type: 'arrow' }],
    }),
    el('T-t0', 'text', 10, 10, { groupIds: ['g'], text: 'the tile' }),
    el('U', 'rectangle', 400, 0, {
        groupIds: ['h'],
        boundElements: [{ id: 'A', type: 'arrow' }],
    }),
    el('A', 'arrow', 100, 25, {
        points: [
            [0, 0],
            [300, 0],
        ],
        startBinding: { elementId: 'T' },
        endBinding: { elementId: 'U' },
        boundElements: [{ id: 'A-label', type: 'text' }],
    }),
    el('A-label', 'text', 230, 15, { containerId: 'A', text: 'yes' }),
];
const after = (fn) => {
    const els = structuredClone(before());
    fn(els);
    return els;
};
const find = (els, id) => els.find((e) => e.id === id);
const bump = (e) =>
    Object.assign(e, { version: e.version + 1, versionNonce: 9, updated: 2 });

describe('diffBoards', () => {
    test('version churn alone prints nothing', () => {
        expect(
            diffBoards(
                before(),
                after((els) => els.forEach(bump)),
            ),
        ).toEqual([]);
    });

    test('a tile move folds its texts and re-routed arrows into one line', () => {
        const lines = diffBoards(
            before(),
            after((els) => {
                for (const id of ['T', 'T-t0']) {
                    find(els, id).x += 40;
                    bump(find(els, id));
                }
                Object.assign(find(els, 'A'), {
                    x: 140,
                    points: [
                        [0, 0],
                        [260, 0],
                    ],
                });
                find(els, 'A-label').x += 20;
            }),
        );
        expect(lines).toEqual(['moved T by 40, 0 (with 1 text and 1 arrow)']);
    });

    test('an edited tile text names the tile, the old and the new text', () => {
        const lines = diffBoards(
            before(),
            after((els) => {
                find(els, 'T-t0').text = 'the edited tile';
            }),
        );
        expect(lines).toEqual([
            'text T-t0 (tile T): "the tile" → "the edited tile"',
        ]);
    });

    test('a new 💬 text is a note, named with the tile it sits beside', () => {
        const lines = diffBoards(
            before(),
            after((els) =>
                els.push(el('n1', 'text', 110, 0, { text: '💬 check this' })),
            ),
        );
        expect(lines).toEqual(['note added: "💬 check this" beside T']);
    });

    test('a deleted element is removed; a tombstone born deleted is nothing', () => {
        const lines = diffBoards(
            before(),
            after((els) => {
                find(els, 'U').isDeleted = true;
                els.push(el('ghost', 'rectangle', 0, 0, { isDeleted: true }));
            }),
        );
        expect(lines).toEqual(['removed U']);
    });
});
