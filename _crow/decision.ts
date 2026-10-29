import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import {
    type LiveSession,
    SESSION_NAME,
    STATE_DIR,
    type Wake,
    decisionOf,
    findSessions,
    isCoordinatorTranscript,
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
    writeState,
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
const decision =
    decisionOf(input.tool_input?.command ?? '') ??
    proposalOf(
        input.tool_name,
        input.tool_input?.file_path,
        input.tool_input?.command,
    );
if (
    decision &&
    input.transcript_path &&
    isCoordinatorTranscript(input.transcript_path)
) {
    try {
        if (decision.kind === 'merge')
            await merge(decision.args, input.transcript_path, input.cwd);
        else if (decision.kind === 'spawn')
            await noWaitWake('spawn', input.transcript_path);
        else if (isFirstInTurn(decision.path, input.transcript_path))
            await noWaitWake(
                `proposal ${decision.path}`,
                input.transcript_path,
                decision.path,
            );
    } catch (error) {
        context(
            `🐦‍⬛ crow decision hook failed, nothing waited: ${error instanceof Error ? error.message : String(error)}`,
        );
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
    const about = `${repo}#${pr.number} (${heads})`;
    const fields = `merge ${repo}#${pr.number} · verified ${verified ?? 'none'} · head ${pr.headRefOid}`;

    const live = liveCrow();
    if ('skip' in live) return context(`🐦‍⬛ ${about}: ${live.skip}`);

    const marker = join(
        STATE_DIR,
        'decisions',
        `${repo.replace('/', '-')}-${pr.number}-${head}.json`,
    );
    if (!live.crow.jobId) {
        const asked = readMarker(marker);
        if (!asked) {
            const wake = await wakeCrow({
                fields,
                transcriptPath,
                withNote: true,
            });
            mkdirSync(join(STATE_DIR, 'decisions'), { recursive: true });
            writeFileSync(
                marker,
                JSON.stringify({ at: Date.now(), wakeId: wake.id }),
            );
            return deny(
                `🐦‍⬛ crow decides on this merge first (${heads}): send the line below, alone, ${sendVia(live.crow.name)}, then rerun the same merge command; the rerun waits up to ${WAIT_MS / 1000} s for crow's note. no need to report it to dima unless he asks.\n${wake.line}`,
            );
        }
        return context(`🐦‍⬛ ${about}: ${await noteOf(asked.wakeId)}`);
    }
    const wake = await wakeCrow({
        fields,
        socket: live.crow,
        transcriptPath,
        withNote: true,
    });
    context(`🐦‍⬛ ${about}: ${await noteOf(wake.id)}`);
}

// a spawn has already run and a proposal is already written: crow is woken, nothing waits on its note
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
        `proposal-${createHash('sha1').update(path).digest('hex').slice(0, 12)}.json`,
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
    const wake: Wake = {
        id: `${wakeIdOf(now)}d${String(now.getSeconds()).padStart(2, '0')}`,
        mode: 'decision',
        phase: 'live',
    };
    const packed = packWake({
        delta,
        lines,
        now,
        proposal,
        state,
        transcriptPath,
        wakeId: wake.id,
    });
    const note = withNote ? ` · note ${notePath(wake.id)}` : '';
    const line = `${wakeLine(wake)} · ${fields}${note}`;
    if (socket?.jobId) await sendLine(socket.messagingSocketPath, line);
    writeState(
        proposal && BOOT_BOARD.test(proposal)
            ? { ...packed.state, lastWakeAt: now.getTime() }
            : packed.state,
    );
    spawnHarvest(wake);
    return { ...wake, line };
}

function notePath(wakeId: string) {
    return join(STATE_DIR, 'packets', wakeId, 'note.md');
}

async function noteOf(wakeId: string) {
    const started = Date.now();
    while (Date.now() - started < WAIT_MS) {
        try {
            const note = readFileSync(notePath(wakeId), 'utf8').trim();
            if (note) return `crow's note: ${note}`;
        } catch {}
        await sleep(1000);
    }
    return `crow silent after ${Math.round(WAIT_MS / 1000)} s`;
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
    tool_input?: { command?: string; file_path?: string };
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
