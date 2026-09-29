import { describe, expect, it } from 'vitest';

import type { Hotkey } from './manual.ts';
import {
    byApp,
    byChord,
    byLabelledChord,
    isUntracked,
    labelAt,
    liveHotkeys,
    ofKind,
    parseEvents,
    selectEvents,
    tally,
    tallyFeatures,
    timeInFront,
    unpressed,
} from './stats.ts';

const chord = (iso: string, chord: string, app = 'com.apple.finder') =>
    JSON.stringify({ app, chord, kind: 'chord', ts: iso });

const activate = (iso: string, app: string) =>
    JSON.stringify({ app, kind: 'activate', ts: iso });

const NOW = new Date('2026-09-14T12:00:00Z');

describe('parseEvents', () => {
    it('reads a line written before app events existed as a chord', () => {
        const legacy =
            '{"ts":"2026-09-14T10:00:00Z","chord":"cmd+c","app":"a"}';
        expect(parseEvents(legacy)).toEqual([
            {
                app: 'a',
                chord: 'cmd+c',
                kind: 'chord',
                ts: '2026-09-14T10:00:00Z',
            },
        ]);
    });

    it('keeps the whole lines around a torn one', () => {
        const jsonl = [
            chord('2026-09-14T10:00:00Z', 'cmd+c'),
            '{"ts":"2026-09-14T10:01:00Z","chord":"cmd',
            chord('2026-09-14T10:02:00Z', 'hyper+a'),
            '',
        ].join('\n');
        expect(parseEvents(jsonl).map((e) => e.chord)).toEqual([
            'cmd+c',
            'hyper+a',
        ]);
    });

    it('drops a chord line with no chord', () => {
        expect(parseEvents('{"ts":"2026-09-14T10:00:00Z","app":"a"}')).toEqual(
            [],
        );
    });

    it('reads an activate line without requiring a chord', () => {
        expect(
            parseEvents(activate('2026-09-14T10:00:00Z', 'com.raycast.macos')),
        ).toEqual([
            {
                app: 'com.raycast.macos',
                kind: 'activate',
                ts: '2026-09-14T10:00:00Z',
            },
        ]);
    });

    it('falls back to chord for an unknown kind', () => {
        const odd =
            '{"ts":"2026-09-14T10:00:00Z","kind":"wat","chord":"cmd+c","app":"a"}';
        expect(parseEvents(odd)[0]?.kind).toBe('chord');
    });
});

describe('selectEvents', () => {
    it('excludes an event older than the window', () => {
        const events = parseEvents(
            [
                chord('2026-09-10T12:00:00Z', 'old'),
                chord('2026-09-13T12:00:00Z', 'new'),
            ].join('\n'),
        );
        expect(
            selectEvents(events, { days: 2, now: NOW }).map((e) => e.chord),
        ).toEqual(['new']);
    });

    it('matches the app filter on a case-insensitive substring', () => {
        const events = parseEvents(
            [
                chord('2026-09-14T11:00:00Z', 'cmd+c', 'com.todesktop.Cursor'),
                chord('2026-09-14T11:00:00Z', 'cmd+v', 'com.google.Chrome'),
            ].join('\n'),
        );
        expect(
            selectEvents(events, { app: 'cursor', now: NOW }).map(
                (e) => e.chord,
            ),
        ).toEqual(['cmd+c']);
    });

    it('drops an ignored chord', () => {
        const events = parseEvents(
            [
                chord('2026-09-14T11:00:00Z', 'opt+esc'),
                chord('2026-09-14T11:01:00Z', 'cmd+c'),
            ].join('\n'),
        );
        expect(
            selectEvents(events, { ignore: ['opt+esc'], now: NOW }).map(
                (e) => e.chord,
            ),
        ).toEqual(['cmd+c']);
    });

    it('keeps app events when a chord is ignored', () => {
        const events = parseEvents(
            [
                chord('2026-09-14T11:00:00Z', 'opt+esc'),
                activate('2026-09-14T11:01:00Z', 'com.apple.Safari'),
            ].join('\n'),
        );
        expect(
            selectEvents(events, { ignore: ['opt+esc'], now: NOW }),
        ).toHaveLength(1);
    });

    it('keeps every event when no window is given', () => {
        const events = parseEvents(chord('2020-01-01T00:00:00Z', 'ancient'));
        expect(selectEvents(events, { now: NOW })).toHaveLength(1);
    });
});

describe('ofKind', () => {
    it('separates app switches from chords', () => {
        const events = parseEvents(
            [
                chord('2026-09-14T11:00:00Z', 'cmd+c'),
                activate('2026-09-14T11:01:00Z', 'com.apple.Safari'),
                activate('2026-09-14T11:02:00Z', 'com.apple.Safari'),
            ].join('\n'),
        );
        expect(ofKind(events, 'activate')).toHaveLength(2);
        expect(ofKind(events, 'chord')).toHaveLength(1);
    });
});

describe('tally', () => {
    it('ranks the most pressed chord first', () => {
        const events = parseEvents(
            [
                chord('2026-09-14T11:00:00Z', 'cmd+c'),
                chord('2026-09-14T11:01:00Z', 'hyper+a'),
                chord('2026-09-14T11:02:00Z', 'cmd+c'),
            ].join('\n'),
        );
        expect(tally(events, byChord)).toEqual([
            { count: 2, name: 'cmd+c' },
            { count: 1, name: 'hyper+a' },
        ]);
    });

    it('counts activations per app', () => {
        const events = parseEvents(
            [
                activate('2026-09-14T11:00:00Z', 'com.apple.Safari'),
                activate('2026-09-14T11:01:00Z', 'com.apple.Safari'),
                activate('2026-09-14T11:02:00Z', 'com.raycast.macos'),
            ].join('\n'),
        );
        expect(tally(events, byApp)).toEqual([
            { count: 2, name: 'com.apple.Safari' },
            { count: 1, name: 'com.raycast.macos' },
        ]);
    });
});

describe('unpressed', () => {
    const bindings: Hotkey[] = [
        { action: 'Claude', app: 'raycast', key: 'a', mods: 'hyper' },
        { action: 'Copy', app: 'macos', key: 'c', mods: 'cmd' },
        { action: 'push to talk', app: 'wispr flow', key: 'ctrl', mods: '' },
    ];

    it('returns only the bindings whose chord never appears', () => {
        const events = parseEvents(chord('2026-09-14T11:00:00Z', 'hyper+a'));
        expect(unpressed(bindings, events).map((h) => h.action)).toEqual([
            'Copy',
            'push to talk',
        ]);
    });

    it('matches a bare-modifier binding against a bare-modifier press', () => {
        const events = parseEvents(chord('2026-09-14T11:00:00Z', 'ctrl'));
        expect(unpressed(bindings, events).map((h) => h.action)).not.toContain(
            'push to talk',
        );
    });
});

describe('liveHotkeys', () => {
    const bindings: Hotkey[] = [
        { action: 'Things', app: 'raycast', key: 'v', mods: 'hyper' },
        {
            action: 'Things',
            app: 'raycast',
            key: '7',
            mods: 'hyper',
            since: '2026-09-20',
        },
    ];
    const moved: Hotkey[] = [
        { ...(bindings[0] as Hotkey), until: '2026-09-20' },
        bindings[1] as Hotkey,
    ];

    it('drops a row on the day its meaning ended', () => {
        expect(liveHotkeys(moved, '2026-09-20').map((row) => row.key)).toEqual([
            '7',
        ]);
    });

    it('keeps a row whose end is still ahead', () => {
        expect(liveHotkeys(moved, '2026-09-19').map((row) => row.key)).toEqual([
            'v',
            '7',
        ]);
    });
});

describe('labelAt', () => {
    const bindings: Hotkey[] = [
        { action: 'All-In-One', app: 'cleanshot', key: '5', mods: 'cmd+shift' },
        {
            action: 'Scrolling Capture',
            app: 'cleanshot',
            key: '5',
            mods: 'cmd+shift',
            since: '2026-09-17',
        },
    ];

    it('keeps the older meaning for a press before the reshuffle', () => {
        expect(
            labelAt(bindings, 'shift+cmd+5', '2026-09-10T10:00:00Z')?.action,
        ).toBe('All-In-One');
    });

    it('uses the dated meaning for a press after it', () => {
        expect(
            labelAt(bindings, 'shift+cmd+5', '2026-09-18T10:00:00Z')?.action,
        ).toBe('Scrolling Capture');
    });

    // A move ends the old meaning. Without that, every later press on the freed chord is still
    // credited to the app that moved away, which is the opposite of what the move was for.
    it('credits nobody for a press after the meaning ended', () => {
        const moved: Hotkey[] = [
            {
                action: 'Google Chrome',
                app: 'raycast',
                key: '1',
                mods: 'hyper',
                until: '2026-09-19',
            },
            {
                action: 'Google Chrome',
                app: 'raycast',
                key: '7',
                mods: 'hyper',
                since: '2026-09-19',
            },
        ];

        expect(labelAt(moved, 'hyper+1', '2026-09-10T10:00:00Z')?.action).toBe(
            'Google Chrome',
        );
        expect(
            labelAt(moved, 'hyper+1', '2026-09-20T10:00:00Z'),
        ).toBeUndefined();
        expect(labelAt(moved, 'hyper+7', '2026-09-20T10:00:00Z')?.action).toBe(
            'Google Chrome',
        );
        expect(
            labelAt(moved, 'hyper+7', '2026-09-10T10:00:00Z'),
        ).toBeUndefined();
    });

    it('tallies a swapped chord as one row per meaning', () => {
        const events = parseEvents(
            [
                chord('2026-09-10T10:00:00Z', 'shift+cmd+5'),
                chord('2026-09-18T10:00:00Z', 'shift+cmd+5'),
                chord('2026-09-18T11:00:00Z', 'shift+cmd+5'),
            ].join('\n'),
        );
        expect(
            tally(events, byLabelledChord(bindings)).map((row) => row.name),
        ).toEqual([
            'shift+cmd+5\tScrolling Capture\tcleanshot',
            'shift+cmd+5\tAll-In-One\tcleanshot',
        ]);
    });
});

describe('tallyFeatures', () => {
    const readAloud: Hotkey[] = [
        {
            action: 'speak',
            app: 'macos',
            feature: 'read aloud',
            key: 'esc',
            mods: 'opt',
            until: '2026-09-28',
        },
        {
            action: 'speak',
            app: 'macos',
            feature: 'read aloud',
            key: 'f4',
            mods: '',
            since: '2026-09-28',
            until: '2026-09-29T22:41',
        },
        {
            action: 'read',
            app: 'x-speak',
            feature: 'read aloud',
            key: 'f4',
            mods: '',
            since: '2026-09-29T22:41',
        },
    ];

    it('adds up every key a feature ever lived on', () => {
        const events = parseEvents(
            [
                chord('2026-09-20T10:00:00+03:00', 'opt+esc'),
                chord('2026-09-28T10:00:00+03:00', 'f4'),
                chord('2026-09-29T23:00:00+03:00', 'f4'),
            ].join('\n'),
        );
        expect(tallyFeatures(readAloud, events)).toEqual([
            {
                chords: [
                    { chord: 'f4', count: 2 },
                    { chord: 'opt+esc', count: 1 },
                ],
                count: 3,
                feature: 'read aloud',
            },
        ]);
    });

    it('leaves out a press on a key after its meaning ended', () => {
        const events = parseEvents(
            chord('2026-09-29T10:00:00+03:00', 'opt+esc'),
        );
        expect(tallyFeatures(readAloud, events)).toEqual([]);
    });
});

describe('isUntracked', () => {
    const wispr: Hotkey[] = [
        { action: 'ptt', app: 'wispr flow', key: 'rcmd', mods: '' },
    ];
    const [lcmd, rcmd] = parseEvents(
        [
            chord('2026-09-20T10:00:00+03:00', 'cmd'),
            chord('2026-09-20T10:00:01+03:00', 'rcmd'),
        ].join('\n'),
    );

    it('marks an unbound bare modifier', () => {
        expect(isUntracked(wispr, lcmd!)).toBe(true);
    });

    it('marks an unbound opt-typed character', () => {
        const [typed] = parseEvents(
            chord('2026-09-20T10:00:00+03:00', 'opt+9'),
        );
        expect(isUntracked(wispr, typed!)).toBe(true);
    });

    it('marks an app shortcut no binding explains', () => {
        const [reload] = parseEvents(
            chord('2026-09-20T10:00:00+03:00', 'cmd+r'),
        );
        expect(isUntracked(wispr, reload!)).toBe(true);
    });

    it('keeps a bare modifier that is bound', () => {
        expect(isUntracked(wispr, rcmd!)).toBe(false);
    });
});

describe('labelAt', () => {
    const esc: Hotkey[] = [
        { action: 'dismiss', app: 'wispr flow', key: 'esc', mods: '' },
        { action: 'hideToasts', app: 'cursor', key: 'esc', mods: '' },
    ];

    it('gives an in-app binding the press made inside its app', () => {
        expect(
            labelAt(
                esc,
                'esc',
                '2026-09-20T10:00:00+03:00',
                'com.todesktop.230313mzl4w4u92',
            )?.action,
        ).toBe('hideToasts');
    });

    it('keeps an in-app binding off a press made in another app', () => {
        expect(
            labelAt(
                esc,
                'esc',
                '2026-09-20T10:00:00+03:00',
                'com.google.Chrome',
            )?.action,
        ).toBe('dismiss');
    });
});

describe('timeInFront', () => {
    it('caps an idle gap at 15 minutes', () => {
        const events = parseEvents(
            [
                activate('2026-09-20T10:00:00+03:00', 'a'),
                activate('2026-09-20T11:00:00+03:00', 'b'),
                activate('2026-09-20T11:05:00+03:00', 'a'),
            ].join('\n'),
        );
        expect(timeInFront(events).find((row) => row.name === 'b')?.count).toBe(
            5,
        );
        expect(timeInFront(events).find((row) => row.name === 'a')?.count).toBe(
            30,
        );
    });

    it('does not count the lock screen as an app', () => {
        const events = parseEvents(
            [
                activate('2026-09-20T10:00:00+03:00', 'com.apple.loginwindow'),
                activate('2026-09-20T10:10:00+03:00', 'a'),
                activate('2026-09-20T10:12:00+03:00', 'b'),
            ].join('\n'),
        );
        expect(timeInFront(events).map((row) => row.name)).not.toContain(
            'com.apple.loginwindow',
        );
    });
});
