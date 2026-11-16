import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

import {
    closeAsks,
    closeWords,
    leadPane,
    pillLabel,
    pillName,
    swallow,
} from './pills.js';

const pane = (pane: string, more: object = {}) => ({
    focused: false,
    pane,
    program: { agent: false },
    tab: 'tb1',
    terminal: pane.replace('p', 't'),
    ...more,
});

describe('the pane that speaks for a tab', () => {
    test('the focused one wins over an agent', () => {
        const all = [
            pane('p1', { program: { agent: true } }),
            pane('p2', { focused: true }),
        ];
        expect(leadPane(all, 'tb1')?.pane).toBe('p2');
    });

    test('with none focused, its agent', () => {
        const all = [pane('p1'), pane('p2', { program: { agent: true } })];
        expect(leadPane(all, 'tb1')?.pane).toBe('p2');
    });

    test('with no agent, the first', () => {
        expect(leadPane([pane('p1'), pane('p2')], 'tb1')?.pane).toBe('p1');
    });

    test("another tab's pane never speaks for this one", () => {
        const all = [pane('p9', { focused: true, tab: 'tb2' }), pane('p1')];
        expect(leadPane(all, 'tb1')?.pane).toBe('p1');
    });
});

describe("a pill's name", () => {
    const names = { t1: '⚡ 🔧 codie: herdr | FRM-635' };

    test('a thread shows its registry name, the member word dropped, whole on hover', () => {
        expect(pillName({ name: 'Claude Code' }, ['t1'], names)).toEqual({
            full: '⚡ 🔧 codie: herdr | FRM-635',
            isThread: true,
            label: '⚡ 🔧 herdr | FRM-635',
        });
    });

    test('a thread in a pane that does not speak still names the tab', () => {
        expect(pillName({ name: '3' }, ['t7', 't1'], names).label).toBe(
            '⚡ 🔧 herdr | FRM-635',
        );
    });

    test("a tab with no thread keeps the tab's own name", () => {
        expect(pillName({ name: 'logs' }, ['t7', null], names)).toEqual({
            full: 'logs',
            isThread: false,
            label: 'logs',
        });
    });

    test('no published names yet: the tab name', () => {
        expect(pillName({ name: 'logs' }, ['t1'], null).label).toBe('logs');
    });

    test.each([
        ['🦉 clio', '🦉 clio'],
        ['⚡ 🔎 sixth: mods | FRM-634', '⚡ 🔎 mods | FRM-634'],
        ['zsh: not a badge', 'zsh: not a badge'],
    ])('the label of «%s»', (name, label) => {
        expect(pillLabel(name)).toBe(label);
    });
});

describe('the × asks before it closes', () => {
    const reply = (facts: object) => ({
        code: 0,
        stdout: JSON.stringify(facts),
    });
    const idle = reply({ foreground: { pid: 10 }, pid: 10, state: 'live' });
    const busy = reply({ foreground: { pid: 42 }, pid: 10, state: 'live' });

    test.each([
        ['an agent', { agent: true }, idle],
        ['a shell with a program running in it', { shell: true }, busy],
        [
            'a program that is no shell, though it is its own foreground',
            { shell: false },
            idle,
        ],
        ['a read that failed', { shell: true }, { code: 1, stdout: '' }],
        ['a read that never came back', { shell: true }, null],
        [
            'a reply that is not json',
            { shell: true },
            { code: 0, stdout: 'no such terminal' },
        ],
        [
            'a reply with no foreground',
            { shell: true },
            reply({ pid: 10, state: 'live' }),
        ],
        [
            'a state herdr never named to us',
            { shell: true },
            reply({ foreground: { pid: 10 }, pid: 10, state: 'paused' }),
        ],
        [
            'a failed read that still printed an idle shell',
            { shell: true },
            {
                code: 1,
                stdout: JSON.stringify({
                    foreground: { pid: 10 },
                    pid: 10,
                    state: 'live',
                }),
            },
        ],
        [
            'a live shell with no pid on either side',
            { shell: true },
            reply({ foreground: {}, state: 'live' }),
        ],
    ])('%s asks', (_name, program, got) => {
        expect(closeAsks(program, 't1', got)).toBe(true);
    });

    test.each([
        ['an idle shell', { shell: true }, 't1', idle],
        [
            'an ended terminal',
            { shell: false },
            't1',
            reply({ foreground: null, pid: 10, state: 'finished' }),
        ],
        ['a pane with no terminal', null, null, null],
    ])('%s closes at once', (_name, program, terminal, got) => {
        expect(closeAsks(program, terminal, got)).toBe(false);
    });

    test('the dialog names what ends', () => {
        expect(closeWords('logs', 'frame', 0).detail).toContain(
            'the program running in it',
        );
        expect(closeWords('🦉 clio', 'frame', 1).detail).toContain('its agent');
        expect(closeWords('pair', 'frame', 2).detail).toContain('2 agents');
    });
});

test('a press or a wheel on the bar goes no further', () => {
    let stopped = 0;
    swallow(null, { stop_propagation: () => stopped++ });
    expect(stopped).toBe(1);
});

test('no colour is a literal: every one comes from the theme', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    for (const name of ['main.js', 'pills.js'])
        expect(readFileSync(join(here, name), 'utf8')).not.toMatch(
            /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/,
        );
});
