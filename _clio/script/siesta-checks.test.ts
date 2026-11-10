import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    mkdirSync,
    mkdtempSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const SID = 's-clio';
const CHECKS = [
    'pocket-check',
    'wish-cover',
    'close-net',
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
    gates(
        home,
        'pre-commit:\n  commands:\n    format:\n      run: true\n',
        '- **format**: tidy\n',
    );
    return home;
}

// a frame lefthook and a catalog page; bytes is left out unless a test plants it
function gates(home: string, hooks: string, page: string, repo = 'frame') {
    mkdirSync(join(home, repo), { recursive: true });
    writeFileSync(join(home, repo, 'lefthook.yaml'), hooks);
    mkdirSync(join(home, 'frame/docs/knowledge'), { recursive: true });
    writeFileSync(join(home, 'frame/docs/knowledge/gates-catalog.md'), page);
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
        {
            encoding: 'utf8',
            env: { ...process.env, HOME: home },
            timeout: 10_000,
        },
    );
}

const section = (out: string, name: string) =>
    out.split(/^## /m).find((s) => s.startsWith(name)) ?? '';

describe('siesta-checks', () => {
    test('prints one section per check, in order, each with its exit, and exits 0 when all pass', () => {
        const home = fixtureHome();
        auditVerb(home, 0, []);
        const out = run(home);
        expect(out.status).toBe(0);
        const heads = out.stdout.match(/^## .+$/gm) ?? [];
        expect(heads.map((h) => h.split(' · ')[0])).toEqual([
            '## pocket-check',
            '## wish-cover',
            '## orbit drift',
            '## close net',
            '## blueprint drift',
            '## helper count',
            '## audit-codie',
            '## gates drift',
            '## vm down',
            '## retros',
        ]);
        expect(heads.every((h) => h.endsWith('exit 0'))).toBe(true);
    });

    test('an unreadable lane dir reds the section and keeps every other section', () => {
        const home = fixtureHome();
        const lane = join(home, '.local/state/x/lanes/locked');
        mkdirSync(lane, { recursive: true });
        chmodSync(lane, 0o000);
        const out = run(home);
        chmodSync(lane, 0o700);
        expect(out.status).toBe(1);
        expect(section(out.stdout, 'retros')).toContain('unreadable: locked');
        expect(out.stdout).toContain('## helper count');
    });

    test('a pending retro names every file in the header count, and never reds the run', () => {
        const home = fixtureHome();
        const lanes = join(home, '.local/state/x/lanes');
        mkdirSync(join(lanes, 'lane-a'), { recursive: true });
        mkdirSync(join(lanes, 'lane-b'), { recursive: true });
        writeFileSync(join(lanes, 'lane-a/lane-a-codie-retro.md'), 'one\n');
        writeFileSync(
            join(lanes, 'lane-b/lane-b-sixth-sense-retro.md'),
            'two\n',
        );
        writeFileSync(join(lanes, 'lane-b/lane-plan.md'), 'not a retro\n');
        const out = run(home);
        expect(out.status).toBe(0);
        const retros = section(out.stdout, 'retros');
        expect(retros).toMatch(/· 2 pending\n/);
        expect(retros).toContain('lane-a/lane-a-codie-retro.md');
        expect(retros).toContain('lane-b/lane-b-sixth-sense-retro.md');
        expect(retros).not.toContain('lane-plan');
    });

    test('no pending retro passes, with no lanes dir at all', () => {
        const out = run(fixtureHome());
        expect(section(out.stdout, 'retros')).toContain('none pending');
    });

    test.each([
        ['pocket-check', 'pocket-check'],
        ['close-net', 'close net'],
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
        expect(out).toContain('### frame/.scratch/lane-a/spec.md');
    });

    test('the write hook’s files count too: a proposal, a review, clio’s own scratch, a linked or capitalised wish', () => {
        const home = fixtureHome();
        const write = (rel: string, text: string) => {
            const file = join(home, rel);
            mkdirSync(join(file, '..'), { recursive: true });
            writeFileSync(file, text);
            return file;
        };
        const proposal = write(
            'frame/.scratch/lane-a/grill-1-proposal.md',
            'wish: FRM-11\n',
        );
        const review = write(
            'frame/.scratch/lane-a/round-2-review.md',
            'Wish: [FRM-12](https://x)\n',
        );
        const clio = write('frame/_clio/.scratch/pk1/spec.md', 'wish: PK-13\n');
        write('frame/.scratch/lane-a/notes.md', 'wish: FRM-14\n');
        const out = section(run(home).stdout, 'wish-cover');
        expect(out).toContain(`wish-cover ran FRM-11 ${proposal}`);
        expect(out).toContain(`wish-cover ran FRM-12 ${review}`);
        expect(out).toContain(`wish-cover ran PK-13 ${clio}`);
        expect(out).not.toContain('FRM-14');
    });

    test('when every run is an outage, the header says not checked, never a bare exit 0', () => {
        const home = fixtureHome({ 'wish-cover': 2 });
        spec(home, 'lane-a', ['FRM-1']);
        const head = run(home).stdout.match(/^## wish-cover.*$/m)?.[0];
        expect(head).toBe('## wish-cover · 1 not checked');
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

    const auditVerb = (home: string, exit: number, misses: unknown[]) => {
        const bin = join(home, '.local/bin');
        mkdirSync(bin, { recursive: true });
        const data = { data: { misses, summary: 'how-you-work.md 1 of 2' } };
        writeFileSync(
            join(bin, 'x'),
            `#!/bin/sh\necho '${JSON.stringify(data)}'\nexit ${exit}\n`,
        );
        chmodSync(join(bin, 'x'), 0o755);
    };

    test('a codie audit miss reds its section and names the session', () => {
        const home = fixtureHome();
        auditVerb(home, 1, [
            { file: 'how-you-work.md', session: 'abc', why: 'no read' },
        ]);
        const out = section(run(home).stdout, 'audit-codie');
        expect(out).toMatch(/· exit 1\n/);
        expect(out).toContain('abc how-you-work.md: no read');
    });

    test('a clean codie audit stays green', () => {
        const home = fixtureHome();
        auditVerb(home, 0, []);
        expect(section(run(home).stdout, 'audit-codie')).toMatch(/· exit 0\n/);
    });

    test('a missing audit verb reads not checked, never red', () => {
        const out = section(run(fixtureHome()).stdout, 'audit-codie');
        expect(out).toMatch(/· not checked\n/);
    });

    test('gates drift names a hook the catalog page never names, in either repo shape', () => {
        const home = fixtureHome();
        gates(
            home,
            'pre-commit:\n  jobs:\n    - name: package-json-shape\n      run: true\n    - run: true\n',
            '- **format**: tidy\n',
            'projects/bytes',
        );
        const out = section(run(home).stdout, 'gates drift');
        expect(out).toMatch(/· exit 1\n/);
        expect(out).toContain(
            'projects/bytes hook package-json-shape is missing',
        );
        expect(out).not.toContain('hook format');
    });

    test('vm down reds a go run that fell back to the mac since the stamp, and only that', () => {
        const home = fixtureHome();
        mkdirSync(join(home, '.local/state/x'), { recursive: true });
        const row = (at: string, leg: string) =>
            `${at}\t1\tx-go\t200\t283\t0\tgit\tk\tclean\t${leg}\n`;
        writeFileSync(
            join(home, '.local/state/x/test-cpu-budget.log'),
            row('2026-01-01T09:00:00+0000', 'vm-down') +
                row(new Date().toISOString(), 'vm') +
                row(new Date().toISOString(), 'vm-down'),
        );
        const out = section(run(home).stdout, 'vm down');
        expect(out).toMatch(/· exit 1\n/);
        expect(out).toContain('1 go run(s) on the mac');
    });

    test('gates drift with no catalog page reads not checked, never red', () => {
        const home = fixtureHome();
        writeFileSync(join(home, 'frame/docs/knowledge/gates-catalog.md'), '');
        expect(section(run(home).stdout, 'gates drift')).toMatch(
            /· not checked\n/,
        );
    });
});
