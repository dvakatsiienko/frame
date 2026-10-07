import { describe, expect, it } from 'vitest';

import {
    boundTwice,
    decryptExport,
    diffAgainstMap,
    dropHotkey,
    encryptExport,
    splitGhosts,
    toChord,
} from './rayconfig.ts';

const shortcut = (mods: string[], key: Record<string, unknown>) => ({
    key,
    modifiers: mods.map((modifier) => ({ modifier })),
});

describe('toChord', () => {
    // manual.ts and the swift daemon both call all four modifiers `hyper`; raycast spells
    // them out. Without the collapse every hyper binding reads as absent from both sides.
    it('collapses all four modifiers into hyper', () => {
        expect(
            toChord(
                shortcut(['Ctrl', 'Alt', 'Shift', 'Meta'], {
                    code: 14,
                    type: 'LayoutIndependent',
                }),
            ),
        ).toBe('hyper+e');
    });

    it('spells a partial modifier set out', () => {
        expect(
            toChord(
                shortcut(['Ctrl', 'Alt'], {
                    code: 14,
                    type: 'LayoutIndependent',
                }),
            ),
        ).toBe('ctrl+opt+e');
    });

    it('names a layout-dependent arrow the way the map does', () => {
        expect(
            toChord(
                shortcut(['Ctrl'], {
                    keyType: { key: 'ArrowRight', type: 'Control' },
                    type: 'LayoutDependent',
                }),
            ),
        ).toBe('ctrl+right');
    });

    // Printing `key${undefined}` is what the second encoding did before it was handled; a
    // chord nobody can name has to be reportable, not rendered as though it were fine.
    it('refuses a key it cannot name', () => {
        expect(
            toChord(shortcut(['Ctrl'], { type: 'SomethingNew' })),
        ).toBeNull();
    });
});

const row = (chord: string, action: string) => ({ action, chord });

describe('boundTwice', () => {
    it('names every owner of a chord two commands claim', () => {
        const clashes = boundTwice([
            row('cmd+space', 'raycast itself'),
            row('hyper+pageup', 'linear-query-tickets'),
            row('hyper+pageup', 'linear-query-wide'),
        ]);

        expect(clashes).toEqual([
            {
                actions: ['linear-query-tickets', 'linear-query-wide'],
                chord: 'hyper+pageup',
            },
        ]);
    });

    it('keeps three owners of one chord in a single entry', () => {
        const clashes = boundTwice([
            row('hyper+e', 'a'),
            row('hyper+e', 'b'),
            row('hyper+e', 'c'),
        ]);

        expect(clashes).toHaveLength(1);
        expect(clashes[0]?.actions).toEqual(['a', 'b', 'c']);
    });

    it('finds nothing when every chord has one owner', () => {
        expect(
            boundTwice([row('cmd+space', 'raycast'), row('hyper+e', 'linear')]),
        ).toEqual([]);
    });
});

describe('diffAgainstMap', () => {
    const exported = [row('cmd+space', 'raycast itself'), row('hyper+e', 'q')];
    const mapped = [row('cmd+space', 'Raycast'), row('hyper+k', 'Calendar')];

    it('names what raycast binds and the map does not', () => {
        expect(diffAgainstMap(exported, mapped).onlyInExport).toEqual([
            row('hyper+e', 'q'),
        ]);
    });

    it('names what the map keeps and raycast no longer binds', () => {
        expect(diffAgainstMap(exported, mapped).onlyInMap).toEqual([
            row('hyper+k', 'Calendar'),
        ]);
    });

    // The two sides spell an action differently on purpose — the map is dima's prose, the
    // export is raycast's command id — so only the chord can decide whether a row is shared.
    it('treats a chord both sides carry as shared however each names it', () => {
        const diff = diffAgainstMap(
            [row('cmd+space', 'raycast itself')],
            [row('cmd+space', 'Raycast')],
        );

        expect(diff.onlyInExport).toEqual([]);
        expect(diff.onlyInMap).toEqual([]);
    });

    it('sorts each list by chord so two runs read the same', () => {
        const diff = diffAgainstMap(
            [row('hyper+z', 'z'), row('hyper+a', 'a')],
            [],
        );

        expect(diff.onlyInExport.map((one) => one.chord)).toEqual([
            'hyper+a',
            'hyper+z',
        ]);
    });
});

describe('the .rayconfig container', () => {
    const header = {
        appVersion: '2.4.1.0',
        encryption: { iv: '00'.repeat(16), salt: '11'.repeat(16) },
        exportedAt: '2026-09-22T15:38:45.337Z',
        osArch: 'arm64',
        osName: 'macOS',
        osVersion: '27.0.0',
        schemaVersion: 3,
    };
    const payload = JSON.stringify({
        settings: {
            commands: [
                {
                    enabled: true,
                    id: 'c:n:x::-::keep',
                    macosHotkey: { kind: 1 },
                },
                {
                    enabled: true,
                    id: 'c:n:x::-::ghost',
                    macosHotkey: { kind: 2 },
                },
            ],
        },
    });

    it('reads back exactly what it wrote', () => {
        const sealed = encryptExport({ header, password: 'hunter2', payload });

        expect(decryptExport(sealed, 'hunter2').payload).toBe(payload);
    });

    it('mints a fresh iv and salt rather than reusing the ones it was handed', () => {
        const sealed = decryptExport(
            encryptExport({ header, password: 'hunter2', payload }),
            'hunter2',
        );

        expect(sealed.header.encryption.iv).not.toBe(header.encryption.iv);
        expect(sealed.header.encryption.salt).not.toBe(header.encryption.salt);
    });

    // Two seals of one payload share no bytes, so a re-export never leaks that nothing moved.
    it('never writes the same bytes twice for one payload', () => {
        const a = encryptExport({ header, password: 'hunter2', payload });
        const b = encryptExport({ header, password: 'hunter2', payload });

        expect(a.equals(b)).toBe(false);
    });

    it('keeps every header field that is not the crypto', () => {
        const back = decryptExport(
            encryptExport({ header, password: 'hunter2', payload }),
            'hunter2',
        ).header;

        expect(back.exportedAt).toBe(header.exportedAt);
        expect(back.osName).toBe(header.osName);
        expect(back.schemaVersion).toBe(3);
    });

    it('refuses a wrong passphrase rather than returning plausible bytes', () => {
        const sealed = encryptExport({ header, password: 'hunter2', payload });

        expect(() => decryptExport(sealed, 'wrong')).toThrow();
    });
});

describe('dropHotkey', () => {
    const payload = JSON.stringify({
        settings: {
            commands: [
                {
                    enabled: true,
                    id: 'c:n:x::-::keep',
                    macosHotkey: { kind: 1 },
                },
                {
                    alias: 'qq',
                    enabled: true,
                    id: 'c:n:x::-::ghost',
                    macosHotkey: { kind: 2 },
                },
            ],
        },
    });

    it('unbinds the named command and names what it touched', () => {
        const dropped = dropHotkey(payload, 'ghost');

        expect(dropped.removed).toEqual(['c:n:x::-::ghost']);
    });

    it('changes nothing else in the payload', () => {
        const before = JSON.parse(payload);
        const after = JSON.parse(dropHotkey(payload, 'ghost').payload);

        // the ghost keeps its row, its alias and its id — only the binding goes
        expect(after.settings.commands[1]).toEqual({
            alias: 'qq',
            enabled: true,
            id: 'c:n:x::-::ghost',
        });
        expect(after.settings.commands[0]).toEqual(before.settings.commands[0]);
        expect(after.settings.commands).toHaveLength(2);
    });

    it('refuses a command name nothing is bound under', () => {
        expect(() => dropHotkey(payload, 'nobody')).toThrow(/nobody/);
    });
});

describe('splitGhosts', () => {
    const rows = [
        { action: 'linear-query-wide', chord: 'hyper+pageup' },
        { action: 'linear-query-tickets (quicklink)', chord: 'hyper+pageup' },
        { action: 'handoff', chord: 'hyper+h' },
    ];

    it('names the dead command and leaves the live rows alone', () => {
        const split = splitGhosts(rows);
        expect(split.ghosts.map((row) => row.action)).toEqual([
            'linear-query-wide',
        ]);
        expect(split.live.map((row) => row.action)).toEqual([
            'linear-query-tickets (quicklink)',
            'handoff',
        ]);
    });

    it('the clash the ghost caused is gone once it is split off', () => {
        expect(boundTwice(rows)).toHaveLength(1);
        expect(boundTwice(splitGhosts(rows).live)).toEqual([]);
    });
});
