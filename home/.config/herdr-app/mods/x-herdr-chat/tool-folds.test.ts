import { describe, expect, test, vi } from 'vitest';

vi.mock('herdr', () => ({ exec: vi.fn() }));
const { createRowModel, callOf } = await import('./row-model.js');
const { createToolFolds, isCallRow, isCardRow, withCallRows } = await import(
    './tool-folds.js'
);

let serial = 0;
const tool = (name: string, input: object) => {
    serial += 1;
    const rest = JSON.stringify({
        isSidechain: false,
        message: {
            content: [{ id: `t-${serial}`, input, name, type: 'tool_use' }],
            id: `msg-${serial}`,
            role: 'assistant',
        },
        timestamp: '2026-11-18T16:00:00.000Z',
        type: 'assistant',
        uuid: `u-${serial}`,
    });
    return `{"parentUuid":"p-${serial}",${rest.slice(1)}`;
};

describe('a call names what it did (PK-432:W1)', () => {
    test.each([
        ['Read', { file_path: '/a/b.ts', limit: 5 }, '/a/b.ts'],
        [
            'Bash',
            { command: 'git status\nmore', description: 'x' },
            'git status',
        ],
        ['Grep', { output_mode: 'content', pattern: 'foo' }, 'foo'],
        ['Mystery', { anything: 'first string' }, 'first string'],
        ['Empty', {}, ''],
    ])('%s', (name, input, arg) => {
        expect(callOf(name, input).arg).toBe(arg);
    });

    test('a huge input is cut for the peek', () => {
        const call = callOf('Write', {
            content: 'x'.repeat(9000),
            file_path: '/f',
        });
        expect(call.input.length).toBeLessThan(4100);
        expect(call.input.endsWith('…')).toBe(true);
    });
});

describe('the tool-call fold opens to its calls, each call alone (PK-432:W2, FRM-638:W23)', () => {
    const model = () => {
        const m = createRowModel();
        m.add([
            tool('Read', { file_path: '/a.ts' }),
            tool('Bash', { command: 'ls' }),
            tool('Read', { file_path: '/b.ts' }),
        ]);
        return m;
    };

    test('folded, the run is one row that keeps every call', () => {
        const m = model();
        expect(m.rows).toHaveLength(1);
        expect(m.rows[0]?.calls?.map((c) => c.arg)).toEqual([
            '/a.ts',
            'ls',
            '/b.ts',
        ]);
        expect(withCallRows(m.rows, createToolFolds())).toHaveLength(1);
    });

    test('opened, one row a call follows it; a call opens alone and closes again', () => {
        const m = model();
        const folds = createToolFolds();
        const id = m.rows[0]?.id ?? '';
        folds.toggle(id);
        const open = withCallRows(m.rows, folds);
        expect(open.map((r) => r.text)).toEqual([
            m.rows[0]?.text,
            'Read /a.ts',
            'Bash ls',
            'Read /b.ts',
        ]);
        expect(open.slice(1).every((r) => isCallRow(r.id))).toBe(true);
        const call = open[2]?.id ?? '';
        folds.toggle(call);
        const peeked = withCallRows(m.rows, folds);
        expect(peeked.map((r) => folds.isOpen(r.id))).toEqual([
            true,
            false,
            true,
            false,
            false,
        ]);
        expect(peeked[2]?.version).not.toBe(open[2]?.version);
        folds.toggle(call);
        expect(folds.isOpen(call)).toBe(false);
    });

    test('an open fold draws again: its version moves', () => {
        const m = model();
        const folds = createToolFolds();
        folds.toggle(m.rows[0]?.id ?? '');
        expect(withCallRows(m.rows, folds)[0]?.version).not.toBe(
            m.rows[0]?.version,
        );
    });

    // FRM-659:W4: a selection drag's release inside the json card is a click on the list item; it closed the card
    describe('an open call’s json card is its own row, so a click in it never closes the call', () => {
        const opened = () => {
            const m = model();
            const folds = createToolFolds();
            folds.toggle(m.rows[0]?.id ?? '');
            const call = withCallRows(m.rows, folds)[2]?.id ?? '';
            folds.toggle(call);
            return { call, folds, m };
        };

        test('the card follows its call as a row of its own', () => {
            const { call, folds, m } = opened();
            const rows = withCallRows(m.rows, folds);
            expect(rows.map((r) => r.id)).toEqual([
                m.rows[0]?.id,
                expect.stringContaining('#call-0'),
                call,
                `${call}#card`,
                expect.stringContaining('#call-2'),
            ]);
            expect(isCardRow(rows[3]?.id ?? '')).toBe(true);
        });

        test('a click in the card leaves the call open and opens nothing', () => {
            const { call, folds } = opened();
            expect(folds.toggle(`${call}#card`)).toBe(false);
            expect([folds.isOpen(call), folds.isOpen(`${call}#card`)]).toEqual([
                true,
                false,
            ]);
        });

        test('the card is found by the json it shows', () => {
            const { folds, m } = opened();
            const rows = withCallRows(m.rows, folds);
            expect(rows[3]?.text).toBe(rows[2]?.calls?.[0]?.input);
        });

        test('a click on the call’s name closes it', () => {
            const { call, folds } = opened();
            folds.toggle(call);
            expect(folds.isOpen(call)).toBe(false);
        });
    });

    test('a call joining an open fold shows as a row at once', () => {
        const m = model();
        const folds = createToolFolds();
        folds.toggle(m.rows[0]?.id ?? '');
        m.add([tool('Grep', { pattern: 'x' })]);
        expect(withCallRows(m.rows, folds).at(-1)?.text).toBe('Grep x');
    });
});
