import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { answerPrompts, dimaSays } from './said.ts';
import { liveStore } from './store.ts';

// FRM-427: dima's tick on an orbit ask is his word, read from x-mod-stash's own $.state — the one record only his
// press writes; a tick is spent by its first use
const NOW = 1_000_000;
type Tick = { at: number; id: string; targets: string[]; text: string };

// `body` is the ticket's current description as linear holds it; none = linear cannot be read
// cat: what a `cat` of the body file prints, when the hook's own read cannot reach it
function world(on: On, ticks: Tick[] = [], body?: string, cat?: string) {
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
    // the cwd's origin, which merge-auto reads its repo from when no --repo names one
    on('process.run', (_$, e) => ({
        value: {
            exitCode:
                (e.argv.includes('read') && body === undefined) ||
                (e.argv[0] === 'cat' && cat === undefined)
                    ? 1
                    : 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout:
                e.argv[0] === 'cat'
                    ? (cat ?? '')
                    : e.argv.includes('get-url')
                      ? 'git@github.com:dvakatsiienko/bytes.git\n'
                      : e.argv.includes('read')
                        ? JSON.stringify({
                              data: { tickets: [{ description: body }] },
                          })
                        : '',
        },
    }));
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

// FRM-478 rider (W745–W746): a tick on «⚠️ merge <repo>#<n>» carries his word like the url does; only his newest tick
// counts, as only his last typed prompt does
const BARE = 'x lane merge-auto 104 --apply';
const FLAGGED = `${BARE} --dima-ok 104`;
for (const [why, ticks, isCarried] of [
    [
        'a tick on «⚠️ merge bytes#104»',
        [tick('⚠️ merge bytes#104: the guard fix')],
        true,
    ],
    ['no tick', [], false],
    ['a tick on another pr', [tick('⚠️ merge bytes#1045: another')], false],
    ["a tick on another repo's pr", [tick('⚠️ merge frame#104: frame')], false],
    [
        'a tick naming the pr without «merge»',
        [tick('read bytes#104 first')],
        false,
    ],
    [
        'a tick on «do not merge bytes#104»',
        [tick('do not merge bytes#104 yet')],
        false,
    ],
    [
        'a tick on another repo of a like name',
        [tick('⚠️ merge bytesX#104: no')],
        false,
    ],
    [
        'a merge tick a newer tick superseded',
        [
            tick('⚠️ merge bytes#104: the guard fix', NOW - 10),
            tick('next: the docs', NOW - 1),
        ],
        false,
    ],
] as const)
    test(`a bare merge-auto --apply on ${why} ${isCarried ? 'carries' : 'gets no'} --dima-ok`, async ($, on) => {
        const { ran } = world(on, [...ticks]);
        await bash($, BARE);
        expect(ran).toEqual([isCarried ? FLAGGED : BARE]);
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
// refused since the sixth sense's clean (round 2), the refusal naming the sign ask to tick
const signFlagged = (r: { deny?: string }) =>
    (r.deny ?? '').includes('then sign');
const SIGN = 'x linear set FRM-1 --add-label signed';

// R3: a sign rides no other door — a tick on the line's guarded command or its pr never carries the sign
for (const [why, line, ticks] of [
    [
        'a ticked mirror push',
        `${MIRROR} && ${SIGN}`,
        [tick(`⚠️ mirror: \`${MIRROR}\``)],
    ],
    [
        'a ticked merge-auto',
        `x lane merge-auto 104 --apply && ${SIGN}`,
        [tick(`merge ${PR}`)],
    ],
] as const)
    test(`a sign chained after ${why} is still refused`, async ($, on) => {
        const { ran } = world(on, [...ticks]);
        const r = await bash($, line);
        expect([signFlagged(r), ran]).toEqual([true, []]);
    });

for (const [why, ticks] of [
    ['no tick', []],
    ['a tick on «FRM-14 …»', [tick('✍️ sign FRM-14: a longer ticket')]],
    ['a non-sign tick naming FRM-1', [tick('rename FRM-1 → orbit ticks')]],
] as const)
    test(`a signed label with ${why} is refused`, async ($, on) => {
        world(on, [...ticks]);
        expect(signFlagged(await bash($, SIGN))).toBe(true);
    });

for (const typed of [
    SIGN,
    'x linear set FRM-1 --add-label agent,signed',
    'x linear set --add-label=signed FRM-1',
])
    test(`a signed label on a sign tick naming FRM-1 runs: ${typed}`, async ($, on) => {
        const { ran } = world(on, [tick('✍️ sign FRM-1: orbit ticks')]);
        const r = await bash($, typed);
        expect([signFlagged(r), ran]).toEqual([false, [typed]]);
    });

// FRM-459 (o49): one sign ask may name several tickets, and its one tick signs each of them
for (const text of [
    '✍️ sign FRM-1, FRM-2: two small tickets',
    '✍️ sign FRM-1 and FRM-2: two small tickets',
    '✍️ sign FRM-1 FRM-2: two small tickets',
])
    test(`one tick on «${text.slice(0, 26)}» signs both ids it names`, async ($, on) => {
        const { ran } = world(on, [tick(text)]);
        const one = await bash($, 'x linear set FRM-1 --add-label signed');
        const two = await bash($, 'x linear set FRM-2 --add-label signed');
        expect([signFlagged(one), signFlagged(two), ran.length]).toEqual([
            false,
            false,
            2,
        ]);
    });

for (const [why, id, text] of [
    ['an id the ask does not name', 'FRM-3', '✍️ sign FRM-1, FRM-2: two'],
    [
        'a longer id that starts with a named one',
        'FRM-14',
        '✍️ sign FRM-1, FRM-2: two',
    ],
    ['an id past the colon', 'FRM-3', '✍️ sign FRM-1: also FRM-3'],
] as const)
    test(`a batch tick does not sign ${why}`, async ($, on) => {
        world(on, [tick(text)]);
        const r = await bash($, `x linear set ${id} --add-label signed`);
        expect(signFlagged(r)).toBe(true);
    });

test('a batch tick is spent per id: a second sign of the same id is refused', async ($, on) => {
    world(on, [tick('✍️ sign FRM-1, FRM-2: two small tickets')]);
    await bash($, 'x linear set FRM-1 --add-label signed');
    const again = await bash($, 'x linear set FRM-1 --add-label signed');
    expect(signFlagged(again)).toBe(true);
});

test('another label runs with no tick', async ($, on) => {
    world(on);
    const r = await bash($, 'x linear set FRM-1 --add-label agent');
    expect(signFlagged(r)).toBe(false);
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
    test(`a body set holding «${line.slice(0, 22)}» is ${isFlagged ? 'refused' : 'run'} with no tick`, async ($, on) => {
        world(on);
        on('fs.read', () => ({
            value: `## wish\n\nx\n\n## signed\n\n${line}\n`,
        }));
        const r = await bash($, 'x linear body FRM-1 --set /repo/b.md');
        expect(signFlagged(r)).toBe(isFlagged);
    });

// FRM-478 rider: a body write on a ticket signed today carries that sign line unchanged; only a sign line the current
// body lacks is a new sign
const SIGNED_TODAY = () =>
    `## wish\n\n* W1 (2026-10-30, dima): x\n\n## signed\n\n✍️ signed ${today()} · body 5a0d10c0\n`;
const TINY = () =>
    `${SIGNED_TODAY().replace('W1 ', 'W609 ')}✏️ changed ${today()} — W1 renumbered W609, no re-sign: tiny · body 77aa00ff\n`;
for (const [why, current, next, isFlagged] of [
    ["a tiny write keeping today's sign line", SIGNED_TODAY, TINY, false],
    [
        "a write changing today's sign line",
        SIGNED_TODAY,
        () => SIGNED_TODAY().replace('5a0d10c0', '99999999'),
        true,
    ],
    [
        'a sign line the body lacks',
        () => SIGNED_TODAY().split('✍️')[0] ?? '',
        SIGNED_TODAY,
        true,
    ],
    ['a tiny write while linear cannot be read', undefined, TINY, true],
] as const)
    test(`${why} is ${isFlagged ? 'refused' : 'run'} with no tick`, async ($, on) => {
        world(on, [], current?.());
        on('fs.read', () => ({ value: next() }));
        const r = await bash($, 'x linear body FRM-1 --set /repo/b.md');
        expect(signFlagged(r)).toBe(isFlagged);
    });

// clio's 13:34 report: a read of the sign file in the same line is no write, so her unchanged sign line still runs
test('a body file the hook cannot read is read through cat, so an unchanged sign line runs', async ($, on) => {
    const { ran } = world(on, [], SIGNED_TODAY(), SIGNED_TODAY());
    on('fs.read', () => ({ deny: 'outside the readable paths' }));
    const r = await bash($, 'x linear body FRM-1 --set /repo/b.md');
    expect([signFlagged(r), ran]).toEqual([
        false,
        ['x linear body FRM-1 --set /repo/b.md'],
    ]);
});

test("a body write behind a grep of its own file keeps today's sign line and runs", async ($, on) => {
    const { ran } = world(on, [], SIGNED_TODAY());
    on('fs.read', () => ({ value: SIGNED_TODAY() }));
    const command =
        "grep -c '^## signed' /repo/b.md; x linear body FRM-1 --set /repo/b.md";
    const r = await bash($, command);
    expect([signFlagged(r), ran]).toEqual([false, [command]]);
});

// lane 4 R1: the sign file is read before the command runs, so one the command writes, one it cannot read and one behind a
// variable each count as a new sign
for (const [why, command, read] of [
    [
        'a sign file the same command writes',
        `cat > /repo/b.md <<EOF\n✍️ signed ${today()} · body 1\nEOF\nx linear body FRM-1 --set /repo/b.md`,
        { value: '## wish\n\nx\n' },
    ],
    [
        'a sign file behind a variable',
        'x linear body FRM-1 --set $TMPDIR/b.md',
        { value: '' },
    ],
    [
        'a sign file that cannot be read',
        'x linear body FRM-1 --set /repo/b.md',
        { deny: 'no such file' },
    ],
] as const)
    test(`${why} is refused with no tick`, async ($, on) => {
        world(on, [], SIGNED_TODAY());
        on('fs.read', () => read);
        expect(signFlagged(await bash($, command))).toBe(true);
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
// sixth sense round 1: the flag lands right after the merge-auto call's own words, never past `&&` or a comment
for (const [typed, want] of [
    [
        'x lane merge-auto 104 --apply && echo merged',
        'x lane merge-auto 104 --apply --dima-ok 104 && echo merged',
    ],
    [
        'x lane merge-auto 104 --apply # ship it',
        'x lane merge-auto 104 --apply --dima-ok 104 # ship it',
    ],
    [
        "bash -c 'x lane merge-auto 104 --apply'",
        "bash -c 'x lane merge-auto 104 --apply'",
    ],
] as const)
    test(`the added --dima-ok lands on the merge-auto call: ${typed}`, async ($, on) => {
        const { ran } = world(on, [tick(`merge ${PR}`)]);
        await bash($, typed);
        expect(ran).toEqual([want]);
    });

// sixth sense round 1: the tick's url names this repo — the cwd's origin, or the call's --repo
for (const [why, text, typed, isRun] of [
    [
        'another repo, same number',
        'merge https://github.com/dvakatsiienko/frame/pull/104',
        'x lane merge-auto 104 --apply --dima-ok 104',
        false,
    ],
    [
        'a bare #104',
        'merge #104',
        'x lane merge-auto 104 --apply --dima-ok 104',
        false,
    ],
    [
        'the --repo it names',
        'merge https://github.com/dvakatsiienko/frame/pull/104',
        'x lane merge-auto 104 --repo dvakatsiienko/frame --apply --dima-ok 104',
        true,
    ],
] as const)
    test(`a pr tick quoting ${why} ${isRun ? 'proves' : 'proves nothing for'} the merge`, async ($, on) => {
        const { ran } = world(on, [tick(text)]);
        const r = await bash($, typed);
        expect([r.deny === undefined, ran.length]).toEqual([
            isRun,
            isRun ? 1 : 0,
        ]);
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
    expect([signFlagged(label), signFlagged(body)]).toEqual([false, false]);
});

test('a target named in prose but never quoted proves nothing', async ($, on) => {
    const { ran } = world(on, [tick('⚠️ mirror the backup to origin')]);
    expect([(await bash($, MIRROR)).deny !== undefined, ran]).toEqual([
        true,
        [],
    ]);
});

// dima's o2 (2026-10-28 14:57): a tick counts for 2 h after its sending window, so a yes for this afternoon's push never
// quietly unlocks tonight's
for (const [age, isRun] of [
    [2 * 3_600_000 - 1_000, true],
    [2 * 3_600_000 + 1_000, false],
] as const)
    test(`a tick ${isRun ? 'just under' : 'just over'} 2 h old ${isRun ? 'still counts' : 'has expired'}`, async ($, on) => {
        const { ran } = world(on, [tick(`⚠️ mirror: \`${MIRROR}\``, NOW - age)]);
        const r = await bash($, MIRROR);
        expect([r.deny === undefined, ran.length]).toEqual([
            isRun,
            isRun ? 1 : 0,
        ]);
    });

// dima's tick on the sixth sense's ask (14:59): a tick unlocks a guarded command only when its ask quotes that whole
// command, never just a target the refusal names
for (const [quoted, isRun] of [
    ['git push origin main', false],
    ['git push --mirror origin', true],
    ['git  push --mirror   origin', true],
] as const)
    test(`a tick quoting \`${quoted}\` ${isRun ? 'unlocks' : 'leaves refused'} a mirror push`, async ($, on) => {
        const { ran } = world(on, [tick(`⚠️ push: \`${quoted}\``)]);
        const r = await bash($, MIRROR);
        expect([r.deny === undefined, ran.length]).toEqual([
            isRun,
            isRun ? 1 : 0,
        ]);
    });
