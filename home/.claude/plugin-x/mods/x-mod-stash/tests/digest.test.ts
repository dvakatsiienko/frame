import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const HERE = 'h1h1h1h1-here';

const SESSIONS = '/home/.claude/sessions';

// one session's band; `stop` ends a reply in any session, `afk` presses 💨, `digest` reads the digest's lines in order.
// `busy` names the sessions the registry shows running when dima comes back
async function band(
    $: Engine,
    on: On,
    busy: string[] = [],
    asks: Record<string, string> = {},
) {
    const clock = mock.clock(on);
    // another session's orbit holds an open ask: its stash mirrors it into the shared store
    mock.store(
        on,
        Object.fromEntries(
            Object.entries(asks).map(([sid, ask]) => [
                `asks:${sid}`,
                { asks: [ask], at: clock.now(), label: 'frame' },
            ]),
        ),
    );
    on('env.get', () => ({ value: '/home' }));
    on('fs.list', (_$, e) => ({
        value:
            e.path === SESSIONS
                ? busy.map((_, i) => ({
                      isLink: false,
                      kind: 'file' as const,
                      mtimeMs: 0,
                      name: `${i + 1}.json`,
                      size: 1,
                  }))
                : [],
    }));
    on('fs.read', (_$, e) => {
        const i = Number(e.path.match(/(\d+)\.json$/)?.[1]) - 1;
        const sid = busy[i];
        if (!e.path.startsWith(SESSIONS) || !sid)
            return { deny: 'no such file' };
        return {
            value: JSON.stringify({
                pid: i + 1,
                sessionId: sid,
                status: 'busy',
            }),
        };
    });
    on('process.run', (_$, e) => ({
        value: {
            exitCode: e.argv[0] === 'ps' ? 0 : 1,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout:
                e.argv[0] === 'ps'
                    ? busy.map((_, i) => `${i + 1}\n`).join('')
                    : '',
        },
    }));
    on('session.end', (_$, e) => ({ sessionId: e.sessionId }));
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

// another session's stash sees its own session end; the store is the one every session shares
const end = (
    $: Engine,
    sessionId: string,
    reason: 'prompt_input_exit' | 'clear' = 'prompt_input_exit',
) =>
    $.session.end({
        reason,
        resume: { id: sessionId },
        sessionId,
    });

test('the away digest lists what needs dima before what finished', async ($, on) => {
    const b = await band($, on, [], { 'n1n1n1n1-asks': 'merge it' });
    await b.afk();
    await b.stop('d0d0d0d0-done', 'shipped the fix.');
    await b.stop('n1n1n1n1-asks', 'one ask is in orbit.');
    await b.afk();
    expect(await b.digest()).toEqual([
        'needs you · n1n1n1n1 · 🪐 1',
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
    await $.prompt.submit({
        origin: { kind: 'composer' },
        text: 'thanks',
        wait: false,
    });
    expect(await b.digest()).toEqual([]);
});

test('a session still busy when dima comes back is not listed as done', async ($, on) => {
    const b = await band($, on, ['d0d0d0d0-done']);
    await b.afk();
    await b.stop('d0d0d0d0-done', 'one step done, more to go.');
    await b.afk();
    expect(await b.digest()).toEqual([]);
});

test('a session that exited during afk is listed as done', async ($, on) => {
    const b = await band($, on);
    await b.afk();
    await b.stop('d0d0d0d0-done', 'shipped the fix.');
    await end($, 'd0d0d0d0-done');
    await b.afk();
    expect(await b.digest()).toEqual(['done · d0d0d0d0']);
});
