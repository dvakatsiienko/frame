import { describe, expect, test } from 'vitest';

import { LOOK_DEFAULT, lookOf, withChange } from './look.js';

// his stored value on 2026-11-16, as `shared.json` holds it, an old key no row reads among them
const his = {
    accent: 'theme',
    bg: 'background',
    fg: 'theme',
    font: 'ui',
    history: 'fold',
    mine: 'bubble',
    replies: 'open',
    size: 14,
    space: 'normal',
    system: 'fold',
    tools: 'hide',
    width: 'narrow',
};

describe('his look reads as he left it', () => {
    test('every value of his stored look comes back', () => {
        expect(lookOf(his)).toEqual({
            accent: 'theme',
            bg: 'background',
            fg: 'theme',
            font: 'ui',
            mine: 'bubble',
            replies: 'open',
            size: 14,
            space: 'normal',
            system: 'fold',
            tools: 'hide',
            width: 'narrow',
        });
    });

    test('nothing stored reads as the defaults', () => {
        expect(lookOf(null)).toEqual(LOOK_DEFAULT);
        expect(lookOf('not an object')).toEqual(LOOK_DEFAULT);
    });

    test.each([
        ['size', 'big'],
        ['size', 99],
        ['font', 'comic'],
        ['width', 3],
        ['tools', null],
        ['system', 'some'],
        ['replies', 'closed'],
        ['accent', 'orange'],
        ['mine', 'cloud'],
        ['bg', '#12345'],
        ['fg', 'red'],
        ['space', 'huge'],
    ])('a %s value no row offers (%s) reads as its default', (key, value) => {
        const look = lookOf({ ...his, [key]: value });
        expect(look[key as keyof typeof look]).toBe(
            LOOK_DEFAULT[key as keyof typeof LOOK_DEFAULT],
        );
    });

    test('a colour he typed reads as itself', () => {
        expect(lookOf({ bg: '#0d1117', fg: '#E6EDF3' })).toMatchObject({
            bg: '#0d1117',
            fg: '#E6EDF3',
        });
    });
});

describe('a change to one row changes only that value', () => {
    test.each([
        ['size', 17],
        ['font', 'mono'],
        ['width', 'full'],
        ['tools', 'show'],
        ['system', 'hide'],
        ['replies', 'folded'],
        ['accent', 'claude'],
        ['mine', 'bar'],
        ['bg', '#1e1e1e'],
        ['fg', '#f0dfbf'],
        ['space', 'roomy'],
    ])('%s → %s: stored, and a fresh read returns it', (key, value) => {
        const stored = withChange(his, { [key]: value });
        expect(lookOf(stored)[key as keyof typeof LOOK_DEFAULT]).toBe(value);
        expect({ ...stored, [key]: his[key as keyof typeof his] }).toEqual(his);
    });

    test('a key no row reads is kept as it was', () => {
        expect(withChange(his, { size: 15 })).toMatchObject({
            history: 'fold',
        });
    });

    test('a change on nothing stored starts from the defaults', () => {
        expect(withChange(null, { font: 'mono' })).toEqual({
            ...LOOK_DEFAULT,
            font: 'mono',
        });
    });

    test('text size stays between 10 and 22', () => {
        expect(lookOf(withChange(his, { size: 30 })).size).toBe(22);
        expect(lookOf(withChange(his, { size: 2 })).size).toBe(10);
    });
});
