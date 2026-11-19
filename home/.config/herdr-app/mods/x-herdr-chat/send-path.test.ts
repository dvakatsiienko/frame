import { describe, expect, test, vi } from 'vitest';

vi.mock('herdr', () => ({
    exec: vi.fn(async () => ({ code: 0, stderr: '', stdout: '' })),
    hc: vi.fn(async () => ({ code: 0, stderr: '', stdout: '' })),
    home: () => '/h',
    readTextFile: vi.fn(async () => null),
    writeTextFile: vi.fn(async () => null),
}));

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
