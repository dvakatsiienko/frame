import {
    closeSync,
    existsSync,
    openSync,
    statSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';

import {
    MIN_STEPS,
    RELAY_PATH,
    SILENT_DAYS,
    STATE_DIR,
    WAKE_GAP_MS,
    type Wake,
    armModels,
    clioThreadOf,
    dayOf,
    dropStaleRelay,
    fail,
    isMode,
    isParked,
    liveArm,
    modeList,
    oneCrow,
    packWake,
    readLines,
    readState,
    sendLine,
    spawnHarvest,
    transcriptDelta,
    wakeIdOf,
    wakeLine,
    wakeSuffixOf,
    writeWakeState,
} from './lib.ts';

const usage = `crow:wake --transcript <jsonl> [--mode ${modeList.join('|')}] [--precompact]

  builds a packet from clio's transcript delta and the leaves in ${join(STATE_DIR, 'leaves.txt')},
  copies it into crow's home and sends crow one wake line. skips (exit 0, one line) when
  ${join(STATE_DIR, 'paused')} exists, crow is not running, the last wake is under 30 min old, or fewer than 10 clio steps
  passed (--precompact waives the step count). mode defaults to day.`;

const { values } = parseArgs({
    options: {
        help: { short: 'h', type: 'boolean' },
        mode: { default: 'day', type: 'string' },
        precompact: { type: 'boolean' },
        transcript: { type: 'string' },
    },
});
if (values.help) {
    console.log(usage);
    process.exit(0);
}
const { mode, transcript } = values;
if (!transcript || !isMode(mode)) fail(usage);
const LOCK_WAIT_MS = 10_000;

// a session that is no clio's fires nothing and logs nothing
const thread = clioThreadOf(transcript);
if (!thread) {
    console.log(`skipped: not clio's thread: ${transcript}`);
    process.exit(0);
}
const threadId = thread.id;

// a trigger that never woke her stays visible: every skip names its thread and reason
function skip(reason: string): never {
    writeFileSync(
        join(STATE_DIR, 'harvest.log'),
        `${new Date().toISOString()} ${threadId} skipped: ${reason}\n`,
        { flag: 'a' },
    );
    console.log(`skipped: ${reason}`);
    process.exit(0);
}

// the hook fires per thread, so a peer's wake is waited out, never dropped; the same thread's second hook then meets its own clock
const lockPath = join(STATE_DIR, 'wake.lock');
const lock = await takeLock();

async function takeLock() {
    const started = Date.now();
    while (true) {
        try {
            return openSync(lockPath, 'wx');
        } catch {
            const age =
                Date.now() -
                (statSync(lockPath, { throwIfNoEntry: false })?.mtimeMs ?? 0);
            if (age >= 60_000) unlinkSync(lockPath);
            else if (Date.now() - started > LOCK_WAIT_MS)
                skip('another wake is running');
            else await sleep(100);
        }
    }
}

// skip() and fail() exit the process, which never runs a finally
process.on('exit', () => {
    closeSync(lock);
    unlinkSync(lockPath);
});
await wake(transcript, mode);

async function wake(transcriptPath: string, wakeMode: Wake['mode']) {
    const now = new Date();
    if (existsSync(join(STATE_DIR, 'paused'))) {
        skip(`paused (${join(STATE_DIR, 'paused')} exists)`);
    }
    const state = readState();
    // a --bg crow takes socket lines; a desktop tab takes only the desktop's own door, so clio relays
    const session = oneCrow();
    const viaSocket = Boolean(session?.jobId);
    const lastWakeAt = state.lastWakeAt?.[threadId];
    if (lastWakeAt && now.getTime() - lastWakeAt < WAKE_GAP_MS) {
        skip(
            `last wake ${Math.round((now.getTime() - lastWakeAt) / 60_000)} min ago (gap ${WAKE_GAP_MS / 60_000} min)`,
        );
    }
    // a tab's one relay slot: a wake parked for another thread keeps it, and this one's delta waits for its next turn
    if (!viaSocket && !dropStaleRelay() && existsSync(RELAY_PATH)) {
        skip('the relay holds an unsent wake');
    }

    let lines: string[];
    try {
        lines = readLines(transcriptPath);
    } catch {
        fail(`cannot read transcript: ${transcriptPath}`);
    }
    const fromLine = Math.min(state.offsets[transcriptPath] ?? 0, lines.length);
    const delta = transcriptDelta(lines, fromLine);
    if (!values.precompact && delta.steps < MIN_STEPS) {
        skip(
            `${delta.steps} clio steps since the last wake (min ${MIN_STEPS})`,
        );
    }
    // the backstop saves the window while the ladder parks; decision wakes never come through here
    if (isParked(now)) skip('park');

    const firstWakeAt = state.firstWakeAt ?? now.getTime();
    const day = dayOf(firstWakeAt, now.getTime());
    const wakeInfo: Wake = {
        id: `${wakeIdOf(now)}${wakeSuffixOf(threadId)}`,
        mode: wakeMode,
        phase: day <= SILENT_DAYS ? 'silent' : 'live',
        thread,
    };
    const packed = packWake({
        delta,
        lines,
        now,
        state,
        thread: threadId,
        transcriptPath,
        wakeId: wakeInfo.id,
    });

    if (viaSocket && session) {
        await sendLine(session.messagingSocketPath, wakeLine(wakeInfo)).catch(
            (error: unknown) =>
                fail(
                    `cannot reach crow's socket: ${error instanceof Error ? error.message : String(error)}`,
                ),
        );
    } else {
        writeFileSync(
            RELAY_PATH,
            JSON.stringify({
                ...wakeInfo,
                line: wakeLine(wakeInfo),
                model: armModels[liveArm],
            }),
        );
    }

    writeWakeState({
        firstWakeAt,
        packed: packed.state,
        thread: threadId,
        transcriptPath,
        wakeAt: now.getTime(),
    });

    if (viaSocket) spawnHarvest(wakeInfo);

    const unmatched = packed.missing.length
        ? `, ${packed.missing.length} leaves unmatched`
        : '';
    console.log(
        `woke ${wakeInfo.id} ${threadId} (${viaSocket ? 'socket' : 'relay: clio forwards it'}): day ${day} ${wakeInfo.phase}, ${delta.steps} steps, ${packed.files.length} files${unmatched}`,
    );
    if (wakeInfo.phase === 'live' && state.arm && state.arm !== liveArm) {
        console.log(
            `crow runs ${state.arm}, the arm is ${liveArm}: pnpm crow:stop, then pnpm crow:start ${liveArm}`,
        );
    }
}
