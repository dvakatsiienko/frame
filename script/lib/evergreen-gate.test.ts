import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { type Exec, evergreenGate } from './evergreen-gate.ts';

const now = new Date('2026-11-04T08:00:00Z');
const old = '2026-10-20T00:00:00Z';
const young = '2026-11-03T00:00:00Z';

describe('evergreen gate', () => {
    test('a frame package behind prints its line and exits 1', async () => {
        const world = plant({
            frameOutdated: { 'style-dictionary': row('5.7.0', '5.7.1') },
            times: { 'style-dictionary': { '5.7.1': old } },
        });

        const result = await evergreenGate(world);

        expect(result.lines.join('\n')).toContain(
            'frame  style-dictionary  5.7.0 → 5.7.1',
        );
        expect(result.code).toBe(1);
    });

    test('every source current exits 0', async () => {
        const result = await evergreenGate(plant({}));

        expect(result.code).toBe(0);
    });

    test('a package named in a renovate hold prints its hold and exits 0', async () => {
        const world = plant({
            bytesOutdated: { jotai: row('2.20.0', '2.21.0') },
            renovate: {
                bytes: {
                    packageRules: [
                        {
                            description: 'jotai waits on devtools',
                            enabled: false,
                            matchPackageNames: ['jotai'],
                        },
                    ],
                },
            },
            times: { jotai: { '2.21.0': old } },
        });

        const result = await evergreenGate(world);

        expect(result.lines.join('\n')).toContain(
            'held: jotai waits on devtools',
        );
        expect(result.code).toBe(0);
    });

    test('a major behind waits for the major round and exits 0', async () => {
        const world = plant({
            bytesOutdated: { next: row('16.2.0', '17.0.0') },
            times: { next: { '17.0.0': old } },
        });

        const result = await evergreenGate(world);

        expect(result.lines.join('\n')).toContain(
            'bytes  next  16.2.0 → 17.0.0  waiting for the major round',
        );
        expect(result.code).toBe(0);
    });

    test('an npm release under 3 days old is skipped and exits 0', async () => {
        const world = plant({
            frameOutdated: { vitest: row('5.0.5', '5.0.6') },
            times: { vitest: { '5.0.6': young } },
        });

        const result = await evergreenGate(world);

        expect(result.lines.join('\n')).not.toContain('vitest');
        expect(result.code).toBe(0);
    });

    test('a go module behind past the age prints and exits 1', async () => {
        const world = plant({
            goLines: {
                xGo: 'charm.land/bubbletea/v2 v2.1.0 v2.1.1 2026-10-20 10:18:02 +0000 UTC\n',
            },
        });

        const result = await evergreenGate(world);

        expect(result.lines.join('\n')).toContain(
            'x/go  charm.land/bubbletea/v2  v2.1.0 → v2.1.1',
        );
        expect(result.code).toBe(1);
    });

    test('a go release under 3 days old is skipped', async () => {
        const world = plant({
            goLines: {
                sline: 'github.com/charmbracelet/x v0.4.0 v0.4.1 2026-11-03 10:00:00 +0000 UTC\n',
            },
        });

        const result = await evergreenGate(world);

        expect(result.code).toBe(0);
    });

    test('brew and uv rows inform and never fail the gate', async () => {
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

        expect(result.lines.join('\n')).toContain(
            'brew  ggml  0.27.0 → 0.28.0  (informs only)',
        );
        expect(result.lines.join('\n')).toContain(
            'uv  harbor  0.20.0 → 0.25.0  (informs only)',
        );
        expect(result.code).toBe(0);
    });

    test('a source that cannot be read fails the gate', async () => {
        const result = await evergreenGate(plant({ failing: 'go list' }));

        expect(result.lines.join('\n')).toContain('✖ x/go: go list exited 1');
        expect(result.code).toBe(1);
    });
});

/* fixtures */

type Row = { current: string; latest: string };

type World = {
    frameOutdated?: Record<string, Row>;
    bytesOutdated?: Record<string, Row>;
    times?: Record<string, Record<string, string>>;
    goLines?: { xGo?: string; sline?: string };
    brew?: { formulae: unknown[]; casks: unknown[] };
    uv?: string;
    renovate?: { frame?: object; bytes?: object };
    failing?: string;
};

function row(current: string, latest: string): Row {
    return { current, latest };
}

function plant(world: World) {
    const base = mkdtempSync(join(tmpdir(), 'evergreen-gate-'));
    const roots = { bytes: join(base, 'bytes'), frame: join(base, 'frame') };
    mkdirSync(join(roots.frame, 'renovate'), { recursive: true });
    mkdirSync(roots.bytes, { recursive: true });
    writeFileSync(
        join(roots.frame, 'renovate.json'),
        JSON.stringify(world.renovate?.frame ?? {}),
    );
    writeFileSync(join(roots.frame, 'renovate/default.json'), '{}');
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
            const json = JSON.stringify(rows ?? {});
            return {
                code: rows && Object.keys(rows).length ? 1 : 0,
                stdout: json,
            };
        }
        if (key === 'pnpm view')
            return {
                code: 0,
                stdout: JSON.stringify(world.times?.[args[1] ?? ''] ?? {}),
            };
        if (key === 'go list') {
            const lines = cwd.endsWith('sline')
                ? world.goLines?.sline
                : world.goLines?.xGo;
            return { code: 0, stdout: lines ?? '' };
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
