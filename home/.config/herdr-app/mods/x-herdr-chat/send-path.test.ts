import { hc } from 'herdr';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('herdr', () => ({
    exec: vi.fn(async () => ({ code: 0, stderr: '', stdout: '' })),
    hc: vi.fn(async () => ({ code: 0, stderr: '', stdout: '' })),
    home: () => '/h',
    readTextFile: vi.fn(async () => null),
    writeTextFile: vi.fn(async () => null),
}));

import { createNotes } from './notes.js';
import { sendArgs } from './queued.js';
import { createQuills } from './quill.js';
import { createSendPath } from './send-path.js';

// a / command pushed (⌘ held) says nothing of its own under the quill (dima, 19 Nov 17:28)
function sent(message: string) {
    const said: (string | null)[] = [];
    const kept: Record<string, string> = {};
    const path = createSendPath({
        attachments: { of: () => [], take: () => [] } as never,
        pushed: () => {},
        quillBox: () => null,
        quills: createQuills({
            getItem: (key: string) => kept[key] ?? null,
            removeItem: (key: string) => {
                delete kept[key];
            },
            setItem: (key: string, value: string) => {
                kept[key] = value;
            },
        }),
        say: (note) => {
            said.push(note);
        },
        shownAddress: () => 't1',
        shownFile: () => '/t/a.jsonl',
        typingInto: new Set(),
    });
    const cx = {
        notify: () => {},
        spawn: (run: (cx: unknown) => unknown) => run(cx),
        timer: { after: () => {} },
    };
    path.push({ value: () => message } as never, cx as never);
    return said;
}

test('a pushed / command leaves no note under the quill', async () => {
    const said = sent('/clio:halt wire+');
    await vi.waitFor(() => expect(said.length).toBeGreaterThan(0));
    expect(said).toEqual([null]);
});

// FRM-585 A3: words and a picture wait in the quill, one note waits to join
describe('a note sent now', () => {
    const FILE = '/h/.claude/shelf/herdr-joins/a.jsonl';
    const THREAD = '/t/a.jsonl';
    async function waiting() {
        const files = new Map<string, string>();
        const on = { joined: [], push: [], taken: [], waiting: [] };
        const kept = new Map<string, string>();
        const store = {
            getItem: (key: string) => kept.get(key) ?? null,
            removeItem: (key: string) => kept.delete(key),
            setItem: (key: string, text: string) => kept.set(key, text),
        };
        const notes = createNotes({
            dir: '/h/.claude/shelf/herdr-joins',
            io: {
                lock: async () => true,
                lockAge: async () => 0,
                now: () => 1_000,
                read: async (path) => files.get(path) ?? null,
                sleep: async () => {},
                unlock: async () => {},
                write: async (path, text) => {
                    files.set(path, text);
                },
            },
            joinsOf: () => on,
            linesWith: async () => [],
            logTrial: () => {},
            movedOn: () => {},
            newId: () => 'id-1',
            store,
        });
        const quills = createQuills(store);
        quills.apply(THREAD, { text: 'in the quill', type: 'typed' });
        const take = vi.fn(() => ['/a.png']);
        const typingInto = new Set<string>();
        const popped: string[] = [];
        const said: (string | null)[] = [];
        const path = createSendPath({
            attachments: { of: () => [], take } as never,
            editorMode: () => null,
            notePulled: (file, words) => notes.pulled(file, words),
            popped: () => popped,
            pushed: () => {},
            quillBox: () => null,
            quills,
            resetPopped: () => {},
            say: (note) => {
                said.push(note);
            },
            shownAddress: () => 't1',
            shownFile: () => THREAD,
            typingInto,
        });
        path.takeJoins(on);
        const { id } = notes.open(THREAD, {
            parts: [{ block: 0, range: null, source: 'w', words: 'the retry' }],
            row: { at: null, id: '1a2b3c4d-0', kind: 'reply' },
        });
        notes.typed(THREAD, id, 'why?');
        await notes.join(THREAD, id, 3);
        const note = () => notes.of(THREAD).find((n) => n.id === id);
        return {
            files,
            id,
            note,
            notes,
            path,
            popped,
            quills,
            said,
            take,
            typingInto,
        };
    }
    beforeEach(() => {
        vi.mocked(hc).mockReset();
        vi.mocked(hc).mockResolvedValue({
            code: 0,
            stderr: '',
            stdout: '',
        } as never);
    });

    test('goes alone, its row out first; the quill’s words and picture stay', async () => {
        const w = await waiting();
        expect(w.files.get(FILE)).toContain('why?');
        const rowAtSend: (string | undefined)[] = [];
        vi.mocked(hc).mockImplementationOnce(async () => {
            rowAtSend.push(w.files.get(FILE));
            return { code: 0, stderr: '', stdout: '' } as never;
        });
        expect(await w.path.sendNote(w.notes, w.id, 2)).toBeNull();
        expect(rowAtSend).toEqual(['']);
        expect(vi.mocked(hc).mock.calls).toHaveLength(1);
        expect(vi.mocked(hc).mock.calls[0]?.[0]).toEqual(
            sendArgs(
                't1',
                'dima on "the retry" (reply 1a2b3c4d, 2 back): why?',
            ),
        );
        expect(w.take).not.toHaveBeenCalled();
        expect(
            w.quills.show(THREAD, { set_value() {}, value: () => '' } as never),
        ).toBe('in the quill');
        expect(w.note()?.state).toBe('sent');
    });

    test('refused, it is a draft with its words and why', async () => {
        const w = await waiting();
        vi.mocked(hc).mockResolvedValueOnce({
            code: 1,
            stderr: 'no thread',
            stdout: '',
        } as never);
        expect(await w.path.sendNote(w.notes, w.id, 2)).toBe(
            'Not sent: no thread',
        );
        expect(w.note()).toMatchObject({
            reason: 'Not sent: no thread',
            state: 'draft',
            text: 'why?',
        });
    });

    test('while a pick types into the thread it waits where it is', async () => {
        const w = await waiting();
        w.typingInto.add('t1');
        expect(await w.path.sendNote(w.notes, w.id, 2)).toBeTruthy();
        expect(vi.mocked(hc)).not.toHaveBeenCalled();
        expect(w.note()?.state).toBe('waiting');
    });

    test.each([
        ['it', 'sent', 'draft', 'in the quill', 'Back in its note'],
        ['another message', 'else', 'sent', 'else\n\nin the quill', null],
    ])(
        'its × pulls %s out of the queue',
        async (_what, crossed, state, quill, note) => {
            const w = await waiting();
            await w.path.sendNote(w.notes, w.id, 2);
            const line = 'dima on "the retry" (reply 1a2b3c4d, 2 back): why?';
            const queued = crossed === 'sent' ? line : crossed;
            vi.mocked(hc).mockImplementation(
                async (args) =>
                    ({
                        code: 0,
                        stderr: '',
                        stdout:
                            args[0] === 'read'
                                ? 'Press up to edit queued messages\n───\n❯ \n───'
                                : '',
                    }) as never,
            );
            w.popped.push(queued);
            w.path.unsend(queued, {
                notify: () => {},
                sleep: async () => {},
                spawn: (run: (cx: unknown) => unknown) =>
                    run({ notify: () => {}, sleep: async () => {} }),
            } as never);
            await vi.waitFor(() => expect(w.said.length).toBeGreaterThan(0));
            expect([w.note()?.state, w.note()?.text, w.said]).toEqual([
                state,
                'why?',
                [note],
            ]);
            expect(
                w.quills.show(THREAD, {
                    set_value() {},
                    value: () => '',
                } as never),
            ).toBe(quill);
        },
    );

    test.each([
        [
            'Claude’s box kept some of it',
            '❯ left over',
            0,
            'else\n\nin the quill',
            "Claude's box kept «left over»: 1 in your quill, 1 back in its note",
        ],
        [
            'it could not go again',
            '❯ ',
            1,
            'in the quill',
            'Not sent again: 1 back in its note',
        ],
    ])(
        'another’s × pulled it too, and %s: its words are its note’s',
        async (_what, left, code, quill, note) => {
            const w = await waiting();
            await w.path.sendNote(w.notes, w.id, 2);
            const line = 'dima on "the retry" (reply 1a2b3c4d, 2 back): why?';
            let isPulled = false;
            vi.mocked(hc).mockImplementation(async (args) => {
                const isRead = args[0] === 'read';
                if (args[0] === 'keys') isPulled = true;
                return {
                    code: isRead || args[0] === 'keys' ? 0 : code,
                    stderr: '',
                    stdout: isRead
                        ? `Press up to edit queued messages\n───\n${isPulled ? left : '❯ '}\n───`
                        : '',
                } as never;
            });
            w.popped.push('else', line);
            w.path.unsend('else', {
                notify: () => {},
                sleep: async () => {},
                spawn: (run: (cx: unknown) => unknown) =>
                    run({ notify: () => {}, sleep: async () => {} }),
            } as never);
            await vi.waitFor(() => expect(w.said.length).toBeGreaterThan(0));
            expect([w.note()?.state, w.note()?.text, w.said]).toEqual([
                'draft',
                'why?',
                [note],
            ]);
            expect(
                w.quills.show(THREAD, {
                    set_value() {},
                    value: () => '',
                } as never),
            ).toBe(code ? `else\n\n${quill}` : quill);
        },
    );
});
