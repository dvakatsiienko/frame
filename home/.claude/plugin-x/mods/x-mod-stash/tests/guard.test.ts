import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const STORE = '/home/.claude/plugins/store';
const MIN = 60_000;
// the clock starts here, so every event below sits a few minutes in the past
const NOW = 100 * MIN;

type Event = {
    at: number;
    command: string;
    door: string;
    kind: 'refused' | 'escaped';
    sid: string;
    name?: string;
    target: string;
    why?: string;
};

const refusal = (at: number, sid: string, command: string): Event => ({
    at,
    command,
    door: 'trash <path>',
    kind: 'refused',
    sid,
    target: command.split(' ').pop() ?? '',
    why: 'a recursive rm cannot be undone',
});

// x-mod-guard's store as the engine keeps it: one `event:<at>:<sid>` key per event
const store = (events: Event[]) =>
    Object.fromEntries(events.map((v) => [`event:${v.at}:${v.sid}`, v]));

const FOUR = store([
    {
        ...refusal(NOW - 4 * MIN, 'a1a1a1a1-0000', 'rm -rf build'),
        name: '☕️ 🔧 FRM-1 code: x',
    },
    refusal(NOW - 3 * MIN, 'a1a1a1a1-0000', 'rm -rf dist'),
    refusal(NOW - 2 * MIN, 'c3c3c3c3-0000', 'rm -rf out'),
    refusal(NOW - 1 * MIN, 'c3c3c3c3-0000', 'rm -rf tmp'),
]);

// a session whose band reads x-mod-guard's own store file
async function band(
    $: Engine,
    on: On,
    surface: 'terminal' | 'desktop',
    events: Record<string, unknown>,
    file = 'x-mod-guard_inline-abc.json',
) {
    const clock = mock.clock(on);
    await clock.advance(NOW);
    mock.store(on);
    on('env.get', () => ({ value: '/home' }));
    on('fs.list', (_$, e) => ({
        value:
            e.path === STORE
                ? [
                      {
                          isLink: false,
                          kind: 'file' as const,
                          mtimeMs: 0,
                          name: file,
                          size: 1,
                      },
                  ]
                : [],
    }));
    on('fs.read', (_$, e) => ({
        value: JSON.stringify(e.path === `${STORE}/${file}` ? events : {}),
    }));
    on('session.id', () => ({ value: 'b2b2b2b2-0000' }));
    on('session.repo', () => ({ value: null }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    await $.session.start({ cwd: '/tmp', isInteractive: true, surface });
    const ui = await $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 100,
            hasSurvey: false,
            isWorking: false,
            maxRows: 12,
            scroll: { bodyRows: 40, offset: 0 },
            view: {},
        },
        surface,
    });
    const lines = async () =>
        (await ui.findAll({ text: /🛡️|→/, type: 'Text' })).map((n) => n.text);
    return { clock, lines, ui };
}

for (const surface of ['terminal', 'desktop'] as const)
    test(`four refusals from two sessions show as one counter row on ${surface}`, async ($, on) => {
        const b = await band($, on, surface, FOUR);
        expect(await b.lines()).toEqual(['🛡️ 4 refusals · 2 sessions']);
    });

test('an escape counts beside the refusals and shows what it ran on', async ($, on) => {
    const escaped: Event = {
        at: NOW - MIN,
        command: 'rm -rf dist # dima-ok: dist',
        door: 'trash <path>',
        kind: 'escaped',
        sid: 'a1a1a1a1-0000',
        target: 'dist',
    };
    const b = await band($, on, 'terminal', store([escaped]));
    await b.ui.press({ key: 'guard-toggle' });
    expect(await b.lines()).toEqual([
        '🛡️ 1 escape · 1 session',
        'a1a1a1a1 — rm -rf dist # dima-ok: dist → ran on dima-ok: dist',
    ]);
});

test('refusals kept under the old guard name still count after the rename', async ($, on) => {
    const b = await band($, on, 'terminal', FOUR, 'guard_inline-0ld0ld.json');
    expect(await b.lines()).toEqual(['🛡️ 4 refusals · 2 sessions']);
});

test("the counter row's hover card names what the next press does", async ($, on) => {
    const b = await band($, on, 'terminal', FOUR);
    await b.ui.press({ key: 'guard-toggle' });
    const cards = (await b.ui.findAll({ type: 'Box' }))
        .filter((n) => n.props.display === 'none')
        .map((n) => n.text);
    expect(cards).toContain('fold guard refusals');
});

test('the counter row is gone 30 minutes after the last refusal', async ($, on) => {
    const b = await band($, on, 'terminal', FOUR);
    await b.clock.advance(29 * MIN);
    expect(await b.lines()).toEqual([]);
});

test('a click on the counter row shows each refusal with its session and reason', async ($, on) => {
    const b = await band($, on, 'terminal', FOUR);
    await b.ui.press({ key: 'guard-toggle' });
    expect(await b.lines()).toEqual([
        '🛡️ 4 refusals · 2 sessions',
        'c3c3c3c3 — rm -rf tmp → a recursive rm cannot be undone',
        'c3c3c3c3 — rm -rf out → a recursive rm cannot be undone',
        'a1a1a1a1 — rm -rf dist → a recursive rm cannot be undone',
        '☕️ 🔧 FRM-1 code: x — rm -rf build → a recursive rm cannot be undone',
    ]);
});

test('a refusal kept before it carried a reason shows its door', async ($, on) => {
    const { why: _, ...old } = refusal(
        NOW - MIN,
        'a1a1a1a1-0000',
        'rm -rf dist',
    );
    const b = await band($, on, 'terminal', store([old]));
    await b.ui.press({ key: 'guard-toggle' });
    expect(await b.lines()).toEqual([
        '🛡️ 1 refusal · 1 session',
        'a1a1a1a1 — rm -rf dist → trash <path>',
    ]);
});
