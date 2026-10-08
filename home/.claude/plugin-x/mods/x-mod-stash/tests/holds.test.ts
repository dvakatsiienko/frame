import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// the 🔒 chip reads x-mod-holds' own store file; these tests write that file and look at the band
const PROPS = {
    bodyColumns: 100,
    hasSurvey: false,
    isWorking: false,
    maxRows: 12,
    scroll: { bodyRows: 40, offset: 0 },
    view: {},
};
const NOW = 10_000_000;
const MIN = 60 * 1000;
const A = 'b1b1b1b1-aaaa';
const B = 'a2a2a2a2-bbbb';
const STORE = '/home/.claude/plugins/store';
const FILE = 'x-mod-holds_inline-abc.json';

// one session, `sid`, in the checkout at /repo, beside x-mod-holds' store file holding `held`
async function band(
    $: Engine,
    on: On,
    sid: string,
    held: Record<string, unknown>,
    surface: 'terminal' | 'desktop' = 'terminal',
) {
    mock.clock(on, { now: NOW });
    mock.store(on);
    on('session.id', () => ({ value: sid }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/repo' },
    }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('env.get', () => ({ value: '/home' }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('ui.log', () => ({ value: undefined }));
    on('fs.list', (_$, e) => ({
        value:
            e.path === STORE
                ? [
                      {
                          isLink: false,
                          kind: 'file' as const,
                          mtimeMs: 0,
                          name: FILE,
                          size: 1,
                      },
                  ]
                : [],
    }));
    on('fs.read', (_$, e) => ({
        value: e.path === `${STORE}/${FILE}` ? JSON.stringify(held) : '{}',
    }));
    on('process.run', (_$, e) => ({
        value: {
            exitCode: 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: e.argv[1] === 'rev-parse' ? '/repo\n' : '',
        },
    }));
    await $.session.start({ cwd: '/repo', isInteractive: true, surface });
    return $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props: PROPS,
        surface,
    });
}

const hold = (top = '/repo') => ({
    at: NOW - MIN,
    file: `${top}/x.ts`,
    landed: true,
    top,
});
const live = { idleSince: null };

test("the holds chip counts other sessions' holds", async ($, on) => {
    const ui = await band($, on, B, {
        [`hold:${A}:/repo/x.ts`]: hold(),
        [`hold:${A}:/repo/y.ts`]: hold(),
        [`holder:${A}`]: live,
    });
    expect((await ui.find({ text: '🔒', type: 'Text' }))?.text).toBe('🔒 2');
});

for (const surface of ['terminal', 'desktop'] as const)
    test(`the holds chip names itself on hover on ${surface}`, async ($, on) => {
        const ui = await band(
            $,
            on,
            B,
            {
                [`hold:${A}:/repo/x.ts`]: hold(),
                [`hold:${A}:/repo/y.ts`]: hold(),
                [`holder:${A}`]: live,
            },
            surface,
        );
        const card = (await ui.findAll({ type: 'Box' })).find(
            (n) => n.text === '2 files held by other sessions',
        );
        // the harness keeps `hover` out of props, so the reveal itself is the surface's
        expect(card?.props.display).toBe('none');
    });

test("a worktree's holds stay out of the main checkout's chip", async ($, on) => {
    const ui = await band($, on, B, {
        [`hold:${A}:/repo/.claude/worktrees/w1/x.ts`]: hold(
            '/repo/.claude/worktrees/w1',
        ),
        [`holder:${A}`]: live,
    });
    expect(await ui.find({ text: /🔒/, type: 'Text' })).toBeUndefined();
});

test("an idle holder's holds leave the chip", async ($, on) => {
    const ui = await band($, on, B, {
        [`hold:${A}:/repo/x.ts`]: hold(),
        [`holder:${A}`]: { idleSince: NOW - 31 * MIN },
    });
    expect(await ui.find({ text: /🔒/, type: 'Text' })).toBeUndefined();
});

test('the holds chip is hidden when nobody else holds a file', async ($, on) => {
    const ui = await band($, on, A, {
        [`hold:${A}:/repo/x.ts`]: hold(),
        [`holder:${A}`]: live,
    });
    expect(await ui.find({ text: /🔒|⚠/, type: 'Text' })).toBeUndefined();
});

test("the holder's chip warns after a refusal", async ($, on) => {
    const ui = await band($, on, A, {
        [`hold:${A}:/repo/x.ts`]: hold(),
        [`holder:${A}`]: live,
        [`refused:${A}`]: { at: NOW, by: B, path: '/repo/x.ts' },
    });
    expect((await ui.find({ text: '⚠', type: 'Text' }))?.text).toBe('⚠');
});

test('an afk flip mid-turn reaches the next tool call once', async ($, on) => {
    on('prompt.submit', (_$, e) => ({ text: e.text }));
    on('tool.call', () => ({ result: {}, text: 'done' }));
    const ui = await band($, on, A, {});
    await $.prompt.submit({
        origin: { kind: 'composer' },
        text: 'go',
        wait: false,
    });
    await ui.press({ key: 'afk' });
    const bash = () => $.tool.call({ command: 'ls', tool: 'Bash' });
    expect((await bash()).context).toContainEqual(
        expect.stringContaining('dima is afk'),
    );
    expect((await bash()).context ?? []).toHaveLength(0);
});
