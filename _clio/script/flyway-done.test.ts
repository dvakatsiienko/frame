import { execFileSync } from 'node:child_process';
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

import { flywayKind, flywayLines, flywaySorted } from './flyway-done.ts';

const script = path.join(import.meta.dirname, 'flyway-done.ts');
const config = path.join(import.meta.dirname, '..', 'backlog.config.yml');
// ci has no backlog cli; every local commit runs these through its gate
const hasBacklog = (process.env.PATH ?? '')
    .split(path.delimiter)
    .some((dir) => existsSync(path.join(dir, 'backlog')));

// a temp pocket holding one flyway, run through the real backlog cli
function pocketWith(lines: string[]) {
    const root = mkdtempSync(
        path.join(process.env.TMPDIR ?? '/tmp', 'flyway-'),
    );
    mkdirSync(path.join(root, 'pocket', 'tasks'), { recursive: true });
    copyFileSync(config, path.join(root, 'backlog.config.yml'));
    const file = path.join(root, 'pocket', 'tasks', 'pk-1 - flyway-wing-9.md');
    writeFileSync(
        file,
        `---\nid: PK-1\ntitle: 'flyway: wing 9'\nstatus: open\nlabels:\n  - clio-wing-9\npriority: now\ntype: task\n---\n\n## Acceptance Criteria\n<!-- AC:BEGIN -->\n${lines.map((l, i) => `- [ ] #${i + 1} ${l}`).join('\n')}\n<!-- AC:END -->\n`,
    );
    const run = (...args: string[]) =>
        execFileSync('node', [script, 'PK-1', ...args], {
            encoding: 'utf8',
            env: { ...process.env, FLYWAY_POCKET: root },
        });
    const read = () =>
        flywayLines(readFileSync(file, 'utf8')).map((l) => l.text);
    return { read, run };
}

describe('flyway-done', () => {
    test('a line takes its kind from its marker', () => {
        expect(flywayKind('⏳ a — waits for: x')).toBe('waits');
        expect(flywayKind('💤 b — later: dima 1')).toBe('later');
        expect(flywayKind('📅 c — on: 2026-11-14')).toBe('dated');
        expect(flywayKind('redraw the board')).toBe('open');
    });

    test('the sort keeps each kind in its own order', () => {
        expect(flywaySorted(['💤 c', '⏳ a', 'one', '⏳ b', 'two'])).toEqual([
            'one',
            'two',
            '⏳ a',
            '⏳ b',
            '💤 c',
        ]);
    });

    test.skipIf(!hasBacklog)('--sort rewrites the flyway in kind order', () => {
        const { read, run } = pocketWith([
            '💤 c — later: dima 1',
            '⏳ a — waits for: x',
            'one',
            '📅 d — on: 2026-11-14',
        ]);
        run('--sort');
        expect(read()).toEqual([
            'one',
            '⏳ a — waits for: x',
            '📅 d — on: 2026-11-14',
            '💤 c — later: dima 1',
        ]);
    });

    test.skipIf(!hasBacklog)(
        '--add places a new open line above the waits',
        () => {
            const { read, run } = pocketWith(['one', '💤 c — later: dima 1']);
            run('--add', 'two');
            expect(read()).toEqual(['one', 'two', '💤 c — later: dima 1']);
        },
    );

    test('lines read with their number and tick', () => {
        expect(
            flywayLines('- [x] #3 shipped\n- [ ] #4 ⏳ read — waits for: x'),
        ).toEqual([
            { done: true, n: 3, text: 'shipped' },
            { done: false, n: 4, text: '⏳ read — waits for: x' },
        ]);
    });
});
