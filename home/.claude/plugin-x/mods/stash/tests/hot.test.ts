import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const props = {
    bodyColumns: 100,
    hasSurvey: false,
    isWorking: false,
    maxRows: 12,
    scroll: { bodyRows: 40, offset: 0 },
    view: {},
};
const MIN = 60 * 1000;

async function hotSession($: Engine, on: On) {
    const clock = mock.clock(on);
    mock.store(on);
    const pings: string[] = [];
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('turn.complete', () => ({ text: '' }));
    on('prompt.submit', (_$, e) => {
        if (e.origin?.kind === 'plugin') pings.push(e.text);
        return { text: e.text };
    });
    const ui = await $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'stash',
        props,
        surface: 'desktop',
    });
    await ui.press({ key: 'hot' });
    return { clock, pings };
}

function endTurn($: Engine) {
    return $.turn.complete({
        answer: '',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });
}

test('a hot session is pinged 50 minutes after its last turn ended', async ($, on) => {
    const s = await hotSession($, on);
    await endTurn($);
    await s.clock.advance(49 * MIN);
    const before = s.pings.length;
    await s.clock.advance(MIN);
    expect([before, s.pings]).toEqual([
        0,
        [expect.stringContaining('keep-hot ping')],
    ]);
});

test('a busy session is never pinged', async ($, on) => {
    const s = await hotSession($, on);
    await endTurn($);
    await s.clock.advance(30 * MIN);
    await $.prompt.submit({
        origin: { kind: 'composer' },
        text: 'a long turn',
        wait: false,
    });
    await s.clock.advance(40 * MIN);
    expect(s.pings).toEqual([]);
});
