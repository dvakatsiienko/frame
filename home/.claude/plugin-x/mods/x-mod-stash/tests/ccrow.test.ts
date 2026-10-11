import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// 🐦‍⬛ the ccrow strip (FRM-397): her newest note's first line and her ledger line, at the board's bottom
const NOTES = '/home/.local/state/ccrow/notes.jsonl';
const LEDGER = '/home/.local/state/ccrow/ledger.txt';
const LINE = '📒 2 sent today | holdout in 3 | last 20:56 | 🎯 4 ok today';
const row = (o: object) => JSON.stringify(o);
const HER_NOTES = [
    row({ channel: 'session', note: '🐦‍⬛ **a** | sent | older catch\nmore' }),
    row({
        channel: 'session',
        note: '🐦‍⬛ **b** | sent | **the** newest catch\nbody',
    }),
    row({ channel: 'plan', note: 'a plan finding' }),
    row({ channel: 'session', note: 'none' }),
].join('\n');

function world(
    on: On,
    files: Record<string, string>,
    shown?: object,
    runs: string[][] = [],
) {
    mock.clock(on, { now: new Date(2026, 9, 11, 21, 0).getTime() });
    const store = new Map<string, unknown>(shown ? [['shown', shown]] : []);
    on('store.get', (_$, e) => ({ value: store.get(e.key) }));
    on('store.set', (_$, e) => {
        store.set(e.key, e.value);
        return { value: undefined };
    });
    on('store.keys', () => ({ value: [...store.keys()] }));
    on('store.delete', (_$, e) => {
        store.delete(e.key);
        return { value: undefined };
    });
    on('session.id', () => ({ value: 's1s1s1s1' }));
    on('env.get', () => ({ value: '/home' }));
    on('ui.log', () => ({ value: undefined }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    on('fs.list', (_$, e) => ({
        value: Object.keys(files)
            .filter((f) => f.startsWith(`${e.path}/`))
            .map((f) => ({
                isLink: false,
                kind: 'file' as const,
                mtimeMs: 0,
                name: f.slice(e.path.length + 1),
                size: 1,
            })),
    }));
    on('process.run', (_$, e) => {
        runs.push([...e.argv]);
        return {
            value: {
                exitCode: 1,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: '',
            },
        };
    });
    on('fs.read', (_$, e) =>
        e.path in files
            ? { value: files[e.path] ?? '' }
            : { deny: 'no such file' },
    );
    on('fs.write', () => ({ value: undefined }));
    on('tool.register', (_$, e) => ({
        value: { tool: `mcp__x-mod-stash__${e.name}` },
    }));
    return store;
}

const start = ($: Engine) =>
    $.session.start({ cwd: '/tmp', isInteractive: true, surface: 'desktop' });
const board = ($: Engine) =>
    $.ui.mount({
        component: 'Pane',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 100,
            isFocused: true,
            placement: 'dock',
            scroll: { bodyRows: 40, offset: 0 },
            title: 'fleet board',
            view: {},
        },
        requestId: 'fleet-board',
        surface: 'desktop',
    });
const strip = async ($: Engine) =>
    (await (await board($)).find({ key: 'ccrow', type: 'Box' }))?.text;

test("the strip shows her newest note's first line verbatim and the ledger line", async ($, on) => {
    world(on, { [LEDGER]: `${LINE}\n`, [NOTES]: HER_NOTES });
    await start($);
    expect(await strip($)).toBe(
        `🐦‍⬛ **b** | sent | **the** newest catch${LINE}`,
    );
});

for (const [why, files] of [
    ['no ledger file', { [NOTES]: HER_NOTES }],
    ['no notes file', { [LEDGER]: LINE }],
    ['an unreadable notes file', { [LEDGER]: LINE, [NOTES]: '{not json' }],
] as const)
    test(`${why} hides the strip`, async ($, on) => {
        world(on, { ...files });
        await start($);
        expect(await strip($)).toBe(undefined);
    });

test('the strip sits at the board’s bottom, under the phases', async ($, on) => {
    world(on, { [LEDGER]: LINE, [NOTES]: HER_NOTES });
    await start($);
    await $.tool.call({
        lines: ['now: x'],
        op: 'plan',
        tool: 'mcp__x-mod-stash__orbit',
    } as never);
    const keys = (await (await board($)).findAll({ type: 'Box' })).map(
        (b) => b.key ?? '',
    );
    expect(keys.indexOf('phases') < keys.indexOf('ccrow')).toBe(true);
});

test('its 🎛️ switch off hides it, across a restart', async ($, on) => {
    world(on, { [LEDGER]: LINE, [NOTES]: HER_NOTES }, { 'stash.ccrow': false });
    await start($);
    await start($);
    expect(await strip($)).toBe(undefined);
});

const TAB = '/home/.claude/sessions/77.json';
const tab = (host: string) =>
    JSON.stringify({ hostSessionId: host, name: '🐦 ⬛ ccrow', pid: 77 });

test('a press on ↗ opens her desktop tab (step 0 passed, cc 2.1.296)', async ($, on) => {
    const runs: string[][] = [];
    world(
        on,
        { [LEDGER]: LINE, [NOTES]: HER_NOTES, [TAB]: tab('local_abc') },
        undefined,
        runs,
    );
    await start($);
    const ui = await board($);
    await ui.press({ key: 'ccrow:open' });
    expect(runs.at(-1)).toEqual([
        'open',
        'claude://code/continue?session=local_abc',
    ]);
});

test('a ccrow with no desktop tab has no ↗', async ($, on) => {
    world(on, {
        [LEDGER]: LINE,
        [NOTES]: HER_NOTES,
        [TAB]: tab('session_xyz'),
    });
    await start($);
    expect(
        await (await board($)).find({ key: 'ccrow:open', type: 'Button' }),
    ).toBe(undefined);
});
