import { expect, test } from 'claude-code/testing';

import {
    type FieldDraft,
    fieldView,
    isTypingAt,
    typedInto,
} from '../hooks/register.tsx';

// a field never redraws because of its own typing (dima, 16:15 and 16:22: the caret drifted mid-word)
const T = 1_000_000;

// type each text a tick apart into a field that drew `drawn`
const typeAll = (drawn: string, ...texts: string[]) =>
    texts.reduce<FieldDraft | undefined>(
        (draft, text, i) => typedInto(draft, drawn, text, T + i * 100),
        undefined,
    );

// what the field draws for the stored value at a time: the held value, the stored one, or a remount
function drawn(
    draft: FieldDraft | undefined,
    saved: string,
    at: number,
    isNumber = false,
) {
    const view = fieldView(draft, saved, at, isNumber);
    if (view.kind === 'held') return view.draft.drawn;
    if (view.kind === 'outside' && view.isRemount) return `remount:${saved}`;
    return saved;
}

test('while typing, every redraw draws the value the field showed', () => {
    const draft = typeAll('', 'a', 'ab', 'abc');
    expect(
        ['', 'a', 'ab', 'abc'].map((saved) => drawn(draft, saved, T + 300)),
    ).toEqual(['', '', '', '']);
});

test('a text field keeps drawing what it showed once typing goes quiet, so its view never jumps to the start', () => {
    expect(drawn(typeAll('', 'a', 'ab'), 'ab', T + 60_000)).toBe('');
});

test('after 3 s of quiet a number field draws the stored value', () => {
    expect(drawn(typeAll('0.5', '0', '0.'), '0.5', T + 3200, true)).toBe('0.5');
});

test('a value set from outside, never typed here, is drawn at once', () => {
    expect(drawn(typeAll('', 'a', 'ab'), 'zz', T + 300)).toBe('zz');
});

test('a clear back to what is drawn, after a save landed, remounts the field', () => {
    const draft = typeAll('', 'a', 'ab');
    const view = fieldView(draft, 'ab', T + 250);
    const landed = view.kind === 'held' ? view.draft : draft;
    expect(drawn(landed, '', T + 300)).toBe('remount:');
});

test('the first keystroke before its save lands is lag, never outside', () => {
    expect(drawn(typeAll('', 'a'), '', T + 50)).toBe('');
});

test('a knob value the knob refuses changes nothing drawn while typing', () => {
    expect(drawn(typeAll('0.5', '0', '0.'), '0.5', T + 300)).toBe('0.5');
});

test('the poll counts a field typed into within 3 s as typing, and an older one as idle', () => {
    expect([
        isTypingAt([T], T + 2900),
        isTypingAt([T], T + 3100),
        isTypingAt([], T),
    ]).toEqual([true, false, false]);
});
