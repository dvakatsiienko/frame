import { execFileSync } from 'node:child_process';
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    TAIL_CAP,
    checkReport,
    flywayKind,
    flywayLines,
    flywaySorted,
    isTail,
    nextLineId,
    parkedTails,
    similarLines,
    sweepFlyway,
} from './flyway-done.ts';

const today = new Date().toLocaleDateString('sv');
const script = path.join(import.meta.dirname, 'flyway-done.ts');
const config = path.join(import.meta.dirname, '..', 'backlog.config.yml');
// ci has no backlog cli; every local commit runs these through its gate
const hasBacklog = (process.env.PATH ?? '')
    .split(path.delimiter)
    .some((dir) => existsSync(path.join(dir, 'backlog')));

// a temp pocket holding one flyway, run through the real backlog cli
function pocketWith(lines: string[], notes = '') {
    const root = mkdtempSync(
        path.join(process.env.TMPDIR ?? '/tmp', 'flyway-'),
    );
    mkdirSync(path.join(root, 'pocket', 'tasks'), { recursive: true });
    copyFileSync(config, path.join(root, 'backlog.config.yml'));
    const file = path.join(root, 'pocket', 'tasks', 'pk-1 - flyway-wing-9.md');
    writeFileSync(
        file,
        `---\nid: PK-1\ntitle: 'flyway: wing 9'\nstatus: open\nlabels:\n  - clio-wing-9\npriority: now\ntype: task\n---\n\n## Acceptance Criteria\n<!-- AC:BEGIN -->\n${lines.map((l, i) => `- [ ] #${i + 1} ${l}`).join('\n')}\n<!-- AC:END -->\n${notes ? `\n## Implementation Notes\n\n<!-- SECTION:NOTES:BEGIN -->\n${notes}\n<!-- SECTION:NOTES:END -->\n` : ''}`,
    );
    const run = (...args: string[]) =>
        execFileSync('node', [script, 'PK-1', ...args], {
            encoding: 'utf8',
            env: { ...process.env, FLYWAY_POCKET: root },
            timeout: 10_000,
        });
    const sweep = (day: string) =>
        execFileSync('node', [script, '--sweep', '--today', day], {
            encoding: 'utf8',
            env: { ...process.env, FLYWAY_POCKET: root },
            timeout: 10_000,
        });
    const read = () =>
        flywayLines(readFileSync(file, 'utf8')).map((l) => l.text);
    const archive = path.join(root, 'pocket', 'archive', 'notes', 'pk-1.md');
    return { archive, file, read, run, sweep };
}

describe('flyway-done', () => {
    test('a line takes its kind from its marker', () => {
        expect(flywayKind('⏳ a — waits for: x')).toBe('waits');
        expect(flywayKind('🦥 b — later: dima 1')).toBe('later');
        expect(flywayKind('📅 c — on: 2026-11-14')).toBe('dated');
        expect(flywayKind('redraw the board')).toBe('open');
    });

    test('the sort keeps each kind in its own order', () => {
        expect(flywaySorted(['🦥 c', '⏳ a', 'one', '⏳ b', 'two'])).toEqual([
            'one',
            'two',
            '⏳ a',
            '⏳ b',
            '🦥 c',
        ]);
    });

    test.skipIf(!hasBacklog)('--sort rewrites the flyway in kind order', () => {
        const { read, run } = pocketWith([
            '🦥 c — later: dima 1',
            '⏳ a — waits for: x',
            'one',
            '📅 d — on: 2026-11-14',
        ]);
        run('--sort');
        expect(read()).toEqual([
            `f3 one — parked: ${today}`,
            'f2 ⏳ a — waits for: x',
            'f4 📅 d — on: 2026-11-14',
            'f1 🦥 c — later: dima 1',
        ]);
    });

    test.skipIf(!hasBacklog)(
        '--add places a new open line above the waits',
        () => {
            const { read, run } = pocketWith(['one', '🦥 c — later: dima 1']);
            run('--add', 'two');
            expect(read()).toEqual([
                `f1 one — parked: ${today}`,
                `f3 two — parked: ${today}`,
                'f2 🦥 c — later: dima 1',
            ]);
        },
    );

    test.skipIf(!hasBacklog)(
        "a cleared line's id is never minted again, and a line clears by its id",
        () => {
            const { read, run } = pocketWith(['f1 one', 'f2 two', 'f3 three']);
            expect(run('f3')).toContain('PK-1 f3 → done note');
            run('--add', 'four');
            expect(read()).toEqual([
                `f1 one — parked: ${today}`,
                `f2 two — parked: ${today}`,
                `f4 four — parked: ${today}`,
            ]);
        },
    );

    test.skipIf(!hasBacklog)(
        "a flyway's cleared line goes to its archive, and its id is never minted again",
        () => {
            const { archive, file, read, run } = pocketWith(
                ['f1 one', 'f2 two', 'f3 three'],
                'kept note',
            );
            run('f3');
            expect(readFileSync(archive, 'utf8')).toMatch(
                /^# pk-1: notes moved out of the flyway, oldest first\n\ndone \d{4}-\d\d-\d\d \d\d:\d\d: f3 three\n\n$/,
            );
            expect(readFileSync(file, 'utf8')).not.toContain('done 20');
            run('--add', 'four');
            expect(read()).toContain(`f4 four — parked: ${today}`);
        },
    );

    test('the next id counts the ids an archive holds', () => {
        expect(
            nextLineId('- [ ] #1 f2 two', 'done 2026-11-25 10:00: f7 x'),
        ).toBe(8);
    });

    describe('--sweep', () => {
        const notes = [
            'PK-1:W1 (2026-11-24 10:00, dima): old wish',
            'done 2026-11-24 11:00: f1 old',
            'undated, dated by the block before',
            'PK-1:W2 (2026-11-25 09:00, dima): today wish',
        ].join('\n\n');
        const world = () => pocketWith(['f1 one'], notes);

        test('a block of an earlier day moves and the next sweep moves nothing', () => {
            const { archive, file, sweep } = world();
            expect(sweep('2026-11-25')).toBe(
                'PK-1: 3 note block(s) moved to pocket/archive/notes/pk-1.md\n',
            );
            const archived = readFileSync(archive, 'utf8');
            expect(archived).toContain('undated, dated by the block before');
            expect(readFileSync(file, 'utf8')).toContain('today wish');
            expect(readFileSync(file, 'utf8')).not.toContain('old wish');
            expect(sweep('2026-11-25')).toBe('');
            expect(readFileSync(archive, 'utf8')).toBe(archived);
        });

        test('a file written by another thread mid-way is left alone, and its blocks are not appended twice', () => {
            const { archive, file } = world();
            const before = readFileSync(file, 'utf8');
            expect(
                sweepFlyway(file, '2026-11-25', () =>
                    writeFileSync(file, `${before}\nlate note`),
                ),
            ).toBe(0);
            expect(readFileSync(file, 'utf8')).toBe(`${before}\nlate note`);
            const archived = readFileSync(archive, 'utf8');
            expect(sweepFlyway(file, '2026-11-25')).toBe(3);
            expect(readFileSync(archive, 'utf8')).toBe(archived);
            expect(readFileSync(file, 'utf8')).toContain('late note');
        });

        test('no dot-temp file stays behind', () => {
            const { file, sweep } = world();
            sweep('2026-11-25');
            expect(readdirSync(path.dirname(file))).toEqual([
                path.basename(file),
            ]);
        });
    });

    test('a kind reads past the id', () => {
        expect(flywayKind('f12 ⏳ a — waits for: x')).toBe('waits');
        expect(flywaySorted(['f1 🦥 c', 'f2 one'])).toEqual([
            'f2 one',
            'f1 🦥 c',
        ]);
    });

    describe('the tail cap', () => {
        test('a tail is an open line that is not marked as his', () => {
            expect(isTail('f1 fix the false red in the sealed check')).toBe(
                true,
            );
            expect(isTail('f2 weak spot 5, one at a time — with: dima')).toBe(
                false,
            );
            expect(isTail('f3 fix the grill opener (dima, 15:27)')).toBe(true);
            expect(isTail('f4 ⏳ a trial round — waits for: that pr')).toBe(
                false,
            );
        });
        test('only unticked tails count toward the cap', () => {
            const lines = flywayLines(
                '- [ ] #1 f1 fix a\n- [x] #2 f2 fix b\n- [ ] #3 f3 a talk — with: dima\n- [ ] #4 f4 fix c',
            );
            expect(parkedTails(lines).map((line) => line.ref)).toEqual([
                'f1',
                'f4',
            ]);
            expect(TAIL_CAP).toBe(5);
        });
    });

    describe('similarLines', () => {
        const flyways = [
            {
                id: 'PK-7',
                text: '- [ ] #1 Refresh the milestone board with the sign hash reader\n- [x] #2 refresh milestone board sign hash reader done\n- [ ] #3 unrelated lunch plan',
            },
        ];
        test('an unticked line sharing 3 long words is named', () => {
            expect(
                similarLines(
                    'milestone board refresh for FRM-12 and PK-3',
                    flyways,
                ),
            ).toEqual([
                'similar open line: PK-7 #1: Refresh the milestone board with the sign hash reader',
            ]);
        });
        test('two shared words, short words, ids and numbers do not count', () => {
            expect(
                similarLines(
                    'milestone board 2026 FRM-123 PK-7 the and',
                    flyways,
                ),
            ).toEqual([]);
        });
    });

    test('lines read with their number and tick', () => {
        expect(
            flywayLines('- [x] #3 shipped\n- [ ] #4 f7 ⏳ read — waits for: x'),
        ).toEqual([
            { done: true, n: 3, ref: '#3', text: 'shipped' },
            { done: false, n: 4, ref: 'f7', text: 'f7 ⏳ read — waits for: x' },
        ]);
    });
});

describe('flyway-done --check', () => {
    const lines = flywayLines(
        '- [ ] #1 ship FRM-1 next\n- [ ] #2 read FRM-2 after PK-3\n- [ ] #3 a chore with no id\n',
    );

    test('a line naming a closed ticket reds and counts', () => {
        const { closed, report } = checkReport(lines, [
            { id: 'FRM-1', state: 'Done' },
            { id: 'FRM-2', state: 'Todo' },
            { id: 'PK-3', state: 'open' },
        ]);
        expect(closed).toBe(1);
        expect(report[0]).toMatch(/^🔴 #1 .* → FRM-1 Done$/);
    });

    test('a line whose every id is live stays green with each state', () => {
        const { report } = checkReport(lines, [
            { id: 'FRM-1', state: 'Todo' },
            { id: 'FRM-2', state: 'Todo' },
            { id: 'PK-3', state: 'open' },
        ]);
        expect(report[1]).toBe(
            '🟢 #2 read FRM-2 after PK-3 → FRM-2 Todo, PK-3 open',
        );
    });

    test('a line naming no id asks for its own home', () => {
        const { report } = checkReport(lines, []);
        expect(report[2]).toBe(
            '⚪ #3 a chore with no id → no id: read its own home',
        );
    });
});

test('a dated read naming a closed ticket shows yellow and is not counted', () => {
    const { closed, report } = checkReport(
        flywayLines('- [ ] #1 📅 FRM-9 the week read — on: 2026-11-16\n'),
        [{ id: 'FRM-9', state: 'Done' }],
    );
    expect(closed).toBe(0);
    expect(report[0]).toMatch(/^🟡 #1 /);
});
