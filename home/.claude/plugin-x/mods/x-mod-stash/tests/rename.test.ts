import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const STORE = '/home/.claude/plugins/store';
const OLD = 'stash_inline-0ld0ld0ld0ld.json';
const MIN = 60 * 1000;
const NOW = 1_000_000;
const SID = 'r3n4m3d0-aaaa';

// a session whose old `stash` store file holds 🔥 for it: is 🔥 still on, and does its ping fire?
async function hotAfterStart(
    $: Engine,
    on: On,
    store: Record<string, unknown> = {},
    oldMtime = 0,
) {
    const clock = mock.clock(on, { now: NOW });
    mock.store(on, store);
    on('env.get', () => ({ value: '/home' }));
    on('fs.list', (_$, e) => ({
        value:
            e.path === STORE
                ? [
                      {
                          isLink: false,
                          kind: 'file' as const,
                          mtimeMs: oldMtime,
                          name: OLD,
                          size: 1,
                      },
                  ]
                : [],
    }));
    on('fs.read', (_$, e) => ({
        value: JSON.stringify(
            e.path === `${STORE}/${OLD}`
                ? { [`hot:${SID}`]: { since: NOW } }
                : {},
        ),
    }));
    const pings: string[] = [];
    on('session.id', () => ({ value: SID }));
    on('session.repo', () => ({ value: null }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('prompt.submit', (_$, e) => {
        if (e.origin?.kind === 'plugin') pings.push(e.text);
        return { text: e.text };
    });
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'desktop',
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
        surface: 'desktop',
    });
    await clock.advance(50 * MIN);
    const hot = (await ui.findAll({ type: 'Button' })).find(
        (n) => n.key === 'hot',
    );
    return [hot?.props.variant, pings.length];
}

test('🔥 kept under the old stash name survives the rename', async ($, on) => {
    expect(await hotAfterStart($, on)).toEqual(['secondary', 1]);
});

// a probe that ran the new name early adopted a snapshot; the old mod kept writing until the cutover
test('an old store written after an earlier adoption is adopted again', async ($, on) => {
    expect(await hotAfterStart($, on, { 'adopted:stash': 5 }, 9)).toEqual([
        'secondary',
        1,
    ]);
});
