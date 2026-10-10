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

test('a reply that waits on nothing draws no 🔭 line', async ($, on) => {
    world(on);
    const ui = await band($);
    await reply($, 'pushed.\n\n🔭 waiting on ci — the watcher wakes me');
    await reply($, 'ci is green, all done.');
    expect(await ui.find({ text: /^🔭/, type: 'Text' })).toBe(undefined);
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
        'auto-compact at this context %',
        'type a %, ✓ saves',
        "keep this session's cache hot: ping every 50 min",
        'wake every session stopped on the 5h cap',
        'afk: tell fleet that dima is away',
        'unfold fleet board',
        '5h window used',
        'context window used',
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
    expect(cards.slice(-4, -2)).toEqual([
        'back: tell fleet that dima is here',
        'unfold fleet board',
    ]);
});
