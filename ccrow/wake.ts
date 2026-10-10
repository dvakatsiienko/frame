import {
    closeSync,
    existsSync,
    openSync,
    statSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import {
    MIN_STEPS,
    RELAY_PATH,
    SILENT_DAYS,
    STATE_DIR,
    WAKE_GAP_MS,
    type Wake,
    armModels,
    armOfDay,
    dayOf,
    fail,
    isCoordinatorTranscript,
    isMode,
    modeList,
    oneCcrow,
    packWake,
    readLines,
    readState,
    sendLine,
    spawnHarvest,
    transcriptDelta,
    wakeIdOf,
    wakeLine,
    writeState,
} from './lib.ts';

const usage = `ccrow:wake --transcript <jsonl> [--mode ${modeList.join('|')}] [--precompact]

  builds a packet from cclio's transcript delta and the leaves in ${join(STATE_DIR, 'leaves.txt')},
  copies it into ccrow's home and sends ccrow one wake line. skips (exit 0, one line) when
  ${join(STATE_DIR, 'paused')} exists, ccrow is not running, the last wake is under 30 min old, or fewer than 10 cclio steps
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

function skip(reason: string): never {
    console.log(`skipped: ${reason}`);
    process.exit(0);
}

// a Stop hook and a PreCompact hook can fire in the same second; one wake at a time
const lockPath = join(STATE_DIR, 'wake.lock');
let lock: number;
try {
    lock = openSync(lockPath, 'wx');
} catch {
    const age =
        Date.now() -
        (statSync(lockPath, { throwIfNoEntry: false })?.mtimeMs ?? 0);
    if (age < 60_000) skip('another wake is running');
    unlinkSync(lockPath);
    lock = openSync(lockPath, 'wx');
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
    if (!isCoordinatorTranscript(transcriptPath)) {
        skip(`not cclio's thread: ${transcriptPath}`);
    }
    const state = readState();
    // a --bg ccrow takes socket lines; a desktop tab takes only the desktop's own door, so cclio relays
    const session = oneCcrow();
    const viaSocket = Boolean(session?.jobId);
    if (state.lastWakeAt && now.getTime() - state.lastWakeAt < WAKE_GAP_MS) {
        skip(
            `last wake ${Math.round((now.getTime() - state.lastWakeAt) / 60_000)} min ago (gap ${WAKE_GAP_MS / 60_000} min)`,
        );
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
            `${delta.steps} cclio steps since the last wake (min ${MIN_STEPS})`,
        );
    }

    const firstWakeAt = state.firstWakeAt ?? now.getTime();
    const day = dayOf(firstWakeAt, now.getTime());
    const wakeInfo: Wake = {
        id: wakeIdOf(now),
        mode: wakeMode,
        phase: day <= SILENT_DAYS ? 'silent' : 'live',
    };
    const packed = packWake({
        delta,
        lines,
        now,
        state,
        transcriptPath,
        wakeId: wakeInfo.id,
    });

    if (viaSocket && session) {
        await sendLine(session.messagingSocketPath, wakeLine(wakeInfo)).catch(
            (error: unknown) =>
                fail(
                    `cannot reach ccrow's socket: ${error instanceof Error ? error.message : String(error)}`,
                ),
        );
    } else {
        writeFileSync(
            RELAY_PATH,
            JSON.stringify({
                ...wakeInfo,
                line: wakeLine(wakeInfo),
                model: armModels[armOfDay(day)],
            }),
        );
    }

    writeState({
        ...packed.state,
        firstWakeAt,
        lastWakeAt: now.getTime(),
    });

    if (viaSocket) spawnHarvest(wakeInfo);

    const unmatched = packed.missing.length
        ? `, ${packed.missing.length} leaves unmatched`
        : '';
    console.log(
        `woke ${wakeInfo.id} (${viaSocket ? 'socket' : 'relay: cclio forwards it'}): day ${day} ${wakeInfo.phase}, ${delta.steps} steps, ${packed.files.length} files${unmatched}`,
    );
    const dayArm = armOfDay(day);
    if (wakeInfo.phase === 'live' && state.arm && state.arm !== dayArm) {
        console.log(
            `day ${day} belongs to ${dayArm}, ccrow runs ${state.arm}: pnpm ccrow:stop, then pnpm ccrow:start ${dayArm}`,
        );
    }
}
