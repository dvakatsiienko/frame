import type { On } from 'claude-code';
import { expect, mock, test } from 'claude-code/testing';

import { answerPrompts } from './said.ts';
import { liveStore } from './store.ts';
import { NOW, bash, tickOn } from './ticks-world.ts';

// FRM-661: an ask's text caps at 90 chars, so its pick carries the command, any length, and his one tick runs exactly that
// 18 Nov's x-herdr-deck-rename cleanup as clio asked it, one ask: a worktree remove plus a branch delete, 130 characters
const CLEANUP =
    'git -C ~/frame worktree remove --force .claude/worktrees/x-herdr-deck-rename && git -C ~/frame branch -D codie/x-herdr-deck-rename';
const SID = 't1t1t1t1-0000';
const PRESSES = `/home/.claude/shelf/orbit-ticks/${SID}.jsonl`;
type Ask = {
    id: string;
    isHerdrMark?: boolean;
    mark?: string;
    markedAt?: number;
    pick: string;
    text: string;
};
const ask = (over: Partial<Ask> = {}): Ask => ({
    id: 'o2',
    mark: 'accepted',
    pick: `run \`${CLEANUP}\``,
    text: 'x-herdr-deck-rename cleanup: remove its worktree and its branch',
    ...over,
});
// a press as x-herdr-deck writes it, the ask's text and pick as they stood when he pressed
const press = (a: Ask, over: Record<string, unknown> = {}) =>
    JSON.stringify({
        at: NOW,
        id: a.id,
        pick: a.pick,
        text: a.text,
        verdict: 'tick',
        ...over,
    });

// his press on x-herdr-deck for this session, read beside x-mod-stash's orbit for it; `ticks` the seat board's records
function world(
    on: On,
    {
        asks = [ask()],
        presses = [press(ask())],
        ticks = [],
    }: { asks?: Ask[]; presses?: string[]; ticks?: unknown[] } = {},
) {
    mock.clock(on, { now: NOW + 1_000 });
    liveStore(on);
    answerPrompts(on);
    const ran: string[] = [];
    const fail = new Set<string>();
    on('state.get', (_$, e, next) => {
        if (e.plugin === 'x-mod-stash' && e.key === 'ticks')
            return { value: { value: ticks, version: 1 } };
        if (e.plugin === 'x-mod-stash' && e.key === 'orbit')
            return { value: { value: { asks }, version: 1 } };
        return next(e);
    });
    on('fs.read', (_$, e) =>
        e.path === PRESSES
            ? { value: presses.join('\n') }
            : { deny: 'no such file' },
    );
    on('session.id', () => ({ value: SID }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: false }));
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', (_$, e) => {
        const command = 'command' in e ? String(e.command) : '';
        ran.push(command);
        return fail.has(command)
            ? { isError: true, result: {}, text: 'failed' }
            : { result: {}, text: 'ran' };
    });
    return { fail, ran };
}

test('his one herdr tick runs the 130-character command its pick quotes, once', async ($, on) => {
    const { ran } = world(on);
    const first = await bash($, CLEANUP);
    const second = await bash($, CLEANUP);
    expect([CLEANUP.length, first.deny, ran, second.deny]).toEqual([
        130,
        undefined,
        [CLEANUP],
        expect.stringContaining('nothing in this command ran'),
    ]);
});

test('a failed run of the picked command keeps his tick for the retry', async ($, on) => {
    const { fail, ran } = world(on);
    fail.add(CLEANUP);
    await bash($, CLEANUP);
    fail.delete(CLEANUP);
    await bash($, CLEANUP);
    expect(ran).toEqual([CLEANUP, CLEANUP]);
});

for (const [name, run] of [
    ['one character changed', CLEANUP.replace('rename', 'renamf')],
    ['an argument added', `${CLEANUP} --force`],
    [
        'a command chained with &&',
        `${CLEANUP} && git -C ~/frame branch -D main`,
    ],
    ['a command chained with ;', `${CLEANUP}; git -C ~/frame branch -D main`],
] as const)
    test(`a tick on the pick opens nothing for ${name}`, async ($, on) => {
        const { ran } = world(on);
        expect([(await bash($, run)).deny, ran]).toEqual([
            expect.stringContaining('nothing in this command ran'),
            [],
        ]);
    });

test('a pick a follow swapped after his press opens neither command', async ($, on) => {
    const swapped = ask({ pick: 'run `git -C ~/frame branch -D main`' });
    const { ran } = world(on, { asks: [swapped], presses: [press(ask())] });
    const r = [
        await bash($, CLEANUP),
        await bash($, 'git -C ~/frame branch -D main'),
    ];
    expect([r.map((x) => x.deny !== undefined), ran]).toEqual([
        [true, true],
        [],
    ]);
});

// wisphunter on 6e0349e9: the mark x-mod-stash kept never rebuilds a tick from a pick swapped while his press still sits
test('a herdr mark on a pick swapped since his press opens neither command', async ($, on) => {
    const swapped = ask({
        isHerdrMark: true,
        markedAt: NOW,
        pick: 'run `git -C ~/frame branch -D main`',
    });
    const { ran } = world(on, { asks: [swapped], presses: [press(ask())] });
    const r = [
        await bash($, CLEANUP),
        await bash($, 'git -C ~/frame branch -D main'),
    ];
    expect([r.map((x) => x.deny !== undefined), ran]).toEqual([
        [true, true],
        [],
    ]);
});

// clio's o5 of 19 Nov 14:0x: the old shape, the whole command in the text's one backtick span, ticked from herdr
test('an ask whose text quotes the command still opens it from a herdr tick', async ($, on) => {
    const o5 = ask({
        id: 'o5',
        pick: 'delete it',
        text: '⚠️ `git -C ~/frame branch -D keep/verify-pr-153`',
    });
    const { ran } = world(on, { asks: [o5], presses: [press(o5)] });
    const command = 'git -C ~/frame branch -D keep/verify-pr-153';
    expect([(await bash($, command)).deny, ran]).toEqual([
        undefined,
        [command],
    ]);
});

test('a press row from a deck that writes no pick still opens what the text quotes', async ($, on) => {
    const old = ask({ text: `⚠️ \`${'git branch -D foo'}\`` });
    const { ran } = world(on, {
        asks: [old],
        presses: [press(old, { pick: undefined })],
    });
    expect([(await bash($, 'git branch -D foo')).deny, ran]).toEqual([
        undefined,
        ['git branch -D foo'],
    ]);
});

test("a seat board tick whose record quotes the pick's command runs it once", async ($, on) => {
    const { ran } = world(on, {
        presses: [],
        ticks: [tickOn(CLEANUP, 'o2')],
    });
    await bash($, CLEANUP);
    expect([(await bash($, CLEANUP)).deny, ran]).toEqual([
        expect.stringContaining('nothing in this command ran'),
        [CLEANUP],
    ]);
});
