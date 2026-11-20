/* @jsx h */
import type { Register } from 'claude-code';

import type { QuietLogLine } from '../types/stash.d.ts';
import { renderBand } from './band.tsx';
import { drawBoard } from './board.tsx';
import { closeBoot, openBoot } from './boot.ts';
import { flushFields, leaveBoxes, returnToBoxes } from './fields.ts';
import {
    WIND_DELAY_MS,
    armRelease,
    holdAfterQuiet,
    holdSteer,
    isQuietHome,
    quietLocked,
    steersOnCompact,
} from './held.ts';
import { joinsLocked, settleJoins } from './joins.ts';
import {
    armHot,
    capAtMeasure,
    capAtTurnEnd,
    holdHot,
    seatDefaults,
    warm,
} from './keep-warm.ts';
import { turnEnded } from './orbit.ts';
import {
    EMPTY_ORBIT,
    currentOrbit,
    inMarking,
    saveOrbit,
} from './orbit-store.ts';
import { LANE_OWNER } from './orbit-tool.ts';
import {
    boldFleetWords,
    bulletDots,
    dropWaitAside,
    linkTickets,
    numberCircled,
    parseWait,
} from './parse.ts';
import { composePrompt } from './prompt-notes.ts';
import { peerPing, quietHeldText } from './quiet.ts';
import { quietLog } from './quiet-books.ts';
import { quietKindsOff, quietOf, quietWhy, saveQuiet } from './quiet-gate.ts';
import { settleTask, stopRed, waitsOf } from './reply-fix.ts';
import { memberOf, openBoard, registry } from './roster.ts';
import { endSession, forget } from './session-end.ts';
import { currentId, refreshThreads, sessionName } from './session-identity.ts';
import { keepShelf, noteModel } from './session-record.ts';
import { startSession } from './session-start.ts';
import { drawSettingsPane } from './settings-pane.tsx';
import {
    QUIET_ON,
    SHOWN,
    flipKnob,
    readSwitch,
    setSettingsOpen,
    shownOf,
} from './settings-store.ts';
import { onToolCall } from './step-notes.ts';
import { HOT, REPLY, type Reply, hotOf } from './store-keys.ts';
import {
    clearWrap,
    endBusy,
    endStop,
    endUserTurn,
    isTurnBusy,
    markActive,
    turn,
} from './turn.ts';
import { forgetTold } from './turn-notes.ts';
import {
    countWords,
    drawFill,
    drawFillAfterCompact,
    measureUsage,
} from './usage.ts';
import { errorText } from './util.ts';
import { load, publish, viewDoors } from './view.ts';
import { COMPACTING, windOf } from './wind.ts';
import {
    COMPACT_SETTLE_MS,
    FILL,
    windAfterTurn,
    windOnCompact,
} from './wind-run.ts';

// x-mod-stash: dima's command center above the prompt, one row; FTR.md lists every feature.
// orbit: the session's asks to dima and its plan, written through its own tool, ticked in the board; its open asks are
// mirrored into $.store (one key per session), so the board counts every session's.
// afk: one switch every session polls; while it is on, every prompt carries an away note, and a flip reaches a running turn.
// keep-hot: while on and idle, one ping 50 min after the last turn ended keeps the prompt cache warm; the switch lives in $.store, so a reload keeps it

// the fleet board: cc's registry gives each session's state; each session's stash adds its 🔭 wait and context fill
const BOARD = 'x-cc-deck';
// 🎛️ is a pane of its own, which the surface tabs beside 🚦: the band is capped by cc, the list outgrew it (dima's pick a of
// four homes, 16:20); a tab row inside a pane was proven too, kept as an idea in api-map.md
const SETTINGS_PANE = 'stash-settings';
// a reload keeps `$.state` and resets the module: what must outlive a mod save lives there (FRM-320)
// what the band and the board draw: renders read it, and a write redraws them, no invalidate
const VIEW = { key: 'view', plugin: 'x-mod-stash' } as const;
// a 📄 line's HH:MM — the same shape reply-check.py reads
const STAMP = /(📄[^\n]*?\b)(\d{1,2}:\d{2})\b/g;
// mobile mode: mods draw nothing on the phone, so the session prints the open asks as the asks fence instead
const MOBILE = { key: 'mobile', plugin: 'x-mod-stash' } as const;
const MOBILE_SKILL = /(^|:)mobile-mode$/;
const MOBILE_OFF = /ARGUMENTS:\s*off\b/i;

export const register: Register = (on) => {
    // session.start fires at startup and again on every hot reload; the classic event only at startup
    on('session.start', async ($, e, next) => {
        await startSession($, e.cwd, viewDoors($));
        return next(e);
    });

    // `/mobile-mode` turns the asks fence on, `/mobile-mode off` turns it off
    on('skill.prompt', async ($, e, next) => {
        await openBoot($, e.skill);
        if (MOBILE_SKILL.test(e.skill))
            await $.state
                .set(MOBILE, !MOBILE_OFF.test(e.text))
                .catch(() => undefined);
        return next(e);
    });

    // only dima's own hands make his turn; a reply to any other origin may drop the block
    // a press reads what was typed: a steer still waiting for its pause saves first
    on('ui.press', async ($, e, next) => {
        await markActive($).catch(() => undefined);
        await flushFields($, viewDoors($));
        return next(e);
    });

    on('prompt.submit', ($, e, next) =>
        composePrompt($, e, next, viewDoors($)),
    );

    // a long turn outruns the prompt's clock: the stored reply's 📄 stamp is the time it was written
    on('session.append', { door: 'response' }, async ($, e, next) => {
        const now = new Date(await $.clock.now()).toTimeString().slice(0, 5);
        // the 🎛️ switches gate the stored rewrite, not only its look (the part list's 📌)
        const switches = shownOf(
            await $.store.get(SHOWN).catch(() => undefined),
        );
        const isOn = {
            bold: switches['stash.boldwords'] !== false,
            bullets: switches['stash.bullets'] !== false,
        };
        let isChanged = false;
        const hits: Record<string, number> = {};
        const content = e.message.content.map((b) => {
            if (b.type !== 'text' || typeof b.text !== 'string') return b;
            // the stored row is what the Stop hooks read: a ·-list fixed here never trips reply-check
            const dotted = isOn.bullets ? bulletDots(b.text) : b.text;
            const fixed = isOn.bold
                ? boldFleetWords(dotted)
                : { hits: {}, text: dotted };
            for (const [word, n] of Object.entries(fixed.hits))
                hits[word] = (hits[word] ?? 0) + n;
            const bulleted = fixed.text;
            if (bulleted !== b.text) isChanged = true;
            const text = bulleted.replace(
                STAMP,
                (whole: string, head: string, at: string) => {
                    if (at === now) return whole;
                    isChanged = true;
                    return `${head}${now}`;
                },
            );
            return { ...b, text };
        });
        if (Object.keys(hits).length)
            await countWords($, hits).catch((err) =>
                $.ui.log(
                    `x-mod-stash: the fleet-word count was not kept: ${errorText(err)}`,
                ),
            );
        if (!isChanged) return next(e);
        return next({ ...e, message: { ...e.message, content } });
    });

    // the drawing: the reply's ·-list shows as bullets while it streams, before the stored row exists
    on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
        // a fix that throws draws the reply as written, never a blank
        let text: string;
        try {
            const switches = (await $.state.get(VIEW)).value?.shown ?? {};
            const dotted =
                switches['stash.bullets'] !== false
                    ? bulletDots(e.props.text)
                    : e.props.text;
            // each fix is mechanical and behind its own switch; reply-check no longer logs what these redraw (todo 29)
            const fixes: [string, (t: string) => string][] = [
                ['stash.circled', numberCircled],
                ['stash.tickets', linkTickets],
                ['stash.waitaside', dropWaitAside],
            ];
            const fixed = fixes.reduce(
                (t, [key, fix]) => (switches[key] !== false ? fix(t) : t),
                dotted,
            );
            text = (
                switches['stash.boldwords'] !== false
                    ? boldFleetWords(fixed)
                    : { text: fixed }
            ).text;
        } catch {
            return next(e);
        }
        if (text === e.props.text) return next(e);
        return next({ ...e, props: { ...e.props, text } });
    });

    on('classic.Stop', async ($, e, next) => {
        const r = await next(e);
        await closeBoot($, e.session_id, e.last_assistant_message ?? '');
        const red = e.stop_hook_active
            ? undefined
            : await stopRed($, e.last_assistant_message ?? '');
        clearWrap();
        // a keep-hot ping's one-character reply never clears what the session waits on; it only stamps the warm cache
        const was = turn.pinged
            ? ((await $.store
                  .get(REPLY + e.session_id)
                  .catch(() => undefined)) as Reply | undefined)
            : undefined;
        const reply: Reply | undefined = turn.pinged
            ? was && { ...was, pingedAt: await $.clock.now() }
            : {
                  at: await $.clock.now(),
                  name: await sessionName($),
                  ...waitsOf(
                      parseWait(e.last_assistant_message ?? ''),
                      e.background_tasks,
                  ),
              };
        if (reply)
            await $.store
                .set(REPLY + e.session_id, reply)
                .catch(() => undefined);
        await endUserTurn($);
        await load($);
        return red ? { ...r, block: red } : r;
    });

    on('turn.complete', async ($, e, next) => {
        await markActive($).catch(() => undefined);
        const r = await next(e);
        // a subagent's turn ending is not the session going idle
        if (e.agentId) return r;
        endBusy();
        await joinsLocked(() =>
            settleJoins($, !e.isAborted && e.reason !== 'error'),
        ).catch(() => undefined);
        await refreshThreads($);
        await inMarking(async () =>
            saveOrbit($, turnEnded(await currentOrbit($)), () => keepShelf($)),
        );
        await windAfterTurn($, viewDoors($)).catch(() => undefined);
        armRelease($, viewDoors($), WIND_DELAY_MS);
        const endedAt = await $.clock.now();
        await endStop($, endedAt);
        await seatDefaults($, viewDoors($)).catch(() => undefined);
        await capAtTurnEnd($, e.reason === 'error', e.answer, viewDoors($));
        // the store is 🔥's truth: crow writes its key after session.start, and a written off turns it off
        const sid = await currentId($);
        if (sid)
            holdHot(hotOf(await $.store.get(HOT + sid).catch(() => warm.hot)));
        // it counts from this turn's end, kept in $.state; it never writes the key back, which once undid a 🌌 sessions
        // chip's delete landing between this read and the write (FRM-499)
        if (warm.hot)
            holdHot({
                ...warm.hot,
                since: turn.endedAt ?? (await $.clock.now()),
            });
        await armHot($, viewDoors($));
        await load($);
        return r;
    });

    on('session.compact', async ($, e, next) => {
        const isOwn = !e.agentId && e.trigger !== 'precompute';
        const compacting = isOwn
            ? await currentId($).catch(() => undefined)
            : undefined;
        if (compacting)
            await $.store
                .set(COMPACTING + compacting, await $.clock.now())
                .catch(() => undefined);
        const r = await next(e).finally(() =>
            compacting
                ? $.store.delete(COMPACTING + compacting).catch(() => undefined)
                : undefined,
        );
        // cc sends the whole skill list again after a compact (2.1.304), so none is reloaded here; a compact another hook
        // skipped changed nothing
        if (!e.agentId && e.trigger !== 'precompute' && !('skip' in r)) {
            // a wind's own compact: its ingest is queued behind it, and runWind hands the held messages over after it
            const wind = compacting ? await windOf($, compacting) : undefined;
            const isWinds = wind?.state === 'refreshing' && !wind.slug;
            forgetTold();
            await windOnCompact($).catch(() => undefined);
            await steersOnCompact($).catch(() => undefined);
            if (!isWinds) armRelease($, viewDoors($), COMPACT_SETTLE_MS);
            // the next measure comes only at this turn's end, and a wind's ingest is one long turn: until then the
            // fill from before the compact would stand on the band and every board
            await drawFill($, undefined).catch(() => undefined);
            const compacted = await currentId($);
            if (compacted)
                await $.store.delete(FILL + compacted).catch(() => undefined);
            $.clock.after(COMPACT_SETTLE_MS, () =>
                drawFillAfterCompact($).catch(() => undefined),
            );
            await keepShelf($);
            await load($);
        }
        return r;
    });

    // the context fill the board shows, and the 5h reset the waker waits on
    on('session.measure', async ($, e, next) => {
        const w = e.rateLimits.find((r) => r.kind === 'five_hour');
        const resetsAt = w?.resetsAt ? Date.parse(w.resetsAt) : undefined;
        await capAtMeasure($, w?.percentUsed, resetsAt, viewDoors($));
        await measureUsage($, e);
        return next(e);
    });

    // the board shows each session's model and effort as its main loop's last request named them; a subagent's step never counts
    on('turn.step', async function* ($, e, next) {
        if (!e.agentId) await noteModel($, e.model, e.effort);
        return yield* next(e);
    });

    // `/board colour` flips the colour MVP for every session's board, and opens it to look
    // quiet comms: in clio's thread a message that does not push is held; every delivery is logged
    on('session.receive', async ($, e, next) => {
        await markActive($).catch(() => undefined);
        const kind = e.origin.kind;
        if (kind === 'task-notification' && !e.agentId) {
            await settleTask($, e.text, viewDoors($)).catch(() => undefined);
            return next(e);
        }
        if ((kind !== 'peer' && kind !== 'peer-send-message') || e.agentId)
            return next(e);
        const steer = await holdSteer($, e.text, viewDoors($)).catch((err) => {
            $.ui.log(`x-mod-stash: a steer passed unheld: ${errorText(err)}`);
            return undefined;
        });
        if (steer && 'consumed' in steer) return steer;
        if (steer) return next({ ...e, text: steer.text });
        if (!(await isQuietHome($).catch(() => false))) return next(e);
        const { body, deliveryTest, from, tag } = peerPing(e.text);
        const marks = deliveryTest ? { deliveryTest } : {};
        let arm: QuietLogLine['arm'] = 'on';
        // fail open: a throw anywhere below passes the delivery unjudged and logs it, so a broken hold never loses a ping
        try {
            const verdict = await quietLocked(async () => {
                const now = await $.clock.now();
                const isOn = await readSwitch($, 'quiet');
                arm = isOn ? 'on' : 'off';
                const isMobile = (await $.state.get(MOBILE)).value === true;
                const isBusyNow = await isTurnBusy($);
                const sid = memberOf(await registry($), from)?.base.sid;
                const why = await quietWhy($, from, body);
                const line = {
                    arm,
                    at: now,
                    from,
                    tag,
                    ...(sid ? { sid } : {}),
                    ...marks,
                } as const;
                if (isOn && !isMobile && !why) {
                    const q = await quietOf($);
                    // consumed only once both the held list and its log line landed: a ping no store holds is a lost one
                    const isSaved = await saveQuiet($, {
                        ...q,
                        held: [
                            ...q.held,
                            {
                                at: now,
                                from,
                                tag,
                                text: quietHeldText(body),
                                ...marks,
                            },
                        ],
                    });
                    if (!isSaved) throw new Error('the held list did not save');
                    const isLogged = await quietLog($, {
                        ...line,
                        startedTurn: false,
                        verdict: 'held',
                    });
                    if (!isLogged) {
                        await saveQuiet($, q);
                        throw new Error('the held line did not log');
                    }
                    return {
                        consumed: `quiet comms held ${from}'s message`,
                    };
                }
                await quietLog($, {
                    ...line,
                    startedTurn: !isBusyNow,
                    verdict: 'passed',
                    ...(why ? { why } : {}),
                });
                return undefined;
            });
            if (verdict) return verdict;
        } catch (err) {
            const at = await $.clock.now().catch(() => Date.now());
            await quietLocked(() =>
                quietLog($, {
                    arm,
                    at,
                    from,
                    startedTurn: false,
                    tag,
                    verdict: 'failed-open',
                    ...marks,
                }),
            );
            $.ui.log(
                `x-mod-stash: quiet comms failed open on ${from}'s ping: ${errorText(err)}`,
            );
        }
        const compact = await holdAfterQuiet($, e.text, viewDoors($)).catch(
            (err) => {
                $.ui.log(
                    `x-mod-stash: a steer passed unheld: ${errorText(err)}`,
                );
                return undefined;
            },
        );
        return compact ?? next(e);
    });

    // the delivery test: a model-free test [progress] ping to clio through the real peer path; its run reads the log by nonce
    on('command.run', { command: 'quiet-delivery-test' }, async ($, e) => {
        const nonce = e.args.trim() || `c${(await $.clock.now()).toString(36)}`;
        const r = await $.session
            .send({
                text: `[progress] quiet delivery test ${nonce}: a test ping from /quiet-delivery-test, nothing to do`,
                to: LANE_OWNER,
            })
            .catch((err) => ({
                isDelivered: false as const,
                reason: errorText(err),
            }));
        return {
            text: r.isDelivered
                ? `quiet delivery test ${nonce}: sent`
                : `quiet delivery test ${nonce}: FAIL, ${r.reason}`,
        };
    });

    on('command.run', { command: 'quiet' }, async ($, e) => {
        const arg = e.args.trim();
        if (arg === 'on' || arg === 'off') {
            await $.store.set(QUIET_ON, arg === 'on');
            $.ui.invalidate('ui.render');
            return {
                text: `quiet comms ${arg}: ${arg === 'on' ? "members' messages wait for your next turn unless they push" : 'every member ping passes'}`,
            };
        }
        const isOn = await readSwitch($, 'quiet');
        const kindsOff = isOn
            ? (await quietKindsOff($)).map((k) => `[${k}]`)
            : [];
        return {
            text: `quiet comms ${isOn ? 'on' : 'off'}, ${(await quietOf($)).held.length} held${kindsOff.length ? `; ${kindsOff.join(', ')} switched off, held like an untagged line` : ''}; /quiet on | off${arg ? ` («${arg}» is neither)` : ''}`,
        };
    });

    on('command.run', { command: 'board' }, async ($, e) => {
        if (e.args.trim() === 'breathe') {
            const isOn = await flipKnob($, 'always', () => publish($));
            return {
                text: `bars breathe ${isOn ? 'all the time' : 'only while a turn runs'}`,
            };
        }
        const isColourFlip = /^colou?r$/.test(e.args.trim());
        const isColour = isColourFlip
            ? await flipKnob($, 'colour', () => publish($))
            : undefined;
        await openBoard($);
        await publish($);
        if (isColour === undefined) return { text: 'fleet board opened' };
        return { text: `fleet board colour ${isColour ? 'on' : 'off'}` };
    });

    // the row's 🚦 shows whether the board is open
    on('ui.close', async ($, e, next) => {
        const r = await next(e);
        if (e.id === BOARD) await publish($);
        if (e.id === SETTINGS_PANE) {
            setSettingsOpen(false);
            await publish($);
        }
        return r;
    });

    // a thread switch reaches a mod only as this client leaving and coming back (the desktop log, FRM-531); a phone's
    // comings and goings leave the desktop's view alone
    on('session.detach', async ($, e, next) => {
        if (e.surface === 'desktop' && e.reason === 'detach')
            await leaveBoxes($, viewDoors($)).catch((err) =>
                $.ui.log(
                    `x-mod-stash: steer boxes not left: ${errorText(err)}`,
                ),
            );
        return next(e);
    });
    on('session.attach', async ($, e, next) => {
        await markActive($).catch(() => undefined);
        if (e.surface === 'desktop')
            await returnToBoxes($, viewDoors($)).catch((err) =>
                $.ui.log(
                    `x-mod-stash: steer boxes not taken back: ${errorText(err)}`,
                ),
            );
        return next(e);
    });

    // 🎛️: the switch list, then the auto-compact point, in a pane of its own (dima's pick a, 16:20)
    on('ui.render', { component: 'Pane', requestId: SETTINGS_PANE }, ($, e) =>
        drawSettingsPane($, e),
    );

    on('ui.render', { component: 'Pane', requestId: BOARD }, ($, e) =>
        drawBoard($, e),
    );

    on('session.end', async ($, e, next) => {
        await endSession(
            $,
            e.sessionId,
            e.reason === 'clear' || e.reason === 'resume',
        );
        return next(e);
    });

    // `/clear` and `/resume` leave the conversation: its asks and holds go now, not at the next poll
    on('command.run', async ($, e, next) => {
        await markActive($).catch(() => undefined);
        if (e.command !== 'clear' && e.command !== 'resume') return next(e);
        const left = await currentId($);
        const r = await next(e);
        if (left) await forget($, left).catch(() => undefined);
        await saveOrbit($, EMPTY_ORBIT, () => keepShelf($));
        await load($);
        await seatDefaults($, viewDoors($)).catch(() => undefined);
        return r;
    });

    // orbit's write door, where the session adds, resolves and follows up its asks and sets its plan; and afk flipped
    // mid-turn: the next tool result carries the new state once
    on('tool.call', ($, e, next) => onToolCall($, e, next, viewDoors($)));

    // the band: one row — the meters' readings, the 🔭 mark, the switches — then the bars
    // and a refused threshold's one line
    on('ui.render', { component: 'AbovePrompt' }, ($, e, next) =>
        renderBand($, e, next),
    );
};
