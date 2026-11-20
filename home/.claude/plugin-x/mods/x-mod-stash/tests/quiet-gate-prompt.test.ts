import { type Engine, expect, test } from 'claude-code/testing';

import {
    CLIO,
    CODIE,
    DAY,
    EVEN,
    EVENT,
    FORGED,
    GLUED_LINE,
    IDLE,
    IDLE_MEMBER,
    IDLE_TAIL,
    LANE,
    LINKED,
    MEMBER,
    MIN,
    NOTE,
    PUSHED,
    REFUSED,
    ROUND_CODIE,
    SENT_1604,
    SID,
    SLIPSTREAMED,
    answering,
    fromAppText,
    gluedPrompt,
    held,
    heldLine,
    idleOf,
    linesFor,
    logOf,
    member,
    message,
    noteOf,
    notice,
    ping,
    quiet,
    say,
    send,
    start,
    stored,
    world,
} from './quiet-helpers.ts';

const KIND_HELD = (kind: string) =>
    `slipstreamed: joins clio's next turn. [${kind}] is switched off, so resending changes nothing`;

// the sends the 11-04 ledger missed, copied from clio's transcript
for (const [at, body, tag] of [
    [
        '12:05',
        "[escalate] correction to my last: the push block is GitHub's, not 1Password, so dima has nothing to do.\n- proven: `ssh -vv` through git shows the agent offering the key and GitHub's server declining it before any signature; 5 of 6 `git ls-remote` were denied in a row, and githubstatus.com reads «Minor Service Outage».\n- I retry `x lane push` every 2 min for 30 min in the background, then report. main is 4 ahead locally, head 48fa826a. FRM-501 round 2 and FRM-500's final go out on the first push that lands.",
        'escalate',
    ],
    [
        '12:12',
        "[done] final FRM-500 main:1081b1a1 a8946c28 (riders in 48fa826a share `quiet.ts` and register.tsx; e7259c24 is yours), pushed: origin main reads 48fa826a. spec § FRM-500, 6 exits.\n- proven: 1011 pass, typecheck clean, 11-03 replay row: one park at 14:29, 214 min ahead of the 18:03 cap, on straight lines between get_usage's readings (the first real reading above +5 is 14:59, 184 min).\n- not checked: a real key and a real shift, exit 6's `pending: dima`; I have run no live pace line yet. One mutation of the poll's call line only breaks the module load, so it has no red proof.\n- yours: `clio:shift` start step runs `pnpm mods:pace-watch on`, end `off`. The pnpm verb is new; the ticket names «pace watch», so I took it without seven names, say so if you want the round.\n- FRM-501 round 2 goes to sixth sense at the same head.",
        'done',
    ],
    [
        '15:57',
        "[done] FRM-500 verified clean, round 3, head 1f64e232; done comment posted, the close is yours. df0c6734 (dima's tooltips and settings layout) is past it, ungraded by his «no verifier». retro at `~/.local/state/x/lanes/mods-lane-4/2026-11-04-FRM-501-codie-retro.md`. parked until your «resume»; left: FRM-501, FRM-499, regressions, FRM-470, FRM-459. dima's board holds one ask from me, the stale 🌀.",
        'done',
    ],
    [
        '16:10',
        "[ask] for dima: make «a slow gate runs in the background» a fleet habit. a by-hand habit dies at compact and reaches no other member.\n- pain: at 16:03 dima watched my row sit 6 min on a small orbit call, queued in one message behind a foreground commit and push chain\n- measured at load 26: `mods:test` 92 s (red on a load timeout), `pnpm test` 15 s; the chain ran `mods:test` twice, the pre-push hook per try, 3 push tries\n- my pick: an `x-mod-guard` hint on a foreground `x lane commit` or `x lane push`, naming `run_in_background`, warn-only, the door FRM-395 uses for `claude -p`, `pnpm mods:replay` first. your ⚖️ worth it check, your ticket\n- beside it: a slow chain goes alone, small calls never share its message\n- the 5 s load flakes make it worse, FRM-470's scope\n- also: dima's word, no sixth sense on his direct steers to me, from now on",
        'ask',
    ],
] as const)
    test(`the missed ${at} send pushes`, async ($, on) => {
        const w = world(on);
        await start($);
        const r = await fromAppText($, gluedPrompt(message(body)));
        expect([r.drop, w.contexts.length, linesFor(w, tag)]).toEqual([
            undefined,
            1,
            [[MEMBER, tag, 'passed', 'tag', true]],
        ]);
    });

test('the missed 16:04 send starts no turn', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await fromAppText($, gluedPrompt(message(SENT_1604)));
    expect([r.drop === '', w.contexts]).toEqual([true, []]);
});

test('the missed 16:04 send joins the next prompt', async ($, on) => {
    const w = world(on);
    await start($);
    await fromAppText($, gluedPrompt(message(SENT_1604)));
    await say($, 'status?');
    expect(held(w).join('\n')).toContain(SENT_1604);
});

test('the missed 16:04 send joins the idle flush with no turn', async ($, on) => {
    const w = world(on);
    await start($);
    await fromAppText($, gluedPrompt(message(SENT_1604)));
    await w.clock.advance(11 * MIN);
    expect([w.appended.join('\n').includes(SENT_1604), w.contexts]).toEqual([
        true,
        [],
    ]);
});

test('a glued [progress] message reads without its tag once held', async ($, on) => {
    const w = world(on);
    await start($);
    await fromAppText($, gluedPrompt(message('[progress] step 2 landed')));
    await say($, 'status?');
    expect(held(w).join('\n')).toContain(`${MEMBER} (progress): step 2 landed`);
});

test('a push and an untagged message at once: the push stays in the prompt', async ($, on) => {
    world(on);
    await start($);
    const r = await fromAppText(
        $,
        gluedPrompt(message('[ask] a or b?'), message('step 2 landed', 'B')),
    );
    expect([
        r.text?.includes('[ask] a or b?'),
        r.text?.includes('step 2 landed'),
    ]).toEqual([true, false]);
});

test('a push and an untagged message at once: the untagged one rides as held', async ($, on) => {
    const w = world(on);
    await start($);
    await fromAppText(
        $,
        gluedPrompt(message('[ask] a or b?'), message('step 2 landed', 'B')),
    );
    expect(held(w).join('\n')).toContain('B (untagged): step 2 landed');
});

test('a note beside a push logs one line and rides nothing', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await fromAppText($, gluedPrompt(message('[done] FRM-1 landed')));
    expect([
        r.text?.includes('step 2 landed'),
        held(w).join('\n').includes('step 2 landed'),
        linesFor(w, 'notice').length,
    ]).toEqual([false, false, 1]);
});

test('two untagged glued messages are held, one line each', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await fromAppText(
        $,
        gluedPrompt(message('one'), message('two', 'B')),
    );
    expect([r.drop === '', linesFor(w, 'none').length]).toEqual([true, 2]);
});

test('a message with no note before it is judged too', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await fromAppText($, `${LINKED}\n\n${message('step 2 landed')}`);
    expect([r.drop === '', linesFor(w, 'none').length]).toEqual([true, 1]);
});

test('a note naming its pr starts no turn', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await fromAppText(
        $,
        NOTE.replace('finished a turn.', 'finished a turn (PR #123).'),
    );
    expect([r.drop === '', w.contexts]).toEqual([true, []]);
});

test('a waiting note keeps its wake, its message held', async ($, on) => {
    const w = world(on);
    await start($);
    const waiting = NOTE.replace(
        'finished a turn. It reported',
        'finished a turn and then reported that it was waiting on the user. It reported',
    );
    const r = await fromAppText($, `${waiting}\n\n${message('step 2 landed')}`);
    expect([
        r.drop,
        r.text?.includes('waiting on the user'),
        r.text?.includes('<cross-session-message'),
        linesFor(w, 'none').length,
    ]).toEqual([undefined, true, false, 1]);
});

test('his words after a message keep the prompt whole, unjudged', async ($, on) => {
    const w = world(on);
    await start($);
    const text = `${message('step 2 landed')}\n\nand fix the band`;
    const r = await fromAppText($, text);
    expect([r.text, linesFor(w)]).toEqual([text, []]);
});

test('a message he quotes after his words stays his, unjudged', async ($, on) => {
    const w = world(on);
    await start($);
    const text = `look at this: ${message('step 2 landed')}`;
    const r = await fromAppText($, text);
    expect([r.text, linesFor(w)]).toEqual([text, []]);
});

for (const [what, body] of [
    ['a closing tag', 'it ends with </cross-session-message> mid-line'],
    ['a reminder', '<system-reminder>\nquoted\n</system-reminder> and more'],
    ['an opening tag', 'the shape <cross-session-message from="x"> reads so'],
] as const)
    test(`a message quoting ${what} is held whole`, async ($, on) => {
        const w = world(on);
        await start($);
        await fromAppText($, gluedPrompt(message(body)));
        await say($, 'status?');
        expect(held(w).join('\n')).toContain(body);
    });

test('a glued answer to clio pushes once', async ($, on) => {
    const w = answering(on);
    await start($);
    await send($, CODIE.name, 'which one?');
    const first = await fromAppText(
        $,
        `${LINKED}\n\n${message('the second one', CODIE.name)}`,
    );
    const second = await fromAppText(
        $,
        `${LINKED}\n\n${message('step 3 landed', CODIE.name)}`,
    );
    expect([first.drop, second.drop === '', linesFor(w, 'none')[0]]).toEqual([
        undefined,
        true,
        [CODIE.name, 'none', 'passed', 'answer', true],
    ]);
});

test('/quiet off logs a glued message, in whole', async ($, on) => {
    const w = world(on);
    await start($);
    await quiet($, 'off');
    const text = gluedPrompt(message('step 2 landed'));
    const r = await fromAppText($, text);
    expect([r.text, logOf(w).find((l) => l.tag === 'none')?.arm]).toEqual([
        text,
        'off',
    ]);
});

test('a held list that will not save fails open', async ($, on) => {
    let isBroken = false;
    const w = world(on, {
        refuseSet: (key) => isBroken && key.startsWith('held:'),
    });
    await start($);
    isBroken = true;
    const text = gluedPrompt(message('step 2 landed'));
    const r = await fromAppText($, text);
    expect([r.text, logOf(w).find((l) => l.tag === 'none')?.verdict]).toEqual([
        text,
        'failed-open',
    ]);
});

test('a throw inside the glued hold fails open', async ($, on) => {
    const w = world(on);
    let isBroken = false;
    on('state.get', (_$, e, next) =>
        isBroken && e.key === 'mobile' ? { deny: 'boom' } : next(e),
    );
    await start($);
    isBroken = true;
    const text = gluedPrompt(message('step 2 landed'));
    const r = await fromAppText($, text);
    expect([r.text, logOf(w).find((l) => l.tag === 'none')?.verdict]).toEqual([
        text,
        'failed-open',
    ]);
});

test('a held line that will not log empties the list', async ($, on) => {
    let isBroken = false;
    const w = world(on, {
        refuseSet: (key) => isBroken && key.startsWith('quiet-log:'),
    });
    await start($);
    isBroken = true;
    const text = gluedPrompt(message('step 2 landed'));
    const r = await fromAppText($, text);
    expect([r.text, stored(w)]).toEqual([text, []]);
});

test('an answer beside its sender note takes the slot, the note logged', async ($, on) => {
    const w = answering(on);
    await start($);
    await send($, CODIE.name, 'which one?');
    await fromAppText(
        $,
        `${noteOf(CODIE.name, 'step 2 landed')}\n\n${message('the second one', CODIE.name)}`,
    );
    expect([
        linesFor(w, 'none')[0]?.[3],
        linesFor(w, 'notice')[0]?.[2],
    ]).toEqual(['answer', 'logged']);
});

for (const [what, text] of [
    ['after two messages', `${message('a')}\n\n${message('b')}\n\nhis words`],
    ['between two messages', `${message('a')}\n\nhis words\n\n${message('b')}`],
    ['after a note and a message', `${NOTE}\n\n${message('a')}\n\nhis words`],
    ['after a note', `${NOTE}\n\nhis words`],
] as const)
    test(`his words ${what} keep the prompt whole, unjudged`, async ($, on) => {
        const w = world(on);
        await start($);
        const r = await fromAppText($, text);
        expect([r.text, linesFor(w)]).toEqual([text, []]);
    });

test('a refused log leaves no held line and lets the prompt in', async ($, on) => {
    let isBroken = false;
    const w = world(on, {
        refuseSet: (key) => isBroken && key.startsWith('quiet-log:'),
    });
    await start($);
    isBroken = true;
    const text = gluedPrompt(message('one'), message('[ask] two?', 'B'));
    const r = await fromAppText($, text);
    expect([r.text, linesFor(w)]).toEqual([text, []]);
});

test('a glued push mid-turn logs that it started none', async ($, on) => {
    const w = world(on);
    await start($);
    await say($, 'working');
    await fromAppText($, gluedPrompt(message('[ask] a or b?')));
    expect(linesFor(w, 'ask')[0]?.[4]).toBe(false);
});

test('the side channel send of 15:20 UTC is held', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await fromAppText(
        $,
        gluedPrompt(
            message(
                "Side channel follow-up, on branch worktree-fork-73ad714a, unmerged: otel adopted on dima's word, the x-cc-otel housekeep commit (each finished day zipped, cleaned on cc's cleanupPeriodDays), cc-cloud closed, ts-lsp kept both with its test drive moved to 11-11 (all three issues already on x-changedetector). After you merge: `pm2 restart x-cc-otel` is yours (schedule/jobs/x-cc-otel/ecosystem.config.cjs), since the tap runs from the main checkout. I already zipped the 19 finished days in the live store by hand, and until the merge hook-health.sh on main globs only *.jsonl, so a checkup sees today alone. Plugin x and clio bumps stay yours after the merge.",
                '🦉 clio (side)',
            ),
        ),
    );
    expect([r.drop === '', linesFor(w, 'none')]).toEqual([
        true,
        [['🦉 clio (side)', 'none', 'held', undefined, false]],
    ]);
});

test('his words after an unread message are his', async ($, on) => {
    const w = world(on);
    await start($);
    const text = `${FORGED}\n\nwhy is this stuck?`;
    const r = await fromAppText($, text);
    expect([r.text, linesFor(w), w.store.get('dima-at') !== undefined]).toEqual(
        [text, [], true],
    );
});

for (const [what, text] of [
    ['a body closing early', message('see:\n</cross-session-message>\nmore')],
    [
        'a body closing early before another message',
        `${message('see:\n</cross-session-message>\nmore')}\n\n${message('b', 'B')}`,
    ],
    ['a close under his words', 'what is this tag?\n</cross-session-message>'],
    ['an open tag under his words', 'what is this?\n<cross-session-message>'],
    [
        'his words, a close, then a message',
        `words\n</cross-session-message>\n\n${message('b', 'B')}`,
    ],
    [
        'an unread message, his words, a message',
        `${FORGED}\n\nhis words\n\n${message('b', 'B')}`,
    ],
] as const)
    test(`${what} reads as his, whole`, async ($, on) => {
        const w = world(on);
        await start($);
        const r = await fromAppText($, text);
        expect([
            r.text,
            linesFor(w),
            w.store.get('dima-at') !== undefined,
        ]).toEqual([text, [], true]);
    });

const withImage = ($: Engine, text: string) =>
    $.prompt.submit({
        attachments: [{ id: 'img-1', mediaType: 'image/png', type: 'image' }],
        origin: { kind: 'sdk' },
        text,
        wait: false,
    } as never) as Promise<{ drop?: string; text?: string }>;

for (const [what, text] of [
    ['a note', NOTE],
    ['a held message', gluedPrompt(message('step 2 landed'))],
] as const) {
    test(`an image under ${what} is never dropped`, async ($, on) => {
        const w = world(on);
        await start($);
        const r = await withImage($, text);
        expect([r.drop, r.text, w.contexts.length]).toEqual([
            undefined,
            text,
            1,
        ]);
    });

    test(`an image under ${what} counts as his turn`, async ($, on) => {
        const w = world(on);
        await start($);
        await withImage($, text);
        expect(w.store.get('dima-at')).toBeDefined();
    });
}

test('a lone pasted message is held, its text riding the next prompt', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await fromAppText($, message('pasted by hand'));
    await say($, 'status?');
    expect([
        r.drop === '',
        held(w).join('\n').includes('pasted by hand'),
    ]).toEqual([true, true]);
});

for (const [kind, key] of [
    ['ask', 'quiet-ask'],
    ['done', 'quiet-done'],
    ['escalate', 'quiet-escalate'],
] as const) {
    test(`[${kind}] switched off holds, no turn`, async ($, on) => {
        const w = world(on);
        await start($);
        w.store.set(key, false);
        const r = await ping($, `[${kind}] the line`);
        expect([r.consumed !== undefined, w.queued]).toEqual([true, []]);
    });

    test(`[${kind}] switched off logs one held line under its tag`, async ($, on) => {
        const w = world(on);
        await start($);
        w.store.set(key, false);
        await ping($, `[${kind}] the line`, MEMBER);
        expect(linesFor(w)).toEqual([[MEMBER, kind, 'held', undefined, false]]);
    });

    test(`[${kind}] switched off reaches the next prompt, its tag kept`, async ($, on) => {
        const w = world(on);
        await start($);
        w.store.set(key, false);
        await ping($, `[${kind}] the line`);
        await say($, 'status?');
        expect(held(w).join('\n')).toContain(`[${kind}] the line`);
    });
}

test('one kind off leaves the others pushing', async ($, on) => {
    const w = world(on);
    await start($);
    w.store.set('quiet-ask', false);
    const r = await ping($, '[done] FRM-1 landed');
    expect([r.consumed, w.queued.length]).toEqual([undefined, 1]);
});

test('«for dima» still pushes with its kind off', async ($, on) => {
    const w = world(on);
    await start($);
    w.store.set('quiet-ask', false);
    await ping($, '[ask] for dima: a or b?');
    expect(linesFor(w, 'ask')[0]?.[3]).toBe('for-dima');
});

test('an answer still pushes with its kind off', async ($, on) => {
    const w = answering(on);
    await start($);
    await send($, CODIE.name, 'which one?');
    w.store.set('quiet-ask', false);
    await ping($, '[ask] the second one?', CODIE.name);
    expect(linesFor(w, 'ask')[0]?.[3]).toBe('answer');
});

test('a glued kind switched off starts no turn', async ($, on) => {
    const w = world(on);
    await start($);
    w.store.set('quiet-done', false);
    const r = await fromAppText($, gluedPrompt(message('[done] FRM-1 landed')));
    expect([r.drop === '', linesFor(w, 'done')[0]?.[2]]).toEqual([
        true,
        'held',
    ]);
});

test('a flip back binds the next send, and a held line stays held', async ($, on) => {
    const w = world(on);
    await start($);
    w.store.set('quiet-ask', false);
    await ping($, '[ask] held one');
    w.store.set('quiet-ask', true);
    const r = await ping($, '[ask] pushed one');
    expect([
        r.consumed,
        w.queued.length,
        linesFor(w, 'ask').map((l) => l[2]),
    ]).toEqual([undefined, 1, ['held', 'passed']]);
    expect(stored(w)).toHaveLength(1);
});

test('bare /quiet names each kind that is off', async ($, on) => {
    const w = world(on);
    await start($);
    w.store.set('quiet-ask', false);
    w.store.set('quiet-escalate', false);
    const r = (await quiet($, '')) as { text: string };
    expect(r.text).toContain('[ask], [escalate] switched off');
});

test('bare /quiet names none while all are on', async ($, on) => {
    world(on);
    await start($);
    const r = (await quiet($, '')) as { text: string };
    expect(r.text).not.toContain('switched off');
});

test('a sender of a held kind reads the held line', async ($, on) => {
    const w = member(on, REFUSED);
    await start($);
    w.store.set('quiet-ask', false);
    w.store.set(`quiet-log:${DAY}`, [heldLine(MEMBER, EVEN)]);
    const r = await send($, '🦉 clio', '[ask] a or b?');
    expect([r.result.message, r.context]).toEqual([
        "held, delivered at clio's next turn",
        [KIND_HELD('ask')],
    ]);
});

test('bare /quiet with the master off names no kind as held', async ($, on) => {
    const w = world(on);
    await start($);
    w.store.set('quiet-ask', false);
    w.store.set('quiet-comms', false);
    const r = (await quiet($, '')) as { text: string };
    expect(r.text).not.toContain('switched off');
});

/* lone app notes: the shapes that reached clio's transcript since 11-04 */

const PR_NOTE = NOTE.replace('finished a turn.', 'finished a turn (PR #123).');

for (const [what, text] of [
    ['a pr note, linked and the event', notice(PR_NOTE, LINKED, EVENT)],
    ['a pr note beside a plain note', notice(NOTE, PR_NOTE, LINKED, EVENT)],
    ['the event alone', EVENT],
    ['linked and the event', notice(LINKED, EVENT)],
] as const) {
    test(`${what} starts no turn`, async ($, on) => {
        const w = world(on);
        await start($);
        const r = await fromAppText($, text);
        expect([r.drop === '', w.contexts]).toEqual([true, []]);
    });

    test(`${what} logs only as a notice`, async ($, on) => {
        const w = world(on);
        await start($);
        await fromAppText($, text);
        expect(logOf(w).every((l) => l.tag === 'notice')).toBe(true);
    });
}

test('the event alone logs one line under the app and joins no prompt', async ($, on) => {
    const w = world(on);
    await start($);
    await fromAppText($, EVENT);
    await say($, 'status?');
    expect([held(w), logOf(w).map((l) => [l.from, l.verdict])]).toEqual([
        [],
        [['the app', 'logged']],
    ]);
});

/* lone shapes: logged only, at his keyboard, under afk and under a shift; the idle notice is the engine's own, meta and unstamped */

const IDLE_SHAPES = [
    ['an idle notice', IDLE],
    [
        'an idle notice with no report',
        idleOf(IDLE_MEMBER, 'is idle now — it finished a turn at 11:49'),
    ],
    ['a bare idle notice', idleOf(IDLE_MEMBER, 'is idle now')],
    ['two idle notices', `${IDLE}\n${idleOf('🎀 helga', 'is idle now')}`],
] as const;

const fromHarness = ($: Engine, text: string) =>
    $.prompt.submit({
        isMeta: true,
        origin: { kind: 'unclassified' },
        text,
        wait: false,
    } as never) as Promise<{ drop?: string; text?: string }>;

const AWAY = [
    ['afk on', 'afk', { on: true }],
    ['a shift running', `pace:${SID}`, { since: EVEN }],
] as const;

for (const [what, submit] of [
    ['the finished-turn note', ($: Engine) => fromAppText($, NOTE)],
    ['the side-sessions notice', ($: Engine) => fromAppText($, EVENT)],
    ...IDLE_SHAPES.map(
        ([shape, text]) =>
            [shape, ($: Engine) => fromHarness($, text)] as const,
    ),
] as const) {
    test(`${what} logs only at his keyboard, no turn`, async ($, on) => {
        const w = world(on);
        await start($);
        const r = await submit($);
        expect([
            r.drop,
            w.contexts,
            [...new Set(logOf(w).map((l) => l.verdict))],
        ]).toEqual(['', [], ['logged']]);
    });

    for (const [state, key, value] of AWAY)
        test(`${what} with ${state} logs only, no turn past any wait`, async ($, on) => {
            const w = answering(on);
            await start($);
            w.store.set(key, value);
            const r = await submit($);
            const before = w.contexts.length;
            // past the old wake's own wait
            await w.clock.advance(12 * MIN);
            expect([
                r.drop,
                w.contexts.length - before,
                [...new Set(logOf(w).map((l) => l.verdict))],
                held(w),
            ]).toEqual(['', 0, ['logged'], []]);
        });
}

test('an untagged line alone while away reaches its hidden row, no turn', async ($, on) => {
    const w = answering(on);
    await start($);
    w.store.set('afk', { on: true });
    await fromAppText($, GLUED_LINE);
    const before = w.contexts.length;
    await w.clock.advance(11 * MIN);
    expect([
        w.contexts.length - before,
        logOf(w).filter((l) => l.verdict === 'flushed').length,
    ]).toEqual([0, 1]);
});

test('an idle notice logs under its member and joins no prompt', async ($, on) => {
    const w = world(on);
    await start($);
    await fromHarness($, IDLE);
    await say($, 'status?');
    expect([held(w), logOf(w).map((l) => [l.from, l.verdict])]).toEqual([
        [],
        [[IDLE_MEMBER, 'logged']],
    ]);
});

const EXIT = idleOf(
    IDLE_MEMBER,
    'has exited (at 11:49) before going idle; it will not process further messages at that address',
);

for (const [what, text] of [
    ['an exit notice', EXIT],
    [
        'an exit notice batched with an idle notice',
        `${IDLE}
${EXIT}`,
    ],
] as const)
    test(`${what} keeps its wake`, async ($, on) => {
        const w = world(on);
        await start($);
        const r = await fromHarness($, text);
        expect([r.drop, w.contexts.length, logOf(w)]).toEqual([
            undefined,
            1,
            [],
        ]);
    });

test('afk on still holds an untagged member message', async ($, on) => {
    const w = world(on);
    await start($);
    w.store.set('afk', { on: true });
    const r = await fromAppText(
        $,
        `<cross-session-message from="local_a" from-name="${IDLE_MEMBER}">\nstep 2\n</cross-session-message>`,
    );
    expect([r.drop, linesFor(w)]).toEqual([
        '',
        [[IDLE_MEMBER, 'none', 'held', undefined, false]],
    ]);
});

test('a meta prompt starting a turn stays whole when one notice of two pushes', async ($, on) => {
    const w = world(on);
    await start($);
    const pushes = idleOf(
        '🎀 helga',
        'is idle now — it finished a turn at 11:49. Its harness reports: «for dima: look»',
    );
    const text = `${IDLE}\n${pushes}`;
    const r = await fromHarness($, text);
    expect([r.drop, r.text, linesFor(w).map((l) => l[2])]).toEqual([
        undefined,
        text,
        ['passed', 'passed'],
    ]);
});

test('an sdk prompt of only an idle notice is his, whole', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await fromAppText($, IDLE);
    expect([r.drop, logOf(w)]).toEqual([undefined, []]);
});

for (const [what, text] of [
    ['typed words after it', `${IDLE}\nwhat now?`],
    ['typed words before it', `what now?\n${IDLE}`],
    ['typed words between two', `${IDLE}\nwhat now?\n${IDLE}`],
    ['another tail', IDLE.replace(IDLE_TAIL, 'act on it.')],
    ['a quote in its name', idleOf('a"b', 'is idle now')],
    ['another middle', idleOf(IDLE_MEMBER, 'went for a walk')],
    ['only a delivery receipt', 'Your message was delivered.'],
] as const)
    test(`a meta prompt with ${what} comes in whole, unjudged`, async ($, on) => {
        const w = world(on);
        await start($);
        const r = await fromHarness($, text);
        expect([r.drop, logOf(w)]).toEqual([undefined, []]);
    });

test('an idle notice from a composer comes in whole', async ($, on) => {
    const w = world(on);
    await start($);
    await say($, IDLE);
    expect(logOf(w)).toEqual([]);
});

test('an unstamped prompt that is not meta comes in whole', async ($, on) => {
    const w = world(on);
    await start($);
    const r = (await $.prompt.submit({
        origin: { kind: 'unclassified' },
        text: IDLE,
        wait: false,
    })) as { drop?: string };
    expect([r.drop, logOf(w)]).toEqual([undefined, []]);
});

test('the master switch off lets an idle notice in', async ($, on) => {
    const w = world(on);
    await start($);
    w.store.set('quiet-comms', false);
    expect((await fromHarness($, IDLE)).drop).toBeUndefined();
});

for (const [what, middle] of [
    ['a bare idle notice', 'is idle now'],
    [
        'an idle notice with no report',
        'is idle now — it finished a turn at 11:49',
    ],
] as const)
    test(`${what} keeps the member's answer slot`, async ($, on) => {
        const w = answering(on);
        await start($);
        await send($, CODIE.name, 'which one?');
        const first = await fromHarness($, idleOf(CODIE.name, middle));
        const second = await fromAppText(
            $,
            noteOf(CODIE.name, 'the second one'),
        );
        expect([first.drop, second.drop, w.contexts.length]).toEqual([
            '',
            undefined,
            1,
        ]);
    });

for (const origin of ['peer', 'sdk'] as const)
    test(`a meta idle notice holds whatever its origin: ${origin}`, async ($, on) => {
        const w = world(on);
        await start($);
        const r = (await $.prompt.submit({
            isMeta: true,
            origin: { kind: origin },
            text: IDLE,
            wait: false,
        } as never)) as { drop?: string };
        expect([r.drop, w.contexts]).toEqual(['', []]);
    });

for (const [what, startsOff, endsOff, line] of [
    [
        'a flip off mid-send reads held on a delivered send too',
        false,
        true,
        KIND_HELD('ask'),
    ],
    ['a flip on mid-send reads pushed', true, false, PUSHED],
] as const)
    test(what, async ($, on) => {
        const w = world(on, {
            name: MEMBER,
            peers: [CLIO],
            whileSending: async () => {
                w.store.set('quiet-ask', !endsOff);
            },
        });
        await start($);
        w.store.set('quiet-ask', !startsOff);
        const r = await send($, '🦉 clio', '[ask] a or b?');
        expect(r.context).toEqual([line]);
    });

test('a side-sessions notice beside a held message logs, the message held', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await fromAppText($, notice(GLUED_LINE, EVENT));
    expect([r.drop, linesFor(w).map((l) => [l[1], l[2]])]).toEqual([
        '',
        [
            ['none', 'held'],
            ['notice', 'logged'],
        ],
    ]);
});

test('a meta idle notice with an image comes in whole', async ($, on) => {
    const w = world(on);
    await start($);
    const r = (await $.prompt.submit({
        attachments: [{ type: 'image' }],
        isMeta: true,
        origin: { kind: 'unclassified' },
        text: IDLE,
        wait: false,
    } as never)) as { drop?: string };
    expect([r.drop, logOf(w)]).toEqual([undefined, []]);
});

test('a send the gate held reads held, its kind back on by the end', async ($, on) => {
    const w = world(on, {
        name: MEMBER,
        peers: [CLIO],
        sent: REFUSED,
        whileSending: async () => {
            w.store.set('quiet-ask', true);
        },
    });
    await start($);
    w.store.set('quiet-ask', false);
    w.store.set(`quiet-log:${DAY}`, [heldLine(MEMBER, EVEN)]);
    const r = await send($, '🦉 clio', '[ask] a or b?');
    expect(r.context).toEqual([SLIPSTREAMED]);
});

test('a side-sessions notice beside a pushing message leaves that turn', async ($, on) => {
    const w = world(on);
    await start($);
    const push = GLUED_LINE.replace('sw done', '[done] step 2');
    const r = await fromAppText($, notice(push, EVENT));
    expect([
        r.drop,
        r.text?.includes(EVENT),
        held(w).join('\n').includes('a side-sessions notice'),
    ]).toEqual([undefined, false, false]);
});

test('a member named the app beside a push is judged as a member', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await fromAppText(
        $,
        notice(
            GLUED_LINE.replace('sw done', '[done] step 2'),
            noteOf('the app', 'step 2 landed'),
        ),
    );
    expect([
        r.drop,
        held(w).join('\n').length > 0,
        r.text?.includes('step 2 landed'),
    ]).toEqual([undefined, false, false]);
});

test('a flip off mid-send reads held, never pushed', async ($, on) => {
    const w = world(on, {
        name: MEMBER,
        peers: [CLIO],
        sent: REFUSED,
        whileSending: async () => {
            w.store.set('quiet-ask', false);
        },
    });
    await start($);
    w.store.set(`quiet-log:${DAY}`, [heldLine(MEMBER, EVEN)]);
    const r = await send($, '🦉 clio', '[ask] a or b?');
    expect([r.result.message, r.context]).toEqual([
        "held, delivered at clio's next turn",
        [KIND_HELD('ask')],
    ]);
});

test('the event beside a note adds no held line of its own', async ($, on) => {
    const w = world(on);
    await start($);
    await fromAppText($, notice(NOTE, EVENT));
    await say($, 'status?');
    expect(held(w).join('\n')).not.toContain('None of the sessions');
});

test('a waiting note with the event keeps its wake', async ($, on) => {
    const w = world(on);
    await start($);
    const waiting = NOTE.replace(
        'finished a turn. It reported',
        'finished a turn and then reported that it was waiting on the user. It reported',
    );
    const r = await fromAppText($, notice(waiting, LINKED, EVENT));
    expect([r.drop, w.contexts.length]).toEqual([undefined, 1]);
});

/* the round count (FRM-504): codie's own «round N on <sha>», one shelf file, `<lane> | <ticket>` per chunk */

test("the coordinator's line passes quiet comms and starts her turn", async ($, on) => {
    const w = world(on);
    await start($);
    const r = await ping(
        $,
        `[escalate] round 4 of ${LANE}, past the cap of 3, from ${ROUND_CODIE}: ask dima «go on, or stop the lane»`,
        ROUND_CODIE,
    );
    expect([r.consumed, w.queued.length]).toEqual([undefined, 1]);
});
