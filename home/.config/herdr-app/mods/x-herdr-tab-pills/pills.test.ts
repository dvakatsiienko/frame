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
} from './pills.js';

const here = dirname(fileURLToPath(import.meta.url));
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
    const shell = { foreground: { pid: 10 }, pid: 10, state: 'live' };

    test('an agent asks', () => {
        expect(closeAsks({ agent: true }, shell)).toBe(true);
    });

    test('a shell with a program running in it asks', () => {
        expect(
            closeAsks({ agent: false }, { ...shell, foreground: { pid: 42 } }),
        ).toBe(true);
    });

    test('an idle shell closes at once', () => {
        expect(closeAsks({ agent: false }, shell)).toBe(false);
    });

    test('an ended terminal closes at once', () => {
        expect(
            closeAsks(
                { agent: false },
                { foreground: null, pid: 10, state: 'finished' },
            ),
        ).toBe(false);
    });

    test('a pane with no terminal closes at once', () => {
        expect(closeAsks(null, null)).toBe(false);
    });

    test('the dialog names what ends', () => {
        expect(closeWords('logs', 'frame', 0).detail).toContain(
            'the program running in it',
        );
        expect(closeWords('🦉 clio', 'frame', 1).detail).toContain('its agent');
        expect(closeWords('pair', 'frame', 2).detail).toContain('2 agents');
    });
});

describe('the bar itself', () => {
    const source = readFileSync(join(here, 'main.js'), 'utf8');

    test('a wheel scroll over it switches no tab', () => {
        expect(source).toContain('on_scroll_wheel');
        expect(source).not.toMatch(/tab\.(next|prev)/);
    });

    test('no colour is a literal: every one comes from the theme', () => {
        for (const name of ['main.js', 'pills.js'])
            expect(readFileSync(join(here, name), 'utf8')).not.toMatch(
                /#[0-9a-fA-F]{3,8}\b/,
            );
    });

    test('a tab closes by its id, never bare', () => {
        expect(source).not.toMatch(/run\(\s*'(tab|pane)\.close'\s*\)/);
    });
});
