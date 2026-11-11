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
    // FRM-574: a coordinator, its wing, crow, helga, a lane codie, and a seat that only calls itself clio
    t40: {
        argv: ['claude'],
        labels: { seat: 'clio' },
        name: 'clio',
        parent: null,
        state: 'live',
        status: { app: 'claude-code' },
    },
    t41: {
        argv: ['claude'],
        labels: { seat: 'crow' },
        parent: null,
        state: 'live',
        status: { app: 'claude-code' },
    },
    t42: {
        argv: ['claude'],
        labels: { seat: 'helga' },
        parent: null,
        state: 'live',
        status: { app: 'claude-code' },
    },
    t43: {
        argv: ['claude'],
        labels: null,
        parent: null,
        state: 'live',
        status: { app: 'claude-code' },
    },
    t44: {
        argv: ['claude'],
        labels: { seat: 'clio-wing-2' },
        parent: null,
        state: 'live',
        status: { app: 'claude-code' },
    },
    t46: {
        argv: ['claude'],
        labels: { where: 'frame / 🦉 clio' },
        name: 'clio',
        parent: null,
        state: 'live',
        status: { app: 'claude-code' },
    },
    // a codie the mods codie (t9) summoned, labelled with its lead's terminal
    t47: {
        argv: ['claude'],
        labels: { lead: 't9', seat: 'mods-helper' },
        parent: null,
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

function world(
    on: On,
    ticks: Tick[] = [],
    self = 't9',
    overlays: unknown[] = ['palette', { id: 'x-probe-setvalue' }],
) {
    mock.clock(on, { now: NOW });
    const store = liveStore(on);
    answerPrompts(on);
    const ran: string[] = [];
    const fail = new Set<string>();
    on('state.get', (_$, e, next) =>
        e.plugin === 'x-mod-stash' && e.key === 'ticks'
            ? { value: { value: ticks, version: 1 } }
            : next(e),
    );
    on('session.id', () => ({ value: 'h1h1h1h1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', (_$, e) => ({
        value: e.name === 'HC_TERMINAL_ID' ? self : '/home',
    }));
    on('fs.exists', () => ({ value: false }));
    on('fs.list', (_$, e) => ({
        value:
            e.path === '/home/.claude/sessions'
                ? [
                      {
                          isLink: false,
                          kind: 'file' as const,
                          mtimeMs: 0,
                          name: '9.json',
                          size: 1,
                      },
                  ]
                : [],
    }));
    on('fs.read', (_$, e, next) =>
        e.path === '/home/.claude/sessions/9.json'
            ? {
                  value: JSON.stringify({
                      name: '🦉 clio',
                      sessionId: 'h1h1h1h1-0000',
                  }),
              }
            : next(e),
    );
    on('ui.log', () => ({ value: undefined }));
    on('process.run', (_$, e) => {
        const terminal =
            e.argv[0] === 'hc' && e.argv[1] === 'get'
                ? TERMINALS[e.argv[2] ?? '']
                : undefined;
        const isWindow = e.argv[0] === 'herdr-app' && e.argv[1] === 'ls';
        const isStatus = e.argv[0] === 'herdr-app' && e.argv[1] === 'status';
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
                      : isStatus
                        ? JSON.stringify({ overlays })
                        : '',
            },
        };
    });
    on('tool.call', (_$, e) => {
        const command = 'command' in e ? String(e.command) : '';
        ran.push(command);
        return [...fail].some((f) => command.includes(f))
            ? { isError: true as const, result: {}, text: 'failed' }
            : { result: {}, text: 'ran' };
    });
    return { fail, ran, store };
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

// FRM-574 decided 1: a clio seat, proven by its own terminal's hc label, ends any seat that is not a clio with no ask
for (const [self, target] of [
    ['t40', 't41'],
    ['t40', 't42'],
    ['t40', 't43'],
    ['t40', 't20'],
    ['t40', 't47'],
    ['t44', 't43'],
])
    test(`a clio seat ends a seat that is not a clio: ${self} → hc kill ${target}`, async ($, on) => {
        const line = `hc kill ${target}`;
        const { ran } = world(on, [], self);
        const r = await bash($, line);
        expect([r.deny, ran]).toEqual([undefined, [line]]);
    });

for (const [self, target] of [
    ['t44', 't40'],
    ['t40', 't44'],
    ['t9', 't40'],
    ['t9', 't44'],
    ['t46', 't41'],
    ['t46', 't44'],
    ['t41', 't40'],
])
    test(`a clio seat is ended by no other terminal, and a self-named clio ends no seat: ${self} → hc kill ${target}`, async ($, on) => {
        const { ran } = world(on, [], self);
        const r = await bash($, `hc kill ${target}`);
        expect([r.deny, ran]).toEqual([expect.stringContaining('herdr'), []]);
    });

test('a lead ends the seat it labelled with its own registry name', async ($, on) => {
    const { ran } = world(on);
    const r = await bash($, 'hc kill t47');
    expect([r.deny, ran]).toEqual([undefined, ['hc kill t47']]);
});

for (const line of [
    'hc run --label seat=clio-wing-9 -- hc kill t43',
    'hc run --bg --label=seat=clio -- claude',
    'hc run --name x --label seat=clio-wing-1 claude',
    'hc label t43 seat=clio',
    'hc label t44 seat=codie',
    'hc label t43 lead=x',
    "hc label t43 'seat=clio-wing-3'",
    // sixth sense round 1 on 23037434: a relabel the guard cannot read
    'echo seat=clio | xargs hc label t43',
    'xargs -a /tmp/kv hc label t43',
    'KV=seat=clio; hc label t43 $KV',
    `echo '{"method":"terminal.label","params":{"terminal":"t43","labels":{"seat":"clio"}}}' | hc connect`,
    'hc connect < /tmp/rpc.jsonl',
])
    test(`a seat's proof label is set by no tool call but a clio's spawn: ${line}`, async ($, on) => {
        const { ran } = world(on);
        const r = await bash($, line);
        expect([r.deny, ran]).toEqual([expect.stringContaining('label'), []]);
    });

for (const line of [
    'hc run --label seat=crow -- claude',
    'hc run --bg -- claude --label seat=clio',
    'hc label t43 note=x',
    'hc ls --json --label seat=helga',
])
    test(`a label that proves no clio passes: ${line}`, async ($, on) => {
        const { ran } = world(on);
        const r = await bash($, line);
        expect([r.deny, ran]).toEqual([undefined, [line]]);
    });

test('a clio seat spawns a wing with its clio label', async ($, on) => {
    const line = 'hc run --bg --label seat=clio-wing-3 -- claude';
    const { ran } = world(on, [], 't40');
    const r = await bash($, line);
    expect([r.deny, ran]).toEqual([undefined, [line]]);
});

// FRM-574 decided 2 and 7: a tick quoting one guarded command passes it inside a longer line, every other part judged,
// and it is spent only on that command's exit 0
const killTick = (line: string): Tick => ({
    at: NOW - 1,
    id: 'o9',
    targets: [line],
    text: `⚠️ end the mods codie: \`${line}\``,
});
for (const line of [
    'hc kill t20 2>&1 | tail -1',
    'hc kill t20 2>&1',
    'hc kill t20 >/dev/null 2>&1',
    'hc ls && hc kill t20',
    'hc ls; hc kill t20',
])
    test(`a tick quoting the command passes it inside a longer line: ${line}`, async ($, on) => {
        const { ran } = world(on, [killTick('hc kill t20')]);
        const r = await bash($, line);
        expect([r.deny, ran.length]).toEqual([undefined, 1]);
    });

for (const line of [
    'hc kill t20 2>&1 | tail -1; hc kill t2p',
    'hc kill t20 && rm -rf /tmp/x',
    'hc kill t20 t2p',
    'hc kill t20x',
    'hc kill t20 | sh',
    // wisphunter on 4f7da87c: run more than once, fed input he never saw, or followed by a command whose exit hides its own
    'for i in 1 2; do\nhc kill t20\ndone',
    'printf x | hc kill t20',
    "hc kill t20 <<'EOF'\nx\nEOF",
    'hc kill t20; hc ls',
    'hc kill t20 && hc ls',
    'hc kill t20 2>&1 | grep x',
    'f() { hc kill t20; }; f; f',
])
    test(`a tick quoting one command passes nothing else on the line: ${line}`, async ($, on) => {
        const { ran } = world(on, [killTick('hc kill t20')]);
        const r = await bash($, line);
        expect([r.deny, ran]).toEqual([expect.any(String), []]);
    });

test('a ticked command that fails keeps the tick for the retry', async ($, on) => {
    const line = 'hc kill t20 2>&1 | tail -1';
    const { ran, fail } = world(on, [killTick('hc kill t20')]);
    fail.add(line);
    expect((await bash($, line)).deny).toBeUndefined();
    fail.clear();
    expect((await bash($, line)).deny).toBeUndefined();
    expect((await bash($, line)).deny).toEqual(
        expect.stringContaining('herdr'),
    );
    expect(ran.length).toBe(2);
});

test('a ticked command inside a pipe runs with pipefail, so its own exit is the one read', async ($, on) => {
    const line = 'hc kill t20 2>&1 | tail -1';
    const { ran } = world(on, [killTick('hc kill t20')]);
    await bash($, line);
    expect(ran).toEqual([`set -o pipefail; ${line}`]);
});

test('exit 2: a ticked `hc kill t9` runs as `hc kill t9 2>&1 | tail -1`', async ($, on) => {
    const { ran } = world(on, [killTick('hc kill t9')]);
    const r = await bash($, 'hc kill t9 2>&1 | tail -1');
    expect([r.deny, ran]).toEqual([
        undefined,
        ['set -o pipefail; hc kill t9 2>&1 | tail -1'],
    ]);
});

test('exit 7: a ticked `hc kill t-dead` that fails keeps the tick for the retry', async ($, on) => {
    const line = 'hc kill t-dead 2>&1 | tail -1';
    const { ran, fail } = world(on, [killTick('hc kill t-dead')]);
    fail.add('t-dead');
    await bash($, line);
    fail.clear();
    expect([(await bash($, line)).deny, ran.length]).toEqual([undefined, 2]);
});

// FRM-574 decided 4: an overlay close passes only on an overlay herdr lists open; a mod toggle opens or closes its own
for (const [why, line, overlays] of [
    ['no overlay is open', `herdr-app do overlay.close '{"id":"x"}'`, []],
    ['another one is open', 'herdr-app do overlay.close --id x', ['palette']],
] as const)
    test(`an overlay close is refused when ${why}`, async ($, on) => {
        const { ran } = world(on, [], 't9', [...overlays]);
        const r = await bash($, line);
        expect([r.deny, ran]).toEqual([expect.stringContaining('overlay'), []]);
    });

for (const [line, overlays] of [
    ['herdr-app do mod.open --name fleet-board', []],
    ['herdr-app do mod.open --name fleet-board', ['fleet-board']],
    [
        `herdr-app do overlay.close '{"id":"fleet-board"}'`,
        [{ name: 'fleet-board' }],
    ],
] as const)
    test(`an overlay close or toggle herdr can answer for runs: ${line} with ${JSON.stringify(overlays)}`, async ($, on) => {
        const { ran } = world(on, [], 't9', [...overlays]);
        expect([(await bash($, line)).deny, ran]).toEqual([undefined, [line]]);
    });
