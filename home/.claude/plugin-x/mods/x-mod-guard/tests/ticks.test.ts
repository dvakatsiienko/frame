import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { answerPrompts, dimaSays } from './said.ts';
import { liveStore } from './store.ts';

// FRM-427: dima's tick on an orbit ask is his word, read from x-mod-stash's own $.state — the one record only his
// press writes; a tick is spent by its first use
const NOW = 1_000_000;
type Tick = { at: number; id: string; targets: string[]; text: string };

function world(on: On, ticks: Tick[] = []) {
    mock.clock(on, { now: NOW });
    const store = liveStore(on);
    const ran: string[] = [];
    answerPrompts(on);
    on('state.get', (_$, e, next) =>
        e.plugin === 'x-mod-stash' && e.key === 'ticks'
            ? { value: { value: ticks, version: 1 } }
            : next(e),
    );
    on('session.id', () => ({ value: 't1t1t1t1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: false }));
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran, store };
}

const tick = (text: string, at = NOW - 1): Tick => ({
    at,
    id: 'o4',
    targets: [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1] as string),
    text,
});
const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

const MIRROR = 'git push --mirror origin';
const PR = 'https://github.com/dvakatsiienko/bytes/pull/104';

test('a ticked ask quoting the guarded command lets it run with no # dima-ok', async ($, on) => {
    const { ran } = world(on, [tick(`⚠️ mirror: \`${MIRROR}\``)]);
    const r = await bash($, MIRROR);
    expect([r.deny, ran]).toEqual([undefined, [MIRROR]]);
});

test('a tick is spent by its first use: the second run is refused', async ($, on) => {
    const { ran } = world(on, [tick(`⚠️ mirror: \`${MIRROR}\``)]);
    await bash($, MIRROR);
    const r = await bash($, MIRROR);
    expect([r.deny, ran]).toEqual([
        expect.stringContaining('mirror'),
        [MIRROR],
    ]);
});

test('a tick quoting only part of the target leaves it refused', async ($, on) => {
    const { ran } = world(on, [
        tick('⚠️ mirror: `git push --mirror` to the backup'),
    ]);
    const r = await bash($, MIRROR);
    expect([r.deny, ran]).toEqual([expect.stringContaining('origin'), []]);
});

test('a tick still in its sending window is not his word yet', async ($, on) => {
    const { ran } = world(on, [tick(`⚠️ mirror: \`${MIRROR}\``, NOW + 4_000)]);
    expect([(await bash($, MIRROR)).deny !== undefined, ran]).toEqual([
        true,
        [],
    ]);
});

test('a tick planted in the shared store, as Bash or another session could, is ignored', async ($, on) => {
    const { ran, store } = world(on);
    store.set('ticks', [tick(`⚠️ mirror: \`${MIRROR}\``)]);
    expect([(await bash($, MIRROR)).deny !== undefined, ran]).toEqual([
        true,
        [],
    ]);
});

test('a # dima-ok marker his prompt never named runs on a tick naming its target', async ($, on) => {
    const { ran } = world(on, [tick(`⚠️ mirror: \`${MIRROR}\``)]);
    await dimaSays($, 'unrelated');
    const marked = `${MIRROR} # dima-ok: origin`;
    expect([(await bash($, marked)).deny, ran]).toEqual([undefined, [marked]]);
});

// FRM-427 slice 02: merge-auto trusts the guard's proof of --dima-ok (merge_auto.go); a tick quoting the pr is that proof
test("merge-auto's typed --dima-ok runs on a tick quoting the pr url", async ($, on) => {
    const MERGE = 'x lane merge-auto 104 --apply --dima-ok 104';
    const { ran } = world(on, [tick(`merge ${PR}`)]);
    expect([(await bash($, MERGE)).deny, ran]).toEqual([undefined, [MERGE]]);
});

test('a bare merge-auto --apply on a tick quoting the pr carries --dima-ok', async ($, on) => {
    const { ran } = world(on, [tick(`merge ${PR}`)]);
    const r = await bash($, 'x lane merge-auto 104 --apply');
    expect([r.deny, ran]).toEqual([
        undefined,
        ['x lane merge-auto 104 --apply --dima-ok 104'],
    ]);
});

test('the brake never takes a tick: --release-brake still needs his typed word', async ($, on) => {
    const { ran } = world(on, [tick(`merge ${PR}`)]);
    const r = await bash(
        $,
        'x lane merge-auto 104 --apply --release-brake --dima-ok 104',
    );
    expect([r.deny !== undefined, ran]).toEqual([true, []]);
});

test('a tick quoting another pr proves nothing for this one', async ($, on) => {
    const { ran } = world(on, [tick(`merge ${PR}1`)]);
    const bare = await bash($, 'x lane merge-auto 104 --apply');
    const typed = await bash($, 'x lane merge-auto 104 --apply --dima-ok 104');
    expect([bare.deny, typed.deny !== undefined, ran]).toEqual([
        undefined,
        true,
        ['x lane merge-auto 104 --apply'],
    ]);
});
