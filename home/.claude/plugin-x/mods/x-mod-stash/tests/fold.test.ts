import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const block = (asks: string[]) =>
    `⏳ waiting on your word:\n\n\`\`\`\nlane\n${asks.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\`\`\``;

// a session with dima's first two asks in the band
async function started($: Engine, on: On) {
    mock.clock(on);
    mock.store(on);
    on('session.id', () => ({ value: 'h1h1h1h1-here' }));
    on('session.repo', () => ({ value: null }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('prompt.submit', (_$, e) => ({ text: e.text }));
    on('classic.Stop', () => ({}));
    on('ui.log', () => ({ value: undefined }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'terminal',
    });
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
        surface: 'terminal',
    });
    await reply($, ['ship it', 'rename']);
    // the ask lines and the head's count, as dima sees them
    const seen = async () =>
        (await ui.findAll({ text: /^\d+\. |open$/, type: 'Text' })).map(
            (n) => n.text,
        );
    return { seen, ui };
}

// dima types, the session answers with this ⏳ block (none: no block at all)
async function reply($: Engine, asks: string[]) {
    await $.prompt.submit({
        origin: { kind: 'composer' },
        text: 'go on',
        wait: false,
    });
    await $.classic.Stop({
        last_assistant_message: asks.length ? block(asks) : 'done',
        stop_hook_active: false,
    });
}

test('a folded ⏳ list stays folded when a reply brings new asks', async ($, on) => {
    const s = await started($, on);
    await s.ui.press({ key: 'asks-toggle' });
    await reply($, ['ship it', 'rename', 'bump x']);
    expect(await s.seen()).toEqual(['⏳ 3 open']);
});

test('a folded ⏳ list stays folded when its asks clear and a new one arrives', async ($, on) => {
    const s = await started($, on);
    await s.ui.press({ key: 'asks-toggle' });
    await reply($, []);
    await reply($, ['bump x']);
    expect(await s.seen()).toEqual(['⏳ 1 open']);
});

test('an unfolded ⏳ list stays unfolded when new asks arrive', async ($, on) => {
    const s = await started($, on);
    await s.ui.press({ key: 'asks-toggle' });
    await s.ui.press({ key: 'asks-toggle' });
    await reply($, ['ship it', 'rename', 'bump x']);
    expect(await s.seen()).toEqual([
        '⏳ 3 open',
        '1. ship it',
        '2. rename',
        '3. bump x',
    ]);
});
