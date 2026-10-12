import { expect, test } from 'claude-code/testing';

import { type FieldDraft, fieldText, typedInto } from '../hooks/register.tsx';

// a field draws what was typed while its saves catch up, and what is stored once something else changed it
// (dima, 16:15: a redraw carried an older note into the field and the caret drifted)

// type each text in order, every keystroke seeing `saved` as the stored value of its render
const typeAll = (saved: string, ...texts: string[]) =>
    texts.reduce<FieldDraft | undefined>(
        (draft, text) => typedInto(draft, saved, text),
        undefined,
    );

test('a redraw carrying a save that lags behind the typing draws the typing', () => {
    const draft = typeAll('', 'a', 'ab', 'abc');
    expect(['', 'a', 'ab'].map((saved) => fieldText(draft, saved))).toEqual([
        'abc',
        'abc',
        'abc',
    ]);
});

test('once the last save lands the field draws the stored text', () => {
    expect(fieldText(typeAll('', 'a', 'ab'), 'ab')).toBe('ab');
});

test('a knob value the knob refuses stays in the field while the old one stays stored', () => {
    expect(fieldText(typeAll('0.5', '0', '0.'), '0.5')).toBe('0.');
});

test('a note cleared from outside after its save landed draws empty', () => {
    const typed = typeAll('', 'why so early?');
    const landed = typedInto(typed, 'why so early?', 'why so early?!');
    expect(fieldText(landed, '')).toBe('');
});

test('a note typed empty by hand stays empty', () => {
    expect(fieldText(typeAll('', 'a', ''), 'a')).toBe('');
});

test('a value set from outside, never typed here, drops the draft', () => {
    expect(fieldText(typeAll('', 'a', 'ab'), 'zz')).toBe('zz');
});
