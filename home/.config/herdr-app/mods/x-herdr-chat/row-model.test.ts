import { describe, expect, test, vi } from 'vitest';

// the pure half of attach.js is what this reads; its herdr door stays shut
vi.mock('herdr', () => ({ exec: vi.fn() }));

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

describe('a paste in his message shows as his words, never as the wrapper Claude Code puts around it (dima, 12:35)', () => {
    test('the opening and closing tags, each with its id, are gone', () => {
        const model = createRowModel();
        model.add([
            mine(
                '\n\n<pasted_content id="8784">\nfirst line\n\nsecond line\n</pasted_content id="8784">\n',
            ),
        ]);
        expect(shown(model)).toEqual(['mine: first line\n\nsecond line']);
    });

    test('a paste whose tag carries no id is still his message', () => {
        const model = createRowModel();
        model.add([mine('<pasted_content>\nthe log\n</pasted_content>')]);
        expect(shown(model)).toEqual(['mine: the log']);
    });

    test.each([
        [
            'a tag he named in a sentence',
            'why does the bubble show <pasted_content> tags?',
        ],
        [
            'a tag inside pasted code',
            '<pasted_content id="b2">\ntoBe("<pasted_content id=1>a</pasted_content>")\n</pasted_content id="b2">',
            'toBe("<pasted_content id=1>a</pasted_content>")',
        ],
        [
            'a tag that only starts the same',
            '<pasted_content-like>\nsome words\n</pasted_content-like>',
        ],
    ])(
        'his own words that only look like a tag stay: %s',
        (_, text, expected = text) => {
            const model = createRowModel();
            model.add([mine(text)]);
            expect(shown(model)).toEqual([`mine: ${expected}`]);
        },
    );

    test('a wrapper inside what he pasted stays: only the outer one leaves', () => {
        const model = createRowModel();
        model.add([
            mine(
                '<pasted_content id="x">\nline1\n<pasted_content>\ninner\n</pasted_content>\nline2\n</pasted_content id="x">',
            ),
        ]);
        expect(shown(model)).toEqual([
            'mine: line1\n<pasted_content>\ninner\n</pasted_content>\nline2',
        ]);
    });

    test('a closing tag naming another id is not this paste’s: both tags stay', () => {
        const text = '<pasted_content id="a">\nX\n</pasted_content id="b">';
        const model = createRowModel();
        model.add([mine(text)]);
        expect(shown(model)).toEqual([`mine: ${text}`]);
    });

    test('two pastes in one message each leave their wrapper', () => {
        const model = createRowModel();
        model.add([
            mine(
                '<pasted_content id="a">\nA\n</pasted_content>\nmid\n<pasted_content id="b">\nB\n</pasted_content>',
            ),
        ]);
        expect(shown(model)).toEqual(['mine: A\nmid\nB']);
    });

    test('words he typed around the paste stay', () => {
        const model = createRowModel();
        model.add([
            mine(
                'look at this:\n<pasted_content id="a1">\nthe log\n</pasted_content>\nwhy?',
            ),
        ]);
        expect(shown(model)).toEqual(['mine: look at this:\nthe log\nwhy?']);
    });
});

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
        expect(model.add([line])).toEqual({ changed: [], removed: 0 });
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

    test('tool calls in a row fold into one line that counts them by name', () => {
        const model = createRowModel();
        model.add([mine('go'), tool('Bash'), tool('Read')]);
        const run = model.rows[1];
        const { changed } = model.add([tool('Bash')]);
        expect(shown(model)).toEqual([
            'mine: go',
            'tool: 3 tool calls: Bash 2, Read 1',
        ]);
        expect(changed).toEqual([run?.id]);
        expect(model.rows[1]).toBe(run);
        expect(run?.version).toBe(3);
    });

    test('one tool call alone reads by its name', () => {
        const model = createRowModel();
        model.add([tool('Bash'), reply('done'), tool('Read')]);
        expect(shown(model)).toEqual([
            'tool: Bash',
            'reply: done',
            'tool: Read',
        ]);
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
        expect(model.add([line])).toEqual({ changed: [], removed: 0 });
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
        const [drawn] = model.rows;
        model.addEarlier([first]);
        expect(shown(model)).toEqual(['reply: first part\n\nsecond part']);
        // the row takes the id of its true first line: the place saved while it was loaded whole is found again
        expect(model.rows[0]).toBe(drawn);
        expect(drawn?.id).toBe(JSON.parse(first).uuid);
    });

    test('a run of tool calls cut by the page edge is one line again', () => {
        const model = createRowModel();
        const early = [tool('Read'), tool('Bash')];
        model.add([tool('Bash'), mine('thanks')]);
        const [run] = model.rows;
        model.addEarlier(early);
        expect(shown(model)).toEqual([
            'tool: 3 tool calls: Bash 2, Read 1',
            'mine: thanks',
        ]);
        expect(model.rows[0]).toBe(run);
    });

    test('a row is found by any transcript line it folds, wherever the loaded tail began', () => {
        const lines = [tool('Read'), tool('Bash'), tool('Bash'), mine('ok')];
        const ids = lines.map((line) => JSON.parse(line).uuid as string);
        const whole = createRowModel();
        whole.add(lines);
        // the same thread, its tail cut inside the run of tool calls
        const tail = createRowModel();
        tail.add(lines.slice(2));
        expect(ids.map((id) => whole.indexOf(id))).toEqual([0, 0, 0, 1]);
        expect(ids.map((id) => tail.indexOf(id))).toEqual([-1, -1, 0, 1]);
        tail.addEarlier(lines.slice(0, 2));
        expect(ids.map((id) => tail.indexOf(id))).toEqual([0, 0, 0, 1]);
        expect(whole.indexOf('gone')).toBe(-1);
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

// Claude Code's queue records and x-mod-stash's joined-words line, as each is written to the transcript
const queueOp = (
    operation: string,
    content?: string,
    at = '2026-11-16T16:45:40.000Z',
    more: object = {},
) => {
    const rest = JSON.stringify({
        operation,
        timestamp: at,
        ...(content === undefined ? {} : { content }),
        ...more,
    });
    // its type first, as Claude Code writes it: a formatter sorts an object's keys
    return `{"type":"queue-operation",${rest.slice(1)}`;
};
const joined = (...texts: string[]) => {
    serial += 1;
    const head =
        texts.length === 1
            ? '💨 dima wrote this in herdr while you worked; it joins this turn as his own words:\n'
            : `💨 dima wrote these ${texts.length}, in order, in herdr while you worked; it joins this turn as his own words:\n`;
    const rest = JSON.stringify({
        attachment: {
            content: [`${head}«${texts.join('»\n«')}»`],
            type: 'hook_additional_context',
        },
        isSidechain: false,
        timestamp: '2026-11-16T16:45:41.000Z',
        type: 'attachment',
        uuid: `u-${serial}`,
    });
    return `{"parentUuid":"p-${serial}",${rest.slice(1)}`;
};
// a prompt taken mid-turn, as Claude Code writes it: a queued command, its remove record a few lines later
const taken = (
    prompt: string | object[],
    origin = 'human',
    command = `cmd-${serial + 1}`,
) => {
    serial += 1;
    const rest = JSON.stringify({
        attachment: {
            commandMode: 'prompt',
            origin: { kind: origin },
            prompt,
            source_uuid: command,
            type: 'queued_command',
        },
        isSidechain: false,
        timestamp: '2026-11-16T16:45:42.000Z',
        type: 'attachment',
        uuid: `u-${serial}`,
    });
    return `{"parentUuid":"p-${serial}",${rest.slice(1)}`;
};
const waiting = (model: ReturnType<typeof createRowModel>) =>
    model.rows.filter((row) => row.isWaiting).map((row) => row.text);

describe('a message sent while the thread works waits at the list’s end', () => {
    test('it shows as his row, waiting, from the moment Claude Code queues it', () => {
        const model = createRowModel();
        model.add([mine('start'), reply('working on it')]);
        model.add([queueOp('enqueue', 'also the tests')]);
        expect(shown(model)).toEqual([
            'mine: start',
            'reply: working on it',
            'mine: also the tests',
        ]);
        expect(waiting(model)).toEqual(['also the tests']);
    });

    test('rows that land after it go above it: it stays last', () => {
        const model = createRowModel();
        model.add([mine('start'), queueOp('enqueue', 'also the tests')]);
        model.add([reply('still working'), tool('Bash')]);
        expect(shown(model).at(-1)).toBe('mine: also the tests');
        expect(shown(model)).toHaveLength(4);
    });

    test('a reply that grows under a waiting row still grows its own row', () => {
        const model = createRowModel();
        model.add([reply('one', 'msg-a'), queueOp('enqueue', 'wait')]);
        model.add([reply('two', 'msg-a')]);
        expect(shown(model)).toEqual(['reply: one\n\ntwo', 'mine: wait']);
    });

    test('once a tool round takes it, its transcript row replaces it', () => {
        const model = createRowModel();
        model.add([mine('start'), queueOp('enqueue', 'also the tests')]);
        const { removed } = model.add([
            taken('also the tests'),
            queueOp('remove', 'also the tests'),
        ]);
        expect(removed).toBe(1);
        expect(shown(model)).toEqual(['mine: start', 'mine: also the tests']);
        expect(waiting(model)).toEqual([]);
    });

    test('a turn’s end takes his oldest waiting message first', () => {
        const model = createRowModel();
        model.add([
            queueOp('enqueue', 'first'),
            queueOp('enqueue', 'second', '2026-11-16T16:45:50.000Z'),
            queueOp('dequeue'),
        ]);
        expect(waiting(model)).toEqual(['second']);
    });

    test('pulled back out of Claude’s prompt, it leaves', () => {
        const model = createRowModel();
        model.add([queueOp('enqueue', 'never mind')]);
        model.add([queueOp('popAll', 'never mind')]);
        expect(model.rows).toHaveLength(0);
    });

    test('a task notice or another thread’s message in the queue is no row of his', () => {
        const model = createRowModel();
        model.add([
            queueOp('enqueue', '<task-notification>done</task-notification>'),
            queueOp('enqueue'),
        ]);
        expect(model.rows).toHaveLength(0);
    });

    test('a waiting row that stays keeps its object, and only a new one is reported changed', () => {
        const model = createRowModel();
        model.add([queueOp('enqueue', 'first')]);
        const [first] = model.rows;
        const { changed } = model.add([
            queueOp('enqueue', 'second', '2026-11-16T16:45:50.000Z'),
        ]);
        expect(model.rows[0]).toBe(first);
        expect(changed).toEqual([model.rows[1]?.id]);
    });

    test('two waiting messages with the same words are two rows', () => {
        const model = createRowModel();
        model.add([queueOp('enqueue', 'go'), queueOp('enqueue', 'go')]);
        expect(new Set(model.rows.map((row) => row.id)).size).toBe(2);
    });

    test('clear forgets what waited', () => {
        const model = createRowModel();
        model.add([queueOp('enqueue', 'first')]);
        model.clear();
        model.add([mine('fresh')]);
        expect(shown(model)).toEqual(['mine: fresh']);
    });
});

describe('a prompt a tool round took mid-turn is his message', () => {
    test('it is one row of his, by its words', () => {
        const model = createRowModel();
        model.add([reply('working'), taken('also the tests')]);
        expect(shown(model)).toEqual([
            'reply: working',
            'mine: also the tests',
        ]);
    });

    test('sent with a picture, it reads by its text', () => {
        const model = createRowModel();
        model.add([
            taken([
                { text: 'look at this', type: 'text' },
                { source: {}, type: 'image' },
            ]),
        ]);
        expect(shown(model)).toEqual(['mine: look at this']);
    });

    test('another thread’s message or a task notice queued the same way is no row of his', () => {
        const model = createRowModel();
        model.add([taken('<cross-session-message>hi', 'peer')]);
        expect(model.rows).toHaveLength(0);
    });
});

describe('words that joined a turn are his messages', () => {
    test('one joined message is one row of his', () => {
        const model = createRowModel();
        model.add([reply('working'), joined('also the tests')]);
        expect(shown(model)).toEqual([
            'reply: working',
            'mine: also the tests',
        ]);
    });

    test('several joined at once are one row each, in order, each found by its own id', () => {
        const model = createRowModel();
        model.add([joined('first', 'second')]);
        expect(shown(model)).toEqual(['mine: first', 'mine: second']);
        const [a, b] = model.rows;
        expect(a?.id).not.toBe(b?.id);
        expect(model.indexOf(b?.id ?? '')).toBe(1);
    });

    test('another hook’s context line is no row', () => {
        const model = createRowModel();
        const line = joined('x').replace('💨 dima wrote this', 'note:');
        model.add([line]);
        expect(model.rows).toHaveLength(0);
    });
});

describe('the turn clock starts at his prompt', () => {
    test('his prompt is when the turn started', () => {
        const model = createRowModel();
        model.add([mine('go')]);
        expect(model.turnAt()).toBe(Date.parse('2026-11-16T16:45:39.060Z'));
    });

    test('a prompt taken mid-turn keeps the clock running', () => {
        const model = createRowModel();
        model.add([mine('go'), reply('working'), taken('also the tests')]);
        expect(model.turnAt()).toBe(Date.parse('2026-11-16T16:45:39.060Z'));
    });

    test('a thread with no prompt of his has no turn to time', () => {
        const model = createRowModel();
        model.add([reply('hi')]);
        expect(model.turnAt()).toBeNull();
    });
});

describe('his message has one delivery state, owned by the row model (FRM-594)', () => {
    const removeOf = (command: string, at: string) =>
        queueOp('remove', 'also the tests', at, { commandUuid: command });
    const read = (at: string) => ({ at, state: 'read' });

    test('a prompt a tool round took is «sent» until the remove that took it lands', () => {
        const model = createRowModel();
        model.add([reply('working'), taken('also the tests', 'human', 'c1')]);
        expect(model.rows.at(-1)?.delivery).toEqual({
            at: '2026-11-16T16:45:42.000Z',
            state: 'sent',
        });
    });

    test('its remove makes it «read» at that time, and only its row changes', () => {
        const model = createRowModel();
        model.add([reply('working'), taken('also the tests', 'human', 'c1')]);
        const row = model.rows.at(-1);
        const { changed } = model.add([
            removeOf('c1', '2026-11-16T16:46:19.000Z'),
        ]);
        expect(row?.delivery).toEqual(read('2026-11-16T16:46:19.000Z'));
        expect(row?.version).toBe(2);
        expect(changed).toEqual([row?.id]);
    });

    test('a second remove for the same command moves nothing', () => {
        const model = createRowModel();
        model.add([
            taken('also the tests', 'human', 'c1'),
            removeOf('c1', '2026-11-16T16:46:19.000Z'),
        ]);
        const { changed } = model.add([
            removeOf('c1', '2026-11-16T16:50:00.000Z'),
        ]);
        expect(model.rows[0]?.delivery).toEqual(
            read('2026-11-16T16:46:19.000Z'),
        );
        expect(changed).toEqual([]);
    });

    test('a remove that names another command moves nothing', () => {
        const model = createRowModel();
        model.add([taken('also the tests', 'human', 'c1')]);
        const [row] = model.rows;
        const { changed } = model.add([
            removeOf('c2', '2026-11-16T16:46:19.000Z'),
        ]);
        expect(model.rows).toEqual([row]);
        expect(row?.delivery?.state).toBe('sent');
        expect(changed).toEqual([]);
    });

    test('an earlier page reads its own removes', () => {
        const model = createRowModel();
        model.add([reply('later')]);
        model.addEarlier([
            taken('also the tests', 'human', 'c1'),
            removeOf('c1', '2026-11-16T16:46:19.000Z'),
        ]);
        expect(model.rows[0]?.delivery).toEqual(
            read('2026-11-16T16:46:19.000Z'),
        );
    });

    test('a remove loaded before the page holding its prompt still reads it', () => {
        const model = createRowModel();
        model.add([removeOf('c1', '2026-11-16T16:46:19.000Z'), reply('later')]);
        model.addEarlier([taken('also the tests', 'human', 'c1')]);
        expect(model.rows[0]?.delivery).toEqual(
            read('2026-11-16T16:46:19.000Z'),
        );
    });

    test('a prompt that started a turn is «read» at its own stamp', () => {
        const model = createRowModel();
        model.add([mine('start'), queueOp('dequeue')]);
        expect(shown(model)).toEqual(['mine: start']);
        expect(model.rows[0]?.delivery).toEqual(
            read('2026-11-16T16:45:39.060Z'),
        );
    });

    test('a message waiting in Claude Code’s queue is «sent» at its queue time', () => {
        const model = createRowModel();
        model.add([queueOp('enqueue', 'later', '2026-11-16T16:47:00.000Z')]);
        expect(model.rows[0]?.delivery).toEqual({
            at: '2026-11-16T16:47:00.000Z',
            state: 'sent',
        });
    });

    test('a reply has no delivery', () => {
        const model = createRowModel();
        model.add([reply('hi')]);
        expect(model.rows[0]?.delivery).toBeNull();
    });

    test('clear forgets the reads', () => {
        const model = createRowModel();
        model.add([removeOf('c1', '2026-11-16T16:46:19.000Z')]);
        model.clear();
        model.add([taken('also the tests', 'human', 'c1')]);
        expect(shown(model)).toEqual(['mine: also the tests']);
        expect(model.rows[0]?.delivery?.state).toBe('sent');
    });
});

describe('the files his message sent draw under his words, never as their paths or tokens (FRM-638 slice 5)', () => {
    const picture = (data: string) => ({
        source: { data, media_type: 'image/jpeg', type: 'base64' },
        type: 'image',
    });

    test('a send Claude Code took inline: its tokens leave the words, its pictures stay in order', () => {
        const model = createRowModel();
        model.add([
            entry('user', {
                content: [
                    {
                        text: '[Image #14] [Image #15]shot sending',
                        type: 'text',
                    },
                    picture('AAA'),
                    picture('BBB'),
                ],
                role: 'user',
            }),
        ]);
        const [row] = model.rows;
        expect(row?.text).toBe('shot sending');
        expect(row?.pictures.map((p) => [p.data, p.media])).toEqual([
            ['AAA', 'image/jpeg'],
            ['BBB', 'image/jpeg'],
        ]);
        expect(new Set(row?.pictures.map((p) => p.id)).size).toBe(2);
    });

    test('a queued command keeps its pictures', () => {
        const model = createRowModel();
        model.add([
            entry(
                'attachment',
                {},
                {
                    attachment: {
                        origin: { kind: 'human' },
                        prompt: [
                            { text: '[Image #1] look', type: 'text' },
                            picture('CCC'),
                        ],
                        source_uuid: 'cmd-1',
                        type: 'queued_command',
                    },
                },
            ),
        ]);
        expect(model.rows[0]?.text).toBe('look');
        expect(model.rows[0]?.pictures.map((p) => p.data)).toEqual(['CCC']);
    });

    test('path lines after the words come back as files: pictures by path, the rest as files, escapes undone', () => {
        const model = createRowModel();
        model.add([
            mine(
                'see these\n/Users/d/My\\ Shots/a.png\n/Users/d/notes\\ (1).md',
            ),
        ]);
        const [row] = model.rows;
        expect(row?.text).toBe('see these');
        expect(row?.pictures.map((p) => p.path)).toEqual([
            '/Users/d/My Shots/a.png',
        ]);
        expect(row?.files).toEqual(['/Users/d/notes (1).md']);
    });

    test.each([
        ['a path inside a sentence', 'open /tmp/a.png please'],
        ['a path line above more words', '/tmp/a.png\nis it there?'],
    ])('%s stays words', (_, said) => {
        const model = createRowModel();
        model.add([mine(said)]);
        expect(model.rows[0]?.text).toBe(said);
        expect(model.rows[0]?.pictures).toEqual([]);
    });

    test('a reply never takes his message fields', () => {
        const model = createRowModel();
        model.add([reply('[Image #1] /tmp/a.png')]);
        expect(model.rows[0]?.pictures).toEqual([]);
        expect(model.rows[0]?.text).toBe('[Image #1] /tmp/a.png');
    });
});
