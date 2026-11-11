import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { withSignCheck } from '../hooks/rules/sign-check.ts';
import { answerPrompts, dimaSays } from './said.ts';
import { liveStore } from './store.ts';

// FRM-427: dima's tick on an orbit ask is his word, read from x-mod-stash's own $.state — the one record only his
// press writes; a tick is spent by its first use
const NOW = 1_000_000;
// the pr head github reports; a test moves it to stand for a push after his tick
const head = { sha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678' };
type Tick = { at: number; id: string; targets: string[]; text: string };

// `body` is the ticket's current description as linear holds it; none = linear cannot be read
// cat: what a `cat` of the body file prints, when the hook's own read cannot reach it
// asks: the seat's own orbit asks, x-mod-stash's `$.state` orbit, which a x-herdr-deck press must match
function world(
    on: On,
    ticks: Tick[] = [],
    body?: string,
    cat?: string,
    asks: {
        id: string;
        mark?: string;
        text: string;
        isHerdrMark?: boolean;
        markedAt?: number;
        isResolved?: boolean;
    }[] = [],
    opts: {
        isOrbitDown?: () => boolean;
        isPrompted?: boolean;
        isSlugDown?: boolean;
        isXDown?: boolean;
        isXMissing?: boolean;
    } = {},
) {
    const clock = mock.clock(on, { now: NOW });
    const store = liveStore(on);
    const ran: string[] = [];
    answerPrompts(on);
    on('state.get', (_$, e, next) =>
        e.plugin === 'x-mod-stash' && e.key === 'ticks'
            ? { value: { value: ticks, version: 1 } }
            : e.plugin === 'x-mod-stash' && e.key === 'orbit'
              ? opts.isOrbitDown?.()
                  ? { deny: 'store down' }
                  : { value: { value: { asks }, version: 1 } }
              : opts.isPrompted &&
                  e.plugin === 'x-mod-guard' &&
                  e.key === 'prompted'
                ? { value: { value: true, version: 1 } }
                : next(e),
    );
    on('session.id', () => ({ value: 't1t1t1t1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: false }));
    on('ui.log', () => ({ value: undefined }));
    on('turn.complete', () => ({ text: '' }));
    // x's answers: the brake check (no brake, no hold), the cwd's slug, a ticket's body and x linear sign-check's verdict,
    // whose stand-in counts a sign line `body` lacks as new and an unread body as new (its own judge is tested in x/go)
    const signVerdict = (sent: string) =>
        body !== undefined &&
        sent
            .split('\n')
            .every((l) => !/^✍️ (re-)?signed /u.test(l) || body.includes(l));
    on('process.run', (_$, e) => ({
        value: {
            exitCode:
                (e.argv.includes('read') && body === undefined) ||
                (e.argv[0] === 'cat' && cat === undefined) ||
                (e.argv.includes('sign-check') &&
                    !signVerdict(e.init?.stdin ?? '')) ||
                (opts.isXMissing && e.argv[0] === 'x')
                    ? 127
                    : (opts.isXDown && e.argv[0] === 'x') ||
                        (opts.isSlugDown && e.argv.includes('repo-slug'))
                      ? 1
                      : 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            // herdr's word on a terminal: `shell1` runs a plain shell, every other one Claude Code
            stdout:
                opts.isXMissing && e.argv[0] === 'x'
                    ? ''
                    : opts.isXDown && e.argv[0] === 'x'
                      ? JSON.stringify({
                            error: 'the ticket did not read',
                            ok: false,
                            status: 'external',
                        })
                      : opts.isSlugDown && e.argv.includes('repo-slug')
                        ? ''
                        : e.argv[0] === 'hc' && e.argv[1] === 'get'
                          ? JSON.stringify({
                                status: {
                                    app:
                                        e.argv[2] === 'shell1'
                                            ? null
                                            : 'claude-code',
                                },
                            })
                          : e.argv[0] === 'gh' && e.argv.includes('headRefOid')
                            ? `${head.sha}\n`
                            : e.argv[0] === 'cat'
                              ? (cat ?? '')
                              : e.argv.includes('--brake-check')
                                ? JSON.stringify({
                                      data: {
                                          brake: '',
                                          holds: [],
                                          holdsUnread: '',
                                      },
                                  })
                                : e.argv.includes('sign-check')
                                  ? JSON.stringify({
                                        data: { newSign: false },
                                        ok: signVerdict(e.init?.stdin ?? ''),
                                        status: signVerdict(e.init?.stdin ?? '')
                                            ? 'ok'
                                            : 'refused',
                                    })
                                  : e.argv.includes('repo-slug')
                                    ? JSON.stringify({
                                          data: { repo: 'dvakatsiienko/bytes' },
                                      })
                                    : e.argv.includes('read')
                                      ? JSON.stringify({
                                            data: {
                                                tickets: [
                                                    { description: body },
                                                ],
                                            },
                                        })
                                      : '',
        },
    }));
    const refuse: string[] = [];
    // the next calls that run and exit non-zero, one per entry
    const fail: boolean[] = [];
    on('tool.call', (_$, e) => {
        const no = refuse.shift();
        if (no) return { deny: no };
        ran.push('command' in e ? String(e.command) : '');
        return fail.shift()
            ? { isError: true as const, result: {}, text: 'exit 1' }
            : { result: {}, text: 'ran' };
    });
    return { clock, fail, ran, refuse, store };
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

test('a tick survives a refusal from the tool itself', async ($, on) => {
    const { ran, refuse } = world(on, [tick(`⚠️ mirror: \`${MIRROR}\``)]);
    refuse.push('core said no');
    const first = await bash($, MIRROR);
    const retry = await bash($, MIRROR);
    expect([first.deny, retry.deny, ran]).toEqual([
        expect.stringContaining('core said no'),
        undefined,
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

// FRM-570 exit 10: a slug x cannot read leaves the tick unmatched, and the refusal names x gh repo-slug
test('a typed --dima-ok whose repo x cannot read is refused naming x gh repo-slug', async ($, on) => {
    const MERGE = 'x lane merge-auto 104 --apply --dima-ok 104';
    const { ran } = world(on, [tick(`merge ${PR}`)], undefined, undefined, [], {
        isSlugDown: true,
    });
    const r = await bash($, MERGE);
    expect([r.deny, ran]).toEqual([
        expect.stringContaining('`x gh repo-slug /repo` gave no slug'),
        [],
    ]);
});

// FRM-478 rider (W745–W746): a tick on «⚠️ merge <repo>#<n>» carries his word like the url does; every live tick counts
// (FRM-510 W1934), each covering only its own ask's words
const BARE = 'x lane merge-auto 104 --apply';
const TWO_HOURS = 2 * 60 * 60 * 1000;
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
        'a merge tick with a newer tick on another ask',
        [
            tick('⚠️ merge bytes#104: the guard fix', NOW - 10),
            { ...tick('next: the docs', NOW - 1), id: 'o5' },
        ],
        true,
    ],
    [
        'a url cited in notes',
        [tick(`notes on ${PR}: 2 lows left, fix them?`)],
        false,
    ],
    ['a url on «do not merge»', [tick(`do not merge ${PR} yet`)], false],
    ['a url on a curly «don’t merge»', [tick(`don’t merge ${PR}`)], false],
    ['a url on «should not merge»', [tick(`should not merge ${PR}`)], false],
    ['a url on «no merge of»', [tick(`no merge of ${PR}`)], false],
    ["a url on «we won't merge»", [tick(`we won't merge ${PR}`)], false],
    ['a url on «hold the merge of»', [tick(`hold the merge of ${PR}?`)], false],
    [
        'a url on «before merge»',
        [tick(`before merge fix 2 lows on ${PR}?`)],
        false,
    ],
    ['a url on «⚠️ do not merge»', [tick(`⚠️ do not merge ${PR}`)], false],
    ['a url on «⚠️ merge»', [tick(`⚠️ merge ${PR}: the guard fix`)], true],
    ['a url on «⚠️ land»', [tick(`⚠️ land ${PR}: the guard fix`)], true],
    ['a url on another ⚠️ action', [tick(`⚠️ close ${PR} unmerged?`)], false],
    ['a url on a force-push', [tick(`⚠️ force-push ${PR}`)], false],
    [
        'a url on «merge anyway»',
        [tick(`merge ${PR}: ci not green, merge anyway`)],
        true,
    ],
    [
        'a merge tick past its 2 h',
        [tick('⚠️ merge bytes#104: the guard fix', NOW - TWO_HOURS - 1)],
        false,
    ],
] as const)
    test(`a bare merge-auto --apply on ${why} ${isCarried ? 'carries' : 'gets no'} --dima-ok`, async ($, on) => {
        const { ran } = world(on, [...ticks]);
        await bash($, BARE);
        expect(ran).toEqual([isCarried ? FLAGGED : BARE]);
    });

test('a merge tick with a newer tick after it passes once: its second run is refused', async ($, on) => {
    const { ran } = world(on, [
        tick(`merge ${PR}`, NOW - 10),
        { ...tick('next: the docs', NOW - 1), id: 'o5' },
    ]);
    const first = await bash($, FLAGGED);
    const second = await bash($, FLAGGED);
    expect([first.deny, second.deny !== undefined, ran]).toEqual([
        undefined,
        true,
        [FLAGGED],
    ]);
});

test('a command tick with a newer tick after it passes once: its second run is refused', async ($, on) => {
    const { ran } = world(on, [
        tick(`⚠️ mirror: \`${MIRROR}\``, NOW - 10),
        { ...tick('next: the docs', NOW - 1), id: 'o5' },
    ]);
    const first = await bash($, MIRROR);
    const second = await bash($, MIRROR);
    expect([first.deny, second.deny !== undefined, ran]).toEqual([
        undefined,
        true,
        [MIRROR],
    ]);
});

test('the brake takes no tick, a newer tick after it or not', async ($, on) => {
    const { ran } = world(on, [
        tick(`merge ${PR}`, NOW - 10),
        { ...tick('next: the docs', NOW - 1), id: 'o5' },
    ]);
    const r = await bash(
        $,
        'x lane merge-auto 104 --apply --release-brake --dima-ok 104',
    );
    expect([r.deny !== undefined, ran]).toEqual([true, []]);
});

// FRM-510's want line, the 2026-11-06 shape: he marked o71–o77 in one go and only one record was left, so 6 sign writes
// were refused. a mod's test can't import another mod, so x-mod-stash's orbit.test.ts holds the press writing these records
const BATCH = [71, 72, 73, 74, 75, 76, 77].map((n) => ({
    ...tick(`✍️ sign FRM-${n}: a chunk of the batch`),
    id: `o${n}`,
}));
const SIGNS = BATCH.map(
    (_, i) => `x linear set FRM-${71 + i} --add-label signed`,
);
test('one record for a batch of seven refuses six signs, as on 2026-11-06', async ($, on) => {
    const { ran } = world(on, BATCH.slice(-1));
    for (const line of SIGNS) await bash($, line);
    expect(ran).toEqual(SIGNS.slice(-1));
});

test('a batch of asks marked in one go signs each ticket', async ($, on) => {
    const { ran } = world(on, BATCH);
    const lines = SIGNS;
    const denied = [];
    for (const line of lines) denied.push((await bash($, line)).deny);
    expect([denied, ran]).toEqual([lines.map(() => undefined), lines]);
});

test('a merge ask in a batch marked in one go runs', async ($, on) => {
    const { ran } = world(on, [
        { ...tick(`merge ${PR}`), id: 'o71' },
        ...BATCH.slice(1),
    ]);
    expect([(await bash($, FLAGGED)).deny, ran]).toEqual([
        undefined,
        [FLAGGED],
    ]);
});

// merge-auto names `gh stack merge <n>` where a repo has no async merge (x/go/stacks.go): his tick keeps that door open
const STACK = 'gh stack merge 104';
test('a stack merge runs once on a tick quoting it whole, its second run refused', async ($, on) => {
    const { ran } = world(on, [tick(`stack: \`${STACK}\``)]);
    const first = await bash($, STACK);
    const second = await bash($, STACK);
    expect([first.deny, second.deny !== undefined, ran]).toEqual([
        undefined,
        true,
        [STACK],
    ]);
});

for (const [why, ticks] of [
    ['no tick', []],
    ['a tick on another pr', [tick('stack: `gh stack merge 1045`')]],
    ['a tick past its 2 h', [tick(`stack: \`${STACK}\``, NOW - TWO_HOURS - 1)]],
    ['a merge tick on the pr', [tick(`merge ${PR}`)]],
] as const)
    test(`a stack merge is refused on ${why}`, async ($, on) => {
        const { ran } = world(on, [...ticks]);
        const r = await bash($, STACK);
        expect([r.deny, ran]).toEqual([
            expect.stringContaining('rule raw-merge'),
            [],
        ]);
    });

test('a tick on a stack merge carries no raw merge beside it', async ($, on) => {
    const { ran } = world(on, [tick(`stack: \`${STACK}\``)]);
    const r = await bash($, `${STACK} && gh pr merge 104`);
    expect([r.deny, ran]).toEqual([
        expect.stringContaining('rule raw-merge'),
        [],
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

// FRM-544 slice 2b: past the brake, his tick on an ask quoting the whole command at the pr's head runs that one merge
const BRAKE = 'x lane merge-auto 104 --apply --release-brake --dima-ok 104';
const brakeTick = (sha = head.sha.slice(0, 7), line = BRAKE) =>
    tick(`⚠️ merge past the brake: \`${line}\` at ${sha}`);

test('a tick quoting the brake command at the pr head runs that one merge once', async ($, on) => {
    const { ran } = world(on, [brakeTick()]);
    const first = await bash($, BRAKE);
    const second = await bash($, BRAKE);
    expect([first.deny, second.deny !== undefined, ran]).toEqual([
        undefined,
        true,
        [BRAKE],
    ]);
});

for (const [why, ticks, line] of [
    [
        'the ask names no head',
        [tick(`⚠️ merge past the brake: \`${BRAKE}\``)],
        BRAKE,
    ],
    ['a push moved the head after his tick', [brakeTick('ffffff0')], BRAKE],
    ['the command adds a flag', [brakeTick()], `${BRAKE} --admin`],
] as const)
    test(`the brake tick runs nothing when ${why}`, async ($, on) => {
        const { ran } = world(on, [...ticks]);
        const r = await bash($, line);
        expect([r.deny, ran]).toEqual([
            expect.stringContaining(`at head ${head.sha.slice(0, 7)}`),
            [],
        ]);
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
// r2: the line as it runs once a body set is judged at run time, the check in front of each id's set
const checked = (line: string, ...ids: string[]) =>
    withSignCheck(line, new Set(ids.length ? ids : ['FRM-1']));
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

// one approval of a sign covers that ticket's writes for its 2 h, a retry included (wing 1, 19:14), and no other ticket
test('a sign tick covers its ticket again on a retry, never a ticket it does not name', async ($, on) => {
    world(on, [tick('✍️ sign FRM-1, FRM-2: two small tickets')]);
    await bash($, 'x linear set FRM-1 --add-label signed');
    const again = await bash($, 'x linear set FRM-1 --add-label signed');
    const other = await bash($, 'x linear set FRM-3 --add-label signed');
    expect([signFlagged(again), signFlagged(other)]).toEqual([false, true]);
});

test('a sign tick survives a refusal later on the line, and the retry runs', async ($, on) => {
    const { ran } = world(on, [tick('✍️ sign FRM-1: a small ticket')]);
    const SIGN = 'x linear set FRM-1 --add-label signed';
    const refused = await bash($, `${SIGN}; rm -rf /tmp/never`);
    const retry = await bash($, SIGN);
    expect([refused.deny !== undefined, retry.deny, ran]).toEqual([
        true,
        undefined,
        [SIGN],
    ]);
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
// the current body holds only an old sign line; a sign line it lacks is new whatever its date (sixth sense R1: a backdated
// or tomorrow-dated line, or an old line's text widened, ran with no tick)
const HELD = '✍️ signed 2026-10-23 — scope A · body 5a0d10c0';
for (const [line, isFlagged] of [
    [`✍️ signed ${today()} · body 5a0d10c0`, true],
    [`✍️ re-signed ${today()} — a rider`, true],
    [HELD, false],
    ['✍️ signed 2026-10-23 — scope A and B · body 5a0d10c0', true],
    ['✍️ signed 1969-12-31 · body 11112222', true],
    ['✍️ signed 2099-01-02 · body 11112222', true],
] as const)
    test(`a body set holding «${line.slice(0, 40)}» is ${isFlagged ? 'refused' : 'run'} with no tick`, async ($, on) => {
        world(on, [], `## wish\n\nx\n\n## signed\n\n${HELD}\n`);
        on('fs.read', () => ({
            value: `## wish\n\nx\n\n## signed\n\n${line}\n`,
        }));
        const r = await bash($, 'x linear body FRM-1 --set /repo/b.md');
        expect(signFlagged(r)).toBe(isFlagged);
    });

// a merge grant made or moved (sixth sense R2) is x linear sign-check's to judge: its rows live in
// x/go/linear_sign_check_test.go, beside the judge (FRM-570 rule 1)

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

// FRM-570 exit 10: an x that gives no verdict still refuses the sign, and the refusal names x linear sign-check
test('a body set x cannot judge is refused naming x linear sign-check', async ($, on) => {
    const { ran } = world(on, [], SIGNED_TODAY(), undefined, [], {
        isXDown: true,
    });
    on('fs.read', () => ({ value: SIGNED_TODAY() }));
    const r = await bash($, 'x linear body FRM-1 --set /repo/b.md');
    expect([signFlagged(r), r.deny, ran]).toEqual([
        true,
        expect.stringContaining(
            'x linear sign-check FRM-1 --body-file /repo/b.md',
        ),
        [],
    ]);
});

test('a body set while x is missing is refused naming x linear sign-check', async ($, on) => {
    const { ran } = world(on, [], SIGNED_TODAY(), undefined, [], {
        isXMissing: true,
    });
    on('fs.read', () => ({ value: SIGNED_TODAY() }));
    const r = await bash($, 'x linear body FRM-1 --set /repo/b.md');
    expect([signFlagged(r), r.deny, ran]).toEqual([
        true,
        expect.stringContaining('x linear sign-check FRM-1'),
        [],
    ]);
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

// lane 4 R3: a loop's every id is a sign of its own, so a tick on one id never signs the next
test('a loop signing two ids on a tick for one is refused', async ($, on) => {
    world(on, [tick('✍️ sign FRM-1: x')]);
    const r = await bash(
        $,
        'for id in FRM-1 FRM-2; do x linear set $id --add-label signed; done',
    );
    expect(signFlagged(r)).toBe(true);
});

for (const command of [
    'x linear set "$ID" --add-label signed',
    'ID=$(cat id); x linear set $ID --add-label signed',
    'echo FRM-2 | xargs -I{} x linear set {} --add-label signed',
])
    test(`a sign whose id the line never shows is refused on any tick: ${command}`, async ($, on) => {
        world(on, [tick('✍️ sign FRM-1: x')]);
        const r = await bash($, command);
        expect(signFlagged(r)).toBe(true);
    });

// lane 4 R2: every sign on the line is judged, and a body file the line writes by cp, mv or a nested shell counts as new
for (const [why, command] of [
    [
        'a label sign after an old body sign',
        'x linear body FRM-1 --set /repo/b.md && x linear set FRM-2 --add-label signed',
    ],
    [
        'a body copied in by cp',
        'cp /repo/signed.md /repo/b.md && x linear body FRM-1 --set /repo/b.md',
    ],
    [
        'a body moved in by mv',
        'mv /repo/signed.md /repo/b.md && x linear body FRM-1 --set /repo/b.md',
    ],
    [
        'a body written in bash -c',
        "bash -c 'cat /repo/s.md > /repo/b.md' && x linear body FRM-1 --set /repo/b.md",
    ],
] as const)
    test(`a sign the line hides is ${/label|bash/.test(why) ? 'refused' : 'judged as it runs'}: ${why}`, async ($, on) => {
        const { ran } = world(on, [], SIGNED_TODAY());
        on('fs.read', () => ({ value: SIGNED_TODAY() }));
        const r = await bash($, command);
        expect(/label|bash/.test(why) ? signFlagged(r) : [r.deny, ran]).toEqual(
            /label|bash/.test(why) ? true : [undefined, [checked(command)]],
        );
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
    test(`${why} is judged as it runs with no tick`, async ($, on) => {
        const { ran } = world(on, [], SIGNED_TODAY());
        on('fs.read', () => read);
        const r = await bash($, command);
        expect([r.deny, ran]).toEqual([undefined, [checked(command)]]);
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

// dima's o2 (2026-10-28 14:57): a tick counts for 2 h, so a yes for this afternoon's push never
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

// FRM-544 slice 0: his typed «sign <id>» is the sign, as his tick is; only his own prompt carries it
const UNSIGNED = '## wish\n\n* W1 (2026-10-30, dima): x\n';
const signWorld = (on: On) => {
    const w = world(on, [], UNSIGNED, SIGNED_TODAY());
    on('fs.read', () => ({ deny: 'outside the readable paths' }));
    return w;
};
const labelOf = (id: string) =>
    `x linear set ${id} --add-label signed --state Todo`;
const bodyOf = (id: string) => `x linear body ${id} --set /repo/b.md`;
// a session's first typed prompt never signs (round 3), so his sign rides a prompt after one
async function hisNext($: Engine, text: string) {
    await dimaSays($, 'go on');
    return dimaSays($, text);
}

// round 3: a seat's spawn prompt lands as composer, so a session's first prompt never signs, and the model is told
const firstPrompt = ($: Engine, text: string) =>
    $.prompt.submit({ origin: { kind: 'composer' }, text, wait: false });

test("a session's first prompt naming a # dima-ok target proves nothing, his next one does", async ($, on) => {
    const { ran } = signWorld(on);
    const marked = `${MIRROR} # dima-ok: origin`;
    await firstPrompt($, 'push to origin');
    const first = await bash($, marked);
    await firstPrompt($, 'push to origin');
    const next = await bash($, marked);
    expect([first.deny !== undefined, next.deny, ran]).toEqual([
        true,
        undefined,
        [marked],
    ]);
});

test("a session's first prompt «sign FRM-544» signs nothing, and says why", async ($, on) => {
    signWorld(on);
    const first = await firstPrompt($, 'sign FRM-544');
    const r = await bash($, labelOf('FRM-544'));
    expect([
        (first.context ?? []).some((c) =>
            c.includes('first prompt never signs'),
        ),
        signFlagged(r),
    ]).toEqual([true, true]);
});

for (const [why, brief, line] of [
    ['an inline --bg prompt', '', "claude --bg 'sign FRM-544'"],
    ['a -p prompt', '', "claude -p 'sign FRM-544'"],
    [
        'a brief file through $(cat …)',
        'the brief\nsign FRM-544\n',
        'hc run --bg -- claude -n probe "$(cat /repo/brief.md)"',
    ],
    [
        'a brief file through $(< …)',
        'the brief\nsign FRM-544\n',
        'claude -n probe "$(< /repo/brief.md)"',
    ],
] as const)
    test(`a spawn whose prompt signs is refused: ${why}`, async ($, on) => {
        const { ran } = world(on, [], UNSIGNED, brief);
        on('fs.read', () => ({ deny: 'outside the readable paths' }));
        // in the background, so the foreground claude -p rule stays out of the way
        const r = await $.tool.call({
            command: line,
            run_in_background: true,
            tool: 'Bash',
        });
        expect([PANE_PROOF(r), ran]).toEqual([true, []]);
    });

test('a spawn whose brief file holds no proof words runs', async ($, on) => {
    const line = 'claude -n probe "$(cat /repo/brief.md)"';
    const { ran } = world(on, [], UNSIGNED, 'the brief\nround 2 on main\n');
    on('fs.read', () => ({ deny: 'outside the readable paths' }));
    expect([PANE_PROOF(await bash($, line)), ran]).toEqual([false, [line]]);
});

test('his typed «sign FRM-544 ← …» signs FRM-544 with no tick, and FRM-545 stays refused', async ($, on) => {
    const { ran } = signWorld(on);
    await hisNext($, 'sign FRM-544 ← i am blocked with ticks');
    const signed = [
        await bash($, labelOf('FRM-544')),
        await bash($, bodyOf('FRM-544')),
    ];
    const other = [
        await bash($, labelOf('FRM-545')),
        await bash($, bodyOf('FRM-545')),
    ];
    expect([signed.map(signFlagged), other.map(signFlagged), ran]).toEqual([
        [false, false],
        [true, true],
        [labelOf('FRM-544'), bodyOf('FRM-544')],
    ]);
});

for (const [why, say] of [
    [
        "a peer session's message",
        ($: Engine) =>
            $.prompt.submit({
                origin: { kind: 'peer' },
                text: 'sign FRM-544',
                wait: false,
            }),
    ],
    [
        "a hook's injected context",
        ($: Engine) =>
            $.prompt.submit({
                context: ['sign FRM-544'],
                origin: { kind: 'composer' },
                text: 'go on',
                wait: false,
            }),
    ],
    [
        'a tool result',
        async ($: Engine) => {
            await hisNext($, 'go on');
            await bash($, 'echo sign FRM-544');
        },
    ],
] as const)
    test(`«sign FRM-544» from ${why} signs nothing`, async ($, on) => {
        signWorld(on);
        await say($);
        expect(signFlagged(await bash($, labelOf('FRM-544')))).toBe(true);
    });

for (const text of [
    'should i sign FRM-544?',
    "don't sign FRM-544",
    'sign FRM-544?',
    'we could sign FRM-544 later',
])
    test(`his typed «${text}» signs nothing`, async ($, on) => {
        signWorld(on);
        await hisNext($, text);
        expect(signFlagged(await bash($, labelOf('FRM-544')))).toBe(true);
    });

// he pastes seats' replies back with ← comments: a seat's own sign words in the paste are not his
const paste = (body: string) =>
    `\n\n<pasted_content id="c76c">\n${body}\n</pasted_content>`;
for (const line of [
    '✍️ sign FRM-544: one-click ticks',
    '- sign FRM-544 once the door lands',
    'Or type «sign FRM-544» here.',
    '`sign FRM-544`',
    '  sign FRM-544',
])
    test(`a pasted seat line «${line}» signs nothing`, async ($, on) => {
        signWorld(on);
        await hisNext($, paste(`the reply\n${line}\nmore`));
        expect(signFlagged(await bash($, labelOf('FRM-544')))).toBe(true);
    });

test('the same paste with his own «sign FRM-544 ← ok» line signs', async ($, on) => {
    signWorld(on);
    await hisNext(
        $,
        paste('the reply\n✍️ sign FRM-544: one-click ticks\nsign FRM-544 ← ok'),
    );
    expect(signFlagged(await bash($, labelOf('FRM-544')))).toBe(false);
});

test('one typed «sign FRM-544 FRM-519» signs each, a retry too, and no third ticket', async ($, on) => {
    signWorld(on);
    await hisNext($, 'sign FRM-544 FRM-519');
    const first = [
        await bash($, labelOf('FRM-544')),
        await bash($, labelOf('FRM-519')),
    ];
    const again = [
        await bash($, labelOf('FRM-544')),
        await bash($, labelOf('FRM-1')),
    ];
    expect([first.map(signFlagged), again.map(signFlagged)]).toEqual([
        [false, false],
        [false, true],
    ]);
});

test('a sign with no tick and no typed word names both doors', async ($, on) => {
    signWorld(on);
    const r = await bash($, labelOf('FRM-544'));
    expect(r.deny).toEqual(
        expect.stringMatching(
            /tick an orbit ask «✍️ sign FRM-544: <title>», or to type «sign FRM-544» himself/,
        ),
    );
});

// round 2 (wisphunter on db65e1b6): the rows the first round missed
test('his typed «re-sign FRM-544» lets the body write its ✍️ re-signed line', async ($, on) => {
    const { ran } = world(
        on,
        [],
        UNSIGNED,
        `${UNSIGNED}\n## signed\n\n✍️ re-signed ${today()} — a rider\n`,
    );
    on('fs.read', () => ({ deny: 'outside the readable paths' }));
    await hisNext($, 're-sign FRM-544');
    expect([signFlagged(await bash($, bodyOf('FRM-544'))), ran]).toEqual([
        false,
        [bodyOf('FRM-544')],
    ]);
});

test('a typed sign older than 2 h signs nothing', async ($, on) => {
    const { clock } = signWorld(on);
    await hisNext($, 'sign FRM-544');
    await clock.advance(2 * 60 * 60 * 1000 + 1);
    expect(signFlagged(await bash($, labelOf('FRM-544')))).toBe(true);
});

for (const line of ['> sign FRM-544', '"sign FRM-544"'])
    test(`a quoted line «${line}» signs nothing`, async ($, on) => {
        signWorld(on);
        await hisNext($, line);
        expect(signFlagged(await bash($, labelOf('FRM-544')))).toBe(true);
    });

test('a typed «sign FRM-5» does not sign FRM-54', async ($, on) => {
    signWorld(on);
    await hisNext($, 'sign FRM-5');
    expect(signFlagged(await bash($, labelOf('FRM-54')))).toBe(true);
});

test('a sign write refused later on its line leaves the typed sign for the retry', async ($, on) => {
    const { ran } = signWorld(on);
    await hisNext($, 'sign FRM-544');
    const refused = await bash($, `${labelOf('FRM-544')}; rm -rf /tmp/never`);
    const retry = await bash($, labelOf('FRM-544'));
    expect([refused.deny !== undefined, retry.deny, ran]).toEqual([
        true,
        undefined,
        [labelOf('FRM-544')],
    ]);
});

// a seat's keys typed into a pane land as his composer prompt (measured 2026-11-10), so the guard fences the typing
const PANE_PROOF = (r: { deny?: string }) =>
    (r.deny ?? '').includes("arrive as dima's own composer prompt");
for (const line of [
    'hc keys t1p s i g n space shift+f shift+r shift+m - 5 4 4 enter',
    "hc send t1p 'sign FRM-544'",
    "hc send t1p 'ok then\nsign FRM-544 ← go'",
    "tmux send-keys -t clio 'sign FRM-544' Enter",
    'herdr-app do pane.send \'{"pane":"p1","text":"sign FRM-544\\n"}\'',
    "hc run --bg -- claude -n probe 'sign FRM-544'",
    "claude -n probe 'sign FRM-544'",
    "hc send t1p 'go on\ndima-ok: origin'",
    "hc send t1p 'operator-override prs'",
])
    test(`a seat typing his proof words is refused: ${line.slice(0, 44)}`, async ($, on) => {
        const { ran } = signWorld(on);
        expect([PANE_PROOF(await bash($, line)), ran]).toEqual([true, []]);
    });

for (const line of [
    "hc send t1p 'round 2 on db65e1b6, sign line in the spec'",
    'hc send clio "round 2: the dima-ok: marker row is red, fixing"',
    "hc send clio 'the fix lets him sign FRM-1 from herdr'",
    "hc send clio 'he may type operator-override prs later'",
    'hc keys t1p g i t space s t a t u s',
    "tmux send-keys -t clio 'ls' Enter",
])
    test(`a seat typing an ordinary message passes: ${line.slice(0, 44)}`, async ($, on) => {
        const { ran } = signWorld(on);
        expect([PANE_PROOF(await bash($, line)), ran]).toEqual([false, [line]]);
    });

test('a seat that types «sign FRM-544» into a pane cannot sign it, and his own typed line still does', async ($, on) => {
    const { ran } = signWorld(on);
    const typed = await bash($, "hc send t20 'sign FRM-544'");
    const forged = await bash($, labelOf('FRM-544'));
    await hisNext($, 'sign FRM-544');
    const his = await bash($, labelOf('FRM-544'));
    expect([
        PANE_PROOF(typed),
        signFlagged(forged),
        signFlagged(his),
        ran,
    ]).toEqual([true, true, false, [labelOf('FRM-544')]]);
});

// his 15:24 prompts as the guard's origins log kept them: a paste, then a plain line, no tick anywhere
test('the 15:24 replay: a pasted «sign FRM-544 ← …» and a typed «sign FRM-519» carry all four sign writes', async ($, on) => {
    const { ran } = signWorld(on);
    await hisNext(
        $,
        '\n\n<pasted_content id="c76c">\nsign FRM-544 ← i am blocked with ticks. which is not good.\n</pasted_content>',
    );
    await hisNext($, 'sign FRM-519');
    await hisNext($, 'i cannot tick');
    const writes = ['FRM-544', 'FRM-519'].flatMap((id) => [
        labelOf(id),
        bodyOf(id),
    ]);
    const results: boolean[] = [];
    for (const w of writes) results.push(signFlagged(await bash($, w)));
    expect([results, ran]).toEqual([[false, false, false, false], writes]);
});

// FRM-544 slice 1: x-herdr-deck writes his presses to the ticks folder, and with every seat's write fenced out the guard
// reads a press there as his tick
const TICKS_FENCED = (r: { deny?: string }) =>
    (r.deny ?? '').includes("a seat's write would forge one");
for (const line of [
    'echo x >> ~/.claude/shelf/orbit-ticks/t1t1t1t1-0000.jsonl',
    'printf x | tee -a "$HOME/.claude/shelf/orbit-ticks/t1t1t1t1-0000.jsonl"',
    'cp /tmp/p.jsonl ~/.claude/shelf/orbit-ticks/',
    "mv /tmp/p.jsonl '/Users/dima/.claude/shelf/orbit-ticks/t1.jsonl'",
    'touch ~/.claude/shelf/orbit-ticks/t1.jsonl',
    `node -e "require('fs').appendFileSync(process.env.HOME + '/.claude/shelf/orbit-ticks/t1.jsonl', 'x')"`,
    `python3 -c "open('/Users/dima/.claude/shelf/orbit-ticks/t1.jsonl', 'a').write('x')"`,
    'git -C ~/.claude/shelf/orbit-ticks add .',
    'cd ~/.claude/shelf/orbit-ticks && echo x > t1.jsonl',
])
    test(`a seat's write to the ticks folder is refused: ${line.slice(0, 48)}`, async ($, on) => {
        const { ran } = world(on);
        expect([TICKS_FENCED(await bash($, line)), ran]).toEqual([true, []]);
    });

for (const line of [
    'cat ~/.claude/shelf/orbit-ticks/t1t1t1t1-0000.jsonl',
    'jq -c . ~/.claude/shelf/orbit-ticks/t1t1t1t1-0000.jsonl',
    'ls ~/.claude/shelf/orbit-ticks',
])
    test(`a read of the ticks folder runs: ${line.slice(0, 48)}`, async ($, on) => {
        const { ran } = world(on);
        expect([TICKS_FENCED(await bash($, line)), ran]).toEqual([
            false,
            [line],
        ]);
    });

for (const [tool, path] of [
    ['Write', '~/.claude/shelf/orbit-ticks/t1.jsonl'],
    ['Edit', '/Users/dima/frame/cc/shelf/orbit-ticks/t1.jsonl'],
    ['Write', '/Users/dima/frame/home/.claude/shelf/orbit-ticks/t1.jsonl'],
] as const)
    test(`a ${tool} into the ticks folder is refused: ${path}`, async ($, on) => {
        world(on);
        const r = await $.tool.call(
            tool === 'Write'
                ? { content: 'x', file_path: path, tool }
                : { file_path: path, new_string: 'y', old_string: 'x', tool },
        );
        expect(TICKS_FENCED(r)).toBe(true);
    });

// FRM-568: herdr's band appends dima's 🐦‍🔥 🔥 ⏰ 💨 presses to its own shelf folder, and every seat acts on them
const PRESS_FENCED = (r: { deny?: string }) =>
    (r.deny ?? '').includes("a seat's write would press for him");
for (const line of [
    'echo \'{"at":1,"button":"afk","on":true}\' >> ~/.claude/shelf/band-presses/band.jsonl',
    'printf x | tee -a "$HOME/.claude/shelf/band-presses/band.jsonl"',
    'cp /tmp/p.jsonl ~/.claude/shelf/band-presses/',
    'touch ~/.claude/shelf/band-presses/band.jsonl',
    `node -e "require('fs').appendFileSync(process.env.HOME + '/.claude/shelf/band-presses/band.jsonl', 'x')"`,
    'cd ~/.claude/shelf/band-presses && echo x > band.jsonl',
    'echo x >> ~/.claude/shelf/band-presse?/band.jsonl',
    'echo x >> ~/.claude/shelf/{band-presses,x}/band.jsonl',
    // FRM-574 exits 4 and 8: a loop that writes into the folder, node's writeFileSync, a cp into it
    'for f in $(ls ~/.claude/shelf/band-presses); do echo x >> "$HOME/.claude/shelf/band-presses/$f"; done',
    'for f in $(ls ~/.claude/shelf/band-presses); do echo x > "$f"; done',
    'for f in $(ls ~/.claude/shelf/band-presses); do cp /tmp/p "$f"; done',
    // both reviewers on 4f7da87c: a writer outside the redirect and carrier lists, so the loop reads only on an allow-list
    `for f in $(ls -d ~/.claude/shelf/band-presses/*); do sed -i '' s/a/b/ "$f"; done`,
    'for f in $(ls ~/.claude/shelf/band-presses); do truncate -s 0 "$f"; done',
    `node -e "require('fs').writeFileSync(process.env.HOME + '/.claude/shelf/band-presses/x','{}')"`,
    'cp /tmp/p ~/.claude/shelf/band-presses/',
    "python3 -c \"open('/Users/dima/.claude/shelf/band-presses/x','w').write('{}')\"",
])
    test(`a seat's write to the band press folder is refused: ${line.slice(0, 48)}`, async ($, on) => {
        const { ran } = world(on);
        expect([PRESS_FENCED(await bash($, line)), ran]).toEqual([true, []]);
    });

test('a write through a link into the band press folder is refused', async ($, on) => {
    const { ran } = diskWorld(on);
    expect([
        PRESS_FENCED(await bash($, 'echo x >> /tmp/b/band.jsonl')),
        ran,
    ]).toEqual([true, []]);
});

for (const line of [
    'cat ~/.claude/shelf/band-presses/band.jsonl',
    'jq -c . ~/.claude/shelf/band-presses/band.jsonl',
    'ls ~/.claude/shelf/band-presses',
    // FRM-574 exit 4: the read shapes of the allow-list
    'for f in $(ls ~/.claude/shelf/band-presses); do cat "$f"; done',
    'head -5 ~/.claude/shelf/band-presses/band.jsonl',
    'stat ~/.claude/shelf/band-presses/band.jsonl',
    'for f in ~/.claude/shelf/band-presses/*; do jq -c . "$f"; done',
])
    test(`a read of the band press folder runs: ${line.slice(0, 48)}`, async ($, on) => {
        const { ran } = world(on);
        expect([PRESS_FENCED(await bash($, line)), ran]).toEqual([
            false,
            [line],
        ]);
    });

for (const [tool, path] of [
    ['Write', '~/.claude/shelf/band-presses/band.jsonl'],
    ['Edit', '/Users/dima/frame/cc/shelf/band-presses/band.jsonl'],
] as const)
    test(`a ${tool} into the band press folder is refused: ${path}`, async ($, on) => {
        world(on);
        const r = await $.tool.call(
            tool === 'Write'
                ? { content: 'x', file_path: path, tool }
                : { file_path: path, new_string: 'y', old_string: 'x', tool },
        );
        expect(PRESS_FENCED(r)).toBe(true);
    });

const PRESSES = '/home/.claude/shelf/orbit-ticks/t1t1t1t1-0000.jsonl';
const press = (text: string, at = NOW - 1, verdict = 'tick', id = 'o7') =>
    JSON.stringify({ at, id, text, verdict });
// by default the seat's orbit holds every pressed ask, accepted, as x-mod-stash leaves it once it took the press in
const acceptedOf = (lines: string[]) =>
    lines.flatMap((l) => {
        const p = JSON.parse(l) as { id: string; text?: string };
        return p.text === undefined
            ? []
            : [{ id: p.id, mark: 'accepted', text: p.text }];
    });
const pressWorld = (
    on: On,
    lines: string[],
    asks: {
        id: string;
        mark?: string;
        text: string;
        isHerdrMark?: boolean;
        markedAt?: number;
    }[] = acceptedOf(lines),
) => {
    const w = world(on, [], undefined, undefined, asks);
    on('fs.read', (_$, e) =>
        e.path === PRESSES
            ? { value: `${lines.join('\n')}\n` }
            : { deny: 'outside the readable paths' },
    );
    return w;
};

for (const [why, ask, line, other] of [
    [
        'a sign ask',
        '✍️ sign FRM-1: a small ticket',
        'x linear set FRM-1 --add-label signed',
        'x linear set FRM-2 --add-label signed',
    ],
    [
        'a merge ask',
        `merge ${PR}`,
        'x lane merge-auto 104 --apply --dima-ok 104',
        'x lane merge-auto 105 --apply --dima-ok 105',
    ],
    [
        'a ⚠️ ask quoting a command whole',
        `⚠️ mirror: \`${MIRROR}\``,
        MIRROR,
        'git push --mirror backup',
    ],
    // 12b (FRM-544 slice 2g): the brake and a raw merge clear from x-herdr-deck as from orbit
    [
        'the brake ask at the pr head',
        brakeTick().text,
        BRAKE,
        'x lane merge-auto 105 --apply --release-brake --dima-ok 105',
    ],
    [
        'a raw merge ask',
        '⚠️ merge: `gh pr merge 104 --squash`',
        'gh pr merge 104 --squash',
        'gh pr merge 105 --squash',
    ],
] as const) {
    // a sign covers its ticket's writes for 2 h (wing 1, 19:14); a merge or a command runs once
    const isSign = why === 'a sign ask';
    test(`a x-herdr-deck press on ${why} runs its target${isSign ? ', a retry too' : ' once'}`, async ($, on) => {
        const { ran } = pressWorld(on, [press(ask)]);
        const first = await bash($, line);
        const second = await bash($, line);
        const elsewhere = await bash($, other);
        expect([
            first.deny,
            second.deny !== undefined,
            elsewhere.deny !== undefined,
            ran.length,
        ]).toEqual([undefined, !isSign, true, isSign ? 2 : 1]);
    });

    // 12b's live click, 21:51: his one press ran the brake twice: x-herdr-deck pruned the spent press, and x-mod-stash's
    // mark of it, at its own time, counted as a second press
    test(`a x-herdr-deck press on ${why} pruned after its run counts no second time as its mark${isSign ? ', a retry too' : ''}`, async ($, on) => {
        const lines = [press(ask, NOW - 1000)];
        const p = JSON.parse(press(ask)) as { id: string; text: string };
        const { ran } = pressWorld(on, lines, [
            {
                id: p.id,
                isHerdrMark: true,
                mark: 'accepted',
                markedAt: NOW - 1,
                text: p.text,
            },
        ]);
        const first = await bash($, line);
        lines.splice(0);
        const second = await bash($, line);
        expect([first.deny, second.deny !== undefined, ran.length]).toEqual([
            undefined,
            !isSign,
            isSign ? 2 : 1,
        ]);
    });

    test(`a x-herdr-deck press on ${why} older than 2 h proves nothing`, async ($, on) => {
        const { clock, ran } = pressWorld(on, [press(ask)]);
        await clock.advance(2 * 60 * 60 * 1000 + 1);
        expect([(await bash($, line)).deny !== undefined, ran]).toEqual([
            true,
            [],
        ]);
    });
}

test('a ↩️ replay pressed after the 🛎 takes the tick back', async ($, on) => {
    const ask = '✍️ sign FRM-1: a small ticket';
    const { ran } = pressWorld(on, [
        press(ask, NOW - 2),
        press(ask, NOW - 1, 'replay'),
    ]);
    const r = await bash($, 'x linear set FRM-1 --add-label signed');
    expect([signFlagged(r), ran]).toEqual([true, []]);
});

test('a press with no ask text proves nothing', async ($, on) => {
    const { ran } = pressWorld(on, [
        JSON.stringify({ at: NOW - 1, id: 'o7', verdict: 'tick' }),
    ]);
    const r = await bash($, MIRROR);
    expect([r.deny !== undefined, ran]).toEqual([true, []]);
});

// wing 1's o13, 19:08: x-herdr-deck prunes a press x-mod-stash has taken, so his next press there drops it from the file;
// the accepted mark x-mod-stash kept from it stands for it, at the time it was marked
const SIGN_ASK_1 = '✍️ sign FRM-1: a small ticket';
const herdrMarked = (markedAt: number, isHerdrMark = true) => [
    { id: 'o13', isHerdrMark, mark: 'accepted', markedAt, text: SIGN_ASK_1 },
];
test('a herdr press pruned from the file still signs its ticket through its kept mark, and no other', async ($, on) => {
    const { ran } = pressWorld(
        on,
        [press('⚠️ close FRM-2: done', NOW - 1, 'tick', 'o14')],
        herdrMarked(NOW - 5),
    );
    const line = 'x linear set FRM-1 --add-label signed';
    const first = await bash($, line);
    const other = await bash($, 'x linear set FRM-2 --add-label signed');
    expect([first.deny, signFlagged(other), ran]).toEqual([
        undefined,
        true,
        [line],
    ]);
});
// a sign is two writes, the label and the body, in either order (clio:shape-lane § 4): one approval covers both, and
// a body write that ran and failed is retried (wing 1's FRM-554, 19:14)
const BODY_1 = '/tmp/FRM-1.md';
for (const [why, writes] of [
    [
        'the label first',
        [labelOf('FRM-1'), `x linear body FRM-1 --set ${BODY_1}`],
    ],
    [
        'the body first',
        [`x linear body FRM-1 --set ${BODY_1}`, labelOf('FRM-1')],
    ],
] as const)
    test(`his typed «sign FRM-1» covers both sign writes, ${why}`, async ($, on) => {
        const { ran } = signWorld(on);
        await hisNext($, 'sign FRM-1');
        const flagged = [];
        for (const line of writes)
            flagged.push(signFlagged(await bash($, line)));
        expect([flagged, ran]).toEqual([writes.map(() => false), [...writes]]);
    });
for (const [why, lines, asks] of [
    [
        'its mark is older than 2 h',
        [],
        herdrMarked(NOW - 2 * 60 * 60 * 1000 - 1),
    ],
    ['the mark came from the seat board', [], herdrMarked(NOW - 5, false)],
    [
        'a ↩️ there is newer than the mark',
        [press(SIGN_ASK_1, NOW - 1, 'replay', 'o13')],
        herdrMarked(NOW - 5),
    ],
] as const)
    test(`a kept herdr mark proves nothing when ${why}`, async ($, on) => {
        const { ran } = pressWorld(on, [...lines], [...asks]);
        const r = await bash($, 'x linear set FRM-1 --add-label signed');
        expect([signFlagged(r), ran]).toEqual([true, []]);
    });

// wisphunter on 15a31816: a press counts only while the seat's own orbit holds that ask, its text, his accepted mark
const MIRROR_ASK = `⚠️ mirror: \`${MIRROR}\``;
for (const [why, asks] of [
    [
        'his take-back on the seat board cleared the mark',
        [{ id: 'o7', text: MIRROR_ASK }],
    ],
    [
        "the seat's ask by that id says something else",
        [{ id: 'o7', mark: 'accepted', text: 'cut the probe?' }],
    ],
    ["the seat's orbit holds no such ask", []],
] as const)
    test(`a x-herdr-deck press proves nothing when ${why}`, async ($, on) => {
        const { ran } = pressWorld(on, [press(MIRROR_ASK)], [...asks]);
        expect([(await bash($, MIRROR)).deny !== undefined, ran]).toEqual([
            true,
            [],
        ]);
    });

test('a press dated ahead of now proves nothing', async ($, on) => {
    const { ran } = pressWorld(on, [press(MIRROR_ASK, NOW + 60_000)]);
    expect([(await bash($, MIRROR)).deny !== undefined, ran]).toEqual([
        true,
        [],
    ]);
});

for (const line of [
    'echo x >> ~/.claude/shelf/orbit-tick?/t1t1t1t1-0000.jsonl',
    'echo x >> ~/.claude/shelf/orbit-{ticks,x}/t1t1t1t1-0000.jsonl',
    'cd ~/.claude/shelf && echo x > orbit-t*/t1t1t1t1-0000.jsonl',
    "echo '{}' > ~/.claude/plugins/store/x-mod-stash_inline-99d499f0f4e0.json",
    'jq \'.["succ:a"]={sid:"b"}\' x.json > "$HOME/.claude/plugins/store/x-mod-stash_inline-1.json"',
    `python3 -c "open('/Users/dima/.claude/plugins/store/x-mod-stash_inline-1.json', 'w')"`,
    'cp /tmp/s.json ~/.claude/plugins/store/',
])
    test(`a seat's forge of a press or its aim is refused: ${line.slice(0, 50)}`, async ($, on) => {
        const { ran } = world(on);
        const r = await bash($, line);
        expect([r.deny !== undefined, ran]).toEqual([true, []]);
    });

for (const line of [
    'git check-ignore -v home/.claude/shelf/orbit-ticks/x.jsonl',
    'git ls-files home/.claude/shelf/orbit-ticks',
    'git log --oneline -- home/.claude/shelf/orbit-ticks',
    'cat home/.config/herdr-app/mods/x-herdr-deck/orbit-ticks.ts',
    'jq . ~/.claude/plugins/store/x-mod-stash_inline-99d499f0f4e0.json',
    // replay 18:50: a program fills the terminal a typer aims at, or a herdr call that types nothing; real lines
    'T=$(hc run --bg --no-parent --no-notify --name codie-tabprobe --json -- cat | jq -r .address); hc keys $T h i',
    'J=$(timeout 20 hc run --bg --name p2 --json -- zsh -f) || exit 1; T=$(printf \'%s\' "$J" | jq -r .address); for k in - / . \'~\' A; do r=$(timeout 5 hc keys "$T" "$k" 2>&1); echo "[$k]"; done',
    'herdr-app do tab.rename \'{"id":"tb1","name":"codie-tabprobe"}\'',
    'a=$(hc ls --json | jq -r \'.terminals[] | select(.name=="clio") | .address\'); herdr-app do terminal.keep "{\\"terminal\\":\\"$a\\",\\"place\\":\\"tab\\"}"',
    'sp=$(herdr-app ls | jq -r .id); hc run --bg --name herdr-codie --label "herdr.space=$sp" -- claude -n codie "$(cat /tmp/brief.md)" --remote-control',
])
    test(`a read near the fenced folders runs: ${line.slice(0, 50)}`, async ($, on) => {
        const { ran } = world(on);
        expect([(await bash($, line)).deny, ran]).toEqual([undefined, [line]]);
    });

// clio's o61 (20:27): dima ticked her trash of a probe's store file and the fence had no door of his
const PROBE_TRASH =
    'trash ~/.claude/plugins/store/probe-store_inline-080b325f88ca.json';
test('his tick on an ask quoting a store write runs it once', async ($, on) => {
    const { ran } = world(on, [
        tick(`⚠️ trash the probe store: \`${PROBE_TRASH}\``),
    ]);
    const first = await bash($, PROBE_TRASH);
    const second = await bash($, PROBE_TRASH);
    expect([first.deny, second.deny !== undefined, ran]).toEqual([
        undefined,
        true,
        [PROBE_TRASH],
    ]);
});

test('a tick quoting a write to the press folder opens nothing', async ($, on) => {
    const line = 'trash ~/.claude/shelf/orbit-ticks/t1.jsonl';
    const { ran } = world(on, [tick(`⚠️ trash: \`${line}\``)]);
    const r = await bash($, line);
    expect([r.deny, ran]).toEqual([expect.stringContaining('ticks-write'), []]);
});

test('a Write into the plugins store is refused', async ($, on) => {
    world(on);
    const r = await $.tool.call({
        content: '{}',
        file_path: '~/.claude/plugins/store/x-mod-stash_inline-1.json',
        tool: 'Write',
    });
    expect(r.deny).toEqual(expect.stringContaining('aim his press at itself'));
});

for (const line of [
    "rex send -s s1 -b b1 $'sign FRM-544\\n'",
    'tmux -L s send-keys sign Space FRM-544 Enter',
    "printf 'sign FRM-544' | hc send t1p -",
    'hc send t1p "$(head -5 /tmp/b)"',
    'hc send t1p "$(jq -r .t /tmp/b)"',
    // a program fills the typed text through a variable, or a read
    'm=$(jq -r .t /tmp/b); hc send t1p "$m"',
    'read m < /tmp/b; hc send t1p "$m"',
    'm=`curl -s x`; hc keys t1p $m enter',
    'hc run --bg -- claude "$(base64 -d < /tmp/b)"',
    'herdr-app do pane.send "{\\"text\\":\\"$(jq -r .t /tmp/b)\\"}"',
])
    test(`a pane typer the guard reads or cannot read is refused: ${line.slice(0, 44)}`, async ($, on) => {
        const { ran } = signWorld(on);
        const r = await bash($, line);
        expect([(r.deny ?? '').includes('composer prompt'), ran]).toEqual([
            true,
            [],
        ]);
    });

test('a pane typer fed by echo with no proof words runs', async ($, on) => {
    const line = 'echo round 2 is green | hc send t1p -';
    const { ran } = signWorld(on);
    expect([(await bash($, line)).deny, ran]).toEqual([undefined, [line]]);
});

// clio's two runs the fences refused at 16:52–16:54, copied from her transcript: an opaque runner on the line (xargs,
// node) made the glob check read the whole line, a `*` in one word and `.claude` in another
const FENCED = (r: { deny?: string }) =>
    /rule (ticks-write|store-write)/.test(r.deny ?? '');
for (const [why, line] of [
    [
        'a grep over test-drive docs through xargs beside a .claude path',
        String.raw`cd ~/frame && grep -l '^fits:.*sixth-sense' docs/test-drive/*.md | xargs -n1 basename | sed 's/\.md$//' | tr '\n' ' '; echo; grep -l '^fits:.*sixth-sense' docs/test-drive/*.md | xargs grep -L -i '^verdict:\|adopted\b.*verdict' | xargs -n1 basename; tail -12 home/.claude/plugin-x/skills/herdr/scripts/seat-tab.ts | cut -c1-160; x brief summon "cd ~/frame && claude --bg -n '⚡ 🔎 sixth sense: mods lane | main' --model opus --effort medium '/x:crew-sixth-sense FRM-544 main:620cfecb ⚡ 🔧 codie: mods lane | PK-363 🦉 clio final: a7322c96 spec: /Users/dima/frame/.scratch/mods-lane-6/spec.md trials: review-rounds wisphunter skill-named-load' --remote-control" 2>&1 | tail -6 | cut -c1-400`,
    ],
    [
        'a heredoc script run by node beside a jq brace',
        `cd ~/frame && cat > "/private/tmp/claude-501/-Users-dima-frame--clio/a741b7d8-dbde-4ae9-95c8-28d502c57cd0/scratchpad/tab.ts" <<'EOF'
import { keepSeatInTab } from '/Users/dima/frame/home/.claude/plugin-x/skills/herdr/scripts/seat-tab.ts';
console.log(keepSeatInTab('t2b', 'sixth-mods'));
EOF
node "/private/tmp/claude-501/-Users-dima-frame--clio/a741b7d8-dbde-4ae9-95c8-28d502c57cd0/scratchpad/tab.ts"; sleep 20; hc get t2b --json | jq -c '{status: .status, pid}'; hc read t2b --lines 12 | tail -12 | cut -c1-160`,
    ],
    [
        'a plugins path beside a glob in another word',
        'grep -l tick home/.claude/plugin-x/mods/*.md | xargs -n1 basename; ls ~/.claude/plugins/cache',
    ],
] as const)
    test(`an ordinary run naming no fenced path passes the fences: ${why}`, async ($, on) => {
        world(on);
        expect(FENCED(await bash($, line))).toBe(false);
    });

// sixth sense round 1 on a7322c96: a brace is its listed names, a glob a pattern, judged per segment
for (const line of [
    'mkdir -p ~/.claude/shelf/{a,b}',
    'bun test home/.claude/plugin-x/mods/x-mod-*/tests',
    'touch ~/.claude/shelf/flawlog/x-{a,b}.md',
    'cp notes.md ~/.claude/plugin-x/skills/*/',
    'mkdir -p ~/.claude/plugins/cache/{a,b}',
    'echo x > ~/.claude/./shelf/flawlog/x?.md',
    'touch ~/.claude/../shelf/orbit-tick?/x',
    'echo x > ~/.cl*de/shelf/flawlog/x.md',
    'cp notes.md ~/frame/*/',
    'touch ~/.cl*de/plugins/cache/x',
    'echo x > "$TMPDIR/out.txt"',
    // replay 17:48: a variable root with one segment after it names a file beside the folder, never inside it
    'timeout 120 pnpm exec vitest run x.test.ts > "$TMPDIR/v6-$i.txt" 2>&1',
    // replay 17:54: a regex's trailing `$` is no variable, and a path of variables alone names nothing
    'cp f x$/shelf/orbit-tick?/x',
    "git ls-tree -r --name-only HEAD | rg 'crew-codie/SKILL.md$|crew-dna/SKILL.md$' > out.txt",
    't=$(mktemp -d "${TMPDIR:-/tmp}/groom.XXXX"); printf x >> $r/$seat/$d.md',
    // replay 18:33: a read never forges (clio), so a program or a loop reading the folders runs; copied from real lines
    "python3 - <<'EOF'\nimport json\nd=json.load(open('/Users/dima/.claude/plugins/store/x-mod-stash_inline-1.json'))\nfor k,v in d.items(): print(k)\nEOF",
    "cd ~/frame && python3 - <<'PY'\np='.scratch/herdr-orbit/spec.md'; s=open(p).read()\ns=s.replace('the gap', 'the ~/.claude/shelf/orbit-ticks gap')\nopen(p,'w').write(s)\nPY",
    'for f in ~/.claude/shelf/orbit-ticks/*.jsonl; do echo "== $f"; tail -3 "$f"; done',
    // a program's own words name the folder: judged by its write calls, never by the words
    "python3 -I -c \"\nimport json,glob\nfor f in glob.glob('/Users/dima/.claude/shelf/orbit-ticks/*.jsonl'):\n  for l in open(f): print(json.loads(l)['id'])\n\"",
    "cd ~/.claude/plugins/store && ls x-mod-stash_*; for d in 2026-11-07; do jq -r '.x' x-mod-stash_inline-1.json; done",
    "grep -rl 'o108' ~/.claude/shelf/orbit-ticks/ 2>/dev/null | head -3 | xargs -I{} sh -c 'echo {}; cat \"{}\" | head -30' 2>/dev/null",
])
    test(`a glob that cannot reach a fenced folder passes: ${line}`, async ($, on) => {
        world(on);
        expect(FENCED(await bash($, line))).toBe(false);
    });

for (const line of [
    'echo x > ~/.claude/s*/orbit-tick?/t1.jsonl',
    'echo x > ~/.claude/shelf/orbit-{ticks,x}/t1.jsonl',
    'mkdir ~/.claude/plugins/st{ore,x}',
    'cp /tmp/s.json ~/.claude/p*s/st?re/',
    // sixth sense round 2: the path the kernel walks, not the raw segments
    'echo x > ~/.claude/./shelf/orbit-tick?/t1.jsonl',
    'echo x > ~/.claude//shelf/orbit-tick?/t1.jsonl',
    'echo x > ~/.claude/shelf/../shelf/orbit-tick?/t1.jsonl',
    'cp f ~/.claude/./plugins/sto?e/x-mod-stash_orbit.json',
    'touch ~/.claude/plugins/../shelf/o*/x',
    'touch ~/.claude/../.claude/shelf/orbit-tick?/x',
    // sixth sense round 3: a glob in the root segment itself
    'echo x > ~/.cl*de/shelf/orbit-tick?/t1.jsonl',
    'echo x > ~/.claud?/shelf/orbit-tick?/t1.jsonl',
    'echo x > ~/.cla{u,x}de/shelf/orbit-tick?/t1.jsonl',
    'cp f ~/.cl*/plugins/sto?e/x-mod-stash_orbit.json',
    'echo x > ~/.cl*de/shelf/orbit-ticks/t1.jsonl',
    'echo x > ~/frame/c?/shelf/orbit-tick?/t1.jsonl',
    'echo x > ~/.claude/{shelf/orbit-tick?,x}/t1.jsonl',
    'echo x > "$HOME"/.cl*de/shelf/orbit-tick?/t1.jsonl',
    'echo x > ~/.claude/$D/orbit-tick?/t1.jsonl',
    // a program or a cd that writes still counts (clio 18:34: the fence refuses writes only)
    "python3 -c \"open('/Users/dima/.claude/shelf/orbit-ticks/t1.jsonl','a').write('x')\"",
    "node -e \"require('fs').writeFileSync(process.env.HOME + '/.claude/plugins/store/x.json', '{}')\"",
    "python3 - <<'EOF'\nimport os\nos.replace('/tmp/f', os.path.expanduser('~/.claude/shelf/orbit-ticks/t1.jsonl'))\nEOF",
    'cd ~/.claude/plugins/store && cp /tmp/f x-mod-stash_inline-1.json',
    "cd ~/.claude/shelf/orbit-ticks && python3 -c \"open('t1.jsonl','a').write('x')\"",
    "ls ~/.claude/shelf/orbit-ticks | xargs -I{} sh -c 'echo x >> ~/.claude/shelf/orbit-ticks/{}'",
    'for f in ~/.claude/shelf/orbit-ticks/*.jsonl; do echo x >> "$f"; done',
    // a brace bomb in the folder's own name, past the cap: refused unread (wisphunter 18:06)
    `echo x > ~/.claude/shelf/orbit-tick${'{0,1}'.repeat(9)}`,
    // a variable keeps the word off the disk check, so the spelled check alone reads the brace
    'echo x > ~/.claude/shelf/orbit-{ticks,x}/$F',
    'cp f $C/shelf/orbit-tick?/x',
])
    test(`a glob that reaches a fenced folder is refused: ${line}`, async ($, on) => {
        world(on);
        expect(FENCED(await bash($, line))).toBe(true);
    });

test('a sign line typed with a leading blank is still his proof word', async ($, on) => {
    const { ran } = signWorld(on);
    const r = await bash($, "hc send clio ' sign FRM-544'");
    expect([PANE_PROOF(r), ran]).toEqual([true, []]);
});

// sixth sense round 1: a sign line split across `hc keys` calls holds no proof word in any one call, so keys into an
// agent's prompt box are fenced at the call; warn-only until sixth sense's clean and a clean replay (clio, 17:04)
const KEYS_WARNED = (r: unknown) =>
    JSON.stringify(r).includes('rule pane-keys') ||
    JSON.stringify(r).includes('pane-keys');
for (const line of [
    'hc keys clio s i g',
    'hc keys clio n space shift+f shift+r shift+m - 5 4 4 enter',
])
    test(`keys into an agent's pane are flagged, warn-only: ${line}`, async ($, on) => {
        const { ran } = world(on);
        const r = await bash($, line);
        expect([KEYS_WARNED(r), r.deny, ran]).toEqual([
            true,
            undefined,
            [line],
        ]);
    });

test("keys into a plain shell's prompt pass unflagged: the prefill for his hand", async ($, on) => {
    const line = 'hc keys shell1 g i t space s t a t u s';
    const { ran } = world(on);
    const r = await bash($, line);
    expect([KEYS_WARNED(r), ran]).toEqual([false, [line]]);
});

// sixth sense round 1, the o40 shape: a tick quoting the whole merge-auto command in backticks is his word for it
test('a tick quoting the whole merge-auto command lets its --dima-ok run once', async ($, on) => {
    const MERGE = 'x lane merge-auto 104 --apply --dima-ok 104';
    const { ran } = world(on, [tick(`merge it: \`${MERGE}\``)]);
    const first = await bash($, MERGE);
    const second = await bash($, MERGE);
    expect([first.deny, second.deny !== undefined, ran]).toEqual([
        undefined,
        true,
        [MERGE],
    ]);
});

// clio's stop at the round-3 cap: the fence judges where a write lands on disk, so a link, a glob or a `..` hop that
// resolves into the folder is refused however it is spelled; `~/.claude/shelf` is itself a link into frame, as live
const REAL = '/home/frame/home/.claude';
const LINKS = new Map([
    ['/home/.claude/shelf', `${REAL}/shelf`],
    ['/home/.claude/plugins', `${REAL}/plugins`],
    ['/home/frame/cc', REAL],
    ['/tmp/t', `${REAL}/shelf/orbit-ticks`],
    ['/tmp/s', `${REAL}/shelf`],
    ['/tmp/p', `${REAL}/plugins/store`],
    ['/tmp/f', `${REAL}/shelf/orbit-ticks/t1.jsonl`],
    ['/tmp/c', '/home/.claude'],
    ['/tmp/b', `${REAL}/shelf/band-presses`],
    ['/tmp/v/zz', `${REAL}/shelf/orbit-ticks`],
    ['/tmp/u/zz', `${REAL}/shelf/orbit-ticks`],
]);
// a folder past the glob fan-out
const WIDE = Array.from({ length: 1100 }, (_, i) => `n${i}`);
// a folder of plain files past it, as clio's grooms folder holds 1,364
const GROOMS = Array.from({ length: 1100 }, (_, i) => `g${i}.md`);
const DIRS = new Map([
    ['/', ['home', 'tmp']],
    ['/home', ['.claude', 'frame']],
    ['/home/.claude', ['shelf', 'plugins']],
    ['/home/frame', ['home', 'cc']],
    ['/home/frame/home', ['.claude']],
    [REAL, ['shelf', 'plugins']],
    [`${REAL}/shelf`, ['orbit-ticks', 'flawlog', 'band-presses']],
    [`${REAL}/shelf/band-presses`, ['band.jsonl']],
    [`${REAL}/shelf/orbit-ticks`, ['t1.jsonl']],
    [`${REAL}/shelf/flawlog`, []],
    [`${REAL}/plugins`, ['store', 'cache']],
    [`${REAL}/plugins/store`, []],
    [`${REAL}/plugins/cache`, []],
    ['/tmp', ['t', 's', 'p', 'f', 'c', 'm', 'other', 'b', 'w', 'v', 'u']],
    ['/tmp/w', GROOMS],
    ['/tmp/v', [...GROOMS, 'zz']],
    ['/tmp/u', ['a.md', 'zz']],
    ['/tmp/other', []],
    ['/tmp/m', WIDE],
    ...WIDE.map((n) => [`/tmp/m/${n}`, []] as [string, string[]]),
]);
function onTree(path: string) {
    let at = '';
    for (const seg of path.split('/').filter(Boolean)) {
        const parent = at || '/';
        if (!(DIRS.get(parent) ?? []).includes(seg)) return undefined;
        at = LINKS.get(`${at}/${seg}`) ?? `${at}/${seg}`;
    }
    return at || '/';
}
function diskWorld(on: On) {
    const { ran } = signWorld(on);
    on('fs.stat', (_$, e) => {
        const real = onTree(e.path);
        return real === undefined
            ? { deny: 'no such file' }
            : {
                  value: {
                      isLink: LINKS.has(e.path),
                      kind: DIRS.has(real)
                          ? ('dir' as const)
                          : ('file' as const),
                      mtimeMs: 0,
                      realPath: real,
                      size: 0,
                  },
              };
    });
    on('fs.list', (_$, e) => {
        const names = DIRS.get(onTree(e.path) ?? '');
        return names === undefined
            ? { deny: 'no such folder' }
            : {
                  value: names.map((name) => ({
                      isLink: LINKS.has(`${e.path}/${name}`),
                      kind: DIRS.has(onTree(`${e.path}/${name}`) ?? '')
                          ? ('dir' as const)
                          : ('file' as const),
                      mtimeMs: 0,
                      name,
                      size: 0,
                  })),
              };
    });
    return { ran };
}
for (const line of [
    'echo x > /tmp/t/t1.jsonl',
    "echo x > '/tmp/t'/t1.jsonl",
    'echo x > /tmp/s/orbit-tick?/t1.jsonl',
    'echo x > /tmp/*/t1.jsonl',
    'cd /tmp/t && echo x > t1.jsonl',
    'cd /tmp && echo x > t/t1.jsonl',
    'mv f /tmp/t',
    'cp f /tmp/p/x-mod-stash_orbit.json',
    'echo x > /tmp/s/../shelf/orbit-tick?/x',
    'echo x > /tmp/other/../t/t1.jsonl',
    'tee -a ~/frame/cc/shelf/orbit-t*/t1.jsonl < f',
    'echo x > "$HOME/frame/c?/plugins/sto*/x.json"',
    'echo x > /tmp/t/../orbit-tick?/x',
    'echo x >> /tmp/f',
    'echo x > ~/frame/home/.claude/../../../../tmp/t/x',
    'echo x > "$HOME/../tmp/t/x"',
    'echo x > /tmp/{t/t1.jsonl,other/x}',
    // wisphunter 18:06: an empty trailing variable, a case APFS ignores, padding and fan-out past the caps, a brace bomb
    'cp t1.jsonl ~/.claude/SHELF/orbit-tick?/$x',
    'cp t1.jsonl /tmp/c/shelf/orbit-tick?/$x',
    'echo x >> ~/.claude/shelf/ORBIT-TICKS/t1.jsonl',
    `cp ${Array.from({ length: 520 }, (_, i) => `a${i}`).join(' ')} /tmp/c/shelf/orbit-tick?/`,
    'cp f /tmp/m/*/../../c/shelf/orbit-tick?/',
    // a brace bomb as the write target
    `echo x > /tmp/c/shelf/orbit-tick?/${'{0,1}'.repeat(9)}`,
    'cp t1.jsonl /tmp/c/shelf/orbit-tic$x/',
    'cp f /tmp/c/shelf/$x/orbit-tick?/',
    'cp f /tmp/m/*/x',
    'cp f ~/.CLAUDE/shelf/orbit-tick?/',
    'cp f ~/.claude/shelf/ORBIT-TICK?/',
    // g4: one plain file stands for its siblings, while a link among them still lands
    'cd /tmp/v && cp f "$(cat a.md)"',
    'cp f /tmp/v/$x',
    'cd /tmp/u && cp f "$(cat a.md)"',
    'echo x > /tmp/v/$x',
    // past the word cap nothing is read, so even a harmless target counts as landing (fail closed)
    `cp ${Array.from({ length: 520 }, (_, i) => `a${i}`).join(' ')} /tmp/other/`,
])
    test(`a write that lands in a fenced folder on disk is refused: ${line}`, async ($, on) => {
        const { ran } = diskWorld(on);
        const r = await bash($, line);
        expect([FENCED(r), ran]).toEqual([true, []]);
    });
for (const line of [
    'cat /tmp/t/t1.jsonl',
    'ls /tmp/*',
    'echo x > /tmp/other/x',
    'echo x > /tmp/t/../flawlog/x.md',
    'echo x > /tmp/s/flawlog/x.md',
    'cp f /tmp/other/',
    `cp ${Array.from({ length: 10 }, (_, i) => `a${i}`).join(' ')} /tmp/other/`,
    'echo {a,b} > /tmp/other/x',
    // 2^30 words if it opened whole: the cap keeps the check quick, and an echo's words are no write
    `echo ${'{0,1}'.repeat(30)} > /tmp/other/x`,
    'ls /tmp/m/*/',
    // wing 1's flyway adds at 20:57: a loop over five long pocket lines, 275 words, under the cap now
    'cd ~/frame/_clio && node script/flyway-done.ts PK-346 2 2>&1 | tail -2; node script/flyway-done.ts PK-346 1 2>&1 | tail -2; for l in "FRM-554 landing: the live check on main\'s node_modules/.bin, one real commit after it, x lane landed FRM-554 --pr 156 --apply, the close, glide l64 ended" "today\'s two almost-freebies on dima\'s 20:53 tick, a helper card each: FRM-559 prompt-groom matcher, FRM-543\'s .scratch brief path in wish-cover-on-write.sh" "the scopes sweep with dima: steps 1–4 of 7 settled and in linear; left: step 5 cli cuts, step 6 built cli and the nine duplicated rules, step 7 the rebalance; the order lives in linear sortOrder and .scratch/herdr/scopes-audit.md § the whole execution order: read it first at any boot" "FRM-384 joins cli lane 7 after FRM-554 lands: a new spec section, x lane dispatch, a next: message to the codie and its sixth sense" "📅 herdr\'s two open questions, answered from herdr itself: where the status bar and the VS Code button are, which terminal herdr runs — on: 2026-11-14"; do node script/flyway-done.ts PK-346 --add "$l" 2>&1 | tail -1; done; grep -n "^- \\[ \\]" "pocket/tasks/pk-346 - flyway-wing-1.md" | cut -c1-110',
    // past the fan-out only path words land, so a pipe's flags stay a read (clio's line, 18:58)
    'f=$(ls /tmp/m/*/x); grep -n "sign" "$f" | cut -c1-120 | tail -3',
    // g4: helga's pocket append from a folder of 1,364 groom files (18:37), and clio's grep in the ticks folder
    'cd /tmp/w && BACKLOG_CWD=~/frame/_clio backlog task edit PK-377 --append-notes "$(cat a.md b.md)" 2>&1 | tail -n 5',
    'cd /tmp/w && BACKLOG_CWD=$HOME/frame/_clio backlog task edit PK-377 --append-notes "$(cat a.md b.md c.md)" 2>&1 | tail -n 5',
    `cd ~/.claude/shelf/orbit-ticks; grep -h '"o60"' *.jsonl | tail -2`,
    `cd /tmp/t; grep -h '"o60"' *.jsonl | tail -2`,
    // clio's line as she ran it, from the replay
    `cd ~/.claude/shelf/orbit-ticks; grep -h '"o60"' *.jsonl | tail -2 | cut -c1-400`,
    'cd ~/.claude/shelf/orbit-ticks && for f in $(ls -t | head -8); do echo "== $f $(stat -f %Sm -t %H:%M:%S $f)"; tail -2 $f | cut -c1-160; done',
])
    test(`a write that lands outside the fenced folders runs: ${line}`, async ($, on) => {
        const { ran } = diskWorld(on);
        const r = await bash($, line);
        expect([FENCED(r), ran]).toEqual([false, [line]]);
    });

// wisphunter 18:06: tar unpacks into the folder it is handed; the shelf's own clean-stamp fence answers first
test('a tar unpacked into the shelf is refused', async ($, on) => {
    const { ran } = diskWorld(on);
    const r = await bash($, 'tar -xf forged.tar -C ~/.claude/shelf');
    expect([/rule (clean-stamp|ticks-write)/.test(r.deny ?? ''), ran]).toEqual([
        true,
        [],
    ]);
});

// clio's FRM-567 at 19:28 and her 18:49 loop: a body file the line writes before it is set, or names by a variable, is
// read as it can be: a plain body edit of an unsigned ticket runs, one that can bring a sign line still needs his word
const T = '/tmp/tickets';
const bodyWorld = (on: On, files: Record<string, string>) => {
    const w = world(on, [], UNSIGNED);
    on('fs.read', (_$, e) =>
        e.path in files
            ? { value: files[e.path] as string }
            : { deny: 'outside the readable paths' },
    );
    on('fs.list', (_$, e) =>
        e.path === T
            ? {
                  value: Object.keys(files)
                      .filter((f) => f.startsWith(`${T}/`))
                      .map((f) => ({
                          isLink: false,
                          kind: 'file' as const,
                          mtimeMs: 0,
                          name: f.slice(T.length + 1),
                          size: 1,
                      })),
              }
            : { deny: 'no such folder' },
    );
    return w;
};
const PLAIN = '## wish\n\n* W1 (2026-11-10, dima): tabs\n';
const STAMPED = `F=${T}/tabs-body.md && sd '^\\* W1 \\(' '* FRM-567:W1 (' $F && printf '\\n⸻ 🪪 cc · agent run stamp\\n' >> $F && x linear body FRM-567 --set $F; echo "exit $?"`;
const LOOP = `T="${T}"; set -- a.md FRM-562 b.md FRM-563; while [ $# -gt 0 ]; do f=$1; id=$2; shift 2; python3 -c "
import sys
p,i=sys.argv[1],sys.argv[2]; s=open(p).read().replace('{ID}',i); open(p,'w').write(s)" "$T/$f" "$id"; x linear body $id --set "$T/$f" > "$T/$f.set.log" 2>&1; done`;
for (const [why, line, files] of [
    [
        'an sd and a stamp written before the set',
        STAMPED,
        { [`${T}/tabs-body.md`]: PLAIN },
    ],
    [
        'a loop over files a variable names',
        LOOP,
        { [`${T}/a.md`]: PLAIN, [`${T}/b.md`]: PLAIN },
    ],
    [
        'a read of the file before the set',
        `F=${T}/tabs-body.md && grep -c W1 $F && cat $F && x linear body FRM-567 --set $F`,
        { [`${T}/tabs-body.md`]: PLAIN },
    ],
] as const)
    test(`a body edit of an unsigned ticket runs: ${why}`, async ($, on) => {
        const { ran } = bodyWorld(on, { ...files });
        const r = await bash($, line);
        expect([signFlagged(r), ran]).toEqual([
            false,
            [checked(line, 'FRM-567', '$id')],
        ]);
    });
for (const [why, line, files] of [
    [
        'the stamp writes a sign line',
        `F=${T}/tabs-body.md && printf '\\n✍️ signed 2026-11-10\\n' >> $F && x linear body FRM-567 --set $F`,
        { [`${T}/tabs-body.md`]: PLAIN },
    ],
    [
        'a copy brings a file the guard never read',
        `F=${T}/tabs-body.md && cp /tmp/other.md $F && x linear body FRM-567 --set $F`,
        { [`${T}/tabs-body.md`]: PLAIN },
    ],
    [
        'one file the loop sets holds a sign line',
        LOOP,
        {
            [`${T}/a.md`]: PLAIN,
            [`${T}/b.md`]: `${PLAIN}\n## signed\n\n✍️ signed 2026-11-10\n`,
        },
    ],
    [
        'a program on the line reads another file',
        `F=${T}/tabs-body.md && python3 -c "open('$F','w').write(open('/tmp/signed.md').read())" && x linear body FRM-567 --set $F`,
        { [`${T}/tabs-body.md`]: PLAIN },
    ],
    [
        'a loop hands its program a path',
        LOOP.replace('FRM-563;', 'FRM-563 /tmp/signed.md;'),
        { [`${T}/a.md`]: PLAIN, [`${T}/b.md`]: PLAIN },
    ],
    [
        'the file it sets does not read',
        `F=${T}/gone.md && sd x y $F && x linear body FRM-567 --set $F`,
        {},
    ],
] as const)
    test(`a body write that can bring a sign line is judged as it runs: ${why}`, async ($, on) => {
        const { ran } = bodyWorld(on, { ...files });
        const r = await bash($, line);
        expect([r.deny, ran]).toEqual([
            undefined,
            [checked(line, 'FRM-567', '$id')],
        ]);
    });

// FRM-544 slice 2f: the first prompt's sign ids are kept for that prompt only, for x-mod-stash to put the ✍️ sign ask up
test("a first prompt's sign ids are kept for that prompt, and the next prompt clears them", async ($, on) => {
    signWorld(on);
    const kept: unknown[] = [];
    on('state.set', (_$, e, next) => {
        if (e.plugin === 'x-mod-guard' && e.key === 'firstSign')
            kept.push(e.value);
        return next(e);
    });
    await firstPrompt($, 'sign FRM-544 FRM-519');
    await firstPrompt($, 'sign FRM-544');
    expect(kept).toEqual([
        null,
        { at: expect.any(Number), ids: ['FRM-544', 'FRM-519'] },
        null,
    ]);
});

// FRM-574 decided 6 and 7: a sign write inside a heredoc or a script passes on his typed sign, a failed one keeps his word,
// and every other line of the script still meets every rule
const PY_SIGN = `python3 - <<'EOF'
body = open('/tmp/FRM-1.md').read().replace('## wish', '## signed\\n\\n✍️ signed today\\n\\n## wish')
open('/tmp/FRM-1.md', 'w').write(body)
EOF
x linear body FRM-1 --set /tmp/FRM-1.md`;
const PY_INNER = `python3 - <<'EOF'
import subprocess
subprocess.run(['x', 'linear', 'body', 'FRM-1', '--set', '/tmp/FRM-1.md'], check=True)
EOF`;
for (const [why, line] of [
    ['a python heredoc writes the body file', PY_SIGN],
    ['the python heredoc runs the write itself', PY_INNER],
    [
        'a cat heredoc writes the body file',
        "cat > /tmp/FRM-1.md <<'EOF'\n## signed\n\n✍️ signed today\nEOF\nx linear body FRM-1 --set /tmp/FRM-1.md",
    ],
] as const)
    test(`exit 3: his typed «sign FRM-1» carries a sign write when ${why}, and its retry after a failure`, async ($, on) => {
        const { fail, ran } = signWorld(on);
        await hisNext($, 'sign FRM-1');
        fail.push(true);
        const first = await bash($, line);
        const retry = await bash($, line);
        expect([first.deny, retry.deny, ran]).toEqual([
            undefined,
            undefined,
            [line, line],
        ]);
    });

test('exit 3: a heredoc sign write with no sign word of his is judged as it runs', async ($, on) => {
    const { ran } = signWorld(on);
    await hisNext($, 'go on');
    const r = await bash($, PY_SIGN);
    expect([r.deny, ran]).toEqual([undefined, [checked(PY_SIGN)]]);
});

const scriptWorld = (on: On, script: string) => {
    const w = world(on, [], UNSIGNED, SIGNED_TODAY());
    on('fs.read', (_$, e) =>
        e.path === '/repo/sign.sh'
            ? { value: script }
            : { deny: 'outside the readable paths' },
    );
    on('fs.stat', () => ({
        value: { isLink: false, kind: 'file' as const, mtimeMs: 0, size: 64 },
    }));
    return w;
};
const SCRIPT_SIGN = 'x linear body FRM-1 --set /tmp/FRM-1.md\n';

test('exit 10: a script holding the sign write and an rm is refused on his typed sign', async ($, on) => {
    const { ran } = scriptWorld(on, `${SCRIPT_SIGN}rm -rf /tmp/fixture\n`);
    await hisNext($, 'sign FRM-1');
    const r = await bash($, 'bash /repo/sign.sh');
    expect([r.deny, ran]).toEqual([expect.stringContaining('rm'), []]);
});

test('a script holding only the sign write runs on his typed sign, and is refused with no word of his', async ($, on) => {
    const { ran } = scriptWorld(on, SCRIPT_SIGN);
    await hisNext($, 'go on');
    const before = await bash($, 'bash /repo/sign.sh');
    await dimaSays($, 'sign FRM-1');
    const after = await bash($, 'bash /repo/sign.sh');
    expect([signFlagged(before), after.deny, ran]).toEqual([
        true,
        undefined,
        ['bash /repo/sign.sh'],
    ]);
});

// FRM-574 decided 3: his bare yes under the one open guarded ask of this seat's orbit is his tick on it
type OpenAsk = {
    id: string;
    text: string;
    mark?: string;
    isResolved?: boolean;
};
const OPEN_MIRROR: OpenAsk[] = [{ id: 'o7', text: MIRROR_ASK }];
// dima's prompt, then the seat's turn adds the asks, then his next prompt: what a real round looks like (o19)
// r7 (his o27): the seat's reply ends its turn before his yes, and a yes counts only for an ask that reply named
const replied = ($: Engine, answer: string, agentId?: string) =>
    $.turn.complete({
        answer,
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
        ...(agentId ? { agentId } : {}),
    });
async function askedThenSays(
    $: Engine,
    orbit: OpenAsk[],
    added: OpenAsk[],
    word: string,
    reply = `run \`${MIRROR}\` now?`,
) {
    await dimaSays($, 'go on');
    orbit.push(...added);
    await replied($, reply);
    await $.prompt.submit({
        origin: { kind: 'composer' },
        text: word,
        wait: false,
    });
}
for (const word of ['yes', 'go', 'Approve.', 'i approve', 'merge', 'do it'])
    test(`exit 9: his typed «${word}» under one open ⚠️ ask runs its command once`, async ($, on) => {
        const orbit: OpenAsk[] = [];
        const { ran } = world(on, [], undefined, undefined, orbit);
        await askedThenSays($, orbit, OPEN_MIRROR, word);
        const first = await bash($, MIRROR);
        const second = await bash($, MIRROR);
        expect([first.deny, second.deny !== undefined, ran]).toEqual([
            undefined,
            true,
            [MIRROR],
        ]);
    });

for (const [why, asks, word] of <[string, OpenAsk[], string][]>[
    [
        'two asks are open',
        [...OPEN_MIRROR, { id: 'o8', text: '⚠️ drop: `git stash drop`' }],
        'yes',
    ],
    ['none is open', [{ ...OPEN_MIRROR[0], mark: 'rejected' }], 'yes'],
    ['the ask is resolved', [{ ...OPEN_MIRROR[0], isResolved: true }], 'go'],
    ['he says ok', OPEN_MIRROR, 'ok'],
    ['he says stop it', OPEN_MIRROR, 'stop it'],
    ['the yes sits in a sentence', OPEN_MIRROR, 'yes but not the mirror'],
    [
        'the open ask is a plain one',
        [{ id: 'o7', text: `mirror: \`${MIRROR}\`` }],
        'yes',
    ],
])
    test(`exit 9: a bare yes runs nothing when ${why}`, async ($, on) => {
        const orbit: OpenAsk[] = [];
        const { ran } = world(on, [], undefined, undefined, orbit);
        await askedThenSays($, orbit, asks, word);
        expect([(await bash($, MIRROR)).deny, ran]).toEqual([
            expect.stringContaining('mirror'),
            [],
        ]);
    });

// o19, dima's pick: a bare yes answers only an ask added since his last typed prompt; an older one needs its tick
test('a bare yes runs nothing for an ask already open at his last prompt', async ($, on) => {
    const { ran } = world(on, [], undefined, undefined, OPEN_MIRROR);
    await dimaSays($, 'yes');
    expect([(await bash($, MIRROR)).deny, ran]).toEqual([
        expect.stringContaining('mirror'),
        [],
    ]);
});

test('a bare yes answers the one ask added since his last prompt, an older one beside it', async ($, on) => {
    const orbit: OpenAsk[] = [{ id: 'o6', text: '⚠️ drop: `git stash drop`' }];
    const { ran } = world(on, [], undefined, undefined, orbit);
    await askedThenSays($, orbit, OPEN_MIRROR, 'yes');
    expect([(await bash($, MIRROR)).deny, ran]).toEqual([undefined, [MIRROR]]);
    expect((await bash($, 'git stash drop')).deny).toContain('stash');
});

// wisphunter on bc030709: a failed orbit read keeps the last snapshot, and a session with none ticks nothing
test('a bare yes after a failed orbit read runs nothing for the ask open before', async ($, on) => {
    let isDown = false;
    const { ran } = world(on, [], undefined, undefined, OPEN_MIRROR, {
        isOrbitDown: () => isDown,
    });
    await dimaSays($, 'go on');
    isDown = true;
    await $.prompt.submit({
        origin: { kind: 'composer' },
        text: 'ok',
        wait: false,
    });
    isDown = false;
    await $.prompt.submit({
        origin: { kind: 'composer' },
        text: 'yes',
        wait: false,
    });
    expect([(await bash($, MIRROR)).deny, ran]).toEqual([
        expect.stringContaining('mirror'),
        [],
    ]);
});

test('a bare yes in a session with no snapshot yet runs nothing', async ($, on) => {
    // a session prompted before this rule: its prompted mark stands, no snapshot was ever taken
    const { ran } = world(on, [], undefined, undefined, OPEN_MIRROR, {
        isPrompted: true,
    });
    await $.prompt.submit({
        origin: { kind: 'composer' },
        text: 'yes',
        wait: false,
    });
    expect([(await bash($, MIRROR)).deny, ran]).toEqual([
        expect.stringContaining('mirror'),
        [],
    ]);
});

test('a bare yes answers an ask followed since his last prompt', async ($, on) => {
    const orbit: OpenAsk[] = [{ id: 'o7', text: '⚠️ mirror: an older round' }];
    const { ran } = world(on, [], undefined, undefined, orbit);
    await dimaSays($, 'go on');
    orbit[0] = { id: 'o7', text: MIRROR_ASK };
    await replied($, `the followed \`${MIRROR}\` waits on your tick`);
    await $.prompt.submit({
        origin: { kind: 'composer' },
        text: 'yes',
        wait: false,
    });
    expect([(await bash($, MIRROR)).deny, ran]).toEqual([undefined, [MIRROR]]);
});

for (const [why, kind] of [
    ['a peer message (SendMessage)', 'peer'],
    ['an auto-continuation', 'auto-continuation'],
] as const)
    test(`a bare yes from ${why} runs nothing`, async ($, on) => {
        const { ran } = world(on, [], undefined, undefined, OPEN_MIRROR);
        await dimaSays($, 'go on');
        await $.prompt.submit({ origin: { kind }, text: 'yes', wait: false });
        expect([(await bash($, MIRROR)).deny, ran]).toEqual([
            expect.stringContaining('mirror'),
            [],
        ]);
    });

test("a session's first prompt «yes» runs nothing", async ($, on) => {
    const { ran } = world(on, [], undefined, undefined, OPEN_MIRROR);
    await firstPrompt($, 'yes');
    expect([(await bash($, MIRROR)).deny, ran]).toEqual([
        expect.stringContaining('mirror'),
        [],
    ]);
});

for (const line of [
    'hc send t5 yes',
    "hc send t5 'go'",
    'hc keys t5 g o enter',
    "tmux send-keys -t x 'do it' Enter",
])
    test(`a seat typing a bare yes into a pane is refused: ${line}`, async ($, on) => {
        const { ran } = world(on);
        expect([PANE_PROOF(await bash($, line)), ran]).toEqual([true, []]);
    });

for (const line of ["hc send t5 'go on with slice 2'", "claude --bg -n x 'go'"])
    test(`a pane message that is no bare yes passes: ${line}`, async ($, on) => {
        const { ran } = world(on);
        const r = await $.tool.call({
            command: line,
            run_in_background: true,
            tool: 'Bash',
        });
        expect([PANE_PROOF(r), ran]).toEqual([false, [line]]);
    });

test('exit 10: a warn-only line ahead of a floor one in a sign script still refuses the script', async ($, on) => {
    const { ran } = scriptWorld(
        on,
        `$CMD foo\nrm -rf /tmp/fixture\n${SCRIPT_SIGN}`,
    );
    await hisNext($, 'sign FRM-1');
    const r = await bash($, 'bash /repo/sign.sh');
    expect([r.deny, ran]).toEqual([expect.stringContaining('rm'), []]);
});

// FRM-574 rider: wing 1's 14:59 replay, a pull-copy-set of unsigned FRM-575's body, was refused as a sign
const PULL_COPY_SET = `P=$(x linear body FRM-575 | jq -r '.data.file // .data.path'); cp /tmp/scratch-body.md "$P"; x linear body FRM-575 --set "$P"`;
const SIGNED_BODY = `## signed\n\n✍️ signed ${today()} · body 11aa22bb\n`;
test('exit 13: a pull-copy-set of an unsigned ticket body runs with no word of his', async ($, on) => {
    const { ran } = world(on, [], UNSIGNED, UNSIGNED);
    await hisNext($, 'go on');
    expect([(await bash($, PULL_COPY_SET)).deny, ran]).toEqual([
        undefined,
        [checked(PULL_COPY_SET, 'FRM-575')],
    ]);
});
for (const [why, body, cat] of [
    ['the ticket is signed', SIGNED_BODY, undefined],
    ['the copied file holds a sign line', UNSIGNED, SIGNED_BODY],
] as const)
    test(`exit 13: the same pull-copy-set is judged as it runs when ${why}`, async ($, on) => {
        const { ran } = world(on, [], body, cat);
        await hisNext($, 'go on');
        expect([(await bash($, PULL_COPY_SET)).deny, ran]).toEqual([
            undefined,
            [checked(PULL_COPY_SET, 'FRM-575')],
        ]);
    });

// sixth sense round 1 on 23037434: exit 3's «spent only after the exit 0» — each sign write, label and body, spends his
// word once on success, and a failed one hands it back
test('exit 3: a heredoc sign write that succeeds spends his typed sign, a second run is judged as it runs', async ($, on) => {
    const { ran } = signWorld(on);
    await hisNext($, 'sign FRM-1');
    const first = await bash($, PY_SIGN);
    const second = await bash($, PY_SIGN);
    expect([first.deny, second.deny, ran]).toEqual([
        undefined,
        undefined,
        [PY_SIGN, checked(PY_SIGN)],
    ]);
});

test('his typed sign carries the body write once, a failed one retried, and the label each time', async ($, on) => {
    const { fail, ran } = signWorld(on);
    await hisNext($, 'sign FRM-1');
    const body = 'x linear body FRM-1 --set /tmp/FRM-1.md';
    fail.push(true);
    const failed = await bash($, body);
    const retry = await bash($, body);
    const again = await bash($, body);
    const labels = [
        await bash($, labelOf('FRM-1')),
        await bash($, labelOf('FRM-1')),
    ];
    expect([
        failed.deny,
        retry.deny,
        signFlagged(again),
        labels.map((r) => r.deny),
        ran.length,
    ]).toEqual([undefined, undefined, true, [undefined, undefined], 4]);
});

// sixth sense round 1: a pull and a set with no copy between them set the pulled file, which an Edit may have signed
test('exit 13: a pull-set with no copy of an unsigned ticket body still needs his word', async ($, on) => {
    const line = `P=$(x linear body FRM-575 | jq -r '.data.file // .data.path'); x linear body FRM-575 --set "$P"`;
    const { ran } = world(on, [], UNSIGNED, UNSIGNED);
    await hisNext($, 'go on');
    expect([(await bash($, line)).deny, ran]).toEqual([
        undefined,
        [checked(line, 'FRM-575')],
    ]);
});

// sixth sense round 2: an inline program running the body write is a sign, spent once on success
test('exit 3: a python heredoc that runs the sign write itself needs his word and spends it once', async ($, on) => {
    const { ran } = signWorld(on);
    await hisNext($, 'go on');
    const before = await bash($, PY_INNER);
    await dimaSays($, 'sign FRM-1');
    const first = await bash($, PY_INNER);
    const second = await bash($, PY_INNER);
    expect([signFlagged(before), first.deny, signFlagged(second), ran]).toEqual(
        [true, undefined, true, [PY_INNER]],
    );
});

// r2 (mods-lane-6, clio's pick a): a body set whose file the line itself writes is judged when it runs, by a shell check
// the guard puts in front of it, so a plain edit of a signed ticket runs with no tick (17 false refusals, 11-10 and 11-11)
const SIGN_CHECKED = '__x_mod_guard_sign_set linear body';
for (const [why, line] of [
    [
        'a cat >> appends to the body file',
        "B=/repo/b.md; cat >> $B <<'EOF'\n\n## closing word\n\ndone\nEOF\nx linear body FRM-1 --set $B",
    ],
    [
        'a python heredoc edits the body file',
        "python3 - <<'EOF'\np='/repo/b.md'; s=open(p).read(); open(p,'w').write(s.replace('x','y'))\nEOF\nx linear body FRM-1 --set /repo/b.md",
    ],
    [
        'an sd edits the body file in place',
        "sd 'a' 'b' /repo/b.md && x linear body FRM-1 --set /repo/b.md",
    ],
    [
        'a printf >> adds a re-sign pending line',
        "printf '\\n✍️ re-sign pending today\\n' >> /repo/b.md; x linear body FRM-1 --set /repo/b.md",
    ],
    [
        'a loop over two ids stamps each file',
        "for t in FRM-1 FRM-2; do printf '\\nlook sent\\n' >> /repo/$t.md; x linear body $t --set /repo/$t.md; done",
    ],
    [
        'a node script edits the body file',
        "node script/ticket-sign.ts FRM-1 changed 'tiny' >/dev/null; x linear body FRM-1 --set /repo/b.md",
    ],
    [
        'a set -- pair loop names the id in a variable',
        'set -- a.md FRM-1 b.md FRM-2; while [ $# -gt 0 ]; do f=$1; id=$2; shift 2; x linear body $id --set /repo/$f; done',
    ],
    // clio's o98 (dima's tick 22:27): an awk merge of groomed lines into FRM-577's pulled body, refused as a sign
    [
        'an awk writes the body file and the set is read by jq',
        `S=/repo; awk 'NR==FNR{a[++n]="* "$0; next} {print} FNR==8{for(i=1;i<=n;i++) print a[i]}' /repo/g.md $S/b.md > $S/b.new; sed -n 7,12p $S/b.new | cut -c1-70; x linear body FRM-1 --set $S/b.new | jq -r .status`,
    ],
] as const)
    test(`r2: ${why} on a signed ticket runs with no tick, its set judged when it runs`, async ($, on) => {
        const { ran } = world(on, [], SIGNED_TODAY());
        on('fs.read', () => ({ value: SIGNED_TODAY() }));
        const r = await bash($, line);
        expect([
            r.deny?.slice(0, 160),
            ran.length,
            ran[0]?.includes(SIGN_CHECKED),
        ]).toEqual([undefined, 1, true]);
    });

const PY_SIGNS =
    "python3 - <<'EOF'\nopen('/repo/b.md', 'a').write('✍️ signed today')\nEOF\n";
for (const [why, line] of [
    [
        'a label sign beside a body write',
        "printf 'x' >> /repo/b.md; x linear set FRM-1 --add-label signed",
    ],
    [
        'a wrapper the check cannot sit inside',
        "sd 'a' 'b' /repo/b.md && timeout 60 x linear body FRM-1 --set /repo/b.md",
    ],
    // wisphunter and security on 6c6c57cf: the seat writes the rest of the line, so a line that could reach the check, or
    // hold a set of the id the check never sees, is judged before it runs
    [
        'a wrapped set beside a checked one',
        `${PY_SIGNS}x linear body FRM-1 --set /repo/c.md; timeout 60 x linear body FRM-1 --set /repo/b.md`,
    ],
    [
        'a path-form x beside a checked one',
        `${PY_SIGNS}~/.local/bin/x linear body FRM-1 --set /repo/b.md; x linear body FRM-1 --set /repo/c.md`,
    ],
    [
        'a set inside bash -c beside a checked one',
        `${PY_SIGNS}bash -c 'x linear body FRM-1 --set /repo/b.md'; x linear body FRM-1 --set /repo/c.md`,
    ],
    [
        'a function the check calls, defined on the line',
        `${PY_SIGNS}awk() { return 0; }; x linear body FRM-1 --set /repo/b.md`,
    ],
    [
        'the check itself, redefined on the line',
        `${PY_SIGNS}__x_mod_guard_sign_set() { command x "$@"; }; x linear body FRM-1 --set /repo/b.md`,
    ],
    [
        'a PATH set for the set',
        `${PY_SIGNS}PATH=/repo/fake:$PATH x linear body FRM-1 --set /repo/b.md`,
    ],
    [
        'an exported PATH',
        `${PY_SIGNS}export PATH=/repo/fake; x linear body FRM-1 --set /repo/b.md`,
    ],
    [
        'a command off the allow-list',
        `${PY_SIGNS}pnpm build; x linear body FRM-1 --set /repo/b.md`,
    ],
    // sixth sense round 5 on e9d68294: an awk that can run a command runs it out of the check's sight
    [
        'an awk program that runs a command',
        `${PY_SIGNS}awk 'BEGIN{system("cp /repo/c.md /repo/b.md")}'; x linear body FRM-1 --set /repo/b.md`,
    ],
] as const)
    test(`r2: ${why} stays refused with no tick`, async ($, on) => {
        const { ran } = world(on, [], SIGNED_TODAY());
        on('fs.read', () => ({ value: SIGNED_TODAY() }));
        expect([signFlagged(await bash($, line)), ran]).toEqual([true, []]);
    });

// clio's o98: a script's argument that names a body set is its data, never its code: the script's own text is read as a
// script the line runs; inline code (`node -e`, `python3 -c`, a heredoc on stdin) still signs every id it names
const FLYWAY =
    "cd /repo && node script/flyway-done.ts PK-349 --add 'groom homes blocked: x linear body --set on FRM-1 (unsigned) is refused as a sign' >/dev/null && echo added";
test('a script argument naming a body set signs nothing', async ($, on) => {
    const { ran } = world(on, [], SIGNED_TODAY());
    on('fs.read', () => ({ value: "console.log('a flyway line');\n" }));
    const r = await bash($, FLYWAY);
    expect([r.deny, ran]).toEqual([undefined, [FLYWAY]]);
});
for (const line of [
    `node -e "const c = 'x linear body FRM-1 --set /repo/b.md'; require('child_process').execSync(c)"`,
    `python3 -c "import os; os.system('x linear body FRM-1 --set /repo/b.md')"`,
    "python3 - <<'EOF'\nimport os; os.system('x linear body FRM-1 --set /repo/b.md')\nEOF",
    // sixth sense round 5 on e9d68294: a flag's value before the inline-code flag is no script file
    `python3 -W ignore -c "import subprocess; subprocess.run(['x','linear','body','FRM-1','--set','/repo/b.md'])"`,
    `python3 -X dev -c "import os; os.system('x linear body FRM-1 --set /repo/b.md')"`,
    `node -r ./x.js -e "const c = 'x linear body FRM-1 --set /repo/b.md'; require('child_process').execSync(c)"`,
    `ruby -I lib -e "system('x linear body FRM-1 --set /repo/b.md')"`,
    `perl -I lib -e "system('x linear body FRM-1 --set /repo/b.md')"`,
    `awk 'BEGIN{system("x linear body FRM-1 --set /repo/b.md")}'`,
    // sixth sense round 6 on 77f877eb: stdin named as a path, a here-string, a process substitution, and awk's other names
    `python3 /dev/fd/0 <<< "import os; os.system('x linear body FRM-1 --set /repo/b.md')"`,
    `python3 /dev/stdin <<< "import os; os.system('x linear body FRM-1 --set /repo/b.md')"`,
    `python3 <(printf '%s' "import os; os.system('x linear body FRM-1 --set /repo/b.md')")`,
    `gawk 'BEGIN{system("x linear body FRM-1 --set /repo/b.md")}'`,
    `mawk 'BEGIN{system("x linear body FRM-1 --set /repo/b.md")}'`,
    `printf '%s' "import os; os.system('x linear body FRM-1 --set /repo/b.md')" | python3`,
])
    test(`inline code naming a body set still signs: ${line.split(' ')[0]} ${line.split(' ')[1]}`, async ($, on) => {
        const { ran } = world(on, [], SIGNED_TODAY());
        on('fs.read', () => ({ value: SIGNED_TODAY() }));
        expect([signFlagged(await bash($, line)), ran]).toEqual([true, []]);
    });

test('r2: his typed sign runs the body set as written, no check in front', async ($, on) => {
    const { ran } = world(on, [], SIGNED_TODAY());
    on('fs.read', () => ({ value: SIGNED_TODAY() }));
    const line =
        "sd 'a' 'b' /repo/b.md && x linear body FRM-1 --set /repo/b.md";
    await hisNext($, 'sign FRM-1');
    const r = await bash($, line);
    expect([r.deny, ran]).toEqual([undefined, [line]]);
});

// wisphunter on 0de792b0: a subject names the ask with two words or more, each a whole token
for (const [why, text, reply, isRun] of [
    [
        'a two-word subject is named',
        `⚠️ mirror push: \`${MIRROR}\``,
        'the mirror push is ready, ok?',
        true,
    ],
    [
        'another ticket holds the subject id',
        `⚠️ mirror FRM-1: \`${MIRROR}\``,
        'mirror FRM-14 next?',
        false,
    ],
] as const)
    test(`r7: a bare yes ${isRun ? 'runs' : 'runs nothing'} when ${why}`, async ($, on) => {
        const orbit: OpenAsk[] = [];
        const { ran } = world(on, [], undefined, undefined, orbit);
        await askedThenSays($, orbit, [{ id: 'o7', text }], 'yes', reply);
        const r = await bash($, MIRROR);
        expect([r.deny === undefined, ran]).toEqual([
            isRun,
            isRun ? [MIRROR] : [],
        ]);
    });

// r7, dima's o27: a bare yes ticks the new guarded ask only when the seat's last reply named it, by its id, a command it
// quotes, or its subject words; a reply asking something else leaves his yes to that question
for (const [why, reply, isRun] of [
    [
        'the reply asks something else',
        'should I rename the deck to x-cc-deck?',
        false,
    ],
    ['the reply names the ask by its id', 'o7 waits on your tick', true],
    ['the reply quotes its command', `run \`${MIRROR}\` now?`, true],
    [
        'the reply names only its one-word subject',
        'the Mirror is ready, ok?',
        false,
    ],
    ['another id holds the ask id', 'o71 waits on your tick', false],
] as const)
    test(`r7: a bare yes ${isRun ? 'runs' : 'runs nothing'} when ${why}`, async ($, on) => {
        const orbit: OpenAsk[] = [];
        const { ran } = world(on, [], undefined, undefined, orbit);
        await askedThenSays($, orbit, OPEN_MIRROR, 'yes', reply);
        const r = await bash($, MIRROR);
        expect([r.deny === undefined, ran]).toEqual([
            isRun,
            isRun ? [MIRROR] : [],
        ]);
    });

test("r7: a subagent's report naming the ask is no reply of the seat's", async ($, on) => {
    const orbit: OpenAsk[] = [];
    const { ran } = world(on, [], undefined, undefined, orbit);
    await dimaSays($, 'go on');
    orbit.push(...OPEN_MIRROR);
    await replied($, 'should I rename the deck?');
    await replied($, 'the mirror push is ready', 'a1');
    await $.prompt.submit({
        origin: { kind: 'composer' },
        text: 'yes',
        wait: false,
    });
    expect([(await bash($, MIRROR)).deny !== undefined, ran]).toEqual([
        true,
        [],
    ]);
});

// g1 (FRM-544): clio's «👀 look sent» writes on signed tickets, each refused as a sign before r2 (14:45, and 2026-11-09
// 22:14); a stamp that adds no sign line is judged as it runs, so the line runs with no tick
const LOOK_STAMP = `cd ~/frame/_clio && D=~/.local/state/x/linear/bodies/1e70bf35-bc95-404c-957d-ec4bdf5250e5; for t in FRM-574 FRM-573; do x linear body $t >/dev/null; node script/ticket-sign.ts $t changed "👀 look sent 2026-11-11, printed in his herdr thread (herdr has no SendUserFile door); no re-sign: tiny" >/dev/null; x linear body $t --set $D/$t.md | jq -c '.ok'; done; cd ~/frame && x lane landed FRM-574 2>&1 | jq -r '.plan.lines[]? // .data.lines[]?' | grep "🔴" | cut -c1-120`;
const LOOK_PRINTF = `cd ~/frame && for t in FRM-549 FRM-553; do x linear body $t >/dev/null; B=~/.local/state/x/linear/bodies/$t.md; printf '\\n👀 look sent 2026-11-10\\n' >> $B; x linear body $t --set $B >/dev/null; echo "$t body $?"; done`;
for (const [why, line, ids] of [
    ['a ticket-sign.ts «changed» stamp', LOOK_STAMP, ['FRM-574', 'FRM-573']],
    ['a printf of the look line', LOOK_PRINTF, ['FRM-549', 'FRM-553']],
] as const)
    test(`g1: a look-sent write on a signed ticket runs with no tick, judged as it runs: ${why}`, async ($, on) => {
        const { ran } = world(on, [], SIGNED_TODAY(), SIGNED_TODAY());
        const r = await bash($, line);
        expect([r.deny, ran]).toEqual([undefined, [checked(line, ...ids)]]);
    });
