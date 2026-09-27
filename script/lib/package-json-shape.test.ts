import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    checkManifest,
    checkVersionAgreement,
    findManifestPaths,
    isExactVersion,
    readWorkspaceGlobs,
    scriptSection,
    sortScriptNames,
} from '../../home/.claude/plugin-x/lib/package-json-shape.ts';

describe('the rules', () => {
    it('reads the scripts block as the engineering loop, not the alphabet', () => {
        expect(
            sortScriptNames([
                'format',
                'typecheck',
                'build:web',
                'check',
                'lint',
                'trophies',
                'dev',
                'test',
                'build',
                'postinstall',
                'preview',
                'dev:api',
            ]),
        ).toEqual([
            'dev',
            'dev:api',
            'build',
            'build:web',
            'preview',
            'trophies',
            'postinstall',
            'lint',
            'typecheck',
            'test',
            'check',
            'format',
        ]);
    });

    it('classifies an unknown script into the domain zone, never an end', () => {
        expect(scriptSection('trophies')).toBe('domain');
        expect(scriptSection('convex:seed')).toBe('domain');
        expect(scriptSection('dev:convex')).toBe('dev');
        expect(scriptSection('build:api')).toBe('build');
        expect(scriptSection('postinstall')).toBe('lifecycle');
        expect(scriptSection('typecheck')).toBe('service');
    });

    it('accepts pnpm protocols and exact pins, rejects ranges', () => {
        expect(isExactVersion('workspace:*')).toBe(true);
        expect(isExactVersion('1.0.0-beta.9')).toBe(true);
        expect(isExactVersion('19.2.8')).toBe(true);
        expect(isExactVersion('^19.2.8')).toBe(false);
        expect(isExactVersion('~19.2.8')).toBe(false);
        expect(isExactVersion('>=2.4.6')).toBe(false);
        expect(isExactVersion('latest')).toBe(false);
    });

    it('reports a randomly printed manifest', () => {
        expect(
            checkManifest({
                dependencies: { react: '^19.2.8' },
                scripts: { build: 'x', dev: 'x' },
            }),
        ).toEqual([
            'root keys out of order — expected scripts, dependencies',
            'scripts out of order — expected dev, build',
            'dependencies.react is "^19.2.8" — pins are exact',
        ]);
    });

    it('exempts peerDependencies from the exact-pin rule', () => {
        expect(
            checkManifest({ peerDependencies: { prettier: '>=3.0.0' } }),
        ).toEqual([]);
    });
});

describe('finding the manifests', () => {
    it('reads only the packages: block of a pnpm workspace', () => {
        const root = fixture({
            'pnpm-workspace.yaml': [
                'packages:',
                '  - apps/*',
                "  - 'home/.claude/mcp-x-cw'",
                '  - "!apps/ignored"',
                '',
                'minimumReleaseAgeExclude:',
                '  - biome-config-polished',
                '',
            ].join('\n'),
        });

        // The exclude list holds a package NAME, not a path. Reading every "- "
        // line would swallow it and look for a package.json that never existed.
        expect(readWorkspaceGlobs(root)).toEqual([
            'apps/*',
            'home/.claude/mcp-x-cw',
        ]);
    });

    it('fans out dir/* and takes an exact path as written', () => {
        const root = fixture({
            'apps/alpha/package.json': '{}',
            'apps/beta/package.json': '{}',
            // a directory under the glob with no manifest is not a package
            'apps/gamma/README.md': 'x',
            'deep/nested/one/package.json': '{}',
            'package.json': '{}',
            'pnpm-workspace.yaml':
                'packages:\n  - apps/*\n  - deep/nested/one\n',
        });

        expect(findManifestPaths(root)).toEqual([
            'apps/alpha/package.json',
            'apps/beta/package.json',
            'deep/nested/one/package.json',
            'package.json',
        ]);
    });

    it('treats a repo with no workspace file as a single package', () => {
        const root = fixture({ 'package.json': '{}' });
        expect(findManifestPaths(root)).toEqual(['package.json']);
    });
});

describe('the bin', () => {
    // The bin lives outside tsconfig's include, so nothing else would notice if
    // its relative import into this directory rotted.
    const bin = join(
        import.meta.dirname,
        '../../home/.claude/plugin-x/bin/package-json-shape',
    );

    // Written as raw JSON, never an object literal: biome's sortKeys would
    // alphabetise the literal, and key order is exactly what is under test.
    it('passes a clean workspace and says what it checked', () => {
        const root = fixture({
            'package.json':
                '{"name":"clean","version":"1.0.0",' +
                '"scripts":{"dev":"x","build":"x","lint":"x"},' +
                '"dependencies":{"react":"19.2.8"}}',
        });

        expect(execFileSync(bin, [root], { encoding: 'utf8' })).toContain(
            '1 manifest on the convention shape',
        );
    });

    it('exits non-zero and names the offender', () => {
        const root = fixture({
            'package.json':
                '{"name":"drifted","version":"1.0.0",' +
                '"scripts":{"build":"x","dev":"x"}}',
        });

        let stderr = '';
        let code = 0;
        try {
            execFileSync(bin, [root], { encoding: 'utf8', stdio: 'pipe' });
        } catch (error) {
            const failure = error as { status: number; stderr: string };
            code = failure.status;
            stderr = failure.stderr;
        }

        expect(code).toBe(1);
        expect(stderr).toContain('scripts out of order');
        expect(stderr).toContain('1 of 1 manifest off the convention shape');
    });
});

describe('one version per name', () => {
    const twoPins = [
        {
            manifest: { devDependencies: { vite: '8.2.2' } },
            path: 'apps/a/package.json',
        },
        {
            manifest: { dependencies: { vite: '8.1.0' } },
            path: 'apps/b/package.json',
        },
    ];

    it('reports a name pinned to two versions, and says where each lives', () => {
        const problems = checkVersionAgreement(twoPins);

        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain('vite');
        expect(problems[0]).toContain('8.2.2');
        expect(problems[0]).toContain('8.1.0');
        expect(problems[0]).toContain('apps/a/package.json');
        expect(problems[0]).toContain('apps/b/package.json');
    });

    it('says nothing when a name is declared many times at one version', () => {
        expect(
            checkVersionAgreement([
                {
                    manifest: { devDependencies: { vite: '8.2.2' } },
                    path: 'apps/a/package.json',
                },
                {
                    manifest: { dependencies: { vite: '8.2.2' } },
                    path: 'apps/b/package.json',
                },
                {
                    manifest: { devDependencies: { vite: '8.2.2' } },
                    path: 'apps/c/package.json',
                },
            ]),
        ).toEqual([]);
    });

    // ? A protocol is not a version — `workspace:*` beside a pin is the normal
    // ? shape for a package consumed both ways, not a disagreement.
    it('ignores pnpm protocols', () => {
        expect(
            checkVersionAgreement([
                {
                    manifest: { devDependencies: { kit: 'workspace:*' } },
                    path: 'a/package.json',
                },
                {
                    manifest: { dependencies: { kit: '1.0.0' } },
                    path: 'b/package.json',
                },
            ]),
        ).toEqual([]);
    });

    // ? The hook narrows to staged manifests so an unrelated drift never blocks a
    // ? commit. Agreement can only be judged across the whole set, so the compare
    // ? stays repo-wide and only the REPORTING narrows.
    it('when narrowed, reports only names the named manifests take part in', () => {
        const manifests = [
            ...twoPins,
            {
                manifest: { devDependencies: { zod: '4.0.0' } },
                path: 'apps/c/package.json',
            },
            {
                manifest: { devDependencies: { zod: '3.0.0' } },
                path: 'apps/d/package.json',
            },
        ];

        expect(
            checkVersionAgreement(manifests, ['apps/a/package.json']),
        ).toHaveLength(1);
        expect(
            checkVersionAgreement(manifests, ['apps/a/package.json'])[0],
        ).toContain('vite');
        expect(
            checkVersionAgreement(manifests, ['apps/c/package.json'])[0],
        ).toContain('zod');
        expect(
            checkVersionAgreement(manifests, ['apps/e/package.json']),
        ).toEqual([]);
    });
});

/* Helpers */
function fixture(files: Record<string, string>) {
    const root = mkdtempSync(join(tmpdir(), 'pkg-shape-'));

    for (const [rel, body] of Object.entries(files)) {
        const path = join(root, rel);
        mkdirSync(join(path, '..'), { recursive: true });
        writeFileSync(path, body);
    }

    return root;
}
