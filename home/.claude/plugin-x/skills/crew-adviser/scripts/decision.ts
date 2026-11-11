import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import {
    type ClioThread,
    type Decision,
    type LiveSession,
    MAIN_THREAD,
    NOTES_PATH,
    SESSION_NAME,
    STATE_DIR,
    type Wake,
    clioThreadOf,
    consoleOf,
    decisionOf,
    findSessions,
    packWake,
    prViewArgs,
    proposalOf,
    readLines,
    readState,
    sendLine,
    spawnHarvest,
    transcriptDelta,
    turnStartOf,
    verifiedHead,
    wakeIdOf,
    wakeLine,
    wakeSuffixOf,
    writeWakeState,
} from './lib.ts';

// a PreToolUse exit 2 or timeout blocks the merge, so every failure prints context and exits 0
// clio's settings give the merge hook 120 s, so this wait stays under it
const WAIT_MS = Number(process.env.CROW_DECISION_WAIT_MS ?? 90_000);
const MARKER_TTL_MS = 10 * 60_000;
// the boot's draft board (clio:boot step 8): dima wants crow's note on it before it prints
const BOOT_BOARD = /(^|\/)\.scratch\/boot-[^/]+\/[^/]+-proposal\.md$/;
// a crow without a job id is a desktop tab or a terminal resume; SendMessage by her registry name reaches both
const sendVia = (name = SESSION_NAME) =>
    `with SendMessage to «${name}», her registry name`;

const input: HookInput = JSON.parse(readFileSync(0, 'utf8'));
const event = input.hook_event_name;
const transcript = input.transcript_path;
const thread = transcript ? clioThreadOf(transcript) : undefined;
if (transcript && thread) {
    try {
        await act(decisionNow(), transcript, thread);
    } catch (error) {
        context(
            `🐦‍⬛ crow decision hook failed, nothing waited: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

// the hook runs before a call and after a write; each act belongs to one side, or a summon wakes crow twice
function decisionNow() {
    const { tool_input: tool, tool_name: name } = input;
    const before =
        event === 'PostToolUse'
            ? undefined
            : (decisionOf(tool?.command ?? '', input.cwd) ??
              consoleOf(name, tool, () => readLines(transcript ?? '')));
    return (
        before ??
        (event === 'PreToolUse'
            ? undefined
            : proposalOf(name, tool?.file_path, tool?.command, input.cwd))
    );
}

async function act(
    decision: Decision | undefined,
    transcriptPath: string,
    clio: ClioThread,
) {
    // no wing call waits on her, and a wing's post or close is read at its cadence wake
    if (
        clio.id !== MAIN_THREAD &&
        decision?.kind !== 'spawn' &&
        decision?.kind !== 'proposal'
    )
        return;
    switch (decision?.kind) {
        case undefined:
            return;
        case 'merge':
            return merge(decision.args, transcriptPath, input.cwd);
        case 'spawn':
            return noWaitWake('spawn', transcriptPath);
        case 'post':
        case 'close':
            return noWaitWake(
                `${decision.kind} ${decision.what}`,
                transcriptPath,
            );
        case 'paid':
            return hold({
                about: `paid call (${decision.what})`,
                act: 'paid call',
                fields: `paid ${decision.what}`,
                marker: `paid-${hashOf(decision.what)}.json`,
                transcriptPath,
            });
        case 'console': {
            const marker = `console-${hashOf(decision.url)}.json`;
            // a tab's rerun carries a marker and is the call the hold promised, so the once-a-turn gate lets it by
            if (
                !readMarker(join(STATE_DIR, 'decisions', marker)) &&
                !isFirstInTurn(`console ${decision.url}`, transcriptPath)
            )
                return;
            return hold({
                about: `console (${decision.url})`,
                act: 'console action',
                fields: `console ${decision.url}`,
                marker,
                transcriptPath,
            });
        }
        case 'proposal':
            if (!isFirstInTurn(decision.path, transcriptPath)) return;
            return noWaitWake(
                `proposal ${decision.path}`,
                transcriptPath,
                decision.path,
            );
        default:
            return decision satisfies never;
    }
}

async function merge(
    args: string[],
    transcriptPath: string,
    cwd: string | undefined,
) {
    const pr: Pr = JSON.parse(
        execFileSync('gh', prViewArgs(args), { cwd, encoding: 'utf8' }),
    );
    const repo = /github\.com\/([^/]+\/[^/]+)\/pull\//.exec(pr.url)?.[1] ?? '?';
    const verified = verifiedHead(`${repo}#${pr.number}`);
    const head = shortSha(pr.headRefOid);
    const isDelta = verified !== undefined && shortSha(verified) !== head;
    const heads = `verified ${verified ? shortSha(verified) : 'none'}, head ${head}${isDelta ? ': unverified delta' : ''}`;
    await hold({
        about: `${repo}#${pr.number} (${heads})`,
        act: `merge (${heads})`,
        fields: `merge ${repo}#${pr.number} · verified ${verified ?? 'none'} · head ${pr.headRefOid}`,
        marker: `${repo.replace('/', '-')}-${pr.number}-${head}.json`,
        transcriptPath,
    });
}

// the act waits up to WAIT_MS for crow's note; a tab takes no socket line, so its first call is denied with the line clio sends by hand
async function hold({ about, act, fields, marker, transcriptPath }: Hold) {
    const live = liveCrow();
    if ('skip' in live) return context(`🐦‍⬛ ${about}: ${live.skip}`);

    const markerPath = join(STATE_DIR, 'decisions', marker);
    if (!live.crow.jobId) {
        const asked = readMarker(markerPath);
        if (!asked) {
            const wake = await wakeCrow({
                fields,
                transcriptPath,
                withNote: true,
            });
            mkdirSync(join(STATE_DIR, 'decisions'), { recursive: true });
            writeFileSync(
                markerPath,
                JSON.stringify({ at: Date.now(), wakeId: wake.id }),
            );
            return deny(
                `🐦‍⬛ crow decides on this ${act} first: send the line below, alone, ${sendVia(live.crow.name)}, then rerun the same command; the rerun waits up to ${WAIT_MS / 1000} s for crow's note. no need to report it to dima unless he asks.\n${wake.line}`,
            );
        }
        return context(`🐦‍⬛ ${about}: ${await noteOf(asked.wakeId, fields)}`);
    }
    const wake = await wakeCrow({
        fields,
        socket: live.crow,
        transcriptPath,
        withNote: true,
    });
    context(`🐦‍⬛ ${about}: ${await noteOf(wake.id, fields)}`);
}

function logDecision(row: object) {
    mkdirSync(join(STATE_DIR, 'decisions'), { recursive: true });
    writeFileSync(
        join(STATE_DIR, 'decisions', 'log.jsonl'),
        `${JSON.stringify({ at: new Date().toISOString(), ...row })}\n`,
        { flag: 'a' },
    );
}

function hashOf(text: string) {
    return createHash('sha1').update(text).digest('hex').slice(0, 12);
}

// a spawn, a post and a close run on, and a proposal is already written: crow is woken, nothing waits on its note
async function noWaitWake(
    fields: string,
    transcriptPath: string,
    proposal?: string,
) {
    const live = liveCrow();
    if ('skip' in live) return;
    const wake = await wakeCrow({
        fields,
        proposal,
        socket: live.crow,
        transcriptPath,
        withNote: false,
    });
    if (!live.crow.jobId)
        context(
            `🐦‍⬛ crow wake for this ${fields.split(' ')[0]}: after this call, send the line below, alone, ${sendVia(live.crow.name)}; ${proposal && BOOT_BOARD.test(proposal) ? 'the board waits on her note: end the turn on the 🔭 line, print the board once her note and wishkeeper are folded.' : 'do not wait for it, no need to report it to dima unless he asks.'}\n${wake.line}`,
        );
}

// one wake per proposal file per turn: a draft takes several Edits, and crow should read it once
function isFirstInTurn(path: string, transcriptPath: string) {
    const turn = `${transcriptPath}:${turnStartOf(readLines(transcriptPath))}`;
    const marker = join(
        STATE_DIR,
        'decisions',
        `proposal-${hashOf(path)}.json`,
    );
    try {
        if (JSON.parse(readFileSync(marker, 'utf8')).turn === turn)
            return false;
    } catch {}
    mkdirSync(dirname(marker), { recursive: true });
    writeFileSync(marker, JSON.stringify({ path, turn }));
    return true;
}

function shortSha(sha: string) {
    return sha.slice(0, 8);
}

// oneCrow exits 2 on two live crows, which here would block the merge
function liveCrow(): { crow: LiveSession } | { skip: string } {
    if (existsSync(join(STATE_DIR, 'paused')))
        return { skip: 'crow is paused' };
    const [crow, ...more] = findSessions();
    if (!crow) return { skip: 'crow is not running' };
    if (more.length) return { skip: 'two crows are live, none was woken' };
    return { crow };
}

// a decision wake skips the 30-min and step gates and leaves lastWakeAt alone: the Stop cadence is the charter's.
// the boot board is the one exception: the boot's turn ends on purpose while it waits, and a Stop wake then would read the same half boot twice
async function wakeCrow({
    fields,
    proposal,
    socket,
    transcriptPath,
    withNote,
}: WakeInput) {
    const now = new Date();
    const state = readState();
    const lines = readLines(transcriptPath);
    const delta = transcriptDelta(
        lines,
        Math.min(state.offsets[transcriptPath] ?? 0, lines.length),
    );
    const clio = thread ?? { id: MAIN_THREAD, name: '' };
    try {
        return await packAndSend();
    } catch (error) {
        // a decision wake that broke leaves its line beside the Stop wake's, or the empty packet dir is the only trace
        writeFileSync(
            join(STATE_DIR, 'harvest.log'),
            `${now.toISOString()} ${clio.id} failed: decision wake: ${error instanceof Error ? error.message : String(error)}\n`,
            { flag: 'a' },
        );
        throw error;
    }

    async function packAndSend() {
        const wake: Wake = {
            id: `${wakeIdOf(now)}d${String(now.getSeconds()).padStart(2, '0')}${wakeSuffixOf(clio.id)}`,
            mode: 'decision',
            phase: 'live',
            thread,
        };
        const packed = packWake({
            delta,
            lines,
            now,
            proposal,
            state,
            thread: clio.id,
            transcriptPath,
            wakeId: wake.id,
        });
        const note = withNote ? ` · note ${notePath(wake.id)}` : '';
        const line = `${wakeLine(wake)} · ${fields}${note}`;
        if (socket?.jobId) await sendLine(socket.messagingSocketPath, line);
        writeWakeState({
            packed: packed.state,
            thread: clio.id,
            transcriptPath,
            wakeAt:
                proposal && BOOT_BOARD.test(proposal)
                    ? now.getTime()
                    : undefined,
        });
        spawnHarvest(wake);
        return { ...wake, line };
    }
}

function notePath(wakeId: string) {
    return join(STATE_DIR, 'packets', wakeId, 'note.md');
}

async function noteOf(wakeId: string, fields: string) {
    const started = Date.now();
    while (Date.now() - started < WAIT_MS) {
        try {
            const note = readFileSync(notePath(wakeId), 'utf8').trim();
            if (note) return `crow's note: ${note}`;
        } catch {}
        // a --bg crow's Write can be refused by its worktree guard, and the harvester logs her reply either way
        const logged = loggedNote(wakeId);
        if (logged) return `crow's note: ${logged}`;
        await sleep(1000);
    }
    logDecision({ fields, value: 'timed out', wakeId });
    return `crow silent after ${Math.round(WAIT_MS / 1000)} s`;
}

function loggedNote(wakeId: string) {
    try {
        return readLines(NOTES_PATH)
            .map((line): { note?: string; wakeId?: string } => JSON.parse(line))
            .find((row) => row.wakeId === wakeId && row.note)
            ?.note?.trim();
    } catch {}
}

function readMarker(path: string): Marker | undefined {
    try {
        const marker: Marker = JSON.parse(readFileSync(path, 'utf8'));
        if (Date.now() - marker.at < MARKER_TTL_MS) return marker;
    } catch {}
}

function context(additionalContext: string) {
    console.log(
        JSON.stringify({
            hookSpecificOutput: {
                additionalContext,
                hookEventName: input.hook_event_name ?? 'PreToolUse',
            },
        }),
    );
}

function deny(reason: string) {
    console.log(
        JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: reason,
            },
        }),
    );
}

/* Types */

interface HookInput {
    cwd?: string;
    hook_event_name?: string;
    transcript_path?: string;
    tool_name?: string;
    tool_input?: {
        action?: string;
        command?: string;
        file_path?: string;
        url?: string;
    };
}

interface Hold {
    about: string;
    act: string;
    fields: string;
    marker: string;
    transcriptPath: string;
}

interface Pr {
    number: number;
    headRefOid: string;
    url: string;
}

interface Marker {
    at: number;
    wakeId: string;
}

interface WakeInput {
    fields: string;
    proposal?: string;
    socket?: LiveSession;
    transcriptPath: string;
    withNote: boolean;
}
