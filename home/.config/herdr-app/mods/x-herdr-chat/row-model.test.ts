import { describe, expect, test } from 'vitest';

import { createRowModel } from './row-model.js';

// lines shaped as Claude Code writes them (keys in its order, trimmed to what the model reads), one content block each
let serial = 0;
const entry = (type: string, message: object, more: object = {}) => {
    serial += 1;
    const rest = JSON.stringify({
        isSidechain: false,
        ...more,
        message,
        timestamp: '2026-11-16T16:45:39.060Z',
        type,
        uuid: `u-${serial}`,
    });
    // the key Claude Code writes first, kept first: a formatter sorts an object's keys
    return `{"parentUuid":"p-${serial}",${rest.slice(1)}`;
};
const mine = (text: string, more: object = {}) =>
    entry('user', { content: text, role: 'user' }, more);
const reply = (text: string, id = `msg-${serial + 1}`) =>
    entry('assistant', {
        content: [{ text, type: 'text' }],
        id,
        role: 'assistant',
    });
const tool = (name: string, id = `msg-${serial + 1}`) =>
    entry('assistant', {
        content: [{ id: `toolu-${serial}`, input: {}, name, type: 'tool_use' }],
        id,
        role: 'assistant',
    });
const shown = (model: ReturnType<typeof createRowModel>) =>
    model.rows.map((row) => `${row.kind}: ${row.text}`);

describe('which transcript lines become rows', () => {
    test('his message, a reply and a tool call each become one row, in order', () => {
        const model = createRowModel();
        model.add([mine('hello'), reply('hi there'), tool('Bash')]);
        expect(shown(model)).toEqual([
            'mine: hello',
            'reply: hi there',
            'tool: Bash',
        ]);
    });

    test('a row keeps the id and time of its transcript line', () => {
        const model = createRowModel();
        model.add([mine('hello')]);
        expect(model.rows[0]).toMatchObject({
            at: '2026-11-16T16:45:39.060Z',
            id: `u-${serial}`,
        });
    });

    test.each([
        ['a line that is no conversation line', '{"type":"api-request","n":1}'],
        ['half a line', '{"parentUuid":"p","type":"user","mess'],
        ['a sub-agent line', mine('inside', { isSidechain: true })],
        ['a model-only line', mine('context', { isMeta: true })],
        ['a compact summary', mine('summary', { isCompactSummary: true })],
        ['a task notice', mine('<task-notification> <task-id>1</task-id>')],
        ['a command echo', mine('<command-name>/compact</command-name>')],
        ['an interruption note', mine('[Request interrupted by user]')],
        [
            'a tool result',
            entry('user', {
                content: [
                    { content: 'x', tool_use_id: 't', type: 'tool_result' },
                ],
                role: 'user',
            }),
        ],
        [
            'a thinking block',
            entry('assistant', {
                content: [{ thinking: 'hm', type: 'thinking' }],
                id: 'm',
                role: 'assistant',
            }),
        ],
    ])('%s draws no row', (_name, line) => {
        const model = createRowModel();
        expect(model.add([line])).toEqual({ changed: [] });
        expect(model.rows).toEqual([]);
    });

    test('his message sent as a text block reads like a typed one', () => {
        const model = createRowModel();
        model.add([
            entry('user', {
                content: [{ text: 'with a picture', type: 'text' }],
                role: 'user',
            }),
        ]);
        expect(shown(model)).toEqual(['mine: with a picture']);
    });
});

describe('an update touches only the rows that changed', () => {
    test.each([100, 10_000])(
        'one new line in a thread of %i rows changes one row',
        (count) => {
            const model = createRowModel();
            model.add(
                Array.from({ length: count }, (_, i) =>
                    i % 2 ? reply(`reply ${i}`) : mine(`ask ${i}`),
                ),
            );
            const before = model.rows.map((row) => [row, row.version] as const);
            const { changed } = model.add([mine('one more')]);
            expect(changed).toEqual([model.rows.at(-1)?.id]);
            expect(model.rows.length).toBe(count + 1);
            expect(
                before.filter(
                    ([row, version], i) =>
                        model.rows[i] !== row || row.version !== version,
                ).length,
            ).toBe(0);
        },
    );

    test('more text of the same reply grows its row, and only that row changes', () => {
        const model = createRowModel();
        model.add([mine('ask'), reply('first part', 'msg-a')]);
        const [ask, answer] = model.rows;
        const { changed } = model.add([reply('second part', 'msg-a')]);
        expect(shown(model)).toEqual([
            'mine: ask',
            'reply: first part\n\nsecond part',
        ]);
        expect(changed).toEqual([answer?.id]);
        expect(model.rows[1]).toBe(answer);
        expect(answer?.version).toBe(2);
        expect(ask?.version).toBe(1);
    });

    test('two replies in a row stay two rows', () => {
        const model = createRowModel();
        model.add([reply('one', 'msg-a'), reply('two', 'msg-b')]);
        expect(shown(model)).toEqual(['reply: one', 'reply: two']);
    });

    test('text of the same reply after its tool call starts a new row', () => {
        const model = createRowModel();
        model.add([
            reply('before', 'msg-a'),
            tool('Bash', 'msg-a'),
            reply('after', 'msg-a'),
        ]);
        expect(shown(model)).toEqual([
            'reply: before',
            'tool: Bash',
            'reply: after',
        ]);
    });

    test('a line handed in twice draws once', () => {
        const model = createRowModel();
        const line = mine('once');
        model.add([line]);
        expect(model.add([line])).toEqual({ changed: [] });
        expect(model.rows.length).toBe(1);
    });
});

describe('earlier pages and a restart', () => {
    test('an earlier page lands above, and no row below it changes', () => {
        const model = createRowModel();
        const early = [mine('first'), reply('second')];
        model.add([mine('third')]);
        const [third] = model.rows;
        expect(model.addEarlier(early)).toEqual({ added: 2 });
        expect(shown(model)).toEqual([
            'mine: first',
            'reply: second',
            'mine: third',
        ]);
        expect(model.rows[2]).toBe(third);
        expect(third?.version).toBe(1);
    });

    test('a reply cut by the page edge is one row again', () => {
        const model = createRowModel();
        const first = reply('first part', 'msg-a');
        model.add([reply('second part', 'msg-a')]);
        model.addEarlier([first]);
        expect(shown(model)).toEqual(['reply: first part\n\nsecond part']);
    });

    test('clear empties the thread for a file read again from its start', () => {
        const model = createRowModel();
        const line = mine('again');
        model.add([line]);
        model.clear();
        expect(model.rows).toEqual([]);
        expect(model.add([line]).changed.length).toBe(1);
    });
});
