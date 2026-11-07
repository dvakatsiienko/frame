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

import { toolchainSync } from './toolchain-sync.ts';

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
                            version: '>=26.0.0',
                        },
                    },
                    engines: { node: '>=26', pnpm: '>=11.0.0' },
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
) => ({
    install,
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
            version: '>=27.0.0',
        });
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
