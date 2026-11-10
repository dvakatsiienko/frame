import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { answerPrompts } from './said.ts';
import { liveStore } from './store.ts';

// dima's o53: the herdr codie's bare `herdr-app do overlay.close` killed main and wing 1 at 19:41 (2026-11-10), so a
// herdr close names its target and never ends a live seat; this seat is t9
const NOW = 1_000_000;
const TERMINALS: Record<string, object> = {
    t20: {
        argv: ['claude'],
        labels: { seat: 'mods-codie' },
        parent: null,
        state: 'live',
        status: { app: 'claude-code' },
    },
    t27: {
        argv: ['/opt/homebrew/bin/zsh', '-l'],
        labels: { 'zoo.quickterm': 'sp1' },
        parent: null,
        state: 'live',
        status: null,
    },
    t2p: {
        argv: ['claude'],
        labels: null,
        parent: null,
        state: 'live',
        status: { app: 'claude-code' },
    },
    t30: {
        argv: ['claude'],
        labels: null,
        parent: 't9',
        state: 'live',
        status: { app: 'claude-code' },
    },
    t31: {
        argv: ['claude'],
        labels: { seat: 'old' },
        parent: null,
        state: 'finished',
        status: null,
    },
    // a seat this seat started: its label alone makes it one
    t32: {
        argv: ['claude'],
        labels: { seat: 'wing-3' },
        parent: 't9',
        state: 'live',
        status: { app: 'claude-code' },
    },
};
const WINDOW = {
    spaces: [
        {
            id: 'sp1',
            tabs: [
                { id: 'tb1', terminals: [{ pane: 'p1', terminal: 't27' }] },
                { id: 'tb2', terminals: [{ pane: 'p2', terminal: 't2p' }] },
            ],
        },
    ],
};
type Tick = { at: number; id: string; targets: string[]; text: string };

function world(on: On, ticks: Tick[] = []) {
    mock.clock(on, { now: NOW });
    liveStore(on);
    answerPrompts(on);
    const ran: string[] = [];
    on('state.get', (_$, e, next) =>
        e.plugin === 'x-mod-stash' && e.key === 'ticks'
            ? { value: { value: ticks, version: 1 } }
            : next(e),
    );
    on('session.id', () => ({ value: 'h1h1h1h1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', (_$, e) => ({
        value: e.name === 'HC_TERMINAL_ID' ? 't9' : '/home',
    }));
    on('fs.exists', () => ({ value: false }));
    on('ui.log', () => ({ value: undefined }));
    on('process.run', (_$, e) => {
        const terminal =
            e.argv[0] === 'hc' && e.argv[1] === 'get'
                ? TERMINALS[e.argv[2] ?? '']
                : undefined;
        const isWindow = e.argv[0] === 'herdr-app' && e.argv[1] === 'ls';
        return {
            value: {
                exitCode:
                    e.argv[0] === 'hc' && e.argv[1] === 'get' && !terminal
                        ? 1
                        : 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: terminal
                    ? JSON.stringify(terminal)
                    : isWindow
                      ? JSON.stringify(WINDOW)
                      : '',
            },
        };
    });
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}
const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

for (const line of [
    'herdr-app do overlay.close',
    'herdr-app do pane.close',
    'herdr-app do tab.close',
    'herdr-app do space.close --confirmed true',
    'herdr-app do terminal.kill',
    'herdr-app do app.quit',
    'herdr-app do window.close',
    `herdr-app do '{"name":"overlay.close"}'`,
    'hc kill',
    'hc rm',
    'hc server stop',
    'hc server restart',
    'hc kill $T',
    'hc kill t20',
    'hc kill t2p',
    'hc kill t99',
    'hc kill t32',
    'hc --json kill t20',
    '/opt/homebrew/bin/hc kill t20',
    'env X=1 hc kill t20',
    'herdr-app do terminal.kill --terminal t2p',
    `herdr-app do terminal.kill '{"terminal":"t20"}'`,
    'herdr-app do pane.close --pane=p2',
    'herdr-app do pane.close --pane p9',
    'herdr-app do tab.close --id tb2',
    'herdr-app do space.close --id sp1 --confirmed true',
    'echo ok && herdr-app do overlay.close',
    'hc ls; hc kill t20',
    "bash -c 'hc kill t20'",
])
    test(`a herdr close that names no target or ends a live seat is refused: ${line}`, async ($, on) => {
        const { ran } = world(on);
        const r = await bash($, line);
        expect([r.deny, ran]).toEqual([expect.stringContaining('herdr'), []]);
    });

for (const line of [
    'hc kill t27',
    'hc kill t30',
    'hc rm t31',
    'herdr-app do overlay.close --id palette',
    'herdr-app do pane.close --pane p1',
    'herdr-app do tab.close --id tb1',
    'herdr-app do pane.split',
    'hc kill --help 2>&1 | head -15',
    `herdr-app do overlay.close '{"id":"x-probe-setvalue"}' | tr -d '\\n'`,
    'hc ls --json',
])
    test(`a herdr close of a named terminal that is no seat runs: ${line}`, async ($, on) => {
        const { ran } = world(on);
        const r = await bash($, line);
        expect([r.deny, ran]).toEqual([undefined, [line]]);
    });

for (const line of [
    'herdr-app do app.quit',
    'herdr-app do window.close',
    'hc server stop',
])
    test(`a close of everything says it ends every seat: ${line}`, async ($, on) => {
        world(on);
        expect((await bash($, line)).deny).toContain('every herdr seat');
    });

test('his tick on an ask quoting the close runs it once', async ($, on) => {
    const line = 'hc kill t20';
    const { ran } = world(on, [
        {
            at: NOW - 1,
            id: 'o4',
            targets: [line],
            text: `⚠️ end the mods codie: \`${line}\``,
        },
    ]);
    const r = await bash($, line);
    expect([r.deny, ran]).toEqual([undefined, [line]]);
});
