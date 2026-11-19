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

// the / command rider (FRM-659 § 0, round 3): the send path tells the note under the quill that a slash command waits
function sent(message: string, isInTurn: boolean) {
    const said: (string | null)[] = [];
    const kept: Record<string, string> = {};
    const path = createSendPath({
        attachments: { of: () => [], take: () => [] } as never,
        isInTurn: () => isInTurn,
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

describe('a / command sent while the thread is in a turn says it waits', () => {
    test('in a turn, the quill reads that the command runs after this turn', async () => {
        const said = sent('/clio:halt wire+', true);
        await vi.waitFor(() =>
            expect(said).toContain('a / command runs after this turn'),
        );
    });

    test('an idle thread takes it now: no such note', async () => {
        const said = sent('/clio:halt wire+', false);
        await vi.waitFor(() => expect(said.length).toBeGreaterThan(0));
        expect(said).not.toContain('a / command runs after this turn');
    });
});
