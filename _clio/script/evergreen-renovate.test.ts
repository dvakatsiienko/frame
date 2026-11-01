import { describe, expect, test } from 'vitest';

import {
    ageDays,
    changesOf,
    ciState,
    dependantNames,
    formatRow,
    gather,
    peerVerdict,
    tierOf,
} from './evergreen-renovate.ts';

const ok = {
    __typename: 'CheckRun',
    conclusion: 'SUCCESS',
    status: 'COMPLETED',
};

describe('tierOf', () => {
    test('a «<pkg>-<major>.x» branch is a major', () => {
        expect(tierOf('renovate/vitest-5.x', 'Update vitest to v5')).toBe(
            'major',
        );
    });
    test('a grouped minor reads its title', () => {
        expect(
            tierOf('renovate/minors', '🌲 evergreen: Update minors (minor)'),
        ).toBe('minor');
    });
    test('a grouped patch reads its title', () => {
        expect(
            tierOf(
                'renovate/patch-patches',
                '🌲 evergreen: Update patches (patch)',
            ),
        ).toBe('patch');
    });
});

describe('ciState', () => {
    test('all green, a skipped check included', () => {
        expect(ciState([ok, { ...ok, conclusion: 'SKIPPED' }])).toBe('green');
    });
    test('one red among greens is red', () => {
        expect(ciState([ok, { ...ok, conclusion: 'FAILURE' }])).toBe('red');
    });
    test('a check still running is pending', () => {
        expect(
            ciState([ok, { __typename: 'CheckRun', status: 'IN_PROGRESS' }]),
        ).toBe('pending');
    });
    test('a failed status context is red', () => {
        expect(
            ciState([{ __typename: 'StatusContext', state: 'FAILURE' }]),
        ).toBe('red');
    });
    test('no checks at all is none, never green', () => {
        expect(ciState([])).toBe('none');
    });
});

describe('ageDays', () => {
    test('whole days from a fixed now', () => {
        expect(
            ageDays('2026-10-28T14:23:56Z', new Date('2026-11-01T12:00:00Z')),
        ).toBe(3);
    });
});

describe('peerVerdict', () => {
    const dependants: { name: string; peers: Record<string, string> }[] = [
        { name: 'wide', peers: { vitest: '^4 || ^5' } },
        { name: 'narrow', peers: { vitest: '^4.0.0' } },
        { name: 'silent', peers: {} },
    ];
    test('names the first dependant whose range excludes the new major', () => {
        expect(peerVerdict('vitest', '5.0.5', dependants)).toBe(
            'blocked by narrow',
        );
    });
    test('passes when every range admits it', () => {
        expect(peerVerdict('vitest', '5.0.5', dependants.slice(0, 1))).toBe(
            'ok',
        );
        expect(peerVerdict('vitest', '5.0.5', dependants.slice(2))).toBe('ok');
    });
    test('an open «>=4 <6» range admits 5 and excludes 6', () => {
        const open = [{ name: 'open', peers: { vitest: '>=4 <6' } }];
        expect(peerVerdict('vitest', '5.1.0', open)).toBe('ok');
        expect(peerVerdict('vitest', '6.0.0', open)).toBe('blocked by open');
    });
});

describe('pr body and pnpm why', () => {
    test('the body table gives each package move', () => {
        const body =
            '| Package | Change |\n|---|---|\n| [@raycast/api](https://x) ([source](https://y)) | [`2.8.2` → `2.10.1`](https://z) | ![age](a) |\n| plain-pkg | `1.0.0` → `2.0.0` |';
        expect(changesOf(body)).toEqual([
            { from: '2.8.2', pkg: '@raycast/api', to: '2.10.1' },
            { from: '1.0.0', pkg: 'plain-pkg', to: '2.0.0' },
        ]);
    });
    test('dependants skip the workspace projects', () => {
        expect(
            dependantNames([
                {
                    dependents: [
                        { name: 'runner' },
                        { depField: 'devDependencies', name: 'frame' },
                    ],
                },
            ]),
        ).toEqual(['runner']);
    });
});

describe('gather, through a fixture runner', () => {
    test('a major pr gets the peer verdict and the previous major date; a grouped one does not', () => {
        const body = '| [vitest](u) | [`4.1.0` → `5.0.5`](u) |';
        const prs = [
            {
                body,
                createdAt: '2026-10-29T00:00:00Z',
                headRefName: 'renovate/vitest-5.x',
                number: 7,
                statusCheckRollup: [],
                title: 'Update vitest to v5',
            },
            {
                body: '| [zod](u) | [`4.1.0` → `4.2.0`](u) |',
                createdAt: '2026-10-30T00:00:00Z',
                headRefName: 'renovate/minors',
                number: 8,
                statusCheckRollup: [ok],
                title: 'Update minors (minor)',
            },
        ];
        const run = (cmd: string, args: string[]) => {
            if (cmd === 'gh')
                return JSON.stringify(
                    args.includes('dvakatsiienko/frame') ? prs : [],
                );
            if (cmd === 'pnpm')
                return JSON.stringify([{ dependents: [{ name: 'runner' }] }]);
            if (args.includes('peerDependencies'))
                return JSON.stringify({ vitest: '^4' });
            return JSON.stringify({ '4.0.0': '2026-05-01T10:00:00.000Z' });
        };
        const lines = gather(run, new Date('2026-11-01T00:00:00Z')).map(
            formatRow,
        );
        expect(lines).toEqual([
            'frame#7 · major · 3d · ci none · vitest 4.1.0→5.0.5 · peers blocked by runner · prev major 2026-05-01',
            'frame#8 · minor · 2d · ci green · zod 4.1.0→4.2.0',
        ]);
    });
});
