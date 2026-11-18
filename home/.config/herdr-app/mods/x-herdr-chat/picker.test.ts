import { describe, expect, test } from 'vitest';

import * as chatter from '../x-herdr-chatter/permissions.js';
import {
    NO_RUNS_AT,
    effortNow,
    modelLabel,
    modelNow,
    permissionIn,
    permissionOf,
    pickIn,
    runsAtAfter,
} from './picker.js';

const reply = (model: string, effort?: string) =>
    JSON.stringify({
        effort,
        message: { content: [{ text: 'ok', type: 'text' }], model },
        type: 'assistant',
    });
const output = (text: string) =>
    JSON.stringify({
        message: {
            content: `<local-command-stdout>${text}</local-command-stdout>`,
        },
        type: 'user',
    });

describe('what the thread runs at, from its transcript', () => {
    test('a reply names its model', () => {
        const at = runsAtAfter(NO_RUNS_AT, reply('claude-opus-5-5'), 0);
        expect(modelNow(at, null)).toBe('Opus 5.5');
    });

    test('a reply stamps its effort', () => {
        const at = runsAtAfter(NO_RUNS_AT, reply('claude-opus-5-5', 'high'), 0);
        expect(effortNow(at, null)).toBe('high');
    });

    test("/model's and /effort's output name the new ones", () => {
        let at = runsAtAfter(
            NO_RUNS_AT,
            output('Set model to `Sonnet 5.5`'),
            0,
        );
        at = runsAtAfter(
            at,
            output('Set effort level to low (this session)'),
            0,
        );
        expect([modelNow(at, null), effortNow(at, null)]).toEqual([
            'Sonnet 5.5',
            'low',
        ]);
    });

    test('a picked effort holds over replies still at the old one, and the first at it applied it', () => {
        let at = runsAtAfter(NO_RUNS_AT, reply('claude-opus-5-5', 'medium'), 0);
        at = {
            ...at,
            effort: { isPicked: true, level: 'high', model: 'Opus 5.5' },
        };
        at = runsAtAfter(at, reply('claude-opus-5-5', 'medium'), 5);
        expect([effortNow(at, null), at.appliedAt]).toEqual(['high', null]);
        at = runsAtAfter(at, reply('claude-opus-5-5', 'high'), 9);
        expect([effortNow(at, null), at.appliedAt]).toEqual(['high', 9]);
    });

    test('a line that is no conversation line changes nothing', () => {
        expect(runsAtAfter(NO_RUNS_AT, '{"type":"api', 0)).toBe(NO_RUNS_AT);
    });
});

describe("with nothing in the transcript yet, Claude's settings answer", () => {
    test('the default model by its alias, its effort by the model', () => {
        const settings = {
            model: 'sonnet',
            modelSettings: { 'claude-sonnet-5-5': { effortLevel: 'xhigh' } },
        };
        expect(modelNow(NO_RUNS_AT, settings)).toBe('Sonnet 5.5');
        expect(effortNow(NO_RUNS_AT, settings)).toBe('xhigh');
    });

    test('an effort set on another model is not this one’s', () => {
        const at = {
            ...NO_RUNS_AT,
            effort: { level: 'low', model: 'Haiku 5.5' },
        };
        expect(effortNow(at, { effortLevel: 'medium', model: 'opus' })).toBe(
            'medium',
        );
    });

    test('a model id reads as its label', () => {
        expect(modelLabel('claude-haiku-5-5-20261101')).toBe('Haiku 5.5');
    });
});

describe("a pick runs in Claude Code's own picker", () => {
    const io = (screens: string[]) => {
        const keys: string[][] = [];
        let n = 0;
        return {
            editorMode: null,
            keys: async (k: string[]) => {
                keys.push(k);
            },
            screen: async () =>
                screens[Math.min(n++, screens.length - 1)] ?? '',
            sent: keys,
            sleep: async () => {},
            status: () => 'idle',
        };
    };

    test('an effort slides from low to its stop and is set', async () => {
        const door = io(['', 'Faster ─── Smarter', '❯ done']);
        await pickIn('effort', 'high', door);
        expect(door.sent).toContainEqual([
            ...Array(5).fill('left'),
            'right',
            'right',
            's',
        ]);
    });

    test('a model Claude does not list is refused, its picker closed', async () => {
        const door = io(['Select model\n ❯ 1. Default (recommended)  x\n']);
        await expect(pickIn('model', 'Opus 5.5', door)).rejects.toThrow(
            "Claude's model picker didn't open",
        );
    });
});

// x-herdr-chatter carries a copy until the swap (a mod cannot import a sibling): both run every row
describe.each([
    ['x-herdr-chat', { permissionIn, permissionOf }],
    ['x-herdr-chatter', chatter],
])(
    '%s: the permission mode, read off Claude’s footer and cycled live',
    (_mod, { permissionIn, permissionOf }) => {
        test.each([
            [
                '  -- INSERT -- ⏵⏵ bypass permissions on (shift+tab to cycle)',
                'bypassPermissions',
            ],
            [
                '  ⏵⏵ auto mode on (shift+tab to cycle) · esc to interrupt',
                'auto',
            ],
            ['  -- INSERT -- ⏸ manual mode on', 'default'],
            ['  ⏵⏵ accept edits on (shift+tab to cycle)', 'acceptEdits'],
            ['  ⏸ plan mode on (shift+tab to cycle)', 'plan'],
        ])('«%s» reads %s', (footer, mode) => {
            expect(permissionOf(`❯ hi\n${footer}`)).toBe(mode);
        });

        test('a screen with no footer reads nothing', () => {
            expect(permissionOf('Select model')).toBeNull();
        });

        // a fake thread: its mode line moves one step per Shift+Tab through `cycle`, redrawn `lag` screen reads later
        const thread = (
            cycle: string[],
            at: number,
            lag = 0,
            isBlocked = () => false,
        ) => {
            let presses = 0;
            let reads = 0;
            let since = 0;
            return {
                io: {
                    isBlocked,
                    keys: async () => {
                        presses += 1;
                        since = reads;
                    },
                    screen: async () => {
                        reads += 1;
                        const shown =
                            reads - since > lag ? presses : presses - 1;
                        return (
                            cycle[(at + Math.max(0, shown)) % cycle.length] ??
                            ''
                        );
                    },
                    sleep: async () => {},
                },
                presses: () => presses,
            };
        };
        const FULL = [
            '⏵⏵ bypass permissions on',
            '⏵⏵ auto mode on',
            '⏸ manual mode on',
            '⏵⏵ accept edits on',
            '⏸ plan mode on',
        ];

        test('Shift+Tab is pressed until the footer reads the mode picked', async () => {
            const t = thread(FULL, 0);
            expect(await permissionIn('acceptEdits', t.io)).toBe('acceptEdits');
            expect(t.presses()).toBe(3);
        });

        test('a mode the cycle never reaches leaves the thread in the mode it started in', async () => {
            const four = [FULL[2], FULL[3], FULL[4], FULL[0]] as string[];
            const t = thread(four, 0);
            expect(await permissionIn('auto', t.io)).toBe('default');
            expect(t.presses()).toBe(4);
        });

        test('a footer slow to redraw is waited for, never pressed past', async () => {
            const t = thread(FULL, 0, 3);
            expect(await permissionIn('default', t.io)).toBe('default');
            expect(t.presses()).toBe(2);
        });

        test('a screen with no mode line gets no key', async () => {
            const t = thread(['Select model'], 0);
            expect(await permissionIn('plan', t.io)).toBeNull();
            expect(t.presses()).toBe(0);
        });

        test('a thread asking a question gets no key', async () => {
            const t = thread(FULL, 0, 0, () => true);
            await permissionIn('plan', t.io);
            expect(t.presses()).toBe(0);
        });
    },
);
