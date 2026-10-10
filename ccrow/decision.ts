import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
    readLines,
    readState,
    sendLine,
    spawnHarvest,
    transcriptDelta,
    verifiedHead,
    wakeIdOf,
    wakeLine,
    writeState,
} from './lib.ts';

// a PreToolUse exit 2 or timeout blocks the merge, so every failure prints context and exits 0
// cclio's settings give the merge hook 120 s, so this wait stays under it
const WAIT_MS = Number(process.env.CCROW_DECISION_WAIT_MS ?? 90_000);
const MARKER_TTL_MS = 10 * 60_000;
const SEND = `through mcp__ccd_session_mgmt__send_message to the session titled «${SESSION_NAME}»`;

const input: HookInput = JSON.parse(readFileSync(0, 'utf8'));
const decision = decisionOf(input.tool_input?.command ?? '');
if (
    decision &&
    input.transcript_path &&
    isCoordinatorTranscript(input.transcript_path)
) {
    try {
        if (decision.kind === 'merge')
            await merge(decision.args, input.transcript_path, input.cwd);
        else await spawnWake(input.transcript_path);
    } catch (error) {
        context(
            `🐦‍⬛ ccrow decision hook failed, nothing waited: ${error instanceof Error ? error.message : String(error)}`,
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

    const live = liveCcrow();
    if ('skip' in live) return context(`🐦‍⬛ ${about}: ${live.skip}`);

    const marker = join(
        STATE_DIR,
        'decisions',
        `${repo.replace('/', '-')}-${pr.number}-${head}.json`,
    );
    if (!live.ccrow.jobId) {
        const asked = readMarker(marker);
        if (!asked) {
            const wake = await wakeCcrow({
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
                `🐦‍⬛ ccrow decides on this merge first (${heads}): send the line below, alone, ${SEND}, then rerun the same merge command; the rerun waits up to ${WAIT_MS / 1000} s for ccrow's note. no need to report it to dima unless he asks.\n${wake.line}`,
            );
        }
        return context(`🐦‍⬛ ${about}: ${await noteOf(asked.wakeId)}`);
    }
    const wake = await wakeCcrow({
        fields,
        socket: live.ccrow,
        transcriptPath,
        withNote: true,
    });
    context(`🐦‍⬛ ${about}: ${await noteOf(wake.id)}`);
}

async function spawnWake(transcriptPath: string) {
    const live = liveCcrow();
    if ('skip' in live) return;
    const wake = await wakeCcrow({
        fields: 'spawn',
        socket: live.ccrow,
        transcriptPath,
        withNote: false,
    });
    if (!live.ccrow.jobId)
        context(
            `🐦‍⬛ ccrow wake for this spawn: after this call, send the line below, alone, ${SEND}; do not wait for it, no need to report it to dima unless he asks.\n${wake.line}`,
        );
}

function shortSha(sha: string) {
    return sha.slice(0, 8);
}

// oneCcrow exits 2 on two live ccrows, which here would block the merge
function liveCcrow(): { ccrow: LiveSession } | { skip: string } {
    if (existsSync(join(STATE_DIR, 'paused')))
        return { skip: 'ccrow is paused' };
    const [ccrow, ...more] = findSessions();
    if (!ccrow) return { skip: 'ccrow is not running' };
    if (more.length) return { skip: 'two ccrows are live, none was woken' };
    return { ccrow };
}

// a decision wake skips the 30-min and step gates and leaves lastWakeAt alone: the Stop cadence is the charter's
async function wakeCcrow({
    fields,
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
        state,
        transcriptPath,
        wakeId: wake.id,
    });
    const note = withNote ? ` · note ${notePath(wake.id)}` : '';
    const line = `${wakeLine(wake)} · ${fields}${note}`;
    if (socket?.jobId) await sendLine(socket.messagingSocketPath, line);
    writeState(packed.state);
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
            if (note) return `ccrow's note: ${note}`;
        } catch {}
        await sleep(1000);
    }
    return `ccrow silent after ${Math.round(WAIT_MS / 1000)} s`;
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
                hookEventName: 'PreToolUse',
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
    transcript_path?: string;
    tool_input?: { command?: string };
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
    socket?: LiveSession;
    transcriptPath: string;
    withNote: boolean;
}
