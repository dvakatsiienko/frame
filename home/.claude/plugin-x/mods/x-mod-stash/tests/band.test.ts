import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const SID = 'b1b1b1b1-band';
const TOOL = 'mcp__x-mod-stash__orbit';

function world(on: On) {
    mock.clock(on);
    mock.store(on);
    on('session.id', () => ({ value: SID }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.repo', () => ({ value: null }));
    on('classic.Stop', () => ({}));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('tool.register', (_$, e) => ({
        value: { tool: `mcp__x-mod-stash__${e.name}` },
    }));
}

async function band($: Engine, surface: 'terminal' | 'desktop' = 'terminal') {
    await $.session.start({ cwd: '/tmp', isInteractive: true, surface });
    return $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 140,
            hasSurvey: false,
            isWorking: false,
            maxRows: 12,
            scroll: { bodyRows: 40, offset: 0 },
            view: {},
        },
        surface,
    });
}

const orbit = ($: Engine, input: Record<string, unknown>) =>
    $.tool.call({ tool: TOOL, ...input } as never);

const reply = ($: Engine, text: string) =>
    $.classic.Stop({
        last_assistant_message: text,
        session_id: SID,
        stop_hook_active: false,
    });

for (const surface of ['terminal', 'desktop'] as const)
    test(`the band is its row and the two meters on ${surface}`, async ($, on) => {
        world(on);
        const ui = await band($, surface);
        await orbit($, { asks: [{ pick: 'yes', text: 'ship it' }], op: 'add' });
        const texts = (await ui.findAll({ type: 'Text' })).map((t) => t.text);
        const shown = [
            (await ui.find({ key: 'row', type: 'Box' }))?.text ?? '',
            (await ui.find({ key: 'meters', type: 'Box' }))?.text ?? '',
        ].join('');
        expect(texts.filter((t) => t && !shown.includes(t))).toEqual([]);
    });

test("the chips count orbit's open asks and the plan's lines", async ($, on) => {
    world(on);
    const ui = await band($);
    await orbit($, {
        asks: [
            { pick: 'yes', text: 'ship it' },
            { pick: 'no', text: 'rename it' },
        ],
        op: 'add',
    });
    await orbit($, { lines: ['now: a', 'next: b', 'then: c'], op: 'plan' });
    expect([
        (await ui.find({ text: /^🪐/, type: 'Text' }))?.text,
        (await ui.find({ text: /^🌔/, type: 'Text' }))?.text,
    ]).toEqual(['🪐 2', '🌔 3']);
});

test('the chips are text, never a control', async ($, on) => {
    world(on);
    const ui = await band($);
    const buttons = (await ui.findAll({ type: 'Button' })).map((b) => b.text);
    expect(buttons.some((t) => t?.includes('🪐'))).toBe(false);
});

test('a reply that waits on something draws its 🔭 line under the row', async ($, on) => {
    world(on);
    const ui = await band($);
    await reply($, 'pushed.\n\n🔭 waiting on ci — the watcher wakes me');
    expect((await ui.find({ text: /^🔭/, type: 'Text' }))?.text).toBe(
        '🔭 waiting on ci — the watcher wakes me',
    );
});

test('the 🔭 line prints who it waits on in bold', async ($, on) => {
    world(on);
    const ui = await band($);
    await reply(
        $,
        'pushed.\n\n🔭 waiting on ci — the watcher wakes me\n🔭 waiting on 🔎 verifier',
    );
    expect(
        (await ui.findAll({ type: 'Text' }))
            .filter((t) => t.props.bold)
            .map((t) => t.text)
            .filter((t) => ['ci', '🔎 verifier'].includes(t ?? '')),
    ).toEqual(['ci', '🔎 verifier']);
});

test('the 🔭 line reads in the theme grey, not dimmed', async ($, on) => {
    world(on);
    const ui = await band($);
    await reply($, 'pushed.\n\n🔭 waiting on ci — the watcher wakes me');
    const line = await ui.find({ text: /^🔭/, type: 'Text' });
    expect([line?.props.color, Boolean(line?.props.dimColor)]).toEqual([
        'inactive',
        false,
    ]);
});

test('a reply that waits on nothing keeps the 🔭 mark as «not waiting»', async ($, on) => {
    world(on);
    const ui = await band($);
    await reply($, 'pushed.\n\n🔭 waiting on ci — the watcher wakes me');
    await reply($, 'ci is green, all done.');
    expect((await ui.find({ text: /^🔭/, type: 'Text' }))?.text).toBe(
        '🔭 not waiting',
    );
});

test('the 🔭 wait sits in the row, and the 📦 field no longer does', async ($, on) => {
    world(on);
    const ui = await band($);
    await reply($, 'pushed.\n\n🔭 waiting on ci — the watcher wakes me');
    const row = (await ui.find({ key: 'row', type: 'Box' }))?.text ?? '';
    expect([/🔭 waiting on ci/u.test(row), row.includes('📦')]).toEqual([
        true,
        false,
    ]);
});

test('every control in the row carries a hover card that names it', async ($, on) => {
    world(on);
    const ui = await band($);
    // the harness keeps `hover` out of props, so a card is a hidden Box with words
    const cards = (await ui.findAll({ type: 'Box' }))
        .filter((n) => n.props.display === 'none')
        .map((n) => n.text);
    expect(cards).toEqual([
        '0 open asks for you',
        '0 phases',
        'enhance prompt',
        "keep this session's cache hot: ping every 50 min",
        'wake every session stopped on the 5h cap',
        'afk: tell fleet that dima is away',
        'settings: show or hide each part',
        'unfold fleet board',
    ]);
});

test('the keys ride the hover cards, never the icons', async ($, on) => {
    world(on);
    const ui = await band($, 'desktop');
    const keyed = (await ui.findAll({ type: 'Button' }))
        .filter((n) => n.props.hotkey)
        .map((n) => `${n.key?.split(':')[1]} ${n.props.hotkey}`);
    expect(keyed).toEqual(['board b']);
});

test("a toggle's hover card names what the next press does", async ($, on) => {
    world(on);
    const ui = await band($);
    await ui.press({ key: 'afk' });
    const cards = (await ui.findAll({ type: 'Box' }))
        .filter((n) => n.props.display === 'none')
        .map((n) => n.text);
    expect(cards.slice(-3)).toEqual([
        'back: tell fleet that dima is here',
        'settings: show or hide each part',
        'unfold fleet board',
    ]);
});

test('a reply with no 🔭 line names its background work in the row', async ($, on) => {
    world(on);
    const ui = await band($);
    await $.classic.Stop({
        background_tasks: [
            {
                description: 'critic',
                id: 't1',
                status: 'running',
                type: 'subagent',
            },
        ],
        last_assistant_message: 'spawned the critic.',
        session_id: SID,
        stop_hook_active: false,
    });
    expect((await ui.find({ text: /^🔭/, type: 'Text' }))?.text).toBe(
        '🔭 waiting on critic',
    );
});

// the two watches as cclio arms them: the pr one names its script, the ci one only its description
const standingWatch = (id: string) =>
    id === 'w1'
        ? {
              command: '~/frame/cclio/.claude/hooks/watch-once.sh pr',
              description: 'Arm the one-shot pr watch',
              id,
              status: 'running',
              type: 'shell',
          }
        : {
              description: 'Arm the one-shot ci watch',
              id,
              status: 'running',
              type: 'shell',
          };

test("cclio's standing pr/ci watches are not counted as waits", async ($, on) => {
    world(on);
    const ui = await band($);
    await $.classic.Stop({
        background_tasks: [
            standingWatch('w1'),
            standingWatch('w2'),
            {
                description: 'critic',
                id: 't1',
                status: 'running',
                type: 'subagent',
            },
        ],
        last_assistant_message: 'spawned the critic.',
        session_id: SID,
        stop_hook_active: false,
    });
    expect((await ui.find({ text: /^🔭/, type: 'Text' }))?.text).toBe(
        '🔭 waiting on critic',
    );
});

test('a session running only the standing watches reads not waiting', async ($, on) => {
    world(on);
    const ui = await band($);
    await $.classic.Stop({
        background_tasks: [standingWatch('w1'), standingWatch('w2')],
        last_assistant_message: 'done.',
        session_id: SID,
        stop_hook_active: false,
    });
    expect((await ui.find({ text: /^🔭/, type: 'Text' }))?.text).toBe(
        '🔭 not waiting',
    );
});

test('a watch named only by its watch-once.sh command is not a wait', async ($, on) => {
    world(on);
    const ui = await band($);
    await $.classic.Stop({
        background_tasks: [
            {
                command: '~/frame/cclio/.claude/hooks/watch-once.sh ci',
                description: 'Watch ci on the head once',
                id: 'w3',
                status: 'running',
                type: 'shell',
            },
        ],
        last_assistant_message: 'done.',
        session_id: SID,
        stop_hook_active: false,
    });
    expect((await ui.find({ text: /^🔭/, type: 'Text' }))?.text).toBe(
        '🔭 not waiting',
    );
});
