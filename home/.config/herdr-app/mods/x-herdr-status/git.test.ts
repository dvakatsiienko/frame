import { beforeEach, describe, expect, test, vi } from 'vitest';

type Answer = { code?: number; stderr?: string; stdout?: string };
const herdr = vi.hoisted(() => ({
    answer: (_line: string): unknown => ({ code: 1 }),
    panes: [] as unknown[],
    ran: [] as string[],
}));
vi.mock('os', () => ({ default: { platform: () => 'darwin' } }));
vi.mock('herdr', () => ({
    appHome: () => '/app',
    exec: async (cmd: string, args: string[]) => {
        const line = [cmd, ...args].join(' ');
        herdr.ran.push(line);
        return {
            code: 0,
            stderr: '',
            stdout: '',
            ...(herdr.answer(line) as object),
        };
    },
    panes: () => herdr.panes,
}));

const { baseName, branchInfo, gitStatus, prsFor, syncRepo } = await import(
    './git.js'
);

/** each command that holds a key answers with it, the first match; any other fails */
const answers = (map: Record<string, Answer>) => {
    herdr.answer = (line) =>
        Object.entries(map).find(([part]) => line.includes(part))?.[1] ?? {
            code: 1,
            stderr: 'refused',
        };
};

beforeEach(() => {
    herdr.ran.length = 0;
    herdr.panes = [];
});

test('a folder’s name is its last part, dots resolved', () => {
    expect(baseName('/Users/me/frame/../bytes/./')).toBe('bytes');
});

describe('a repo’s status', () => {
    test('its branch, upstream, ahead and behind, and every changed file', async () => {
        answers({
            status: {
                stdout: '# branch.oid abc123\n# branch.head main\n# branch.upstream origin/main\n# branch.ab +2 -13\n1 .M N... a.js\n? new.txt\n\n',
            },
        });
        expect(await gitStatus('/r')).toEqual({
            ahead: 2,
            behind: 13,
            branch: 'main',
            dirty: 2,
            oid: 'abc123',
            upstream: 'origin/main',
        });
    });

    test('a branch with no upstream reads 0 and 0', async () => {
        answers({ status: { stdout: '# branch.head lane\n' } });
        expect(await gitStatus('/r')).toMatchObject({
            ahead: 0,
            behind: 0,
            upstream: null,
        });
    });

    test('a folder that is no repo, or a mac with no git, has none', async () => {
        answers({});
        expect(await gitStatus('/r')).toBeNull();
        herdr.answer = () => {
            throw new Error('no git');
        };
        expect(await gitStatus('/r')).toBeNull();
    });
});

describe('a sync', () => {
    const fine = {
        '--abbrev-ref': { stdout: 'origin/main\n' },
        fetch: {},
        pull: {},
        'rev-list': { stdout: '1\n' },
    };

    test('says how many commits it pulled, or that it is up to date', async () => {
        let head = 'a';
        answers(fine);
        const rest = herdr.answer;
        herdr.answer = (line) => {
            if (line.includes('pull')) head = 'b';
            return line === 'git rev-parse HEAD'
                ? { stdout: head }
                : rest(line);
        };
        expect(await syncRepo('/Users/me/frame')).toEqual({
            body: 'frame · origin/main',
            ok: true,
            title: 'Pulled 1 commit',
        });
        expect((await syncRepo('/Users/me/frame')).title).toBe('Up to date');
    });

    test('a refused fetch or pull says git’s last lines, a pull never after a failed fetch', async () => {
        answers({ 'rev-parse HEAD': { stdout: 'a' } });
        expect(await syncRepo('/r')).toEqual({
            body: 'refused',
            ok: false,
            title: "Couldn't fetch",
        });
        expect(herdr.ran.some((l) => l.includes('pull'))).toBe(false);
        answers({
            ...fine,
            pull: { code: 1, stderr: '1\n2\n3\nNot possible to fast-forward' },
        });
        expect(await syncRepo('/r')).toEqual({
            body: '2\n3\nNot possible to fast-forward',
            ok: false,
            title: "Couldn't pull",
        });
    });

    test('a branch with no upstream is fetched only', async () => {
        answers({ fetch: {} });
        expect(await syncRepo('/r')).toEqual({
            body: 'r: no upstream branch to pull from',
            ok: true,
            title: 'Fetched',
        });
    });
});

describe('the pr of a branch', () => {
    // the origin is read once a folder, so each row has its own
    const github = (folder: string, pr: object | null) =>
        answers({
            'gh pr view': pr ? { stdout: JSON.stringify(pr) } : { code: 1 },
            'remote get-url': { stdout: `git@github.com:me/${folder}.git` },
        });
    const open = {
        headRefOid: 'abc',
        isDraft: false,
        number: 7,
        state: 'OPEN',
        title: 't',
        url: 'u',
    };
    const at = (folder: string, branch = 'lane', oid = 'abc') => [
        { branch, folder, oid },
    ];

    test('an open one, wherever the branch stands', async () => {
        github('/a', open);
        expect((await prsFor(at('/a', 'lane', 'zzz')))['/a|lane']?.pr).toEqual(
            expect.objectContaining({ head: 'abc', number: 7 }),
        );
    });

    test('a merged one only while the branch is still at its last commit', async () => {
        github('/b', { ...open, state: 'MERGED' });
        expect((await prsFor(at('/b')))['/b|lane']?.pr?.number).toBe(7);
        expect((await prsFor(at('/b', 'lane', 'new')))['/b|lane']?.pr).toBe(
            null,
        );
    });

    test('none for a branch with no pr, a detached head or a forge it does not know', async () => {
        github('/c', null);
        expect(await prsFor(at('/c'))).toEqual({ '/c|lane': { pr: null } });
        herdr.ran.length = 0;
        expect(await prsFor(at('/c', '(detached)'))).toEqual({
            '/c|(detached)': { pr: null },
        });
        expect(herdr.ran).toEqual([]);
        answers({ 'remote get-url': { stdout: 'git@codeberg.org:me/d.git' } });
        expect(await prsFor(at('/d'))).toEqual({ '/d|lane': { pr: null } });
        expect(herdr.ran.some((l) => l.startsWith('gh'))).toBe(false);
    });
});

describe('a repo’s page', () => {
    test('its branches, the current one marked, its changes and the agents inside it', async () => {
        answers({
            'for-each-ref': {
                stdout: '*|main|2 hours ago\n |lane|3 days ago\n',
            },
            'rev-parse --show-toplevel': { stdout: '/Users/me/frame\n' },
            status: { stdout: ' M a.js\n?? b\n' },
        });
        herdr.panes = [
            { cwd: '/Users/me/frame/x', status: 'working' },
            { cwd: '/Users/me/frame', status: 'idle' },
            { cwd: '/Users/me/frame-two', status: 'idle' },
            { cwd: '/Users/me/frame', status: null },
        ];
        expect(await branchInfo('/Users/me/frame/x')).toEqual({
            agentsHere: 2,
            branches: [
                { current: true, name: 'main', when: '2 hours ago' },
                { current: false, name: 'lane', when: '3 days ago' },
            ],
            dirty: 2,
            root: '/Users/me/frame',
        });
    });

    test('none for a folder that is no repo', async () => {
        answers({});
        expect(await branchInfo('/r')).toBeNull();
    });
});
