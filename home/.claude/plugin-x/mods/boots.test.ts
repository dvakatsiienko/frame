import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    countBoots,
    countMods,
    pastTheTable,
    raised,
    readTable,
    readTicks,
    refusedHelper,
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
        ['a property of that name', `${KIT}const t = { test: 1 }; t.test;`, 0],
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
        [
            'a describe, the kit’s or its own',
            `${KIT}describe('d', () => { test('a', ($) => {}); });`,
        ],
        ['an alias', `${KIT}const t = test; t('a', ($) => {});`],
        ['a member', `${KIT}test.each(l)('a', ($) => {});`],
        [
            'a whole import',
            "import * as kit from 'claude-code/testing'; kit.test('a', ($) => {});",
        ],
        ['a default import', "import kit from 'claude-code/testing';"],
        [
            'a string name',
            "import { 'test' as t } from 'claude-code/testing'; t('a', ($) => {});",
        ],
        [
            'a renamed import in a loop',
            "import { test as t } from 'claude-code/testing'; for (const n of l) t(n, ($) => {});",
        ],
        ['a re-export of a local', `${KIT}export { test };`],
        ['a re-export', "export { test } from 'claude-code/testing';"],
        [
            'a late load',
            "const { test } = await import('claude-code/testing'); test('a', ($) => {});",
        ],
        [
            'a late load in pieces',
            "const k = await import('claude-code/' + 'testing');",
        ],
        ['a require', "const k = require('claude-code/testing');"],
        ['another test file', "import { test } from './b.test.ts';"],
        [
            'another name of the helper',
            "import { hostTest } from './shared-boot.ts';",
        ],
        [
            'a helper by another path',
            "import { test } from './sub/shared-boot.ts';",
        ],
        [
            'a helper by another suffix',
            "import { test } from './shared-boot.js';",
        ],
        ['the helper handed on', "export { test } from './shared-boot.ts';"],
    ])('%s is refused, uncounted', (_, source) => {
        expect(countBoots(source).why).toBeDefined();
    });

    it('a nested file reaches the one helper', () => {
        const source =
            "import { test } from '../shared-boot.ts';test('a', ($) => {});";
        expect(countBoots(source, 'tests/sub/a.test.ts')).toEqual({ boots: 1 });
        expect(countBoots(source, 'tests/a.test.ts').why).toBeDefined();
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

    it.each(['many', '9x', '', '1 111', '1.5', '-1'])(
        'a row of «%s» is named, and its raise asks a tick',
        (boots) => {
            const [bad] = readTable(`x-mod-a\ttests/a.test.ts\t${boots}\t`);
            const broken = [row('*', 3), bad as never];
            expect(pastTheTable([row('a.test.ts', 1)], broken)).toEqual([
                'x-mod-a/tests/a.test.ts: its row holds no whole number',
            ]);
            expect(
                raised(table, [row('*', 3), bad as never, row('b.test.ts', 2)]),
            ).toHaveLength(1);
        },
    );
    it('a second row of one file is named', () => {
        expect(
            pastTheTable(
                [row('a.test.ts', 1), row('b.test.ts', 1)],
                [...table, row('a.test.ts', 9)],
            ),
        ).toEqual(['x-mod-a/tests/a.test.ts: a second row']);
    });

    const base = [row('*', 3), row('a.test.ts', 1)];
    const up = raised([row('*', 3), row('a.test.ts', 2, '1795')], base);
    const tick = {
        at: 1795,
        pick: 'raise x-mod-a/tests/a.test.ts to 2',
        verdict: 'tick',
    };
    it('a raise on a logged tick of that pick passes', () => {
        expect([up.length, unticked(up, [tick])]).toEqual([1, []]);
    });
    it.each([
        ['no tick', []],
        ['a tick typed in, never logged', [{ ...tick, at: 1 }]],
        ['a tick sent back', [{ ...tick, verdict: 'replay' }]],
        ['a tick with a steer', [{ ...tick, steer: 'no, cut it first' }]],
        [
            'a tick on another file',
            [{ ...tick, pick: 'raise x-mod-a/tests/aa.test.ts to 2' }],
        ],
        [
            'a tick on another number',
            [{ ...tick, pick: 'raise x-mod-a/tests/a.test.ts to 22' }],
        ],
        [
            'a tick declining it',
            [{ ...tick, pick: 'never raise x-mod-a/tests/a.test.ts to 2' }],
        ],
        [
            'a tick whose ask alone says it',
            [{ ...tick, pick: 'keep 1', text: tick.pick }],
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

describe('a file beside the test files', () => {
    it.each([
        [
            'the kit’s types',
            "import type { Engine } from 'claude-code/testing';",
        ],
        ['a mock', "import { type Engine, mock } from 'claude-code/testing';"],
        ['another module', "export * from './other.ts';"],
        ['the helper’s mock', "import { mock } from './shared-boot.ts';"],
    ])('%s starts no host', (_, source) => {
        expect(refusedHelper(source)).toBeUndefined();
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
        [
            'a template late load',
            'const kit = await import(`claude-code/testing`);',
        ],
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
        ['the helper’s test', "import { test } from './shared-boot.ts';"],
        ['a test file', "import './a.test.ts';"],
    ])('%s is refused', (_, source) => {
        expect(refusedHelper(source)).toBeDefined();
    });
});

describe('the shared helper', () => {
    const FILE = 'x-mod-stash/tests/shared-boot.ts';
    const source = readFileSync(join(import.meta.dirname, FILE), 'utf8');
    const read = (edit: (s: string) => string) => {
        const edited = edit(source);
        expect(edited === source).toBe(false);
        return refusedHelper(edited, 'tests/shared-boot.ts');
    };
    it('stands on its pin, a new door and all', () => {
        expect(refusedHelper(source, 'tests/shared-boot.ts')).toBeUndefined();
        expect(
            read((s) =>
                s.replace(
                    "    'ui.toast',\n",
                    "    'ui.toast',\n    'ui.wide',\n",
                ),
            ),
        ).toBeUndefined();
    });
    it.each([
        [
            'boots each row',
            (s: string) => s.replace('if (!body.length)', 'if (body)'),
        ],
        [
            'hands the kit’s test on',
            (s: string) =>
                s.replace(
                    'export { type Engine,',
                    'export { test as hostTest2, type Engine,',
                ),
        ],
        [
            'starts a host in another function',
            (s: string) =>
                s.replace(
                    'async function runRows($: Engine, on: On) {',
                    "async function runRows($: Engine, on: On) {\n    hostTest('a', ($) => {});",
                ),
        ],
        [
            'exports another function',
            (s: string) =>
                s.replace(
                    'async function runRows',
                    'export async function runRows',
                ),
        ],
    ])('one that %s is refused', (_, edit) => {
        expect(read(edit)).toBeDefined();
    });
});

it('a test file counts wherever in a mod it sits', () => {
    const root = mkdtempSync(join(tmpdir(), 'boots-mods-'));
    for (const file of [
        'tests/sub/a.test.ts',
        'hooks/b.test.tsx',
        'tests/.z.test.ts',
        'tests/node_modules_b/z.test.ts',
        'node_modules/d/c.test.ts',
        '.claude-plugin/types/d.test.ts',
        'tests/h.mts',
        'tests/.kit.ts',
        'tests/k.js',
    ]) {
        mkdirSync(join(root, 'mod-a', dirname(file)), { recursive: true });
        writeFileSync(join(root, 'mod-a', file), `${KIT}test('a', ($) => {});`);
    }
    const { counts, red } = countMods(root);
    expect(red.map((l) => l.split(':')[0])).toEqual([
        'mod-a/tests/.kit.ts',
        'mod-a/tests/h.mts',
        'mod-a/tests/k.js',
    ]);
    expect(counts.map((c) => c.file)).toEqual([
        'hooks/b.test.tsx',
        'tests/.z.test.ts',
        'tests/node_modules_b/z.test.ts',
        'tests/sub/a.test.ts',
    ]);
});
