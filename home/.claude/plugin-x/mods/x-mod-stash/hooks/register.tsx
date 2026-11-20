/* @jsx h */
import type { EngineInterface, Register } from 'claude-code';

import type { QuietLogLine } from '../types/stash.d.ts';
import { renderBand } from './band.tsx';
import { drawBoard } from './board.tsx';
import {
    flushFields,
    isTypedHere,
    leaveBoxes,
    returnToBoxes,
} from './fields.ts';
import {
    WIND_DELAY_MS,
    armRelease,
    holdAfterQuiet,
    holdSteer,
    isQuietHome,
    quietLocked,
    steersOnCompact,
} from './held.ts';
import { joinsLocked, settleJoins, takeJoins } from './joins.ts';
import {
    armHot,
    capAtMeasure,
    capAtTurnEnd,
    holdHot,
    paceStep,
    seatDefaults,
    warm,
} from './keep-warm.ts';
import { readLanes, takeLaneMoves } from './lanes.ts';
import {
    ORBIT_TOOL,
    isFresh,
    joinRowsText,
    joinText,
    oneLine,
    orbitOp,
    planText,
    turnEnded,
} from './orbit.ts';
import { takeMarks, takePlanMark } from './orbit-presses.ts';
import {
    EMPTY_ORBIT,
    absorbMarks,
    currentOrbit,
    inMarking,
    saveOrbit,
} from './orbit-store.ts';
import { LANE_OWNER, orbitCall } from './orbit-tool.ts';
import {
    boldFleetWords,
    bulletDots,
    dropWaitAside,
    linkTickets,
    numberCircled,
    parseWait,
} from './parse.ts';
import { AWAY_NOTE, composePrompt, takeLaneSteers } from './prompt-notes.ts';
import { peerPing, quietHeldText } from './quiet.ts';
import { quietLog } from './quiet-books.ts';
import {
    SEND_TOOL,
    quietKindsOff,
    quietOf,
    quietSendEnd,
    quietSendStart,
    quietWhy,
    saveQuiet,
} from './quiet-gate.ts';
import { WRAP_UP_TOOL, settleTask, stopRed, waitsOf } from './reply-fix.ts';
import { memberOf, openBoard, registry } from './roster.ts';
import { laneRoundLine } from './rounds.ts';
import { endSession, forget } from './session-end.ts';
import {
    currentId,
    isLaneOwner,
    refreshThreads,
    sessionName,
} from './session-identity.ts';
import { keepShelf, noteModel } from './session-record.ts';
import { startSession } from './session-start.ts';
import { drawSettingsPane } from './settings-pane.tsx';
import {
    QUIET_ON,
    SHOWN,
    flipKnob,
    partsShown,
    readSwitch,
    setSettingsOpen,
    shownOf,
} from './settings-store.ts';
import { HOT, REPLY, type Reply, hotOf } from './store-keys.ts';
import {
    clearWrap,
    countTool,
    endBusy,
    endStop,
    endUserTurn,
    isTurnBusy,
    markActive,
    markNudged,
    markWork,
    markWrapAsked,
    setTurnAfk,
    turn,
} from './turn.ts';
import { forgetTold, orbitTexts, tickSentence } from './turn-notes.ts';
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
    takeFill,
    takeWind,
    windAfterTurn,
    windBlock,
    windOnCompact,
} from './wind-run.ts';

// x-mod-stash: dima's command center above the prompt, one row; FTR.md lists every feature.
// orbit: the session's asks to dima and its plan, written through its own tool, ticked in the board; its open asks are
// mirrored into $.store (one key per session), so the board counts every session's.
// afk: one switch every session polls; while it is on, every prompt carries an away note, and a flip reaches a running turn.
// keep-hot: while on and idle, one ping 50 min after the last turn ended keeps the prompt cache warm; the switch lives in $.store, so a reload keeps it

const BACK_NOTE = 'dima is back from afk: orbit and pings reach him again.';
// the fleet board: cc's registry gives each session's state; each session's stash adds its 🔭 wait and context fill
const BOARD = 'x-cc-deck';
// 🎛️ is a pane of its own, which the surface tabs beside 🚦: the band is capped by cc, the list outgrew it (dima's pick a of
// four homes, 16:20); a tab row inside a pane was proven too, kept as an idea in api-map.md
const SETTINGS_PANE = 'stash-settings';
// a reload keeps `$.state` and resets the module: what must outlive a mod save lives there (FRM-320)
// what the band and the board draw: renders read it, and a write redraws them, no invalidate
const VIEW = { key: 'view', plugin: 'x-mod-stash' } as const;
// the running turn, so a mid-turn reload still knows it is busy
const TURN = { key: 'turn', plugin: 'x-mod-stash' } as const;
// a 📄 line's HH:MM — the same shape reply-check.py reads
const STAMP = /(📄[^\n]*?\b)(\d{1,2}:\d{2})\b/g;
const NUDGE_AT = 3;
// a plan set in either of the last 2 turns still holds: a turn that did not move it gets no nudge (clio's brief 8)
const PLAN_QUIET_TURNS = 2;
// mobile mode: mods draw nothing on the phone, so the session prints the open asks as the asks fence instead
const MOBILE = { key: 'mobile', plugin: 'x-mod-stash' } as const;
const MOBILE_SKILL = /(^|:)mobile-mode$/;
// clio's boot is open from the clio:boot skill's load until a reply as long as the board prints; start_session's own
// «then end your turn» hint ended the 10-29 boot early (FRM-426, exit 9). the keep is the store, so a reload still knows;
// a harness nudge answered «booting, board next» is short and never closes it, a silent turn has no reply at all
const BOOT = 'boot:';
const BOOT_SKILL = /^(?:clio:)?boot$/;
const BOARD_MIN = 300;
const BOOT_MS = 3 * 60 * 60 * 1000;
const START_SESSION_TOOL = 'mcp__ccd_session__start_session';
const BOOT_NOTE = 'the boot continues; the board ends the turn';
const MOBILE_OFF = /ARGUMENTS:\s*off\b/i;

const WORK_TOOLS = new Set([
    'Edit',
    'Write',
    'NotebookEdit',
    'MultiEdit',
    'Agent',
]);
const WORK_BASH =
    /\b(claude\s+(--bg|-n\s+\S+.*--bg|stop|respawn)|git\s+commit|x\s+lane\s+(commit|push|pr-open|merge-main|seed)|x\s+mods\s+edit\s+push)\b/;
export const isWork = (tool: string, command?: string) =>
    WORK_TOOLS.has(tool) || (tool === 'Bash' && WORK_BASH.test(command ?? ''));

// a clio boot whose board has not printed: the skill loaded in the last hours, no board-length reply since
async function isBootOpen($: EngineInterface) {
    if (!(await isLaneOwner($))) return false;
    const at = await $.store.get(BOOT + (await $.session.id()));
    return typeof at === 'number' && (await $.clock.now()) - at < BOOT_MS;
}

export const register: Register = (on) => {
    // session.start fires at startup and again on every hot reload; the classic event only at startup
    on('session.start', async ($, e, next) => {
        await startSession($, e.cwd, viewDoors($));
        return next(e);
    });

    // `/mobile-mode` turns the asks fence on, `/mobile-mode off` turns it off
    on('skill.prompt', async ($, e, next) => {
        if (BOOT_SKILL.test(e.skill) && (await isLaneOwner($)))
            await $.store
                .set(BOOT + (await $.session.id()), await $.clock.now())
                .catch(() => undefined);
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
        if ((e.last_assistant_message ?? '').length >= BOARD_MIN)
            await $.store.delete(BOOT + e.session_id).catch(() => undefined);
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
    on('tool.call', async ($, e, next) => {
        await flushFields($, viewDoors($));
        if ((e.tool as string) === ORBIT_TOOL) {
            const input = e as Record<string, unknown>;
            const ops = Array.isArray(input.ops)
                ? input.ops.filter(
                      (x): x is Record<string, unknown> =>
                          typeof x === 'object' && x !== null,
                  )
                : [input];
            if (!ops.length)
                return { deny: 'orbit: ops needs one { op, … } or more' };
            // a «changed:» resolve needs a follow or an add that lands: each is tried on the orbit as it stands, op is pure
            const was = await currentOrbit($);
            const isAmended = ops.some(
                (x) =>
                    (x.op === 'follow' || x.op === 'add') &&
                    !('deny' in orbitOp(was, x, true)),
            );
            if (ops.length === 1) {
                const r = await orbitCall(
                    $,
                    ops[0] as Record<string, unknown>,
                    isAmended,
                );
                return ('deny' in r ? r : { result: r.result }) as never;
            }
            const lines: string[] = [];
            let landed = 0;
            for (const [i, x] of ops.entries()) {
                const r = await orbitCall($, x, isAmended);
                if ('deny' in r)
                    lines.push(`${i + 1} ${String(x.op)}: refused — ${r.deny}`);
                else {
                    landed++;
                    lines.push(`${i + 1} ${String(x.op)}: ${r.result}`);
                }
            }
            const text = lines.join('\n');
            return (landed ? { result: text } : { deny: text }) as never;
        }
        // a wind blocks on work that STARTS after «pending: none», so the check runs before the call does
        if (!e.agentId)
            await windBlock($, e as Record<string, unknown>).catch(
                () => undefined,
            );
        const send =
            (e.tool as string) === SEND_TOOL && !e.agentId
                ? await quietSendStart($, e as Record<string, unknown>).catch(
                      () => undefined,
                  )
                : undefined;
        const r = await next(e);
        if (r.deny !== undefined || e.agentId) return r;
        if (
            (e.tool as string) === WRAP_UP_TOOL &&
            oneLine((e as Record<string, unknown>).ask)
        )
            markWrapAsked();
        if (
            isWork(
                e.tool as string,
                (e as { command?: unknown }).command as string | undefined,
            )
        )
            markWork();
        const notes: string[] = [];
        const sent = send
            ? await quietSendEnd($, send, r.result).catch(() => undefined)
            : undefined;
        if (sent?.line) notes.push(sent.line);
        // a fresh answer: core's `text` and `ref` still name the refusal
        const answer = sent?.held ? ({ result: sent.held } as never) : r;
        const isOn = await partsShown($);
        if ((e.tool as string) === SEND_TOOL && isOn('stash.rounds')) {
            const round = await laneRoundLine(
                $,
                e as Record<string, unknown>,
                r.result,
            ).catch(() => undefined);
            if (round) notes.push(round);
        }
        if (turn.turnAfk !== undefined && turn.turnAfk !== warm.afk) {
            setTurnAfk(warm.afk);
            if (isOn('stash.afk')) notes.push(warm.afk ? AWAY_NOTE : BACK_NOTE);
        }
        if (
            (e.tool as string) === START_SESSION_TOOL &&
            isOn('stash.boot') &&
            (await isBootOpen($))
        )
            notes.push(BOOT_NOTE);
        // a mark dima made while any turn of this session runs joins it here, model-only, and locks — a peer's or a task's
        // turn too, only the keep-hot ping never takes one (dima's o10, 2026-10-11); the turn is read from $.state, which a
        // mid-turn reload keeps
        await absorbMarks($, () => keepShelf($), isTypedHere);
        const isPing = (await $.state.get(TURN)).value?.isPinged ?? turn.pinged;
        const fresh =
            isPing || !isOn('stash.orbit')
                ? []
                : await takeMarks($, (o) => o.asks.filter(isFresh));
        if (fresh.length)
            notes.push(
                joinText(
                    fresh,
                    tickSentence(await orbitTexts($), fresh.length),
                ),
            );
        // a lane steer dima took while clio's turn runs joins it here too, as an orbit mark does
        if (!isPing && isOn('stash.glide') && (await isLaneOwner($))) {
            notes.push(...(await takeLaneMoves($)));
            notes.push(...(await takeLaneSteers($, await readLanes($))));
        }
        // 🐦‍🔥 a press while this session works slipstreams into its next tool step, as a tick does; an idle one waits
        // for its next turn, never woken (dima, 19:14)
        if (isOn('stash.second-wind')) {
            // a long turn crosses the lines with no prompt: the step reads its fill live (probed, 2.1.322)
            const fill = await $.session
                .usage()
                .then((u) => u.context.percent)
                .catch(() => undefined);
            const fillLine = await takeFill($, fill).catch(() => undefined);
            if (fillLine) notes.push(fillLine);
            const wind = await takeWind($, await isLaneOwner($)).catch(
                () => undefined,
            );
            if (wind) notes.push(wind);
        }
        // dima's phases mark joins the running turn at its next tool call
        const p =
            !isPing && isOn('stash.phases') ? await takePlanMark($) : undefined;
        if (p) notes.push(planText(p));
        const o = await currentOrbit($);
        if (
            !turn.isNudged &&
            isOn('stash.phases') &&
            countTool() >= NUDGE_AT &&
            turn.isWorkTurn &&
            !(o.plan && o.plan.at >= o.turns + 1 - PLAN_QUIET_TURNS)
        ) {
            markNudged();
            notes.push(
                o.plan
                    ? `phases not set for ${PLAN_QUIET_TURNS + 1} turns — update them with ${ORBIT_TOOL} plan`
                    : `no phases yet — set them with ${ORBIT_TOOL} plan`,
            );
        }
        // last: the rung moves here, and everything above may still throw
        if (!isPing) {
            const pace = await paceStep($).catch(() => undefined);
            if (pace) notes.push(pace);
        }
        // a join herdr wrote mid-turn lands at the next tool step, as a tick does; taken after every step that could
        // throw, since a taken row is stamped joined at the turn's end
        const joins = isPing
            ? []
            : await joinsLocked(() => takeJoins($)).catch(() => []);
        if (joins.length) notes.push(joinRowsText(joins));
        if (!notes.length) return answer;
        return { ...answer, context: [...(r.context ?? []), ...notes] };
    });

    // the band: one row — the meters' readings, the 🔭 mark, the switches — then the bars
    // and a refused threshold's one line
    on('ui.render', { component: 'AbovePrompt' }, ($, e, next) =>
        renderBand($, e, next),
    );
};
