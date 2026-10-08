import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const SID = 'a1a1a1a1-0000';
const QUEUE = '/home/.claude/shelf/stash/pocket-queue.md';

// one session with two open asks; queue: the file as it stands before the prompt
async function world($: Engine, on: On, queue?: string) {
    mock.clock(on, { now: new Date(2026, 9, 8, 14, 10).getTime() });
    const store = new Map<string, unknown>([
        [
            `asks:${SID}`,
            {
                asks: [
                    'purge the history ➡️ after the push',
                    'drop the old tag',
                ],
                at: 1,
                label: 'frame',
            },
        ],
    ]);
    on('store.get', (_$, e) => ({ value: store.get(e.key) }));
    on('store.set', (_$, e) => {
        store.set(e.key, e.value);
        return { value: undefined };
    });
    on('store.keys', () => ({ value: [...store.keys()] }));
    on('store.delete', (_$, e) => {
        store.delete(e.key);
        return { value: undefined };
    });
    const written: { path: string; text: string }[] = [];
    on('session.id', () => ({ value: SID }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.read', (_$, e) => {
        if (e.path === QUEUE && queue !== undefined) return { value: queue };
        throw new Error('ENOENT');
    });
    on('fs.write', (_$, e) => {
        written.push({ path: e.path, text: e.text });
        return { value: undefined };
    });
    on('prompt.submit', (_$, e) => ({ text: e.text }));
    return { written };
}

const say = ($: Engine, text: string, kind = 'composer' as const) =>
    $.prompt.submit({ origin: { kind }, text });

test('a «yes, after X» verdict queues its pocket line', async ($, on) => {
    const w = await world($, on);
    await say($, '1. yes, after the push\n2. no');
    expect(w.written).toEqual([
        {
            path: QUEUE,
            text: '- 2026-10-08 14:10 · after the push · purge the history ➡️ after the push\n',
        },
    ]);
});

test('a queued line is appended after the lines already there', async ($, on) => {
    const w = await world($, on, '- older line\n');
    await say($, '2. Yes after the tag lands');
    expect(w.written[0]?.text).toBe(
        '- older line\n- 2026-10-08 14:10 · after the tag lands · drop the old tag\n',
    );
});

test('a plain yes queues nothing', async ($, on) => {
    const w = await world($, on);
    await say($, '1. yes\n2. yes');
    expect(w.written).toEqual([]);
});
