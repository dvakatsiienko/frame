import {
    WORKING,
    codie,
    parked,
    parkedWorld,
    pass,
    sixth,
} from './parked-world.ts';
import { MIN, steps } from './quiet-helpers.ts';
import { expect, test } from './shared-boot.ts';

/* FRM-692:W4, the probe: the idle stretches of 23 Nov 2026 as `docs/knowledge/fleet-stories/lane-members-idle-and-waste-time/story.md` names
   them, minute by minute. four nobody was told of, each one wake now; four that were fine, each none */

const at = (h: number, m: number, s = 0) =>
    new Date(2026, 10, 23, h, m, s).getTime();
const speakCodie = codie({
    name: '🌗 🔧 speak | FRM-683',
    sid: 'speak001-codie',
});
const speakSixth = sixth({ name: '🌗 🔎 speak | #168', sid: 'speak001-sixth' });
const modsCodie = codie({
    name: '⚡ 🔧 mods | FRM-596',
    sid: 'mods0001-codie',
});
const modsSixth = sixth({
    name: '⚡ 🔎 mods | FRM-596',
    sid: 'mods0001-sixth',
});
const DONE = { current: 2, ...steps('BYT-168', 'BYT-168') };

test('15:39, the speak codie on a finished card: one wake inside 11 min', async ($, on) => {
    const w = parkedWorld(on, [{ ...speakCodie, at: at(15, 39) }], {
        card: { ...DONE, title: 'speak' },
        now: at(15, 39),
    });
    expect([
        await parked($, w, 9),
        (await pass($, w, 2, 30), w.wakes()),
    ]).toEqual([
        [],
        [
            expect.stringContaining(
                'finished, nothing queued for 🌗 🔧 speak | FRM-683',
            ),
        ],
    ]);
});

test('16:18, the mods card near its end, FRM-658 signed and not dispatched: one wake inside 11 min', async ($, on) => {
    const w = parkedWorld(
        on,
        [
            { ...modsCodie, at: at(16, 18) },
            { ...modsSixth, at: at(16, 17) },
        ],
        {
            card: steps('FRM-596', 'FRM-596', 'FRM-658'),
            now: at(16, 18),
            tickets: { 'FRM-658': { labels: ['agent', 'signed'] } },
        },
    );
    expect([await parked($, w, 9), (await pass($, w, 2), w.wakes())]).toEqual([
        [],
        [
            expect.stringContaining(
                '2 steps left in FRM-596; next chunk FRM-658 is signed, not dispatched',
            ),
        ],
    ]);
});

test('16:17, the mods sixth sense beside a working codie, pings at 17:07 and 17:57: one wake inside 31 min', async ($, on) => {
    const reply = `reply:${modsSixth.sid}`;
    const w = parkedWorld(
        on,
        [
            { ...modsCodie, ...WORKING },
            { ...modsSixth, at: at(16, 17) },
        ],
        {
            card: steps('FRM-658', 'FRM-658', 'FRM-658', 'FRM-658'),
            now: at(16, 17),
            store: { [reply]: { at: at(16, 17) } },
        },
    );
    const ping = (pingedAt: number) => {
        w.store.set(reply, { at: at(16, 17), pingedAt });
        w.wrote.set(modsSixth.sid, pingedAt + 2000);
    };
    const early = await parked($, w, 29);
    await pass($, w, 2, 19);
    ping(at(17, 7));
    await pass($, w, 50);
    ping(at(17, 57));
    await pass($, w, 4);
    expect([early, w.wakes()]).toEqual([
        [],
        [expect.stringContaining('⚡ 🔎 mods | FRM-596 idle 30 min')],
    ]);
});

test('18:32:33, the speak codie on a second wind that never fired: one wake inside 4 min', async ($, on) => {
    const ended = at(18, 32, 33);
    const w = parkedWorld(on, [{ ...speakCodie, at: ended, status: 'shell' }], {
        card: steps('FRM-683', 'FRM-683', 'FRM-683'),
        handoffs: ['speak-hunt-2'],
        now: ended,
        store: {
            [`reply:${speakCodie.sid}`]: {
                at: ended,
                tasks: [{ description: 'the pr', id: 'm', type: 'monitor' }],
                wait: 'waiting on the pr',
            },
            [`wind:${speakCodie.sid}`]: {
                at: ended,
                blocked: 'a watch («the pr»)',
                slug: 'speak-hunt-2',
                state: 'refused',
            },
        },
    });
    const early = await parked($, w, 2);
    await pass($, w, 2, 3);
    // 18:39:35, the mod reloaded in every session: a row in its transcript, no word of its own
    w.wrote.set(speakCodie.sid, at(18, 39, 35));
    await pass($, w, 2);
    expect([early, w.wakes()]).toEqual([
        [],
        [
            expect.stringContaining(
                'said second wind «speak-hunt-2» 3 min ago, it never fired: held by a watch («the pr»)',
            ),
        ],
    ]);
});

const HUNT = steps('FRM-683', 'FRM-683', 'FRM-683', 'FRM-683');
for (const [why, member, over] of [
    ['a member at work', { ...speakCodie, ...WORKING, ago: 12 }, {}],
    ['a member idle under the row', { ...speakCodie, ago: 2 }, {}],
    [
        'a member idle 12 min on a 🔭 line naming its sixth sense',
        { ...speakCodie, ago: 5 },
        {
            store: {
                [`reply:${speakCodie.sid}`]: {
                    at: at(18, 0) - 5 * MIN,
                    wait: 'waiting on 🔎 sixth sense',
                },
            },
        },
    ],
    [
        'an ended card',
        { ...speakCodie, ago: 12 },
        { card: { ...DONE, endedAt: at(17, 50) } },
    ],
] as const)
    test(`23 Nov, ${why}: no wake`, async ($, on) => {
        const w = parkedWorld(on, [member], {
            card: HUNT,
            now: at(18, 0),
            ...over,
        });
        expect(await parked($, w, 7)).toEqual([]);
    });

test('a finished card and a second member on a stuck wind: one wake naming both, then none', async ($, on) => {
    const w = parkedWorld(
        on,
        [
            { ...speakCodie, ago: 9 },
            { ...speakSixth, ago: 9 },
        ],
        {
            card: DONE,
            handoffs: ['speak-hunt-2'],
            now: at(18, 40),
            store: {
                [`wind:${speakSixth.sid}`]: {
                    at: at(18, 38),
                    blocked: 'a watch («the pr»)',
                    slug: 'speak-hunt-2',
                    state: 'refused',
                },
            },
        },
    );
    await parked($, w, 1, 1, 1);
    await pass($, w, 20);
    const all = w.wakes();
    expect([all.length, all.join(' ')]).toEqual([
        1,
        expect.stringMatching(
            /finished, nothing queued for 🌗 🔧 speak.*said second wind «speak-hunt-2»/,
        ),
    ]);
});
