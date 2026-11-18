import { describe, expect, test } from 'vitest';

import { orbitNoteDefaults, pages, rowWords } from './settings-model.js';

const rowOf = (key: string) => {
    const row = pages
        .flatMap((page) => page.groups.flatMap((group) => group.rows))
        .find((candidate) => candidate.key === key);
    if (!row) throw new Error(`no row ${key}`);
    return row;
};

describe('a second wind note is titled by when its thread reads it', () => {
    test('with nothing stored the titles carry the default lines', () => {
        expect(rowWords(rowOf('stash.wind.text.notice'), {}).title).toBe(
            'at 55 % context: the heads-up',
        );
        expect(rowWords(rowOf('stash.wind.text.at'), {}).title).toBe(
            'at 65 % context: the must',
        );
    });

    test("a moved line moves the title of its note, and the line named in the other note's why", () => {
        const values = { 'stash.wind.must': 70, 'stash.wind.notice': 45 };
        expect(rowWords(rowOf('stash.wind.text.notice'), values)).toEqual({
            title: 'at 45 % context: the heads-up',
            why: 'what the thread reads then. {fill} = its context now, {wind} = the 70 % line.',
        });
    });

    test('a row with no number in its words reads as written', () => {
        expect(rowWords(rowOf('stash.wind.text.press'), {}).title).toBe(
            'when you press 🐦‍🔥',
        );
    });
});

describe('the three orbit notes', () => {
    const keys = [
        'stash.orbit.text.tick',
        'stash.orbit.text.plan-stale',
        'stash.orbit.text.lane-stale',
    ];

    test('each is a text row on the Claude Code mods page, empty by default, with a built-in line to show', () => {
        const cc = pages.find((page) => page.id === 'cc');
        const rows = cc?.groups.flatMap((group) => group.rows) ?? [];
        expect(
            keys.map((key) => {
                const row = rows.find((candidate) => candidate.key === key);
                return [
                    row?.control.kind,
                    row?.default,
                    !!orbitNoteDefaults[key],
                ];
            }),
        ).toEqual(keys.map(() => ['text', '', true]));
    });

    test('a placeholder in a why reads as written, never as a row value', () => {
        expect(rowWords(rowOf('stash.orbit.text.tick'), {}).why).toContain(
            '{n} = how many asks',
        );
    });
});

// x-mod-stash's second-wind store holds five notes (`WIND_ROWS` in its wind-store.ts): each has its box here
test('every second wind note the stash keeps has its row on the Claude Code mods page', () => {
    const cc = pages.find((page) => page.id === 'cc');
    const keys = (cc?.groups.flatMap((group) => group.rows) ?? [])
        .filter((row) => row.key.startsWith('stash.wind.text.'))
        .map((row) => row.key);
    expect(keys).toEqual([
        'stash.wind.text.notice',
        'stash.wind.text.at',
        'stash.wind.text.at.coordinator',
        'stash.wind.text.propose',
        'stash.wind.text.press',
    ]);
});
