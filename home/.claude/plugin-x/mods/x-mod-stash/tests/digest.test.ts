import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const HERE = 'h1h1h1h1-here';
const block = (ask: string) =>
    `⏳ waiting on your word:\n\n\`\`\`\nlane\n1. ${ask} ➡️ yes\n\`\`\``;

// one session's band; `stop` ends a reply in any session, `afk` presses 💨, `digest` reads the digest's lines in order
async function band($: Engine, on: On) {
    const clock = mock.clock(on);
    mock.store(on);
    on('session.id', () => ({ value: HERE }));
    on('session.repo', () => ({ value: null }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('classic.Stop', () => ({}));
    on('prompt.submit', (_$, e) => ({ text: e.text }));
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
    return {
        afk: () => ui.press({ key: 'afk' }),
        clock,
        digest: async () =>
            (await ui.findAll({ text: /needs you|done/, type: 'Text' })).map(
                (n) => n.text,
            ),
        stop: (sid: string, reply: string) =>
            $.classic.Stop({
                last_assistant_message: reply,
                session_id: sid,
                stop_hook_active: false,
            }),
    };
}

test('the away digest lists what needs dima before what finished', async ($, on) => {
    const b = await band($, on);
    await b.afk();
    await b.stop('d0d0d0d0-done', 'shipped the fix.');
    await b.stop('n1n1n1n1-asks', block('merge it'));
    await b.afk();
    expect(await b.digest()).toEqual([
        'needs you · n1n1n1n1 · ⏳ 1',
        'done · d0d0d0d0',
    ]);
});

test('a reply that ended before afk stays out of the digest', async ($, on) => {
    const b = await band($, on);
    await b.stop('e9e9e9e9-early', 'done before he left.');
    await b.clock.advance(60_000);
    await b.afk();
    await b.stop('d0d0d0d0-done', 'shipped the fix.');
    await b.afk();
    expect(await b.digest()).toEqual(['done · d0d0d0d0']);
});

test("dima's next prompt folds the digest away", async ($, on) => {
    const b = await band($, on);
    await b.afk();
    await b.stop('d0d0d0d0-done', 'shipped the fix.');
    await b.afk();
    await $.prompt.submit({ origin: { kind: 'composer' }, text: 'thanks' });
    expect(await b.digest()).toEqual([]);
});
