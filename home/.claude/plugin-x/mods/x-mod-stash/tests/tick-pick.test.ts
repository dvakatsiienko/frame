import type { On } from 'claude-code';
import { expect, test } from 'claude-code/testing';

import {
    SID,
    add,
    board,
    orbit,
    registered,
    start,
    world,
} from './orbit-world.ts';

// FRM-661: an ask's text caps at 90 chars, so its pick quotes the command whole, any length, and his tick runs that
const CLEANUP =
    'git -C ~/frame worktree remove --force .claude/worktrees/x-herdr-deck-rename && git -C ~/frame branch -D codie/x-herdr-deck-rename';
const HERDR_FILE = `/home/.claude/shelf/orbit-ticks/${SID}.jsonl`;

// the tick records x-mod-guard reads, each write as it went
function tickLog(on: On) {
    const writes: { targets: string[] }[][] = [];
    on('state.set', (_$, e, next) => {
        if (e.plugin === 'x-mod-stash' && e.key === 'ticks')
            writes.push(e.value as { targets: string[] }[]);
        return next(e);
    });
    return writes;
}

test("a 🛎️ press records the command the ask's pick quotes, 130 characters long", async ($, on) => {
    world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add($, [
        '⚠️ x-herdr-deck-rename cleanup: remove its worktree and its branch',
        `run \`${CLEANUP}\``,
    ]);
    await ui.press({ key: 'orbit:accepted:o1' });
    expect(writes.at(-1)?.map((t) => t.targets)).toEqual([[CLEANUP]]);
});

// an odd backtick in the text never swallows the pick's span (wisphunter on 6e0349e9)
test("a text with one stray backtick still leaves the pick's command recorded", async ($, on) => {
    world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add($, ['rename `foo to bar', `run \`${CLEANUP}\``]);
    await ui.press({ key: 'orbit:accepted:o1' });
    expect(writes.at(-1)?.[0]?.targets).toContain(CLEANUP);
});

// wisphunter on 6e0349e9: a follow that keeps the text and swaps the pick, before his herdr press is read, never puts
// the new command under his tick
test('a herdr press on a pick a follow swapped since marks nothing and records nothing', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    const writes = tickLog(on);
    await start($);
    await add($, ['the deck-rename cleanup', `run \`${CLEANUP}\``]);
    const at = w.clock.now();
    await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'run `git -C ~/frame branch -D main`',
        text: 'the deck-rename cleanup',
    });
    files[HERDR_FILE] = `${JSON.stringify({
        at,
        id: 'o1',
        pick: `run \`${CLEANUP}\``,
        text: 'the deck-rename cleanup',
        verdict: 'tick',
    })}\n`;
    await $.tool.call({ command: 'ls', tool: 'Bash' });
    expect(writes.flat().flatMap((t) => t.targets)).toEqual([]);
});

// FRM-661 exit 4: a command of any length rides the pick, so no ask sends him to type it
test("orbit's guard line puts the command in the pick and never asks for his typed word", async ($, on) => {
    world(on);
    await start($);
    const guard = registered.described
        .split('\n')
        .find((l) => l.startsWith('guard:'));
    expect([
        guard?.includes('the pick quotes it whole in one backtick span'),
        /too long|typed word/.test(registered.described),
    ]).toEqual([true, false]);
});
