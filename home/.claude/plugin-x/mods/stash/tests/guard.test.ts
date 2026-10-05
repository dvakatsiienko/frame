import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const STORE = '/home/.claude/plugins/store';
const REFUSED = 'event:1000:a1a1a1a1-0000';
const ESCAPED = 'event:2000:a1a1a1a1-0000';
const EVENTS = {
    [ESCAPED]: {
        at: 2000,
        command: 'rm -rf dist # dima-ok: dist',
        door: 'trash <path>',
        kind: 'escaped',
        sid: 'a1a1a1a1-0000',
        target: 'dist',
    },
    [REFUSED]: {
        at: 1000,
        command: 'rm -rf build',
        door: 'trash <path>',
        kind: 'refused',
        name: '☕️ 🔧 FRM-1 code: x',
        sid: 'a1a1a1a1-0000',
        target: 'build',
    },
};

// a session whose band reads guard's own store file, as the engine keeps it
async function band(
    $: Engine,
    on: On,
    surface: 'terminal' | 'desktop',
    events: Record<string, unknown>,
) {
    const clock = mock.clock(on);
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
                          name: 'guard_inline-abc.json',
                          size: 1,
                      },
                  ]
                : [],
    }));
    on('fs.read', (_$, e) => ({
        value: JSON.stringify(
            e.path === `${STORE}/guard_inline-abc.json` ? events : {},
        ),
    }));
    on('session.id', () => ({ value: 'b2b2b2b2-0000' }));
    on('session.repo', () => ({ value: null }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    await $.session.start({ cwd: '/tmp', isInteractive: true, surface });
    const ui = await $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'stash',
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
        (await ui.findAll({ text: /🛡️/, type: 'Text' })).map((n) => n.text);
    return { clock, lines, ui };
}

for (const surface of ['terminal', 'desktop'] as const)
    test(`a guard refusal shows as a 🛡️ line until dismissed on ${surface}`, async ($, on) => {
        const b = await band($, on, surface, { [REFUSED]: EVENTS[REFUSED] });
        expect(await b.lines()).toEqual([
            '🛡️ ☕️ 🔧 FRM-1 code: x — rm -rf build → trash <path>',
        ]);
        await b.ui.press({ key: `dismiss:${REFUSED}` });
        expect(await b.lines()).toEqual([]);
    });

test('an escape shows what it ran on', async ($, on) => {
    const b = await band($, on, 'terminal', { [ESCAPED]: EVENTS[ESCAPED] });
    expect(await b.lines()).toEqual([
        '🛡️ a1a1a1a1 — rm -rf dist # dima-ok: dist → ran on dima-ok: dist',
    ]);
});

test('two dismissed lines stay gone after the next poll', async ($, on) => {
    const b = await band($, on, 'terminal', EVENTS);
    await b.ui.press({ key: `dismiss:${ESCAPED}` });
    await b.ui.press({ key: `dismiss:${REFUSED}` });
    await b.clock.advance(5000);
    expect(await b.lines()).toEqual([]);
});
