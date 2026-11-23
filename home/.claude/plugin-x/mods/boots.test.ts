import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    countBoots,
    countMods,
    helperStartsHosts,
    pastTheTable,
    raised,
    readTable,
    readTicks,
    unticked,
} from './boots.ts';

const KIT = "import { type Engine, test } from 'claude-code/testing';\n";
const SHARED = "import { test } from './shared-boot.ts';\n";

describe('the host starts of one test file', () => {
    it.each([
        ['a row with a $', `${KIT}test('a', async ($) => {});`, 1],
        [
            'each such row',
            `${KIT}test('a', ($) => {});test('b', ($, on) => {});`,
            2,
        ],
        [
            'options before the body',
            `${KIT}test('a', { timeoutMs: 1 }, ($) => {});`,
            1,
        ],
        ['a body written elsewhere', `${KIT}test('a', body);`, 1],
        ['no row with a $', `${KIT}test('a', () => {});`, 0],
        [
            'a describe',
            `${KIT}describe('d', () => { test('a', ($) => {}); });`,
            1,
        ],
        [
            'the shared boot',
            `${SHARED}test('a', ($) => {});test('b', ($) => {});`,
            1,
        ],
        [
            'the shared boot in a loop',
            `${SHARED}for (const n of l) test(n, ($) => {});`,
            1,
        ],
        [
            'a shared file that never starts one',
            `${SHARED}test('a', () => {});`,
            0,
        ],
        [
            'a plain row in a loop',
            `${KIT}for (const n of l) test(n, () => {});`,
            0,
        ],
    ])('%s', (_, source, boots) => {
        expect(countBoots(source)).toEqual({ boots });
    });

    it.each([
        ['a loop', `${KIT}for (const n of l) test(n, ($) => {});`],
        ['a forEach', `${KIT}l.forEach((n) => { test(n, ($) => {}); });`],
        [
            'a function',
            `${KIT}function row(n) { test(n, ($) => {}); } row('a');`,
        ],
        ['an arrow', `${KIT}const row = (n) => test(n, ($) => {}); row('a');`],
        ['an alias', `${KIT}const t = test; t('a', ($) => {});`],
        ['a member', `${KIT}test.each(l)('a', ($) => {});`],
        [
            'a whole import',
            "import * as kit from 'claude-code/testing'; kit.test('a', ($) => {});",
        ],
        [
            'a renamed import in a loop',
            "import { test as t } from 'claude-code/testing'; for (const n of l) t(n, ($) => {});",
        ],
        ['a re-export', `${KIT}export { test };`],
        [
            'a late load',
            "const { test } = await import('claude-code/testing'); test('a', ($) => {});",
        ],
    ])('%s is refused, uncounted', (_, source) => {
        expect(countBoots(source).why).toBeDefined();
    });
});

const row = (file: string, boots: number, tick = '') => ({
    boots,
    file: file === '*' ? file : `tests/${file}`,
    mod: 'x-mod-a',
    tick,
});

describe('the boots table', () => {
    const table = [row('*', 3), row('a.test.ts', 1), row('b.test.ts', 2)];
    it('passes files at or under their rows', () => {
        expect(
            pastTheTable([row('a.test.ts', 1), row('b.test.ts', 1)], table),
        ).toEqual([]);
    });
    it('names a file past its row, a file with none, a mod past its whole and a dead row', () => {
        expect(
            pastTheTable([row('a.test.ts', 4), row('c.test.ts', 1)], table),
        ).toEqual([
            'x-mod-a/tests/a.test.ts: 4 host starts, its row says 1',
            'x-mod-a/tests/c.test.ts: 1 host starts and no row in boots.tsv',
            'x-mod-a: 5 host starts, its row says 3',
            'x-mod-a/tests/b.test.ts: a row for a file that is gone',
        ]);
    });
    it('reads its rows past a comment', () => {
        expect(
            readTable('# mod\tfile\nx-mod-a\ttests/a.test.ts\t1\t\n'),
        ).toEqual([row('a.test.ts', 1)]);
    });

    const base = [row('*', 3), row('a.test.ts', 1)];
    const up = raised([row('*', 3), row('a.test.ts', 2, '1795')], base);
    const tick = {
        at: 1795,
        pick: 'raise x-mod-a/tests/a.test.ts to 2',
        verdict: 'tick',
    };
    it('a raise on a logged tick naming the file and the number passes', () => {
        expect([up.length, unticked(up, [tick])]).toEqual([1, []]);
    });
    it.each([
        ['no tick', []],
        ['a tick typed in, never logged', [{ ...tick, at: 1 }]],
        ['a tick sent back', [{ ...tick, verdict: 'back' }]],
        [
            'a tick on another file',
            [{ ...tick, pick: 'raise x-mod-a/tests/aa.test.ts to 2' }],
        ],
        [
            'a tick on another number',
            [{ ...tick, pick: 'raise x-mod-a/tests/a.test.ts to 22' }],
        ],
    ])('a raise on %s is named', (_, ticks) => {
        expect(unticked(up, ticks)).toHaveLength(1);
    });
    it('a new file may start one host, a second is a raise', () => {
        expect(
            [1, 2].map((n) => raised([row('new.test.ts', n)], base).length),
        ).toEqual([0, 1]);
    });
});

it('a tick he took back is no tick, in its own session alone', () => {
    const dir = mkdtempSync(join(tmpdir(), 'boots-ticks-'));
    const tick = { at: 1, id: 'o1', text: 'raise a to 2', verdict: 'tick' };
    const lines = (...rows: object[]) =>
        rows.map((r) => `${JSON.stringify(r)}\n`).join('');
    writeFileSync(
        join(dir, 'a.jsonl'),
        lines(tick, { ...tick, at: 2, verdict: 'untick' }),
    );
    writeFileSync(join(dir, 'b.jsonl'), `${lines({ ...tick, at: 3 })}{half`);
    expect(
        readTicks(dir)
            .filter((t) => t.verdict === 'tick')
            .map((t) => t.at),
    ).toEqual([3]);
});

describe('a helper', () => {
    it.each([
        [
            'the kit’s types',
            "import type { Engine } from 'claude-code/testing';",
        ],
        ['a mock', "import { type Engine, mock } from 'claude-code/testing';"],
        ['another module', "export * from './other.ts';"],
    ])('%s starts no host', (_, source) => {
        expect(helperStartsHosts(source)).toBe(false);
    });
    it.each([
        ['test', "import { test } from 'claude-code/testing';"],
        [
            'test renamed',
            'import { expect, test as row } from "claude-code/testing";',
        ],
        ['the whole kit', "import * as kit from 'claude-code/testing';"],
        [
            'the kit under a harmless name',
            "import * as mock from 'claude-code/testing';",
        ],
        ['a default', "import kit from 'claude-code/testing';"],
        ['a late load', "const kit = await import('claude-code/testing');"],
        ['a re-export of all', "export * from 'claude-code/testing';"],
        ['a re-export of test', "export { test } from 'claude-code/testing';"],
        [
            'test exported as mock',
            "export { test as mock } from 'claude-code/testing';",
        ],
        [
            'test imported as mock',
            "import { test as mock } from 'claude-code/testing';",
        ],
    ])('%s is refused', (_, source) => {
        expect(helperStartsHosts(source)).toBe(true);
    });
});

it('a test file counts wherever in a mod it sits', () => {
    const root = mkdtempSync(join(tmpdir(), 'boots-mods-'));
    for (const file of [
        'tests/sub/a.test.ts',
        'hooks/b.test.tsx',
        'node_modules/d/c.test.ts',
        '.claude-plugin/types/d.test.ts',
    ]) {
        mkdirSync(join(root, 'x-mod-a', dirname(file)), { recursive: true });
        writeFileSync(
            join(root, 'x-mod-a', file),
            `${KIT}test('a', ($) => {});`,
        );
    }
    expect(countMods(root).counts.map((c) => c.file)).toEqual([
        'hooks/b.test.tsx',
        'tests/sub/a.test.ts',
    ]);
});
