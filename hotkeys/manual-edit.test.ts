import { describe, expect, it } from 'vitest';

import type { Hotkey } from './manual.ts';
import {
    type ManualEdit,
    editManualText,
    moveManualText,
    printRow,
} from './manual-edit.ts';

const fixture = `export const manualHotkeys = [
    ...(
        [
            ['e', 'Linear'],
            ['n', 'Notion'],
        ] as const
    ).map(
        ([key, action]): Hotkey => ({
            action,
            app: 'raycast',
            key,
            mods: 'hyper',
        }),
    ),
    { action: 'Raycast', app: 'raycast', key: 'space', mods: 'cmd' },
    {
        action: 'Switch Windows (disabled)',
        app: 'raycast',
        key: 'tab',
        mods: 'opt',
    },
] satisfies readonly Hotkey[];
`;

const rows: Hotkey[] = [
    { action: 'Linear', app: 'raycast', key: 'e', mods: 'hyper' },
    { action: 'Notion', app: 'raycast', key: 'n', mods: 'hyper' },
    { action: 'Raycast', app: 'raycast', key: 'space', mods: 'cmd' },
    {
        action: 'Switch Windows (disabled)',
        app: 'raycast',
        key: 'tab',
        mods: 'opt',
    },
];

const edit = (from: Hotkey, to: ManualEdit['to']) =>
    editManualText(fixture, rows, { from, to });

describe('editManualText', () => {
    it('moves a tuple row to another key inside its own layer', () => {
        const next = edit(rows[0] as Hotkey, {
            action: 'Linear',
            key: 'l',
            mods: 'hyper',
        });

        expect(next).toContain("['l', 'Linear'],");
        expect(next).not.toContain("['e', 'Linear'],");
    });

    it('renames what a tuple row opens without touching its key', () => {
        const next = edit(rows[1] as Hotkey, {
            action: 'Obsidian',
            key: 'n',
            mods: 'hyper',
        });

        expect(next).toContain("['n', 'Obsidian'],");
    });

    it('lifts a tuple row out of its group when the layer changes', () => {
        const next = edit(rows[0] as Hotkey, {
            action: 'Linear',
            key: 'e',
            mods: 'ctrl+opt',
        });

        expect(next).not.toContain("['e', 'Linear'],");
        expect(next).toContain(
            "    { action: 'Linear', app: 'raycast', key: 'e', mods: 'ctrl+opt' },\n] satisfies",
        );
    });

    it('edits an object row in place', () => {
        const next = edit(rows[2] as Hotkey, {
            action: 'Raycast',
            key: 'space',
            mods: 'ctrl',
        });

        expect(next).toContain(
            "{ action: 'Raycast', app: 'raycast', key: 'space', mods: 'ctrl' }",
        );
    });

    it('edits a multi-line object row in place', () => {
        const next = edit(rows[3] as Hotkey, {
            action: 'Switch Windows',
            key: 'tab',
            mods: 'opt',
        });

        expect(next).toContain("action: 'Switch Windows',");
    });

    it('refuses a chord no hand-kept row carries', () => {
        expect(() =>
            edit(
                { action: 'Linear', app: 'raycast', key: 'z', mods: 'hyper' },
                { action: 'Linear', key: 'z', mods: 'hyper' },
            ),
        ).toThrow(/no hand-kept row/);
    });

    it('refuses when the same pair is written twice', () => {
        const twice = fixture.replace(
            "['n', 'Notion'],",
            "['n', 'Notion'],\n            ['n', 'Notion'],",
        );

        expect(() =>
            editManualText(twice, rows, {
                from: rows[1] as Hotkey,
                to: { action: 'Notion', key: 'm', mods: 'hyper' },
            }),
        ).toThrow(/appears 2 times/);
    });
});

describe('editManualText escaping', () => {
    // A raw newline ends the string literal mid-line and manual.ts stops parsing, which takes
    // the daemon's own import of it down with the file.
    it('writes a newline in an action as an escaped one, never as a line break', () => {
        const next = edit(rows[1] as Hotkey, {
            action: 'a\nb',
            key: 'n',
            mods: 'hyper',
        });

        expect(next).toContain("['n', 'a\\nb']");
        expect(next).not.toContain("'a\nb'");
    });

    it('escapes a tab and a backslash the same way', () => {
        const next = edit(rows[1] as Hotkey, {
            action: 'a\tb\\c',
            key: 'n',
            mods: 'hyper',
        });

        expect(next).toContain("['n', 'a\\tb\\\\c']");
    });

    // biome's own rule, measured 2026-09-20: single quotes unless the value holds MORE singles
    // than doubles. Writing the other form produces a file biome refuses, failing the next commit.
    it('keeps single quotes when a value holds both kinds', () => {
        const next = edit(rows[1] as Hotkey, {
            action: 'it\'s a "thing"',
            key: 'n',
            mods: 'hyper',
        });

        expect(next).toContain("['n', 'it\\'s a \"thing\"']");
    });

    it('switches to double quotes only when singles outnumber doubles', () => {
        const next = edit(rows[1] as Hotkey, {
            action: "only 'singles' here",
            key: 'n',
            mods: 'hyper',
        });

        expect(next).toContain("['n', \"only 'singles' here\"]");
    });
});

describe('moveManualText', () => {
    const move = (
        from: Hotkey,
        to: { mods: string; key: string; action: string },
    ) => moveManualText(fixture, rows, { from, on: '2026-09-20', to });

    // A row crosses 80 columns once it carries a date, so it prints multi-line. These assert
    // the fields and their order, which is the contract, not where biome put the newlines.
    const flat = (text: string) => text.replace(/\s+/g, ' ');

    // The presses already on hyper+e were Linear's and stay Linear's; the chord itself stops
    // meaning anything. Both halves, one action.
    it('ends the old meaning and starts the new one', () => {
        const next = move(rows[0] as Hotkey, {
            action: 'Linear',
            key: 'l',
            mods: 'hyper',
        });

        expect(next).not.toContain("['e', 'Linear'],");
        expect(flat(next)).toContain(
            "action: 'Linear', app: 'raycast', key: 'e', mods: 'hyper', until: '2026-09-20',",
        );
        expect(flat(next)).toContain(
            "action: 'Linear', app: 'raycast', key: 'l', mods: 'hyper', since: '2026-09-20',",
        );
    });

    it('leaves an object row where it is and only dates its end', () => {
        const next = move(rows[2] as Hotkey, {
            action: 'Raycast',
            key: 'space',
            mods: 'ctrl',
        });

        // the ended row keeps its place, still ahead of the row that always followed it
        expect(flat(next)).toContain(
            "mods: 'cmd', until: '2026-09-20', }, { action: 'Switch Windows",
        );
        expect(flat(next)).toContain(
            "key: 'space', mods: 'ctrl', since: '2026-09-20',",
        );
    });

    it('carries the app across, because a move is the same binding on a new chord', () => {
        const next = move(rows[1] as Hotkey, {
            action: 'Notion',
            key: 'm',
            mods: 'hyper',
        });

        expect(flat(next)).toContain(
            "action: 'Notion', app: 'raycast', key: 'm', mods: 'hyper', since: '2026-09-20',",
        );
    });

    it('carries the feature across, so its presses follow the move', () => {
        const row: Hotkey = {
            action: 'Speak',
            app: 'x-speak',
            feature: 'read aloud',
            key: 'f4',
            mods: '',
        };
        const text = `export const manualHotkeys = [
    {
        action: 'Speak',
        app: 'x-speak',
        feature: 'read aloud',
        key: 'f4',
        mods: '',
    },
] satisfies readonly Hotkey[];
`;
        const next = moveManualText(text, [row], {
            from: row,
            on: '2026-09-30',
            to: { action: 'Speak', key: 'f8', mods: '' },
        });

        expect(flat(next)).toContain(
            "feature: 'read aloud', key: 'f8', mods: '', since: '2026-09-30',",
        );
    });

    it('refuses a move that changes nothing', () => {
        expect(() =>
            move(rows[0] as Hotkey, {
                action: 'Linear',
                key: 'e',
                mods: 'hyper',
            }),
        ).toThrow(/changes nothing/);
    });

    // After one move the file holds the ended row and the live one under the same action, and
    // the next move (back, or onward) must land on the live one, never refuse.
    it('moves a row that already moved once', () => {
        const moved = move(rows[0] as Hotkey, {
            action: 'Linear',
            key: 'l',
            mods: 'hyper',
        });
        const movedRows: Hotkey[] = [
            { ...(rows[0] as Hotkey), until: '2026-09-20' },
            {
                action: 'Linear',
                app: 'raycast',
                key: 'l',
                mods: 'hyper',
                since: '2026-09-20',
            },
            ...rows.slice(1),
        ];
        const back = moveManualText(moved, movedRows, {
            from: movedRows[1] as Hotkey,
            on: '2026-09-22',
            to: { action: 'Linear', key: 'e', mods: 'hyper' },
        });

        expect(flat(back)).toContain(
            "key: 'l', mods: 'hyper', since: '2026-09-20', until: '2026-09-22',",
        );
        expect(flat(back)).toContain(
            "key: 'e', mods: 'hyper', since: '2026-09-22',",
        );
        // the first ended row is untouched
        expect(flat(back)).toContain(
            "key: 'e', mods: 'hyper', until: '2026-09-20',",
        );
    });

    // A chord that was left on the same day it was taken never lived long enough to count a
    // press, so the row claiming it did is noise in the history. One test session on
    // 2026-09-22 left five of them in manual.ts. Moving on to a THIRD chord rather than back
    // keeps this about the zero-length row alone — the return is the next test's job.
    it('drops a chord the same day it passed through', () => {
        const moved = move(rows[0] as Hotkey, {
            action: 'Linear',
            key: 'l',
            mods: 'hyper',
        });
        const movedRows: Hotkey[] = [
            { ...(rows[0] as Hotkey), until: '2026-09-20' },
            {
                action: 'Linear',
                app: 'raycast',
                key: 'l',
                mods: 'hyper',
                since: '2026-09-20',
            },
            ...rows.slice(1),
        ];
        const back = moveManualText(moved, movedRows, {
            from: movedRows[1] as Hotkey,
            on: '2026-09-20',
            to: { action: 'Linear', key: 'm', mods: 'hyper' },
        });

        expect(back).not.toContain("key: 'l'");
        // the move still lands, and the meaning that really ended still says so
        expect(flat(back)).toContain(
            "key: 'm', mods: 'hyper', since: '2026-09-20',",
        );
        expect(flat(back)).toContain(
            "key: 'e', mods: 'hyper', until: '2026-09-20',",
        );
    });

    // A chord taken and handed straight back changes nothing, so the file it started from is
    // the file it has to end on. It used to leave a seam instead: the original row ended and
    // an identical one started on the same day — two rows saying one thing, which is what a
    // second rebind read as duplicates rather than as one chain.
    it('leaves the file untouched when a same-day move returns', () => {
        const away = move(rows[2] as Hotkey, {
            action: 'Raycast',
            key: 'space',
            mods: 'ctrl',
        });
        const awayRows: Hotkey[] = [
            rows[0] as Hotkey,
            rows[1] as Hotkey,
            { ...(rows[2] as Hotkey), until: '2026-09-20' },
            rows[3] as Hotkey,
            {
                action: 'Raycast',
                app: 'raycast',
                key: 'space',
                mods: 'ctrl',
                since: '2026-09-20',
            },
        ];
        const back = moveManualText(away, awayRows, {
            from: awayRows[4] as Hotkey,
            on: '2026-09-20',
            to: { action: 'Raycast', key: 'space', mods: 'cmd' },
        });

        expect(back).toBe(fixture);
    });

    it('refuses a chord no hand-kept row carries', () => {
        expect(() =>
            move(
                { action: 'Linear', app: 'raycast', key: 'z', mods: 'hyper' },
                { action: 'Linear', key: 'q', mods: 'hyper' },
            ),
        ).toThrow(/no hand-kept row/);
    });
});

describe('printRow', () => {
    it('keeps a row on one line while it fits the 80-column budget', () => {
        expect(
            printRow({
                action: 'Autofill',
                app: '1password',
                key: '\\',
                mods: 'cmd',
            }),
        ).toBe(
            "    { action: 'Autofill', app: '1password', key: '\\\\', mods: 'cmd' },",
        );
    });

    it('explodes a row that does not fit', () => {
        expect(
            printRow({
                action: 'Switch Windows (disabled)',
                app: 'raycast',
                key: 'tab',
                mods: 'opt',
            }),
        ).toBe(
            "    {\n        action: 'Switch Windows (disabled)',\n        app: 'raycast',\n        key: 'tab',\n        mods: 'opt',\n    },",
        );
    });
});
