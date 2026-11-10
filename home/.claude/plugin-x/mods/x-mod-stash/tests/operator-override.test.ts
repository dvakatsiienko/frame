import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const REAL = '/real-home/.local/state/x/operator-override.json';
const PLANTED = '/planted-home/.local/state/x/operator-override.json';
const ON = '{"prs":{"at":"2026-11-07T13:00:00.000Z","by":"word"}}';

const props = {
    bodyColumns: 100,
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 12,
    scroll: { bodyRows: 40, offset: 0 },
    view: {},
};

function world(on: On, files: Record<string, string>, spawns: string[] = []) {
    mock.clock(on);
    mock.store(on);
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.id', () => ({ value: 's1s1s1s1-0000' }));
    on('session.repo', () => ({ value: null }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('env.get', (_$, e) => ({
        value: e.name === 'HOME' ? '/planted-home' : undefined,
    }));
    on('process.run', (_$, e) => {
        spawns.push(e.argv[0] ?? '');
        return {
            value: {
                exitCode: e.argv[0] === 'id' ? 0 : 1,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout:
                    e.argv[0] === 'id'
                        ? 'dima:********:501:20::0:0:Dima:/real-home:/bin/zsh\n'
                        : '',
            },
        };
    });
    on('fs.read', (_$, e) => {
        const body = files[e.path];
        return body === undefined ? { deny: 'no such file' } : { value: body };
    });
    on('fs.write', (_$, e) => {
        files[e.path] = e.text;
        return { value: undefined };
    });
    return files;
}

async function band($: Engine, surface: 'desktop' | 'terminal' = 'terminal') {
    await $.session.start({ cwd: '/tmp', isInteractive: true, surface });
    return $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props,
        surface,
    });
}

for (const surface of ['terminal', 'desktop'] as const)
    test(`🔓 clears on one press while prs is on, on ${surface}`, async ($, on) => {
        const files = world(on, { [REAL]: ON });
        const ui = await band($, surface);
        expect(await ui.find({ key: 'operator-override' })).toBeDefined();
        await ui.press({ key: 'operator-override' });
        expect(files[REAL]).toBe('{}');
        expect(await ui.find({ key: 'operator-override' })).toBe(undefined);
    });

for (const [name, files] of [
    ['no store', {}],
    ['an empty store', { [REAL]: '{}' }],
    ['a store that does not parse', { [REAL]: '{"prs":' }],
    ['a store only under HOME', { [PLANTED]: ON }],
    ['another scope only', { [REAL]: '{"guards":{"by":"word","at":"x"}}' }],
] as const)
    test(`no 🔓, so no press can turn it on, with ${name}`, async ($, on) => {
        world(on, { ...files });
        const ui = await band($);
        expect(await ui.find({ key: 'operator-override' })).toBe(undefined);
    });

test('the store path costs one id spawn, every poll after it a file read', async ($, on) => {
    const spawns: string[] = [];
    world(on, { [REAL]: ON }, spawns);
    await band($);
    const was = spawns.filter((s) => s === 'id').length;
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'terminal',
    });
    expect(was).toBe(1);
    expect(spawns.filter((s) => s === 'id').length).toBe(1);
});

for (const surface of ['terminal', 'desktop'] as const)
    test(`🔓 sits immediately left of 🎛️, on ${surface}`, async ($, on) => {
        world(on, { [REAL]: ON });
        const ui = await band($, surface);
        const keys = (await ui.findAll({ type: 'Button' })).map((b) => b.key);
        expect(
            keys.indexOf('settings') - keys.indexOf('operator-override'),
        ).toBe(1);
    });

test('🔓 reads «operator override» on hover', async ($, on) => {
    world(on, { [REAL]: ON });
    const ui = await band($);
    const cards = (await ui.findAll({ type: 'Box' }))
        .filter((n) => n.props.display === 'none')
        .map((n) => n.text);
    expect(cards).toContain('operator override');
});
