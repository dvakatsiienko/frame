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

// FRM-427 slice 06 (o197): a sign lands only on dima's tick on a sign ask, `✍️ sign <id>: <title>`, the id whole;
// warn-only until the verifier's clean, so «refused» reads as the would-refuse note
const signFlagged = (context: readonly string[] | undefined) =>
    (context ?? []).some((l) => l.includes('rule sign-untick'));
const SIGN = 'x linear set FRM-1 --add-label signed';

for (const [why, ticks] of [
    ['no tick', []],
    ['a tick on «FRM-14 …»', [tick('✍️ sign FRM-14: a longer ticket')]],
    ['a non-sign tick naming FRM-1', [tick('rename FRM-1 → orbit ticks')]],
] as const)
    test(`a signed label with ${why} is flagged`, async ($, on) => {
        world(on, [...ticks]);
        expect(signFlagged((await bash($, SIGN)).context)).toBe(true);
    });

for (const typed of [
    SIGN,
    'x linear set FRM-1 --add-label agent,signed',
    'x linear set --add-label=signed FRM-1',
])
    test(`a signed label on a sign tick naming FRM-1 runs unflagged: ${typed}`, async ($, on) => {
        const { ran } = world(on, [tick('✍️ sign FRM-1: orbit ticks')]);
        const r = await bash($, typed);
        expect([signFlagged(r.context), ran]).toEqual([false, [typed]]);
    });

test('another label runs unflagged with no tick', async ($, on) => {
    world(on);
    const r = await bash($, 'x linear set FRM-1 --add-label agent');
    expect(signFlagged(r.context)).toBe(false);
});

const today = () => {
    const d = new Date(NOW);
    const two = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
};
for (const [line, isFlagged] of [
    [`✍️ signed ${today()} · body 5a0d10c0`, true],
    [`✍️ re-signed ${today()} — a rider`, true],
    ['✍️ signed 2026-10-23 · body 5a0d10c0', false],
] as const)
    test(`a body set holding «${line.slice(0, 22)}» is ${isFlagged ? 'flagged' : 'unflagged'} with no tick`, async ($, on) => {
        world(on);
        on('fs.read', () => ({
            value: `## wish\n\nx\n\n## signed\n\n${line}\n`,
        }));
        const r = await bash($, 'x linear body FRM-1 --set /repo/b.md');
        expect(signFlagged(r.context)).toBe(isFlagged);
    });

// the want line, FRM-427 exit 10: the 10-22 o4/o9 case — one ask quoting a guarded target and the pr, ticked once — and
// both doors pass with no typed turn; a tick spends per what it authorized, so one ask carries both
test('the o4/o9 replay: one tick quoting a guarded target and a pr passes both doors', async ($, on) => {
    const MERGE = 'x lane merge-auto 104 --apply --dima-ok 104';
    const { ran } = world(on, [
        tick(`⚠️ land ${PR}, then mirror: \`${MIRROR}\``),
    ]);
    const pushed = await bash($, MIRROR);
    const merged = await bash($, MERGE);
    const again = await bash($, MIRROR);
    expect([pushed.deny, merged.deny, again.deny !== undefined, ran]).toEqual([
        undefined,
        undefined,
        true,
        [MIRROR, MERGE],
    ]);
});

// review round 1: the merge-auto flag lands only on a plain call, never past a compound one's other refusals; a sign's
// label and body each take the tick once; a target counts only quoted in backticks
test('a compound merge-auto call never gets the flag appended', async ($, on) => {
    const typed = 'x lane merge-auto 104 --apply && echo ok';
    const { ran } = world(on, [tick(`merge ${PR}`)]);
    await bash($, typed);
    expect(ran).toEqual([typed]);
});

test('a ticked pr never runs a compound command past its other refusal', async ($, on) => {
    const { ran } = world(on, [tick(`merge ${PR}`)]);
    const r = await bash($, 'x lane merge-auto 104 --apply; rm -rf build');
    expect([r.deny !== undefined, ran]).toEqual([true, []]);
});

test("one sign tick carries the label and the body's sign line", async ($, on) => {
    world(on, [tick('✍️ sign FRM-1: orbit ticks')]);
    on('fs.read', () => ({
        value: `## signed\n\n✍️ signed ${today()} · body 1\n`,
    }));
    const label = await bash($, SIGN);
    const body = await bash($, 'x linear body FRM-1 --set /repo/b.md');
    expect([signFlagged(label.context), signFlagged(body.context)]).toEqual([
        false,
        false,
    ]);
});

test('a target named in prose but never quoted proves nothing', async ($, on) => {
    const { ran } = world(on, [tick('⚠️ mirror the backup to origin')]);
    expect([(await bash($, MIRROR)).deny !== undefined, ran]).toEqual([
        true,
        [],
    ]);
});
