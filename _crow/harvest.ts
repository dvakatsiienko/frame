import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import {
    type Arm,
    HARVEST_DEADLINE_MS,
    NOTES_PATH,
    type Note,
    type Run,
    STATE_DIR,
    type Wake,
    appendJsonl,
    appendNoteOnce,
    armList,
    claudeArgs,
    isMode,
    newestTranscript,
    oneShotModel,
    readCharter,
    readState,
    readTurn,
    reconcileMarker,
    runOneShot,
    tokensIn,
    wakeLine,
    writeState,
} from './lib.ts';

// spawned detached by wake.ts, stdio ignored: every outcome goes to harvest.log
const POLL_MS = 5_000;
const TIMEOUT: Run = {
    model: null,
    note: 'timeout: no turn end within 15 min',
    seconds: HARVEST_DEADLINE_MS / 1000,
    tokensIn: 0,
    tokensOut: 0,
};
// `<wake id> <mode> <phase>` for a wake, `reconcile <note id> <evidence>` for a reconcile
const [wakeId, mode, phaseArg] = process.argv.slice(2);

function log(line: string) {
    writeFileSync(
        join(STATE_DIR, 'harvest.log'),
        `${new Date().toISOString()} ${wakeId} ${line}\n`,
        { flag: 'a' },
    );
}

function noteOf(
    wake: Wake,
    arm: Arm,
    channel: Note['channel'],
    run: Run,
): Note {
    return {
        arm,
        at: new Date().toISOString(),
        channel,
        effort: 'medium',
        id: `${wake.id}-${arm}`,
        mode: wake.mode,
        phase: wake.phase,
        wakeId: wake.id,
        ...run,
    };
}

async function waitTurn(marker: string) {
    const started = Date.now();
    while (Date.now() - started < HARVEST_DEADLINE_MS) {
        const path = newestTranscript();
        const run = path && readTurn(path, marker);
        if (run) return { path, run };
        await sleep(POLL_MS);
    }
    log('session: no turn end within 15 min');
}

async function harvestSession(wake: Wake, arm: Arm) {
    const turn = await waitTurn(`crow wake ${wake.id}`);
    if (!turn)
        return appendNoteOnce(
            NOTES_PATH,
            noteOf(wake, arm, 'session', TIMEOUT),
        );
    // a relayed wake lands after a /clear in a transcript born after the wake keyed its leaves
    const state = readState();
    if (state.leavesFor !== turn.path)
        writeState({ ...state, leavesFor: turn.path });
    appendNoteOnce(NOTES_PATH, noteOf(wake, arm, 'session', turn.run));
    log(`session: note logged (${turn.run.seconds} s)`);
}

async function harvestReconcile(noteId: string, evidence: string, arm: Arm) {
    // a timeout logs no row, so the line can be sent again; harvest.log has the miss
    const turn = await waitTurn(reconcileMarker(noteId));
    if (!turn) return;
    appendNoteOnce(NOTES_PATH, {
        arm,
        at: new Date().toISOString(),
        channel: 'reconcile',
        evidence,
        id: `${noteId}-reconcile`,
        reconciles: noteId,
        ...turn.run,
    });
    log(`reconcile: answer logged (${turn.run.seconds} s)`);
}

async function harvestOneShot(wake: Wake, arm: Arm) {
    const prompt = `${readCharter()}\n\nskip the boot section; this is a one-shot run. the wake line:\n${wakeLine(wake)}`;
    const oneShot = await runOneShot(claudeArgs(arm), prompt, STATE_DIR);
    if ('error' in oneShot) return log(`one-shot ${arm}: ${oneShot.error}`);
    const run = oneShot.result;
    let model: string | null = null;
    try {
        model = oneShotModel(STATE_DIR, run.session_id ?? '');
    } catch {
        log(`one-shot ${arm}: transcript unreadable, model left null`);
    }
    appendJsonl(
        NOTES_PATH,
        noteOf(wake, arm, 'one-shot', {
            model,
            note: String(run.result ?? '').trim() || 'none',
            seconds: Math.round((run.duration_ms ?? 0) / 1000),
            tokensIn: tokensIn(run.usage ?? {}),
            tokensOut: run.usage?.output_tokens ?? 0,
        }),
    );
    log(`one-shot ${arm}: note logged`);
}

const sessionArm = readState().arm;
if (wakeId === 'reconcile' && mode && phaseArg !== undefined && sessionArm) {
    await harvestReconcile(mode, phaseArg, sessionArm).catch((error: unknown) =>
        log(
            `crashed: ${error instanceof Error ? error.message : String(error)}`,
        ),
    );
    process.exit(0);
}
if (
    !wakeId ||
    !isMode(mode) ||
    (phaseArg !== 'silent' && phaseArg !== 'live') ||
    !sessionArm
) {
    log(`bad args or no arm in state: ${process.argv.slice(2).join(' ')}`);
    process.exit(2);
}
const wake: Wake = { id: wakeId, mode, phase: phaseArg };
const otherArm = armList.find((arm) => arm !== sessionArm) ?? sessionArm;

await Promise.all([
    harvestSession(wake, sessionArm),
    wake.phase === 'silent' ? harvestOneShot(wake, otherArm) : undefined,
]).catch((error: unknown) =>
    log(`crashed: ${error instanceof Error ? error.message : String(error)}`),
);

/* Types */
