import { spawn } from 'node:child_process';
import {
    closeSync,
    existsSync,
    openSync,
    readFileSync,
    statSync,
    unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import {
    MIN_STEPS,
    SILENT_DAYS,
    STATE_DIR,
    WAKE_GAP_MS,
    type Wake,
    armOfDay,
    buildPacket,
    dayOf,
    fail,
    findSession,
    isMode,
    localDay,
    modeList,
    readLines,
    readState,
    resolveLeaves,
    sendLine,
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
    const state = readState();
    const session = findSession();
    if (!session) skip('ccrow is not running (pnpm ccrow:start opus|fable)');
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
    let leafPatterns: string[] = [];
    try {
        leafPatterns = readFileSync(
            join(STATE_DIR, 'leaves.txt'),
            'utf8',
        ).split('\n');
    } catch {}
    const leaves = resolveLeaves(leafPatterns, localDay(now));
    const files = buildPacket({
        deltaText: delta.text,
        dir: join(STATE_DIR, 'packets', wakeInfo.id),
        leaves: leaves.found,
        missing: leaves.missing,
    });

    await sendLine(session.messagingSocketPath, wakeLine(wakeInfo)).catch(
        (error: unknown) =>
            fail(
                `cannot reach ccrow's socket: ${error instanceof Error ? error.message : String(error)}`,
            ),
    );

    writeState({
        ...state,
        firstWakeAt,
        lastWakeAt: now.getTime(),
        offsets: { ...state.offsets, [transcriptPath]: lines.length },
    });

    spawn(
        process.execPath,
        [
            new URL('harvest.ts', import.meta.url).pathname,
            wakeInfo.id,
            wakeInfo.mode,
            wakeInfo.phase,
        ],
        { detached: true, stdio: 'ignore' },
    ).unref();

    const unmatched = leaves.missing.length
        ? `, ${leaves.missing.length} leaves unmatched`
        : '';
    console.log(
        `woke ${wakeInfo.id}: day ${day} ${wakeInfo.phase}, ${delta.steps} steps, ${files.length} files${unmatched}`,
    );
    const dayArm = armOfDay(day);
    if (wakeInfo.phase === 'live' && state.arm && state.arm !== dayArm) {
        console.log(
            `day ${day} belongs to ${dayArm}, ccrow runs ${state.arm}: claude stop ${state.jobId}, then pnpm ccrow:start ${dayArm}`,
        );
    }
}
