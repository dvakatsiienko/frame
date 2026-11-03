import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { answerPrompts, dimaSays } from './said.ts';
import { liveStore } from './store.ts';

// FRM-426: dima's prompt naming the stash, a kill verb and the repo lets `git stash drop` through in that repo only
function world(on: On, cwd = '/home/projects/frame') {
    mock.clock(on, { now: 1_000_000 });
    liveStore(on);
    const ran: string[] = [];
    answerPrompts(on);
    on('session.id', () => ({ value: 's1s1s1s1-0000' }));
    on('session.cwd', () => ({ value: cwd }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: false }));
    on('ui.log', () => ({ value: undefined }));
    // the toplevel of the dir after -C: the repo a drop runs in
    on('process.run', (_$, e) => ({
        value: {
            exitCode: 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: `${e.argv[2] ?? cwd}\n`,
        },
    }));
    on('turn.complete', () => ({ text: '' }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

const THROWN = 'throws away set-aside work';
const DROP_BYTES = 'git -C ~/projects/bytes stash drop';

test('a drop in the repo dima named runs on his kill-the-stash prompt', async ($, on) => {
    const { ran } = world(on);
    await dimaSays($, 'kill the stash in bytes git');
    expect((await bash($, DROP_BYTES)).deny).toBeUndefined();
    expect(ran).toEqual([DROP_BYTES]);
});

test('the same drop in another repo stays refused', async ($, on) => {
    const { ran } = world(on);
    await dimaSays($, 'kill the stash in bytes git');
    expect((await bash($, 'git -C ~/frame stash drop')).deny).toContain(THROWN);
    expect(ran).toEqual([]);
});

test('stash clear stays refused after a prompt that says only kill', async ($, on) => {
    const { ran } = world(on);
    await dimaSays($, 'kill the stash in bytes git');
    expect(
        (await bash($, 'git -C ~/projects/bytes stash clear')).deny,
    ).toContain(THROWN);
    expect(ran).toEqual([]);
});

test('stash clear runs when dima says clear all stashes in the repo', async ($, on) => {
    const { ran } = world(on);
    await dimaSays($, 'clear all stashes in bytes');
    const clear = 'git -C ~/projects/bytes stash clear';
    expect((await bash($, clear)).deny).toBeUndefined();
    expect(ran).toEqual([clear]);
});

test('a prompt naming x-mod-stash is not a word on the stash', async ($, on) => {
    const { ran } = world(on);
    await dimaSays($, 'x-mod-stash orbit tick is broken');
    expect((await bash($, 'git stash drop')).deny).toContain(THROWN);
    expect(ran).toEqual([]);
});

test('a later turn keeps the refusal: his word holds for the turn he typed it in', async ($, on) => {
    const { ran } = world(on);
    await dimaSays($, 'kill the stash in bytes git');
    await $.turn.complete({
        answer: '',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });
    expect((await bash($, DROP_BYTES)).deny).toContain(THROWN);
    expect(ran).toEqual([]);
});

test("a negated kill ask keeps the refusal: «don't drop the stash in bytes»", async ($, on) => {
    const { ran } = world(on);
    await dimaSays($, "don't drop the stash in bytes");
    expect((await bash($, DROP_BYTES)).deny).toContain(THROWN);
    expect(ran).toEqual([]);
});

for (const redirected of [
    'GIT_DIR=/home/frame/.git git -C ~/projects/bytes stash drop',
    'git --git-dir=/home/frame/.git -C ~/projects/bytes stash drop',
    'git --work-tree=/home/frame -C ~/projects/bytes stash drop',
])
    test(`a drop pointed at another repo by env or flag stays refused: ${redirected.slice(0, 40)}`, async ($, on) => {
        const { ran } = world(on);
        await dimaSays($, 'kill the stash in bytes git');
        expect((await bash($, redirected)).deny).toContain(THROWN);
        expect(ran).toEqual([]);
    });

test("«that's all» never widens a drop into a stash clear", async ($, on) => {
    const { ran } = world(on);
    await dimaSays($, "drop the stash in bytes, that's all");
    expect(
        (await bash($, 'git -C ~/projects/bytes stash clear')).deny,
    ).toContain(THROWN);
    expect(ran).toEqual([]);
});

test('«clearly» is not a kill verb', async ($, on) => {
    const { ran } = world(on);
    await dimaSays($, 'clearly the bytes stash matters, build it');
    expect((await bash($, DROP_BYTES)).deny).toContain(THROWN);
    expect(ran).toEqual([]);
});

test('a negated ask keeps the refusal', async ($, on) => {
    const { ran } = world(on);
    await dimaSays($, "don't touch the stash in bytes");
    expect((await bash($, DROP_BYTES)).deny).toContain(THROWN);
    expect(ran).toEqual([]);
});

test('a drop beside a nested shell is never let through', async ($, on) => {
    const { ran } = world(on);
    await dimaSays($, 'kill the stash in bytes git');
    expect(
        (await bash($, `${DROP_BYTES} && bash -c 'git stash drop'`)).deny,
    ).toContain(THROWN);
    expect(ran).toEqual([]);
});

// FRM-472 R3 row 4: the lift reads every command a refusal reads, so a kill nested in another repo never rides it
const NESTED_FRAME_KILLS = [
    ['find -exec', String.raw`find . -exec git -C ~/frame stash clear \;`],
    ['env -S', "env -S 'git -C ~/frame stash clear'"],
    ['a function body', 'f() { git -C ~/frame stash clear; }; f'],
] as const;
// FRM-472 R3 row 6: the lift reads the git dir the shell sees, quotes and GIT_COMMON_DIR included
const MOVED = [
    [
        'a GIT_DIR split by quotes',
        'export "GIT_""DIR=/home/projects/bytes/.git"; git stash drop',
    ],
    [
        'a GIT_COMMON_DIR',
        'GIT_COMMON_DIR=/home/projects/bytes/.git git stash drop',
    ],
] as const;
for (const [shape, command] of MOVED)
    test(`a drop moved to another repo stays refused: ${shape}`, async ($, on) => {
        const { ran } = world(on);
        await dimaSays($, 'kill the stash in frame git');
        expect((await bash($, command)).deny).toContain(THROWN);
        expect(ran).toEqual([]);
    });

for (const [shape, nested] of NESTED_FRAME_KILLS)
    test(`a kill in another repo nested beside the asked one stays refused: ${shape}`, async ($, on) => {
        const { ran } = world(on);
        await dimaSays($, 'kill the stash in bytes git');
        expect((await bash($, `${DROP_BYTES} && ${nested}`)).deny).toContain(
            THROWN,
        );
        expect(ran).toEqual([]);
    });
