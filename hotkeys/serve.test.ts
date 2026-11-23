import { describe, expect, it } from 'vitest';

import { chordOf } from './chord.ts';
import { bindingsAnswer, refuseMutation } from './serve.ts';

const write = (remoteAddress: string) =>
    refuseMutation({
        headers: { 'content-type': 'application/json' },
        socket: { remoteAddress },
    });

describe('a write to the chords server', () => {
    it('is refused from another machine on the network', () => {
        expect(write('192.168.1.23')).toBe(
            'writes are taken from this mac only',
        );
    });

    it('is taken from this mac', () => {
        expect(write('127.0.0.1')).toBeNull();
    });
});

describe('the bindings answer', () => {
    const answer = bindingsAnswer({
        hotkeys: [
            { action: 'grab', app: 'cleanshot', key: '4', mods: 'cmd+shift' },
            { action: 'read', app: 'x-speak', key: 'f4', mods: '' },
            {
                action: 'gone',
                app: 'raycast',
                key: 'q',
                mods: 'hyper',
                until: '2026-01-01',
            },
        ],
        scannedAt: '2026-11-23T12:00:00.000Z',
    });

    it('spells the chord of every live row and drops an ended one', () => {
        expect(answer.hotkeys.map((hotkey) => hotkey.chord)).toEqual([
            'shift+cmd+4',
            'f4',
        ]);
    });

    it('carries the order every chord is spelled in', () => {
        const chord = chordOf({
            key: 'k',
            mods: [...answer.modifierOrder].reverse().join('+'),
        });

        expect(chord).toBe(`${answer.modifierOrder.join('+')}+k`);
    });
});
