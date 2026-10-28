import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { type Exec, evergreenGate } from './evergreen-gate.ts';

const now = new Date('2026-11-04T08:00:00Z');
const old = '2026-10-20T00:00:00Z';
const young = '2026-11-03T00:00:00Z';

describe('evergreen gate', () => {
    test('a frame package behind fails the gate with its line', async () => {
        const world = plant({
            frameOutdated: { 'style-dictionary': row('5.7.0', '5.7.1') },
            times: { 'style-dictionary': { '5.7.1': old } },
        });

        const result = await evergreenGate(world);

        expect(result.lines).toContain(
            'frame  style-dictionary  5.7.0 → 5.7.1',
        );
        expect(result.code).toBe(1);
    });

    test('every source current passes the gate', async () => {
        const result = await evergreenGate(plant({}));

        expect(result.code).toBe(0);
    });

    test('a package under a renovate hold passes, its hold printed', async () => {
        const world = plant({
            bytesOutdated: { jotai: row('2.20.0', '2.21.0') },
            renovate: {
                bytes: hold({
                    description: 'jotai waits on devtools',
                    enabled: false,
                    name: 'jotai',
                }),
            },
            times: { jotai: { '2.21.0': old } },
        });

        const result = await evergreenGate(world);

        expect(result.lines).toContain(
            'bytes  jotai  2.20.0 → 2.21.0  held: jotai waits on devtools',
        );
        expect(result.code).toBe(0);
    });

    test('a hold scoped to majors leaves a minor behind', async () => {
        const world = plant({
            bytesOutdated: { jotai: row('2.20.0', '2.21.0') },
            renovate: {
                bytes: hold({
                    description: 'major only',
                    enabled: false,
                    name: 'jotai',
                    updateTypes: ['major'],
                }),
            },
            times: { jotai: { '2.21.0': old } },
        });

        const result = await evergreenGate(world);

        expect(result.code).toBe(1);
    });

    test('a bytes hold leaves the same package in frame behind', async () => {
        const world = plant({
            frameOutdated: { jotai: row('2.20.0', '2.21.0') },
            renovate: {
                bytes: hold({
                    description: 'bytes only',
                    enabled: false,
                    name: 'jotai',
                }),
            },
            times: { jotai: { '2.21.0': old } },
        });

        const result = await evergreenGate(world);

        expect(result.code).toBe(1);
    });

    test('an allowedVersions cap holds a release at the cap', async () => {
        const world = plant({
            frameOutdated: { vgpu: row('0.5.0', '0.6.0') },
            renovate: {
                frame: hold({
                    allowedVersions: '<0.6.0',
                    description: 'vgpu on 0.5',
                    name: 'vgpu',
                }),
            },
            times: { vgpu: { '0.6.0': old } },
        });

        const result = await evergreenGate(world);

        expect(result.code).toBe(0);
    });

    test('an allowedVersions cap leaves a release under the cap behind', async () => {
        const world = plant({
            frameOutdated: { vgpu: row('0.5.0', '0.5.1') },
            renovate: {
                frame: hold({
                    allowedVersions: '<0.6.0',
                    description: 'vgpu on 0.5',
                    name: 'vgpu',
                }),
            },
            times: { vgpu: { '0.5.1': old } },
        });

        const result = await evergreenGate(world);

        expect(result.code).toBe(1);
    });

    test('a major behind passes, waiting for the major round', async () => {
        const world = plant({
            bytesOutdated: { next: row('16.2.0', '17.0.0') },
            times: { next: { '17.0.0': old } },
        });

        const result = await evergreenGate(world);

        expect(result.lines).toContain(
            'bytes  next  16.2.0 → 17.0.0  waiting for the major round',
        );
        expect(result.code).toBe(0);
    });

    test('an npm release younger than the preset age is skipped', async () => {
        const world = plant({
            frameOutdated: { vitest: row('5.0.5', '5.0.6') },
            times: { vitest: { '5.0.6': young } },
        });

        const result = await evergreenGate(world);

        expect(result.lines.join('\n')).not.toContain('vitest');
        expect(result.code).toBe(0);
    });

    test('an npm release with no published time counts as behind', async () => {
        const world = plant({
            frameOutdated: { vitest: row('5.0.5', '5.0.6') },
        });

        const result = await evergreenGate(world);

        expect(result.code).toBe(1);
    });

    test('a go module behind past the age fails the gate', async () => {
        const world = plant({
            goLines: {
                xGo: 'charm.land/bubbletea/v2 v2.1.0 v2.1.1 2026-10-20 10:18:02 +0000 UTC\n',
            },
        });

        const result = await evergreenGate(world);

        expect(result.lines).toContain(
            'x/go  charm.land/bubbletea/v2  v2.1.0 → v2.1.1',
        );
        expect(result.code).toBe(1);
    });

    test('a go release younger than the preset age is skipped', async () => {
        const world = plant({
            goLines: {
                sline: 'github.com/charmbracelet/x v0.4.0 v0.4.1 2026-11-03 10:00:00 +0000 UTC\n',
            },
        });

        const result = await evergreenGate(world);

        expect(result.code).toBe(0);
    });

    test('brew and uv rows only inform', async () => {
        const world = plant({
            brew: {
                casks: [],
                formulae: [
                    {
                        current_version: '0.28.0',
                        installed_versions: ['0.27.0'],
                        name: 'ggml',
                    },
                ],
            },
            uv: 'harbor v0.20.0 [latest: 0.25.0]\n- harbor\n',
        });

        const result = await evergreenGate(world);

        expect(result.lines).toContain(
            'brew  ggml  0.27.0 → 0.28.0  (informs only)',
        );
        expect(result.lines).toContain(
            'uv  harbor  0.20.0 → 0.25.0  (informs only)',
        );
        expect(result.code).toBe(0);
    });

    test('an unreadable npm source fails the gate', async () => {
        const result = await evergreenGate(plant({ failing: 'pnpm outdated' }));

        expect(result.lines).toContain(
            '✖ frame: pnpm outdated printed no json (exit 1)',
        );
        expect(result.code).toBe(1);
    });

    test('an unreadable go source fails the gate', async () => {
        const result = await evergreenGate(plant({ failing: 'go list' }));

        expect(result.lines).toContain('✖ x/go: go list exited 1');
        expect(result.code).toBe(1);
    });

    test('an unreadable brew source only informs', async () => {
        const result = await evergreenGate(plant({ failing: 'brew outdated' }));

        expect(result.lines).toContain(
            '✖ brew: outdated printed no json (exit 1)',
        );
        expect(result.code).toBe(0);
    });
});

/* fixtures */

type Row = { current: string; latest: string };

type World = {
    brew?: { casks: unknown[]; formulae: unknown[] };
    bytesOutdated?: Record<string, Row>;
    failing?: string;
    frameOutdated?: Record<string, Row>;
    goLines?: { sline?: string; xGo?: string };
    renovate?: { bytes?: object; frame?: object };
    times?: Record<string, Record<string, string>>;
    uv?: string;
};

function row(current: string, latest: string): Row {
    return { current, latest };
}

function hold(rule: {
    allowedVersions?: string;
    description: string;
    enabled?: false;
    name: string;
    updateTypes?: string[];
}) {
    return {
        packageRules: [
            {
                allowedVersions: rule.allowedVersions,
                description: rule.description,
                enabled: rule.enabled,
                matchPackageNames: [rule.name],
                matchUpdateTypes: rule.updateTypes,
            },
        ],
    };
}

function plant(world: World) {
    const base = mkdtempSync(join(tmpdir(), 'evergreen-gate-'));
    const roots = { bytes: join(base, 'bytes'), frame: join(base, 'frame') };
    mkdirSync(join(roots.frame, 'renovate'), { recursive: true });
    mkdirSync(roots.bytes, { recursive: true });
    writeFileSync(
        join(roots.frame, 'renovate/default.json'),
        JSON.stringify({ minimumReleaseAge: '3 days' }),
    );
    writeFileSync(
        join(roots.frame, 'renovate.json'),
        JSON.stringify(world.renovate?.frame ?? {}),
    );
    writeFileSync(
        join(roots.bytes, 'renovate.json'),
        JSON.stringify(world.renovate?.bytes ?? {}),
    );

    const exec: Exec = async (cmd, args, cwd) => {
        const key = `${cmd} ${args[0]}`;
        if (world.failing === key) return { code: 1, stdout: '' };
        if (key === 'pnpm outdated') {
            const rows =
                cwd === roots.frame ? world.frameOutdated : world.bytesOutdated;
            return { code: rows ? 1 : 0, stdout: JSON.stringify(rows ?? {}) };
        }
        if (key === 'pnpm view')
            return {
                code: 0,
                stdout: JSON.stringify(world.times?.[args[1] ?? ''] ?? {}),
            };
        if (key === 'go list') {
            const goLines = cwd.endsWith('sline')
                ? world.goLines?.sline
                : world.goLines?.xGo;
            return { code: 0, stdout: goLines ?? '' };
        }
        if (key === 'brew outdated')
            return {
                code: 0,
                stdout: JSON.stringify(
                    world.brew ?? { casks: [], formulae: [] },
                ),
            };
        if (key === 'uv tool') return { code: 0, stdout: world.uv ?? '' };
        throw new Error(`unplanted command: ${cmd} ${args.join(' ')}`);
    };

    return { exec, now, roots };
}
