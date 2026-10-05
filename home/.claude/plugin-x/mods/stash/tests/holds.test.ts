import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

type GitState = 'modified' | 'untracked';

const PROPS = {
    bodyColumns: 100,
    hasSurvey: false,
    isWorking: false,
    maxRows: 12,
    scroll: { bodyRows: 40, offset: 0 },
    view: {},
};
const START = 'Sun Oct  4 21:00:00 2026';
const MIN = 60 * 1000;
// B sorts before A, so a tie broken by session id alone would hand B the file
const A = 'b1b1b1b1-aaaa';
const B = 'a2a2a2a2-bbbb';
const C = 'c3c3c3c3-cccc';
const PIDS: Record<string, number> = { [A]: 100, [B]: 200, [C]: 300 };
const WORKTREE = '/repo/.claude/worktrees/w1';

// two sessions in one checkout at /repo, with a git that answers like the real one
function world(on: On) {
    const clock = mock.clock(on, { now: 1_000_000 });
    const files = new Map<string, GitState>();
    const dead = new Set<number>();
    const links = new Map<string, string>();
    const logs: string[] = [];
    // one-shot hooks into the middle of a claim: inside git rev-parse, inside the tool itself
    const fails = { next: false };
    const during: {
        revParse?: () => Promise<void>;
        tool?: () => Promise<void>;
    } = {};
    const fire = async (k: keyof typeof during) => {
        const f = during[k];
        during[k] = undefined;
        await f?.();
    };
    let sid = A;
    on('session.id', () => ({ value: sid }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/repo' },
    }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('prompt.submit', (_$, e) => ({ text: e.text }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('ui.log', (_$, e) => {
        logs.push(e.text);
        return { value: undefined };
    });
    on('fs.stat', (_$, e) => ({
        value: {
            isLink: false,
            kind: 'file' as const,
            mtimeMs: 0,
            realPath: links.get(e.path) ?? e.path,
            size: 1,
        },
    }));
    on('process.run', async (_$, e) => {
        const [cmd, ...args] = e.argv;
        const out = (stdout: string, exitCode = 0, stderr = '') => ({
            value: {
                exitCode,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr,
                stdout,
            },
        });
        if (cmd === 'sh') return out(`${PIDS[sid]}\n${START}\n`);
        if (cmd === 'ps') {
            const pid = Number(args.at(-1));
            return out(
                dead.has(pid) ? '' : `${START}\n`,
                dead.has(pid) ? 1 : 0,
            );
        }
        if (args[0] === 'rev-parse') {
            await fire('revParse');
            return out(
                e.init?.cwd?.startsWith(WORKTREE) ? `${WORKTREE}\n` : '/repo\n',
            );
        }
        if (!e.init?.cwd?.startsWith('/repo'))
            return out('', 128, 'fatal: not a git repository');
        const file = String(args.at(-1));
        const state = files.get(file);
        if (args[0] === 'status')
            return out(
                state ? `${state === 'untracked' ? '??' : ' M'} ${file}\n` : '',
            );
        // git diff never sees an untracked file
        return out('', state === 'modified' ? 1 : 0);
    });
    on('tool.call', async () => {
        await fire('tool');
        if (!fails.next) return { result: {}, text: 'done' };
        fails.next = false;
        return {
            isError: true as const,
            result: 'old_string not found',
            text: 'old_string not found',
        };
    });
    on('turn.complete', () => ({ text: '' }));
    return {
        as: async ($: Engine, who: string, cwd = '/repo') => {
            sid = who;
            await $.session.start({
                cwd,
                isInteractive: true,
                surface: 'terminal',
            });
        },
        be: (who: string) => {
            sid = who;
        },
        clock,
        dead,
        during,
        fails,
        files,
        links,
        logs,
    };
}

// an edit leaves the file modified in git, as a real Edit does
async function edit(
    $: Engine,
    w: ReturnType<typeof world>,
    file: string,
    state: GitState = 'modified',
) {
    const r = await $.tool.call({
        file_path: file,
        new_string: 'b',
        old_string: 'a',
        tool: 'Edit',
    });
    const real = w.links.get(file) ?? file;
    if (r.deny === undefined && !r.isError)
        w.files.set(real, w.files.get(real) ?? state);
    return r;
}

async function endTurn($: Engine) {
    await $.turn.complete({
        answer: '',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });
}

test('a first edit takes the hold', async ($, on) => {
    mock.store(on);
    const w = world(on);
    await w.as($, A);
    await edit($, w, '/repo/x.ts');
    await w.clock.advance(3 * MIN);
    await w.as($, B);
    const r = await edit($, w, '/repo/x.ts');
    expect(r.deny).toBeDefined();
    expect(r.deny).toContain(`held by session ${A.slice(0, 8)}`);
    expect(r.deny).toContain('3 min ago');
});

test('the holder keeps editing', async ($, on) => {
    mock.store(on);
    const w = world(on);
    await w.as($, A);
    await edit($, w, '/repo/x.ts');
    expect((await edit($, w, '/repo/x.ts')).deny).toBeUndefined();
});

test('other files stay free', async ($, on) => {
    mock.store(on);
    const w = world(on);
    await w.as($, A);
    await edit($, w, '/repo/x.ts');
    await w.as($, B);
    expect((await edit($, w, '/repo/y.ts')).deny).toBeUndefined();
});

test("a commit releases the holder's file", async ($, on) => {
    mock.store(on);
    const w = world(on);
    await w.as($, A);
    await edit($, w, '/repo/x.ts');
    w.files.delete('/repo/x.ts');
    await w.as($, B);
    expect((await edit($, w, '/repo/x.ts')).deny).toBeUndefined();
    // A's hold is gone: the file is B's now
    await w.as($, A);
    expect((await edit($, w, '/repo/x.ts')).deny).toContain(B.slice(0, 8));
});

test('a commit releases a hold whose first edit failed', async ($, on) => {
    mock.store(on);
    const w = world(on);
    await w.as($, A);
    w.fails.next = true;
    await edit($, w, '/repo/x.ts');
    await edit($, w, '/repo/x.ts');
    w.files.delete('/repo/x.ts');
    await w.as($, B);
    expect((await edit($, w, '/repo/x.ts')).deny).toBeUndefined();
});

test('a new file stays held until committed', async ($, on) => {
    mock.store(on);
    const w = world(on);
    await w.as($, A);
    await edit($, w, '/repo/new.ts', 'untracked');
    await w.as($, B);
    expect((await edit($, w, '/repo/new.ts')).deny).toBeDefined();
});

test('a dead holder releases', async ($, on) => {
    mock.store(on);
    const w = world(on);
    await w.as($, A);
    await edit($, w, '/repo/x.ts');
    w.dead.add(PIDS[A] ?? 0);
    await w.as($, B);
    expect((await edit($, w, '/repo/x.ts')).deny).toBeUndefined();
});

test('a holder idle for 30 min releases', async ($, on) => {
    mock.store(on);
    const w = world(on);
    await w.as($, A);
    await edit($, w, '/repo/x.ts');
    await endTurn($);
    await w.clock.advance(31 * MIN);
    await w.as($, B);
    expect((await edit($, w, '/repo/x.ts')).deny).toBeUndefined();
});

test('a holder idle under 30 min keeps the hold', async ($, on) => {
    mock.store(on);
    const w = world(on);
    await w.as($, A);
    await edit($, w, '/repo/x.ts');
    await endTurn($);
    await w.clock.advance(29 * MIN);
    await w.as($, B);
    expect((await edit($, w, '/repo/x.ts')).deny).toBeDefined();
});

test('one winner when two sessions take a new file in the same second', async ($, on) => {
    mock.store(on);
    const w = world(on);
    await w.as($, A);
    const first = await edit($, w, '/repo/new.ts', 'untracked');
    await w.as($, B);
    const second = await edit($, w, '/repo/new.ts', 'untracked');
    expect([first.deny, second.deny].filter(Boolean)).toHaveLength(1);
});

test('one winner when a rival writes while the claim is in flight', async ($, on) => {
    mock.store(on);
    const w = world(on);
    let second: Awaited<ReturnType<typeof edit>> | undefined;
    await w.as($, A);
    // B takes the file a second later, between A's read and A's write
    w.during.revParse = async () => {
        await w.clock.advance(1000);
        await w.as($, B);
        second = await edit($, w, '/repo/new.ts', 'untracked');
        w.be(A);
    };
    const first = await edit($, w, '/repo/new.ts', 'untracked');
    expect([first.deny, second?.deny].filter(Boolean)).toHaveLength(1);
});

test('a hold whose edit has not landed stays held on a clean file', async ($, on) => {
    mock.store(on);
    const w = world(on);
    let rival: Awaited<ReturnType<typeof edit>> | undefined;
    await w.as($, A);
    // B edits while A's edit waits on its permission prompt
    w.during.tool = async () => {
        await w.as($, B);
        rival = await edit($, w, '/repo/x.ts');
        w.be(A);
    };
    await edit($, w, '/repo/x.ts');
    expect(rival?.deny).toBeDefined();
});

test('a file reached through a symlink stays held', async ($, on) => {
    mock.store(on);
    const w = world(on);
    w.links.set('/home/.claude/CLAUDE.md', '/repo/home/.claude/CLAUDE.md');
    await w.as($, A);
    await edit($, w, '/home/.claude/CLAUDE.md');
    await w.as($, B);
    expect(
        (await edit($, w, '/repo/home/.claude/CLAUDE.md')).deny,
    ).toBeDefined();
});

test('a broken store never blocks an edit', async ($, on) => {
    const w = world(on);
    const broken = () => ({ deny: 'store unreadable' });
    on('store.get', broken);
    on('store.set', broken);
    on('store.keys', broken);
    on('store.delete', broken);
    await w.as($, B);
    expect((await edit($, w, '/repo/x.ts')).deny).toBeUndefined();
    expect(w.logs).toContainEqual(expect.stringContaining('store unreadable'));
});

async function chipFor($: Engine, on: On, surface: 'terminal' | 'desktop') {
    mock.store(on);
    const w = world(on);
    await w.as($, A);
    await edit($, w, '/repo/x.ts');
    await edit($, w, '/repo/y.ts');
    await w.as($, B);
    return $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'stash',
        props: PROPS,
        surface,
    });
}

test("the holds chip counts other sessions' holds", async ($, on) => {
    const ui = await chipFor($, on, 'terminal');
    expect((await ui.find({ text: '🔒', type: 'Text' }))?.text).toBe('🔒 2');
});

test('the holds chip names itself on hover on desktop', async ($, on) => {
    const ui = await chipFor($, on, 'desktop');
    const svg = await ui.find({ type: 'Svg' });
    expect([svg?.props.alt, svg?.props.source]).toEqual([
        '2 files held by other sessions',
        expect.stringContaining(
            '<title>2 files held by other sessions</title>',
        ),
    ]);
});

test("a worktree's holds stay out of the main checkout's chip", async ($, on) => {
    mock.store(on);
    const w = world(on);
    await w.as($, A, WORKTREE);
    await edit($, w, `${WORKTREE}/x.ts`);
    await w.as($, B);
    const ui = await $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'stash',
        props: PROPS,
        surface: 'terminal',
    });
    expect(await ui.find({ text: /🔒/, type: 'Text' })).toBeUndefined();
});

test("a dead holder's holds leave the chip once a turn ends", async ($, on) => {
    mock.store(on);
    const w = world(on);
    await w.as($, A);
    await edit($, w, '/repo/x.ts');
    w.dead.add(PIDS[A] ?? 0);
    await w.as($, C);
    await endTurn($);
    await w.as($, B);
    const ui = await $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'stash',
        props: PROPS,
        surface: 'terminal',
    });
    expect(await ui.find({ text: /🔒/, type: 'Text' })).toBeUndefined();
});

test('the holds chip is hidden when nobody else holds a file', async ($, on) => {
    mock.store(on);
    const w = world(on);
    await w.as($, A);
    await edit($, w, '/repo/x.ts');
    const ui = await $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'stash',
        props: PROPS,
        surface: 'terminal',
    });
    expect(await ui.find({ text: /🔒|⚠/, type: 'Text' })).toBeUndefined();
});

test("the holder's chip warns after a refusal", async ($, on) => {
    mock.store(on);
    const w = world(on);
    await w.as($, A);
    await edit($, w, '/repo/x.ts');
    await w.as($, B);
    await edit($, w, '/repo/x.ts');
    await w.as($, A);
    const ui = await $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'stash',
        props: PROPS,
        surface: 'terminal',
    });
    expect((await ui.find({ text: '⚠', type: 'Text' }))?.text).toBe('⚠');
});

test('an afk flip mid-turn reaches the next tool call once', async ($, on) => {
    mock.store(on);
    const w = world(on);
    await w.as($, A);
    const ui = await $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'stash',
        props: PROPS,
        surface: 'terminal',
    });
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
