import { expect, test } from 'claude-code/testing';

import {
    fieldView,
    isTypingAt,
    mounted,
    typedInto,
} from '../hooks/register.tsx';
import type { FieldDraft } from '../types/stash.d.ts';

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

// FRM-492: the history once kept 50 texts, so a burst of 52+ after a landed save read that save as an outside write
// and drew it over what was typed since
test('a burst of more than 50 keystrokes after a landed save keeps drawing what the field showed', () => {
    let draft = typeAll('', 'a heron');
    const landed = fieldView(draft, 'a heron', T + 2000);
    draft = landed.kind === 'held' ? landed.draft : draft;
    let text = 'a heron';
    for (let i = 0; i < 60; i++) {
        text += 'x';
        const at = T + 3000 + i * 100;
        const v = fieldView(draft, 'a heron', at);
        draft = typedInto(
            v.kind === 'held' ? v.draft : undefined,
            v.kind === 'held' ? v.draft.drawn : 'a heron',
            text,
            at,
        );
    }
    expect(drawn(draft, 'a heron', T + 9500)).toBe('');
});

// FRM-492 local review: a typed-back save still in flight stays his own
test('a backspace back to a landed text keeps the save still in flight as his own', () => {
    const view = fieldView(typeAll('', 'a', 'ab', 'a'), 'a', T + 400);
    const held = view.kind === 'held' ? view.draft : undefined;
    expect(drawn(held, 'ab', T + 500)).toBe('');
});

// FRM-492 local review: a write made from a read older than his last typed save keeps what he typed
const ask = { id: 'o1', pick: 'x', text: 'name a bird' };
test('a write from a read older than his last typed save keeps his steer and what the box mounted with', () => {
    const was = { ...ask, rev: 2, shown: '', steer: 'abcd' };
    const stale = {
        ...ask,
        mark: 'accepted' as const,
        rev: 1,
        shown: '',
        steer: 'abc',
    };
    expect(mounted(was, stale, false)).toEqual({ ...was, mark: 'accepted' });
});

test("a typed save from an older read never rolls back the box's remount", () => {
    const was = { ...ask, gen: 1, rev: 1, shown: '' };
    expect(mounted(was, { ...ask, rev: 1, steer: 'x' }, true)).toEqual({
        ...ask,
        gen: 1,
        rev: 2,
        shown: '',
        steer: 'x',
    });
});

test('a clear from a read as fresh as the last typed save empties the box, remounting it', () => {
    const was = { ...ask, rev: 1, shown: '', steer: 'ab' };
    expect(mounted(was, { ...ask, rev: 1 }, false)).toEqual({
        ...ask,
        gen: 1,
        rev: 1,
        shown: '',
    });
});
