import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { type PressRecord, next, pressState, untickDoor } from './press.js';

// FRM-648 step 113: an ask's press is one record, moved only by named events; the board draws from it alone
const read = (
    over: Partial<{
        pending: 'tick' | 'replay' | 'untick' | null;
        mark: string | null;
        isLocked: boolean;
        isGone: boolean;
    }> = {},
) =>
    ({
        isGone: false,
        isLocked: false,
        mark: null,
        pending: null,
        type: 'shelfRead',
        ...over,
    }) as const;

const run = (
    record: PressRecord | null,
    ...events: Parameters<typeof next>[1][]
) => events.reduce<PressRecord | null>((r, e) => next(r, e), record);

const shown = (record: PressRecord | null) => pressState(record);

describe('a read of the shelf makes and moves the record', () => {
    test('an ask first read is drawn as the shelf has it', () => {
        expect(shown(run(null, read()))).toBe('open');
        expect(shown(run(null, read({ pending: 'tick' })))).toBe('ticked');
        expect(shown(run(null, read({ mark: 'accepted' })))).toBe('ticked');
        expect(shown(run(null, read({ mark: 'rejected' })))).toBe('replayed');
    });

    test('an untick line in the file outranks the mark it answers', () => {
        expect(
            shown(run(null, read({ mark: 'accepted', pending: 'untick' }))),
        ).toBe('open');
    });

    test('a locked ask is locked whatever the file still holds', () => {
        expect(
            shown(run(null, read({ isLocked: true, pending: 'untick' }))),
        ).toBe('locked');
    });

    test('an ask that left has no record', () => {
        expect(run(null, read(), read({ isGone: true }))).toBeNull();
    });
});

describe('his press: local, then written, then read', () => {
    test('a press draws at once, before its write', () => {
        const r = run(null, read(), {
            at: 1,
            type: 'pressed',
            verdict: 'tick',
        });
        expect(r?.phase).toBe('local');
        expect(shown(r)).toBe('ticked');
    });

    test('a read while the write is in flight never flips the press back', () => {
        const r = run(
            null,
            read(),
            { at: 1, type: 'pressed', verdict: 'tick' },
            read(),
        );
        expect(r?.phase).toBe('local');
        expect(shown(r)).toBe('ticked');
    });

    test('a written press waits for the shelf to show it, then is read', () => {
        const written = run(
            null,
            read(),
            { at: 1, type: 'pressed', verdict: 'tick' },
            { at: 1, type: 'writeOk' },
            read(),
        );
        expect(written?.phase).toBe('written');
        expect(shown(written)).toBe('ticked');
        expect(run(written, read({ pending: 'tick' }))?.phase).toBe('read');
    });

    test('a take-back whose file read still holds the press stays drawn open', () => {
        const r = run(
            null,
            read({ mark: 'accepted' }),
            { at: 2, type: 'pressed', verdict: 'untick' },
            { at: 2, type: 'writeOk' },
            read({ mark: 'accepted', pending: 'tick' }),
        );
        expect(r?.phase).toBe('written');
        expect(shown(r)).toBe('open');
    });

    // sixth sense round 1 (FRM-648 a1): a failed write is its own phase with its reason, never a revert to read
    test('a failed write is failed, with its reason, and draws the shelf’s press', () => {
        const r = run(
            null,
            read(),
            { at: 1, type: 'pressed', verdict: 'tick' },
            { at: 1, reason: 'disk full', type: 'writeFailed' },
        );
        expect(r?.phase).toBe('failed');
        expect(r?.reason).toBe('disk full');
        expect(shown(r)).toBe('open');
    });

    test('a failure stays through the reads after it, so he sees it', () => {
        const r = run(
            null,
            read(),
            { at: 1, type: 'pressed', verdict: 'tick' },
            { at: 1, reason: 'disk full', type: 'writeFailed' },
            read({ mark: 'accepted' }),
        );
        expect(r?.phase).toBe('failed');
        expect(shown(r)).toBe('ticked');
    });

    test('failed, then pressed again, is local', () => {
        const r = run(
            null,
            read(),
            { at: 1, type: 'pressed', verdict: 'tick' },
            { at: 1, reason: 'disk full', type: 'writeFailed' },
            { at: 2, type: 'pressed', verdict: 'tick' },
        );
        expect(r?.phase).toBe('local');
        expect(r?.reason).toBeUndefined();
    });

    test('an older write’s answer never moves a newer press', () => {
        const r = run(
            null,
            read(),
            { at: 1, type: 'pressed', verdict: 'tick' },
            { at: 2, type: 'pressed', verdict: 'untick' },
            { at: 1, reason: 'late', type: 'writeFailed' },
            { at: 1, type: 'writeOk' },
        );
        expect(r?.phase).toBe('local');
        expect(r?.verdict).toBe('untick');
    });

    test('a turn that takes the press locks it, even mid-write', () => {
        const r = run(
            null,
            read(),
            { at: 1, type: 'pressed', verdict: 'tick' },
            read({ isLocked: true, mark: 'accepted' }),
        );
        expect(shown(r)).toBe('locked');
    });

    test('a locked ask takes no press', () => {
        const locked = run(null, read({ isLocked: true }));
        expect(
            run(locked, { at: 1, type: 'pressed', verdict: 'untick' }),
        ).toEqual(locked);
    });
});

describe('a press the session never takes is given up, never silently', () => {
    test('its timer gives the shelf’s press back and names the phase', () => {
        const r = run(
            null,
            read(),
            { at: 1, type: 'pressed', verdict: 'tick' },
            { at: 1, type: 'writeOk' },
            { at: 1, type: 'timedOut' },
        );
        expect(r?.phase).toBe('given-up');
        expect(shown(r)).toBe('open');
        expect(run(r, read())?.phase).toBe('read');
    });

    test('a timer outliving its press does nothing', () => {
        const settled = run(
            null,
            read(),
            { at: 1, type: 'pressed', verdict: 'tick' },
            { at: 1, type: 'writeOk' },
            read({ pending: 'tick' }),
        );
        expect(run(settled, { at: 1, type: 'timedOut' })).toEqual(settled);
        const newer = run(settled, {
            at: 2,
            type: 'pressed',
            verdict: 'untick',
        });
        expect(run(newer, { at: 1, type: 'timedOut' })).toEqual(newer);
    });
});

// the old rules, each a row on the record
describe('the rules the press kept through FRM-628, now on the record', () => {
    test('1290ff4a: a tick the stash read shows ticked, so ⌘Enter on it replays', () => {
        expect(shown(run(null, read({ mark: 'accepted' })))).toBe('ticked');
    });

    test('Enter, ⌘Enter, ⌘Enter with no read between: ticked, replayed, open', () => {
        let r = run(null, read());
        const states = (['tick', 'replay', 'untick'] as const).map(
            (verdict, i) => {
                r = run(r, { at: i + 1, type: 'pressed', verdict });
                return shown(r);
            },
        );
        expect(states).toEqual(['ticked', 'replayed', 'open']);
    });

    test('a press over a replay mark draws ticked', () => {
        expect(
            shown(
                run(null, read({ mark: 'rejected' }), {
                    at: 1,
                    type: 'pressed',
                    verdict: 'tick',
                }),
            ),
        ).toBe('ticked');
    });
});

describe('his second press picks the door that still reaches the thread', () => {
    test('a press the stash has not read leaves the file, even one still being written', () => {
        expect(
            untickDoor(
                run(null, read(), { at: 1, type: 'pressed', verdict: 'tick' }),
                null,
            ),
        ).toBe('drop');
        expect(untickDoor(run(null, read({ pending: 'tick' })), null)).toBe(
            'drop',
        );
    });

    test('a press the stash has read gets an untick line', () => {
        expect(
            untickDoor(run(null, read({ mark: 'accepted' })), 'accepted'),
        ).toBe('untick');
        expect(
            untickDoor(
                run(null, read({ mark: 'accepted', pending: 'tick' })),
                'accepted',
            ),
        ).toBe('untick');
    });
});

test('the deck draws a press only through the record', () => {
    const main = readFileSync(new URL('./main.js', import.meta.url), 'utf8');
    expect(main).not.toMatch(/\btickState\b|\bisPressSettled\b|presses\.of\(/);
});
