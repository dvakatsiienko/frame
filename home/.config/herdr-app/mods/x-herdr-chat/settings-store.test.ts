import { describe, expect, test } from 'vitest';

import { settingRows } from './settings-model.js';
import {
    noteHint,
    noteShown,
    noteStored,
    noteWrite,
    resolvedRows,
    rowValue,
    settingChange,
    settingsOf,
    settingsText,
    settledPending,
    storedRows,
    windRefusal,
} from './settings-store.js';

/** @type {any} */
const toggle = { control: { kind: 'toggle' }, default: true, key: 'a.toggle' };
/** @type {any} */
const stepper = {
    control: { kind: 'stepper', max: 95, min: 30, step: 5, unit: '%' },
    default: 60,
    key: 'a.step',
};
/** @type {any} */
const checks = {
    control: {
        kind: 'checks',
        options: [
            { label: 'all', value: 'all' },
            { isLocked: true, label: 'floor', value: 'floor' },
        ],
    },
    default: ['all'],
    key: 'a.checks',
};

describe('rowValue', () => {
    test('a value of the row’s shape is kept', () => {
        expect(rowValue(toggle, false)).toBe(false);
        expect(rowValue(stepper, 75)).toBe(75);
        expect(rowValue(checks, [])).toEqual([]);
    });

    test('a missing value or one of another type reads as the default', () => {
        expect(rowValue(toggle, undefined)).toBe(true);
        expect(rowValue(toggle, 'yes')).toBe(true);
        expect(rowValue(stepper, '75')).toBe(60);
        expect(rowValue(checks, 'all')).toEqual(['all']);
    });

    test('a number off the stepper’s range or step reads as the default', () => {
        expect(rowValue(stepper, 25)).toBe(60);
        expect(rowValue(stepper, 100)).toBe(60);
        expect(rowValue(stepper, 62)).toBe(60);
        expect(rowValue(stepper, Number.NaN)).toBe(60);
    });

    test('checks naming an unknown or a locked option read as the default', () => {
        expect(rowValue(checks, ['all', 'nope'])).toEqual(['all']);
        expect(rowValue(checks, ['floor'])).toEqual(['all']);
        expect(rowValue(checks, [1])).toEqual(['all']);
    });
});

describe('resolvedRows', () => {
    test('every row gets a value, a stored one when it fits, and a key no row names is dropped', () => {
        expect(
            resolvedRows([toggle, stepper, checks], {
                'a.step': 90,
                'gone.row': 1,
            }),
        ).toEqual({ 'a.checks': ['all'], 'a.step': 90, 'a.toggle': true });
    });
});

describe('settingsText', () => {
    test('a file that is not json, or not ours, reads as nothing stored', () => {
        expect(settingsText([stepper], null)).toContain('"a.step": 60');
        expect(settingsText([stepper], '{oops')).toContain('"a.step": 60');
        expect(settingsText([stepper], '[1]')).toContain('"a.step": 60');
    });

    test('a change lands over what is stored, and the file names its version', () => {
        const text = settingsText(
            [toggle, stepper],
            '{"v":1,"rows":{"a.step":70}}',
            {
                'a.toggle': false,
            },
        );
        expect(JSON.parse(text)).toEqual({
            rows: { 'a.step': 70, 'a.toggle': false },
            v: 1,
        });
    });

    test('a change that does not fit its row is refused, the stored value stays', () => {
        const text = settingsText([stepper], '{"v":1,"rows":{"a.step":70}}', {
            'a.step': 3,
        });
        expect(JSON.parse(text).rows['a.step']).toBe(70);
    });
});

describe('the file the old chat wrote', () => {
    // a cut of his real file, 18 Nov: the old chat's own rows sit beside ours
    const his =
        '{"v":1,"rows":{"chatter.send.holdDelay":150,"chatter.showMore":false,"chatter.pictures.cleanshot":false,"stash.second-wind-auto":true}}';

    test("reads his values for this chat's rows", () => {
        const values = settingsOf(his);
        expect([
            values['chatter.send.holdDelay'],
            values['chatter.pictures.cleanshot'],
        ]).toEqual([150, false]);
    });

    test('reads a row the file lacks at its default', () => {
        expect(settingsOf(his)['chatter.send.holdPush']).toBe(1000);
    });

    test("keeps the old chat's own row through a change made here", () => {
        const next = settingsText(settingRows, his, {
            'chatter.send.holdPush': 1500,
        });
        expect(JSON.parse(next).rows['chatter.showMore']).toBe(false);
    });
});

describe('a restart', () => {
    test('a row he changed survives it, and a key no row names stays in the file', () => {
        const saved =
            '{"v":1,"rows":{"a.step":75,"a.toggle":false,"later.row":"kept"}}';
        expect(JSON.parse(settingsText([toggle, stepper], saved)).rows).toEqual(
            {
                'a.step': 75,
                'a.toggle': false,
                'later.row': 'kept',
            },
        );
    });

    test('only a missing row is filled with its default', () => {
        expect(
            JSON.parse(
                settingsText([toggle, stepper], '{"v":1,"rows":{"a.step":75}}'),
            ).rows,
        ).toEqual({ 'a.step': 75, 'a.toggle': true });
    });
});

describe('the 🐦‍🔥 second wind group (FRM-625)', () => {
    const rows = (text: string) => JSON.parse(text).rows;
    const lines = { 'stash.wind.must': 65, 'stash.wind.notice': 55 };

    test('the two switches and the two lines are saved to the rows x-mod-stash reads', () => {
        const text = settingsText(settingRows, null, {
            'stash.second-wind': false,
            'stash.second-wind-auto': false,
            'stash.wind.must': 70,
            'stash.wind.notice': 50,
        });
        expect(rows(text)).toMatchObject({
            'stash.second-wind': false,
            'stash.second-wind-auto': false,
            'stash.wind.must': 70,
            'stash.wind.notice': 50,
        });
    });

    test('a notice line at or above the wind line is refused, in words that name both', () => {
        expect(windRefusal(lines, { 'stash.wind.notice': 65 })).toBe(
            '🛑 not saved: the notice line (65) must sit below the wind line (65)',
        );
        expect(windRefusal(lines, { 'stash.wind.must': 50 })).toBe(
            '🛑 not saved: the notice line (55) must sit below the wind line (50)',
        );
    });

    test('a notice line below the wind line, or a change to another row, is not refused', () => {
        expect(windRefusal(lines, { 'stash.wind.notice': 60 })).toBeNull();
        expect(windRefusal(lines, { 'chatter.showMore': false })).toBeNull();
    });

    test('a note box shows its row, else the default the stash wrote', () => {
        expect(noteShown('my text', 'the default')).toBe('my text');
        expect(noteShown('', 'the default')).toBe('the default');
        expect(noteShown('  \n', 'the default')).toBe('the default');
        expect(noteShown(undefined, 'the default')).toBe('the default');
    });

    test('a note saved as the default, or blank, leaves its row empty', () => {
        expect(noteStored('the default', 'the default')).toBe('');
        expect(noteStored('   ', 'the default')).toBe('');
        expect(noteStored('mine, with a handoff', 'the default')).toBe(
            'mine, with a handoff',
        );
    });

    test('an edited note is saved to its row whole', () => {
        const key = 'stash.wind.text.press';
        const edited = settingsText(settingRows, null, {
            [key]: 'line 1\nline 2',
        });
        expect(rows(edited)[key]).toBe('line 1\nline 2');
    });

    test('a save writes the box to its row and leaves the box alone', () => {
        expect(
            noteWrite('mine, with a handoff', 'the default', false, true),
        ).toEqual({
            box: null,
            row: 'mine, with a handoff',
        });
    });

    test('a reset empties the row and puts the default back in the box', () => {
        expect(
            noteWrite('mine, with a handoff', 'the default', true, true),
        ).toEqual({
            box: 'the default',
            row: '',
        });
    });

    test('a refused change writes nothing and its row says why', () => {
        expect(settingChange(lines, {}, {}, 'stash.wind.notice', 65)).toEqual({
            notes: {
                'stash.wind.notice':
                    '🛑 not saved: the notice line (65) must sit below the wind line (65)',
            },
            pending: {},
            write: null,
        });
    });

    test('a saved line clears the refusal on both lines', () => {
        const notes = {
            'chatter.other': 'stays',
            'stash.wind.must': '🛑 not saved: old',
        };
        expect(
            settingChange(lines, {}, notes, 'stash.wind.notice', 50),
        ).toEqual({
            notes: { 'chatter.other': 'stays' },
            pending: { 'stash.wind.notice': 50 },
            write: { 'stash.wind.notice': 50 },
        });
    });

    test('a second line pressed before the first one reloaded is judged against it', () => {
        const first = settingChange(lines, {}, {}, 'stash.wind.notice', 60);
        expect(
            settingChange(lines, first.pending, {}, 'stash.wind.must', 60)
                .write,
        ).toBeNull();
    });

    test('a change still waits until the reloaded values show it', () => {
        const pending = { 'stash.wind.must': 70, 'stash.wind.notice': 60 };
        expect(
            settledPending(pending, { ...lines, 'stash.wind.notice': 60 }),
        ).toEqual({ 'stash.wind.must': 70 });
    });

    test('a note box pressed before its text was read writes nothing', () => {
        expect(noteWrite('', 'the default', false, false)).toBeNull();
        expect(noteWrite('', 'the default', true, false)).toBeNull();
    });

    test('a blank note box, which means the default, gets no hint', () => {
        expect(noteHint('', ['second-wind', 'handoff'])).toBeNull();
        expect(noteHint('  \n', ['second-wind', 'handoff'])).toBeNull();
    });

    test('a note missing the word second-wind or handoff gets a hint that names it', () => {
        const needs = ['second-wind', 'handoff'];
        expect(
            noteHint('write a handoff, then op second-wind', needs),
        ).toBeNull();
        expect(noteHint('write a handoff', needs)).toBe(
            'this note no longer says «second-wind»: a thread may not compact',
        );
        expect(noteHint('just stop', needs)).toBe(
            'this note no longer says «second-wind» or «handoff»: a thread may not compact',
        );
    });

    test('the lane idle alarm row is saved in minutes, 10 by default', () => {
        expect(rows(settingsText(settingRows, null))['stash.park.after']).toBe(
            10,
        );
        expect(
            rows(settingsText(settingRows, null, { 'stash.park.after': 25 }))[
                'stash.park.after'
            ],
        ).toBe(25);
    });
});
