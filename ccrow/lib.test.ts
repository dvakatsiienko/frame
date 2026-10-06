import {
    mkdtempSync,
    readFileSync,
    readdirSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    buildPacket,
    readLines,
    resolveLeaves,
    transcriptDelta,
} from './lib.ts';

const fixtures = join(import.meta.dirname, 'fixtures');
const leavesDir = join(fixtures, 'leaves');
const lines = readLines(join(fixtures, 'transcript.jsonl'));

describe('transcriptDelta', () => {
    test('keeps dima, peer and cclio text from the offset on', () => {
        expect(transcriptDelta(lines, 2).text).toBe(
            [
                '## dima\nship the ccrow build',
                '## cclio\non it',
                '## peer\ncoder: done, pr #9',
                '## cclio\ndone, all green',
            ].join('\n\n'),
        );
    });

    test('counts one step per assistant message id', () => {
        expect(transcriptDelta(lines, 2).steps).toBe(2);
    });
});

describe('readLines', () => {
    test('leaves out a last line that has no newline yet', () => {
        const path = join(mkdtempSync(join(tmpdir(), 'ccrow-')), 't.jsonl');
        writeFileSync(path, '{"a":1}\n{"b":');
        expect(readLines(path)).toEqual(['{"a":1}']);
    });
});

describe('resolveLeaves', () => {
    test('expands {today} into every match of the day', () => {
        const { found } = resolveLeaves(
            [`${leavesDir}/flawlog/{today}-*.md`],
            '2026-10-06',
        );
        expect(found.map((path) => path.split('/').at(-1))).toEqual([
            '2026-10-06-a.md',
            '2026-10-06-b.md',
        ]);
    });

    test('takes only the newest match for a latest line', () => {
        const dir = mkdtempSync(join(tmpdir(), 'ccrow-'));
        for (const [name, time] of [
            ['old.md', 1000],
            ['new.md', 2000],
        ] as const) {
            writeFileSync(join(dir, name), name);
            utimesSync(join(dir, name), time, time);
        }
        const { found } = resolveLeaves([`latest ${dir}/*.md`], '2026-10-06');
        expect(found.map((path) => path.split('/').at(-1))).toEqual(['new.md']);
    });

    test('reports a line with no match', () => {
        const { missing } = resolveLeaves(
            [`${leavesDir}/nope.md`],
            '2026-10-06',
        );
        expect(missing).toEqual([`${leavesDir}/nope.md`]);
    });
});

describe('buildPacket', () => {
    test('copies each leaf beside a delta file', () => {
        const dir = join(mkdtempSync(join(tmpdir(), 'ccrow-')), 'packet');
        buildPacket({
            deltaText: '## dima\nhi',
            dir,
            leaves: [join(leavesDir, 'strategy.md')],
            missing: [],
        });
        expect(readdirSync(dir).toSorted()).toEqual([
            'delta.md',
            'strategy.md',
        ]);
        expect(readFileSync(join(dir, 'strategy.md'), 'utf8')).toBe(
            'vector: ship the fleet\n',
        );
    });
});
