import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { answerPrompts } from './said.ts';
import { liveStore } from './store.ts';

// dima's o47 and his 19:09 «warn me»: a second Herdr app start while his window runs reloads that window, and the text he
// was typing there is lost; the herdr codie's 8 probe starts 18:48–18:56 (2026-11-11) did it, the first a real row
const NOW = 1_000_000;
const PROBE =
    'S=/private/tmp/claude-501/-Users-dima-frame/8892f154/scratchpad/hprobe; cd $S; HERDR_APP_HOME=$S/A nohup /Applications/Herdr.app/Contents/MacOS/Herdr > A.log 2>&1 & echo $! > A.pid';
const ASK = '⚠️ a seat wants a second Herdr window: save your typed text first';
type Tick = { at: number; id: string; targets: string[]; text: string };

function world(on: On, opts: { isOpen?: boolean; ticks?: Tick[] } = {}) {
    mock.clock(on, { now: NOW });
    const store = liveStore(on);
    store.set('rule-mode:herdr-start', 'enforce');
    answerPrompts(on);
    const ran: string[] = [];
    const states: unknown[] = [];
    on('state.get', (_$, e, next) =>
        e.plugin === 'x-mod-stash' && e.key === 'ticks'
            ? { value: { value: opts.ticks ?? [], version: 1 } }
            : next(e),
    );
    on('state.set', (_$, e, next) => {
        if (e.key === 'herdrStart') states.push(e.value);
        return next(e);
    });
    on('session.id', () => ({ value: 'h1h1h1h1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: false }));
    on('fs.list', () => ({ value: [] }));
    on('ui.log', () => ({ value: undefined }));
    on('process.run', (_$, e) => ({
        value: {
            exitCode: e.argv[0] === 'pgrep' && opts.isOpen === false ? 1 : 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: e.argv[0] === 'pgrep' ? '98397\n' : '',
        },
    }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran, states, store };
}
const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

for (const line of [
    PROBE,
    '/Applications/Herdr.app/Contents/MacOS/Herdr',
    'HERDR_APP_HOME=/tmp/h herdr-app',
    'herdr-app',
    'open -n -a Herdr',
    'open -na Herdr',
    'open -n /Applications/Herdr.app',
    'open --new -a /Applications/Herdr.app --args --x',
    'open -n -b dev.herdr.app',
    // sixth sense round 1 on 86f77267: the app's binary path, opened as a bare word
    'open -n /Applications/Herdr.app/Contents/MacOS/Herdr',
    'open -n /Applications/Herdr.app/Contents/MacOS/Herdr/',
    // round 2 on 59ac53d0: spellings the kernel walks to the same file
    'open -n /Applications/Herdr.app/Contents/MacOS//Herdr',
    'open -n /Applications/Herdr.app/Contents/MacOS/./Herdr',
    'open -n /Applications/Herdr.app/Contents/../Contents/MacOS/Herdr',
    'open -n /Applications//Herdr.app',
    'open -n -a /Applications/./Herdr.app',
    'env HERDR_APP_HOME=/tmp/h /Applications/Herdr.app/Contents/MacOS/Herdr &',
    "bash -c 'open -na Herdr'",
    'hc run -- /Applications/Herdr.app/Contents/MacOS/Herdr',
])
    test(`a second Herdr app start while his window runs is refused: ${line}`, async ($, on) => {
        const { ran } = world(on);
        const r = await bash($, line);
        expect([r.deny, ran]).toEqual([
            expect.stringContaining('typed draft'),
            [],
        ]);
    });

for (const line of [
    'herdr-app ls',
    'HERDR_APP_HOME=/tmp/h herdr-app ls',
    'herdr-app status',
    'herdr-app --version',
    'herdr-app do tab.new',
    'open -a Herdr',
    'open -n -a Safari',
    'open -n ~/notes/Herdr.md',
    'ls /Applications/Herdr.app/Contents/MacOS/',
    'pgrep -x Herdr',
])
    test(`a Herdr call that starts no second app runs: ${line}`, async ($, on) => {
        const { ran } = world(on);
        const r = await bash($, line);
        expect([r.deny, ran]).toEqual([undefined, [line]]);
    });

test('a Herdr start runs when his window is not up', async ($, on) => {
    const { ran } = world(on, { isOpen: false });
    const r = await bash($, 'open -na Herdr');
    expect([r.deny, ran]).toEqual([undefined, ['open -na Herdr']]);
});

test('the refusal leaves the start for x-mod-stash to put his ⚠️ ask up', async ($, on) => {
    const { states } = world(on);
    await bash($, 'open -na Herdr');
    expect(states).toEqual([{ at: NOW, command: 'open -na Herdr' }]);
});

test('his tick on the ⚠️ ask lets one start run, and a second start asks again', async ($, on) => {
    const { ran } = world(on, {
        ticks: [{ at: NOW - 1, id: 'o9', targets: [], text: ASK }],
    });
    const first = await bash($, 'open -na Herdr');
    const second = await bash($, 'open -na Herdr');
    expect([first.deny, second.deny, ran]).toEqual([
        undefined,
        expect.stringContaining('typed draft'),
        ['open -na Herdr'],
    ]);
});

test('a tick on another ask lets no start run', async ($, on) => {
    const { ran } = world(on, {
        ticks: [{ at: NOW - 1, id: 'o9', targets: [], text: '⚠️ end t9' }],
    });
    const r = await bash($, 'open -na Herdr');
    expect([r.deny, ran]).toEqual([expect.stringContaining('typed draft'), []]);
});

test('the rule ships warn-only: the start runs with a would-refuse note', async ($, on) => {
    const { ran, store } = world(on);
    store.delete('rule-mode:herdr-start');
    const r = await bash($, 'open -na Herdr');
    expect([r.deny, ran, JSON.stringify(r)]).toEqual([
        undefined,
        ['open -na Herdr'],
        expect.stringContaining('herdr-start'),
    ]);
});

// wisphunter on 63d5fa57: a Herdr start hid every rule after it in the chain, so his Herdr tick let `sudo` through
for (const line of [
    'sudo open -na Herdr',
    'sudo /Applications/Herdr.app/Contents/MacOS/Herdr',
])
    test(`his tick on the ⚠️ ask passes no other rule on the line: ${line}`, async ($, on) => {
        const { ran } = world(on, {
            ticks: [{ at: NOW - 1, id: 'o9', targets: [], text: ASK }],
        });
        const r = await bash($, line);
        expect([r.deny === undefined, ran]).toEqual([false, []]);
    });
