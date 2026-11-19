import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parseKeysChangeArgs, planKeysChange } from './keys-change.ts';

// a copy of dima's keys.json (19 Nov): its terminal sends hold escaped control characters
const real = readFileSync(
    fileURLToPath(new URL('./fixtures/keys.json.txt', import.meta.url)),
    'utf8',
);
const mods = [
    'chat',
    'x-herdr-chat',
    'menu',
    'x-herdr-agents',
    'x-herdr-deck',
    'picker',
];
const help = {
    command: 'app.help',
    key: 'cmd-alt-y',
    scope: 'global',
} as const;

describe('planKeysChange', () => {
    it('writes the file once, then reloads every x-herdr mod, none skipped', () => {
        const plan = planKeysChange(real, help, mods);
        expect(plan.steps).toEqual([
            { kind: 'write', text: plan.text },
            { kind: 'reload', mod: 'x-herdr-agents' },
            { kind: 'reload', mod: 'x-herdr-chat' },
            { kind: 'reload', mod: 'x-herdr-deck' },
        ]);
        expect(JSON.parse(plan.text).global['cmd-alt-y']).toBe('app.help');
    });

    it('adds a key and takes it out again, leaving the file byte for byte', () => {
        const added = planKeysChange(real, help, mods).text;
        const removed = planKeysChange(
            added,
            { command: null, key: 'cmd-alt-y', scope: 'global' },
            mods,
        ).text;
        expect(removed).toBe(real);
    });

    it('keeps the escaped control characters of a terminal send', () => {
        const { text } = planKeysChange(real, help, mods);
        expect(text).toContain('"send:\\u001bb"');
        expect(text).not.toContain('\u001b');
    });

    it('changes a key bound already, in its place', () => {
        const { text } = planKeysChange(
            real,
            { command: 'app.palette', key: 'cmd-p', scope: 'global' },
            mods,
        );
        const keys = (t: string) => Object.keys(JSON.parse(t).global);
        expect(JSON.parse(text).global['cmd-p']).toBe('app.palette');
        expect(keys(text)).toEqual(keys(real));
    });

    it('reloads every x-herdr mod even when nothing changed', () => {
        const plan = planKeysChange(
            real,
            { command: null, key: 'cmd-alt-nope', scope: 'global' },
            mods,
        );
        expect(plan.text).toBe(real);
        expect(plan.steps.filter((s) => s.kind === 'reload')).toHaveLength(3);
    });
});

describe('parseKeysChangeArgs', () => {
    it('takes a binding to set', () => {
        expect(
            parseKeysChangeArgs(['set', 'global', 'cmd-alt-y', 'app.help']),
        ).toEqual(help);
    });

    it('takes a binding to remove', () => {
        expect(parseKeysChangeArgs(['remove', 'terminal', 'cmd-f'])).toEqual({
            command: null,
            key: 'cmd-f',
            scope: 'terminal',
        });
    });

    it.each([
        [[]],
        [['set', 'global', 'cmd-alt-y']],
        [['set', 'nowhere', 'cmd-alt-y', 'app.help']],
        [['remove', 'global', 'cmd-f', 'extra']],
        [['set', 'global', '', 'app.help']],
        [['drop', 'global', 'cmd-f']],
    ])('refuses %j', (argv) => {
        expect(parseKeysChangeArgs(argv)).toBeNull();
    });
});
