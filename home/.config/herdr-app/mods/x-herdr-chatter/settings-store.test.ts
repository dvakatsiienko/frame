import { describe, expect, test } from 'vitest';

import { resolvedRows, rowValue, settingsText } from './settings-store.js';

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
