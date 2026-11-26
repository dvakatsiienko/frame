/// <reference types="node" />
// the quill-mini in memory, for its tests: a test file mocks herdr and gpui with `quill-mini-fakes.ts`, then imports this

import { createNotes } from './notes.js';
import { createQuillMini } from './quill-mini.js';
import { type El, at } from './quill-mini-fakes.ts';
import type { SelectedAt } from './selection.js';

export const raw = (el: unknown) =>
    el && typeof el === 'object' ? ((el as { raw?: El }).raw ?? null) : null;
const all = (el: unknown): El[] => {
    const own = raw(el);
    return own ? [own, ...own.kids.flatMap(all)] : [];
};
const ON = { joined: [], taken: [] };
export const selected = (words: string, id = 'r1'): SelectedAt => ({
    at: { x: 40, y: 100 },
    passage: {
        parts: [
            {
                block: 0,
                range: { end: words.length, start: 0 },
                source: words,
                words,
            },
        ],
        row: { at: null, id, kind: 'reply' },
    },
});
export const settle = async () => {
    // a held lock is asked for twenty times
    for (let i = 0; i < 300; i++) await Promise.resolve();
};

export function world() {
    const files = new Map<string, string>();
    const writes: string[] = [];
    const said = {
        chat: [] as (string | null)[],
        escapes: 0,
        isSending: null as boolean | null,
        lines: [] as string[],
        quill: 0,
        sent: [] as string[],
        sentAnswer: null as string | null,
        settles: 0,
        tab: [] as string[],
        tabs: [] as [string, boolean][],
    };
    const now = {
        broken: null as Error | null,
        isHeld: false,
        joins: ON as { joined: string[]; taken: string[] } | null,
        rowOf: (id: string) => id,
        /** herdr's answer to a send, when it is slow */
        sending: Promise.resolve(),
        thread: '/t/a.jsonl' as string | null,
    };
    const kept = new Map<string, string>();
    let ids = 0;
    let clock = 0;
    let drawn = 0;
    let pressedAt = 0;
    const notes = createNotes({
        dir: '/joins',
        io: {
            lock: async () => !now.isHeld,
            lockAge: async () => 0,
            now: () => clock,
            read: async (path) => files.get(path) ?? null,
            sleep: async (ms) => {
                clock += ms;
            },
            unlock: async () => {},
            write: async (path, text) => {
                writes.push(text);
                files.set(path, text);
            },
        },
        joinsOf: () => now.joins,
        linesWith: async () => [],
        logTrial: () => {},
        movedOn: (thread, id, next, cut) => mini.movedOn(thread, id, next, cut),
        newId: () => `id-${++ids}`,
        store: {
            getItem: (key) => kept.get(key) ?? null,
            removeItem: (key) => kept.delete(key),
            setItem: (key, text) => kept.set(key, text),
        },
    });
    const cx = {
        bind_keys: (keys: typeof at.keys) => at.keys.push(...keys),
        // each part of the box's row: the one Tab gave the keyboard is `at.held`
        focus_handle: () => {
            const handle = { focus: () => (at.held = handle) };
            at.handles.push(handle);
            return handle;
        },
        notify: () => {
            drawn += 1;
        },
        spawn: (job: (c: unknown) => unknown) => job(cx),
        stop_propagation: () => {},
        timer: {
            after: (ms: number, run: (c: unknown) => void) => {
                const timer = { ms, run: () => run(cx) };
                at.timers.push(timer);
                return {
                    cancel: () => {
                        at.timers = at.timers.filter((t) => t !== timer);
                    },
                    is_done: () => !at.timers.includes(timer),
                };
            },
        },
    };
    const mini = createQuillMini({
        back: () => 2,
        focusQuill: (isSending: boolean) => {
            said.quill += 1;
            said.isSending = isSending;
        },
        notes,
        pressEscape: () => {
            said.escapes += 1;
        },
        room: () => ({ height: 600, width: 800 }),
        rowOf: (id: string) => now.rowOf(id),
        say: (note: string | null) => said.chat.push(note),
        sendNote: async (id: string) => {
            said.sent.push(id);
            if (now.broken) throw now.broken;
            const out = await notes.release('/t/a.jsonl', id, 2);
            if ('reason' in out) return out.reason;
            said.lines.push(out.line);
            await now.sending;
            if (said.sentAnswer)
                notes.returned('/t/a.jsonl', id, said.sentAnswer);
            else notes.landed('/t/a.jsonl', id);
            return said.sentAnswer;
        },
        settle: () => {
            said.settles += 1;
        },
        tab: {
            ask: (from: string, isBack: boolean) =>
                said.tabs.push([from, isBack]),
            held: (stop: string) => said.tab.push(`held ${stop}`),
            left: (stop: string, later: (run: () => void) => void) => {
                said.tab.push(`left ${stop}`);
                later(() => said.tab.push('after'));
            },
        },
        thread: () => now.thread,
        threadName: () => 'clio',
    } as never);
    mini.start(cx as never);
    const el = () => mini.view({} as never);
    const words = () =>
        all(el()).flatMap((e) =>
            e.kids.filter((kid): kid is string => typeof kid === 'string'),
        );
    const byId = (id: string) => all(el()).find((e) => e.id === id);
    const act = (action: string) =>
        raw(el())?.handlers.get(action)?.({} as never, cx as never);
    return {
        act,
        button: (id: string) =>
            byId(id)?.handlers.get('on_click')?.({} as never, cx as never),
        byId,
        cx,
        drawn: () => drawn,
        f6: (on: SelectedAt | null = selected('some words'), later = 1000) => {
            pressedAt += later;
            mini.toggle(() => on, pressedAt, cx as never);
        },
        mini,
        note: (thread = '/t/a.jsonl') => notes.of(thread)[0] ?? null,
        notes,
        now,
        press: (action: string) => {
            act(action);
            raw(el())?.handlers.get('on_key_up')?.(
                { key: 'enter' } as never,
                cx as never,
            );
        },
        root: () => raw(el()),
        rows: () => files.get('/joins/a.jsonl') ?? '',
        run: () => {
            for (const { run } of at.timers.splice(0)) run();
        },
        said,
        top: () => raw(el())?.top,
        type: (text: string) => {
            at.box.text = text;
            at.box.on.get('change')?.({}, cx);
        },
        words,
        writes,
    };
}
export const ENTER = 'x_herdr_chat_mini_enter';
export const CMD_ENTER = 'x_herdr_chat_mini_cmd_enter';

/** every handler on an element and the elements in it */
export const pressable = (el: El | null | undefined): string[] =>
    el
        ? [
              ...el.handlers.keys(),
              ...el.kids.flatMap((kid) =>
                  pressable((kid as { raw?: El } | null)?.raw),
              ),
          ]
        : [];
