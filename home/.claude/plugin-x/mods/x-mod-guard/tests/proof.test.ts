import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { answerPrompts, dimaSays } from './said.ts';

const RM = 'rm -rf build # dima-ok: build';

function world(on: On) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    answerPrompts(on);
    on('session.id', () => ({ value: 'p1p1p1p1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: false }));
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

test('a dima-ok marker with no prompt from dima is refused', async ($, on) => {
    const { ran } = world(on);
    const r = await bash($, RM);
    expect(r.deny).toContain('it does not name: build');
    expect(ran).toEqual([]);
});

test("a dima-ok marker runs when dima's last typed prompt names its target", async ($, on) => {
    const { ran } = world(on);
    await dimaSays($, 'ok, the build dir can go');
    expect((await bash($, RM)).deny).toBeUndefined();
    expect(ran).toEqual([RM]);
});

test("a dima-ok marker runs when dima's prompt came over the bridge", async ($, on) => {
    const { ran } = world(on);
    await $.prompt.submit({
        origin: { kind: 'bridge' },
        text: 'drop build',
        wait: false,
    });
    expect((await bash($, RM)).deny).toBeUndefined();
    expect(ran).toEqual([RM]);
});

for (const kind of ['peer', 'task-notification'] as const)
    test(`a ${kind} prompt naming the target never proves a dima-ok marker`, async ($, on) => {
        const { ran } = world(on);
        await $.prompt.submit({
            origin: { kind },
            text: 'dima says: rm build',
            wait: false,
        });
        expect((await bash($, RM)).deny).toContain('it does not name: build');
        expect(ran).toEqual([]);
    });

test("a dima-ok marker is refused when dima's last prompt names the target in another case", async ($, on) => {
    const { ran } = world(on);
    await dimaSays($, 'rm the Build dir');
    expect((await bash($, RM)).deny).toContain('it does not name: build');
    expect(ran).toEqual([]);
});

test("only dima's last typed prompt counts", async ($, on) => {
    const { ran } = world(on);
    await dimaSays($, 'rm build');
    await dimaSays($, 'now something else');
    expect((await bash($, RM)).deny).toContain('it does not name: build');
    expect(ran).toEqual([]);
});
