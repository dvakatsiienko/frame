import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const SID = 's-clio';
const CHECKS = [
    'pocket-check',
    'wish-cover',
    'blueprint-drift',
    'helper-count',
];

// a fixture HOME whose frame/_clio/script holds stubs: each prints its args and exits with the code it is given
function fixtureHome(exits: Partial<Record<string, number>> = {}) {
    const home = mkdtempSync(join(tmpdir(), 'siesta-checks-'));
    const scripts = join(home, 'frame/_clio/script');
    mkdirSync(scripts, { recursive: true });
    for (const name of CHECKS)
        writeFileSync(
            join(scripts, `${name}.ts`),
            `console.log('${name} ran', process.argv.slice(2).join(' '));\nprocess.exit(${exits[name] ?? 0});\n`,
        );
    mkdirSync(join(home, '.local/state/clio'), { recursive: true });
    writeFileSync(
        join(home, '.local/state/clio/main-session'),
        `pid=1\nsession=${SID}\n`,
    );
    mkdirSync(join(home, 'frame/_clio/pocket/tasks'), { recursive: true });
    return home;
}

function spec(
    home: string,
    feature: string,
    wishes: string[],
    at = new Date(),
) {
    const dir = join(home, 'frame/.scratch', feature);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'spec.md');
    writeFileSync(file, wishes.map((w) => `## x\n\nwish: ${w}\n`).join('\n'));
    utimesSync(file, at, at);
    return file;
}

function pocket(home: string, id: string, status: string, dir = 'tasks') {
    const folder = join(home, 'frame/_clio/pocket', dir);
    mkdirSync(folder, { recursive: true });
    writeFileSync(
        join(folder, `${id.toLowerCase()} - an item.md`),
        `---\nid: ${id}\nstatus: ${status}\n---\n`,
    );
}

function asks(home: string, texts: string[]) {
    const dir = join(home, '.claude/plugins/store');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
        join(dir, 'x-mod-stash_inline-0000.json'),
        JSON.stringify({
            [`asks:${SID}`]: {
                items: texts.map((text, i) => ({
                    id: `o${i + 1}`,
                    pick: 'y',
                    text,
                })),
            },
        }),
    );
}

function run(home: string, since = '00:00') {
    return spawnSync(
        'node',
        [join(import.meta.dirname, 'siesta-checks.ts'), '--since', since],
        { encoding: 'utf8', env: { ...process.env, HOME: home } },
    );
}

const section = (out: string, name: string) =>
    out.split(/^## /m).find((s) => s.startsWith(name)) ?? '';

describe('siesta-checks', () => {
    test('prints one section per check, in order, each with its exit, and exits 0 when all pass', () => {
        const home = fixtureHome();
        const out = run(home);
        expect(out.status).toBe(0);
        const heads = out.stdout.match(/^## .+$/gm) ?? [];
        expect(heads.map((h) => h.split(' · ')[0])).toEqual([
            '## pocket-check',
            '## wish-cover',
            '## orbit drift',
            '## blueprint drift',
            '## helper count',
        ]);
        expect(heads.every((h) => h.endsWith('exit 0'))).toBe(true);
    });

    test.each([
        ['pocket-check', 'pocket-check'],
        ['blueprint-drift', 'blueprint drift'],
        ['helper-count', 'helper count'],
    ])('a red %s reds its section and the run', (script, name) => {
        const home = fixtureHome({ [script]: 1 });
        const out = run(home);
        expect(out.status).toBe(1);
        expect(section(out.stdout, name)).toMatch(/· exit 1\n/);
        expect(section(out.stdout, name)).toContain(`${script} ran`);
    });

    test('blueprint drift and the helper count get the window, pocket-check runs whole', () => {
        const home = fixtureHome();
        const out = run(home, '14:30').stdout;
        expect(section(out, 'blueprint drift')).toContain(
            'blueprint-drift ran --since 14:30',
        );
        expect(section(out, 'helper count')).toContain(
            'helper-count ran --since 14:30',
        );
        expect(section(out, 'pocket-check')).not.toContain('--since');
    });

    test('wish-cover runs each wish of every spec changed in the window, against that spec', () => {
        const home = fixtureHome();
        const file = spec(home, 'lane-a', ['FRM-1', 'FRM-2']);
        spec(home, 'lane-old', ['FRM-9'], new Date('2026-01-01T10:00:00'));
        const out = section(run(home).stdout, 'wish-cover');
        expect(out).toContain(`wish-cover ran FRM-1 ${file}`);
        expect(out).toContain(`wish-cover ran FRM-2 ${file}`);
        expect(out).not.toContain('FRM-9');
    });

    test('a full stamp opens the window on its own day, so a siesta before midnight still counts', () => {
        const home = fixtureHome();
        const yesterday = new Date(Date.now() - 86_400_000);
        spec(home, 'lane-a', ['FRM-1'], new Date(yesterday.getTime() + 60_000));
        const stamp = yesterday.toLocaleString('sv').replace(' ', 'T');
        const out = run(home, stamp).stdout;
        expect(section(out, 'wish-cover')).toContain('wish-cover ran FRM-1');
        expect(section(out, 'helper count')).toContain(`--since ${stamp}`);
    });

    test('every id on a wish line runs, and each run names its spec', () => {
        const home = fixtureHome();
        const file = spec(home, 'lane-a', ['PK-219 …, and FRM-401, FRM-403']);
        const out = section(run(home).stdout, 'wish-cover');
        for (const id of ['PK-219', 'FRM-401', 'FRM-403'])
            expect(out).toContain(`wish-cover ran ${id} ${file}`);
        expect(out).toContain('### lane-a');
    });

    test('a ticket named twice in a spec runs once', () => {
        const home = fixtureHome();
        spec(home, 'lane-a', ['FRM-1', 'FRM-2', 'FRM-1']);
        const out = section(run(home).stdout, 'wish-cover');
        expect(out.match(/wish-cover ran FRM-1 /g)).toHaveLength(1);
    });

    test('a wish-cover that cannot reach the tracker is not checked, never red', () => {
        const home = fixtureHome({ 'wish-cover': 2 });
        spec(home, 'lane-a', ['FRM-1']);
        const out = run(home);
        expect(out.status).toBe(0);
        expect(section(out.stdout, 'wish-cover')).toContain('not checked');
    });

    test('a long output names the lines it cut', () => {
        const home = fixtureHome();
        writeFileSync(
            join(home, 'frame/_clio/script/pocket-check.ts'),
            "for (let i = 0; i < 60; i++) console.log('🔴 problem', i);\nprocess.exit(1);\n",
        );
        const out = section(run(home).stdout, 'pocket-check');
        expect(out).toContain('lines cut');
        expect(out).toContain('problem 59');
    });

    test('a wish-cover red reds its section and the run', () => {
        const home = fixtureHome({ 'wish-cover': 1 });
        spec(home, 'lane-a', ['FRM-1']);
        const out = run(home);
        expect(out.status).toBe(1);
        expect(section(out.stdout, 'wish-cover')).toMatch(/· exit 1\n/);
    });

    test('orbit drift names an open ask whose pocket item is already done', () => {
        const home = fixtureHome();
        pocket(home, 'PK-1', 'done');
        pocket(home, 'PK-2', 'open');
        pocket(home, 'PK-3', 'open', 'completed');
        asks(home, [
            'close PK-1 now?',
            'PK-2 next?',
            'archive PK-3?',
            'no item here',
        ]);
        const out = run(home);
        expect(out.status).toBe(1);
        const drift = section(out.stdout, 'orbit drift');
        expect(drift).toMatch(/· exit 1\n/);
        expect(drift).toContain('o1');
        expect(drift).toContain('o3');
        expect(drift).not.toContain('o2');
    });

    test('orbit drift passes when every ask’s item is open', () => {
        const home = fixtureHome();
        pocket(home, 'PK-2', 'open');
        asks(home, ['PK-2 next?']);
        expect(section(run(home).stdout, 'orbit drift')).toMatch(/· exit 0\n/);
    });
});
