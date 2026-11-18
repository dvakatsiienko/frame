import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type Deps, parseFnmList, toolchainSync } from './toolchain-sync.ts';

const apps = ['cv', 'financial', 'trophy-sys'];
let root = '';
let frame = '';
let bytes = '';

const write = (file: string, text: string) => {
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, text);
};

// both repos pinned at node 26, pnpm 11.0.0
beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'toolchain-sync-'));
    frame = join(root, 'frame');
    bytes = join(root, 'bytes');
    for (const repo of [frame, bytes]) {
        write(join(repo, '.node-version'), '26\n');
        write(
            join(repo, 'package.json'),
            `${JSON.stringify(
                {
                    devEngines: {
                        runtime: {
                            name: 'node',
                            onFail: 'error',
                            version: '>=26.13.1',
                        },
                    },
                    engines: { node: '>=26.13.1', pnpm: '>=11.0.0' },
                    name: 'fixture',
                    packageManager: 'pnpm@11.0.0',
                },
                null,
                2,
            )}\n`,
        );
    }
    write(
        join(bytes, 'apps/trophy-sys/package.json'),
        '{\n  "scripts": {\n    "build:api": "esbuild a.ts --target=node26 --outfile=b.js"\n  }\n}\n',
    );
    write(
        join(bytes, 'apps/trophy-sys/script/vercel-output.ts'),
        "const FUNCTION_CONFIG = {\n  runtime: 'nodejs26.x',\n};\n",
    );
    for (const app of apps)
        write(join(bytes, 'apps', app, 'vercel.json'), '{}');
    vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { force: true, recursive: true });
});

const deps = (
    nodeMajor: string,
    readVercel: () => Record<string, string>,
    install = vi.fn(),
    fnm: Deps['fnm'] = {
        current: 'v26.13.1',
        installed: () => ({ default: 'v26.13.1', versions: ['v26.13.1'] }),
        uninstall: vi.fn(),
    },
) => ({
    fnm,
    install,
    nodeInstalled: `${nodeMajor}.13.1`,
    nodeMajor,
    pnpmVersion: '11.0.0',
    readVercel,
    repos: [frame, bytes],
});
const allOn = (major: string) =>
    Object.fromEntries(apps.map((app) => [app, `${major}.x`]));
const read = (file: string) => readFileSync(join(bytes, file), 'utf8');

describe('sync', () => {
    it('writes devEngines.runtime and both trophy-sys pins at the new major', () => {
        const install = vi.fn();
        const code = toolchainSync(
            false,
            deps('27', () => allOn('27'), install),
        );

        expect(code).toBe(0);
        const manifest = JSON.parse(read('package.json'));
        expect(manifest.devEngines.runtime).toEqual({
            name: 'node',
            onFail: 'error',
            version: '>=27.13.1',
        });
        expect(manifest.engines.node).toBe('>=27.13.1');
        expect(Object.keys(manifest)).toEqual([
            'name',
            'engines',
            'devEngines',
            'packageManager',
        ]);
        expect(read('apps/trophy-sys/package.json')).toContain(
            '--target=node27 ',
        );
        expect(read('apps/trophy-sys/script/vercel-output.ts')).toContain(
            "runtime: 'nodejs27.x'",
        );
        expect(read('.node-version')).toBe('27\n');
        expect(install).toHaveBeenCalledTimes(2);
    });
});

describe('--check', () => {
    it('exits 1 naming a vercel project on the old major', () => {
        const code = toolchainSync(
            true,
            deps('26', () => ({ ...allOn('26'), financial: '22.x' })),
        );

        expect(code).toBe(1);
        expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('vercel financial: 22.x → 26.x'),
        );
    });

    it('exits 0 with every project on the new major', () => {
        expect(
            toolchainSync(
                true,
                deps('26', () => allOn('26')),
            ),
        ).toBe(0);
    });

    it('reads a failed vercel call red, naming each project', () => {
        const code = toolchainSync(
            true,
            deps('26', () => {
                throw new Error('not logged in');
            }),
        );

        expect(code).toBe(1);
        for (const app of apps)
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining(`vercel ${app}: read failed`),
            );
    });

    it('reports a project vercel does not list', () => {
        const { cv: _cv, ...rest } = allOn('26');

        expect(
            toolchainSync(
                true,
                deps('26', () => rest),
            ),
        ).toBe(1);
        expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('vercel cv: not listed'),
        );
    });

    it('reports either trophy-sys pin and devEngines on another major as drift', () => {
        const code = toolchainSync(
            true,
            deps('27', () => allOn('27')),
        );

        expect(code).toBe(1);
        for (const part of [
            'devEngines.runtime.version',
            'apps/trophy-sys/package.json',
            'apps/trophy-sys/script/vercel-output.ts',
        ])
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining(part),
            );
    });
});

describe('prune old fnm nodes', () => {
    const fnm = (
        uninstall: Deps['fnm']['uninstall'],
        current = 'v26.13.1',
    ): Deps['fnm'] => ({
        current,
        installed: () => ({
            default: 'v26.13.1',
            versions: ['v22.23.1', 'v26.13.0', 'v26.13.1'],
        }),
        uninstall,
    });

    it('the write path uninstalls every version but the default, --check only says it would', () => {
        const uninstall = vi.fn();

        toolchainSync(
            true,
            deps('26', () => allOn('26'), vi.fn(), fnm(uninstall)),
        );
        expect(uninstall).not.toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('would remove v22.23.1'),
        );

        toolchainSync(
            false,
            deps('26', () => allOn('26'), vi.fn(), fnm(uninstall)),
        );
        expect(uninstall.mock.calls).toEqual([['v22.23.1'], ['v26.13.0']]);
    });

    it('removes nothing when no installed version is the default', () => {
        const uninstall = vi.fn();
        const noDefault: Deps['fnm'] = {
            current: 'v26.13.1',
            installed: () => ({
                default: '',
                versions: ['v22.23.1', 'v26.13.0'],
            }),
            uninstall,
        };

        toolchainSync(
            false,
            deps('26', () => allOn('26'), vi.fn(), noDefault),
        );

        expect(uninstall).not.toHaveBeenCalled();
    });

    it('keeps the node it runs on and pinned, which is not the default', () => {
        const uninstall = vi.fn();

        toolchainSync(
            false,
            deps('26', () => allOn('26'), vi.fn(), fnm(uninstall, 'v26.13.0')),
        );

        expect(uninstall.mock.calls).toEqual([['v22.23.1']]);
    });

    it('warns on a failed uninstall, goes on to the next one and still exits 0', () => {
        const uninstall = vi.fn((version: string) => {
            if (version === 'v22.23.1') throw new Error('EBUSY');
        });
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        const code = toolchainSync(
            false,
            deps('26', () => allOn('26'), vi.fn(), fnm(uninstall)),
        );

        expect([code, uninstall.mock.calls]).toEqual([
            0,
            [['v22.23.1'], ['v26.13.0']],
        ]);
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('could not remove v22.23.1'),
        );
    });

    it('says so when no default is named, and removes nothing', () => {
        toolchainSync(
            false,
            deps('26', () => allOn('26'), vi.fn(), {
                current: 'v26.13.1',
                installed: () => ({ default: '', versions: ['v22.23.1'] }),
                uninstall: vi.fn(),
            }),
        );

        expect(console.log).toHaveBeenCalledWith(
            'fnm: no default, nothing removed',
        );
    });
});

describe('parseFnmList reads fnm list as it prints it', () => {
    it.each([
        ['* system\n', { default: '', versions: [] }],
        [
            '* v22.23.1\n* v26.13.1 default\n* system\n',
            { default: 'v26.13.1', versions: ['v22.23.1', 'v26.13.1'] },
        ],
        [
            '* v26.13.1 lts-latest, default\n* system\n',
            { default: 'v26.13.1', versions: ['v26.13.1'] },
        ],
        ['* v24.12.0\n', { default: '', versions: ['v24.12.0'] }],
        ['', { default: '', versions: [] }],
    ])('%j', (text, want) => {
        expect(parseFnmList(text)).toEqual(want);
    });
});
