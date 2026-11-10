import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { gitEnv } from '../../script/lib/git-fixture.ts';

const SCRIPT = join(import.meta.dirname, 'clio-lanes-radar.ts');
const DEAD_PID = spawnSync('node', ['-e', ''], { timeout: 10_000 }).pid;

function world() {
    const base = mkdtempSync(join(tmpdir(), 'clio-lanes-radar-'));
    const claude = join(base, 'claude');
    const root = join(base, 'frame');
    for (const dir of ['sessions', 'plugins/store', 'shelf']) {
        mkdirSync(join(claude, dir), { recursive: true });
    }
    mkdirSync(join(root, '_clio/pocket/tasks'), { recursive: true });
    writeFileSync(join(claude, 'shelf/lanes.json'), '{"lanes":[]}');
    const storeFile = join(claude, 'plugins/store/x-mod-stash_inline-a.json');
    writeFileSync(storeFile, '{}');

    const session = (name: string, sessionId: string, more: object = {}) => {
        writeFileSync(
            join(claude, 'sessions', `${sessionId}.json`),
            JSON.stringify({
                kind: 'interactive',
                name,
                pid: process.pid,
                sessionId,
                status: 'idle',
                statusUpdatedAt: Date.now(),
                ...more,
            }),
        );
    };
    const flyway = (key: string, lines: string[]) => {
        writeFileSync(
            join(root, `_clio/pocket/tasks/pk-${key}.md`),
            `---\ntitle: 'flyway: ${key}'\n---\n${lines.join('\n')}\n`,
        );
    };
    const run = (args: string[] = [], input = '') => {
        return spawnSync('node', [SCRIPT, ...args], {
            encoding: 'utf8',
            env: {
                ...process.env,
                CLIO_LANES_RADAR_CLAUDE: claude,
                CLIO_LANES_RADAR_ROOT: root,
                TZ: 'Asia/Tokyo',
            },
            input,
            timeout: 10_000,
        }).stdout;
    };
    const git = (dir: string, ...args: string[]) => {
        return spawnSync('git', ['-C', dir, ...args], {
            encoding: 'utf8',
            env: gitEnv(),
            timeout: 10_000,
        });
    };
    const addTree = (name: string) => {
        const tree = join(root, '.claude/worktrees', name);
        git(root, 'worktree', 'add', '-q', '-b', name, tree);
        return tree;
    };
    const commit = (dir: string, file: string) => {
        writeFileSync(join(dir, file), 'x\n');
        git(dir, 'add', file);
        git(dir, 'commit', '-q', '-m', file);
    };
    const gitRepo = () => {
        git(root, 'init', '-q', '-b', 'main');
        commit(root, 'a.txt');
    };
    return {
        addTree,
        claude,
        commit,
        flyway,
        gitRepo,
        root,
        run,
        session,
        storeFile,
    };
}

describe('clio-lanes-radar', () => {
    test('a live seat shows its status, phases and wait from the board store', () => {
        const w = world();
        w.session('🦉🪽 clio: wing 2', 'sid-2', { status: 'busy' });
        writeFileSync(
            w.storeFile,
            JSON.stringify({
                'kept:sid-2': {
                    orbit: { plan: { lines: ['build the view'] } },
                },
                'reply:sid-2': { wait: '🔭 waiting on crow' },
            }),
        );
        const out = w.run();
        expect(out).toContain('🦉🪽 clio: wing 2: alive, busy 0 min');
        expect(out).toContain('  - build the view');
        expect(out).toContain('waits: 🔭 waiting on crow');
    });

    test('a dead seat keeps its flyway as parked and drops its old phases', () => {
        const w = world();
        w.session('🦉🪽 clio: wing 1', 'sid-1', { pid: DEAD_PID });
        w.flyway('wing 1', ['- [ ] #1 the cpu chore']);
        writeFileSync(
            w.storeFile,
            JSON.stringify({
                'kept:sid-1': { orbit: { plan: { lines: ['old phase'] } } },
            }),
        );
        const out = w.run();
        expect(out).toContain('🦉🪽 clio: wing 1: dead');
        expect(out).toContain('flyway, parked:\n  - the cpu chore');
        expect(out).not.toContain('old phase');
    });

    test('a flyway with no session reads dead too', () => {
        const w = world();
        w.flyway('wing 7', ['- [ ] #1 waits for its wing']);
        expect(w.run()).toContain('🦉🪽 clio: wing 7: dead\nflyway, parked:');
    });

    test('a flyway lists its open lines only, in its own order', () => {
        const w = world();
        w.session('🦉 clio', 'sid-m');
        w.flyway('main', [
            '- [x] #1 finished',
            '- [ ] #2 a chore',
            '- [ ] #3 ⏳ a watch — waits for: 2026-11-14',
        ]);
        const out = w.run();
        expect(out).toContain(
            'flyway:\n  - a chore\n  - ⏳ a watch — waits for: 2026-11-14',
        );
        expect(out).not.toContain('finished');
    });

    test('a pocket item that only talks about flyways is no flyway', () => {
        const w = world();
        writeFileSync(
            join(w.root, '_clio/pocket/tasks/pk-9.md'),
            "---\ntitle: 'flyways board view'\n---\n- [ ] #1 a wish\n",
        );
        expect(w.run()).not.toContain('a wish');
    });

    test('a running card sits under its runner, a card with no runner under main, an ended one nowhere', () => {
        const w = world();
        w.session('🦉 clio', 'sid-m');
        w.session('🦉🪽 clio: wing 1', 'sid-1');
        const items = [{ text: 'first' }, { text: 'second' }];
        writeFileSync(
            join(w.claude, 'shelf/lanes.json'),
            JSON.stringify({
                lanes: [
                    {
                        current: 1,
                        items,
                        members: { codie: '🔧 codie: mods' },
                        title: 'mods lane',
                    },
                    {
                        current: 0,
                        items,
                        runner: '🦉🪽 clio: wing 1',
                        title: 'git slim',
                    },
                    { current: 2, endedAt: 1, items, title: 'long over' },
                ],
            }),
        );
        const [, main = '', wing = ''] = w.run().split('\n\n');
        expect(main).toContain(
            'mods lane: step 2 of 2, second; 🔧 codie: mods',
        );
        expect(wing).toContain('git slim: step 1 of 2, first');
        expect(main + wing).not.toContain('long over');
    });

    test('sidecars and unrelated sessions hold no lane', () => {
        const w = world();
        w.session('🦉 clio', 'sid-m');
        w.session('🦉🪽 clio: wing 3', 'sid-bg', { kind: 'bg' });
        w.session('💻 cc games', 'sid-g');
        const out = w.run();
        expect(out).not.toContain('wing 3');
        expect(out).not.toContain('cc games');
    });

    test('a tree reads against main, under its seat, a fork by session id, a stray apart', () => {
        const w = world();
        w.gitRepo();
        w.session('🦉🪽 clio: wing 1', 'abcd1234-rest');
        const wing = w.addTree('clio-wing-2');
        w.addTree('fork-abcd1234');
        w.addTree('fork-00000000');
        w.session('🦉 clio (fork)', '11111111-rest');
        w.addTree('fork-11111111');
        w.addTree('verify-1');
        w.commit(w.root, 'behind.txt');
        w.commit(wing, 'ahead.txt');
        writeFileSync(join(wing, 'a.txt'), 'edited\n');
        const out = w.run();
        expect(out).toContain(
            '🦉🪽 clio: wing 2: dead\ntree clio-wing-2: 1 behind main, 1 not on main, 1 uncommitted',
        );
        expect(out).toContain(
            'alive, idle 0 min\ntree fork-abcd1234: 1 behind main',
        );
        expect(out).toContain('trees outside a seat:\n  - tree fork-00000000');
        expect(out).toContain('fork-11111111: 1 behind main, 🦉 clio (fork)');
        expect(out).not.toContain('verify-1');
    });

    test('a level tree says so', () => {
        const w = world();
        w.gitRepo();
        w.addTree('clio-wing-4');
        expect(w.run()).toContain('tree clio-wing-4: level with main, clean');
    });

    test('an untracked stray keeps a tree from reading clean', () => {
        const w = world();
        w.gitRepo();
        writeFileSync(join(w.addTree('clio-wing-4'), 'stray.txt'), 'x\n');
        expect(w.run()).toContain('tree clio-wing-4: 1 uncommitted');
    });

    test('a reused pid reads dead: alive by pid, but another process', () => {
        const w = world();
        w.session('🦉 clio', 'sid-m', {
            procStart: 'Thu Jan  1 00:00:00 1970',
        });
        expect(w.run()).toContain('🦉 clio: dead');
    });

    test('the process the registry names reads alive', () => {
        const w = world();
        const procStart = spawnSync(
            'ps',
            ['-o', 'lstart=', '-p', `${process.pid}`],
            {
                encoding: 'utf8',
                env: { ...process.env, TZ: 'UTC' },
                timeout: 10_000,
            },
        ).stdout.trim();
        w.session('🦉 clio', 'sid-m', { procStart });
        expect(w.run()).toContain('🦉 clio: alive');
    });

    test('a pocket file gone mid-read is named, and the view still prints', () => {
        const w = world();
        w.session('🦉 clio', 'sid-m');
        mkdirSync(join(w.root, '_clio/pocket/tasks/pk-gone.md'));
        const out = w.run();
        expect(out).toContain('🦉 clio: alive');
        expect(out).toContain('pk-gone.md');
    });

    test('a source it cannot read is named, not read as nothing there', () => {
        const w = world();
        w.session('🦉 clio', 'sid-m');
        writeFileSync(join(w.claude, 'shelf/lanes.json'), '{broken');
        expect(w.run()).toContain('📌 unread, so this view may miss things');
    });

    test('the start hook stays silent for a parked sidecar and prints for a clio', () => {
        const w = world();
        w.session('🎀 helga', 'sid-bg', { kind: 'bg' });
        w.session('🦉 clio', 'sid-m');
        expect(w.run(['--hook'], '{"session_id": "sid-bg"}')).toBe('');
        expect(w.run(['--hook'], '{"session_id": "sid-m"}')).toContain(
            '🦉 clio: alive',
        );
    });
});
