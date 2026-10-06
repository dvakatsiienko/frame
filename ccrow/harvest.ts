import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import {
    type Arm,
    NOTES_PATH,
    type Note,
    STATE_DIR,
    type Usage,
    type Wake,
    appendJsonl,
    armList,
    claudeArgs,
    findSession,
    isMode,
    oneShotModel,
    parseEntry,
    readCharter,
    readLines,
    readState,
    runOneShot,
    tokensIn,
    transcriptPathOf,
    wakeLine,
} from './lib.ts';

// spawned detached by wake.ts, stdio ignored: every outcome goes to harvest.log
const DEADLINE_MS = 15 * 60_000;
const POLL_MS = 5_000;
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

function readTurn(path: string, marker: string): Run | undefined {
    const entries = readLines(path).flatMap((line) => parseEntry(line) ?? []);
    const start = entries.findIndex(
        (entry) =>
            entry.type === 'user' &&
            JSON.stringify(entry.message?.content ?? '').includes(marker),
    );
    if (start === -1) return;
    const end = entries.findIndex(
        (entry, index) =>
            index > start &&
            entry.type === 'system' &&
            entry.subtype === 'turn_duration',
    );
    if (end === -1) return;
    const usageById = new Map<string, Usage>();
    let model: string | null = null;
    let note = '';
    for (const entry of entries.slice(start + 1, end)) {
        if (entry.type !== 'assistant' || !entry.message) continue;
        model = entry.message.model ?? model;
        usageById.set(entry.message.id ?? '', entry.message.usage ?? {});
        const content = entry.message.content;
        for (const block of typeof content === 'string'
            ? []
            : (content ?? [])) {
            if (block.type === 'text' && block.text?.trim())
                note = block.text.trim();
        }
    }
    const usages = [...usageById.values()];
    return {
        model,
        note: note || 'none',
        seconds: Math.round((entries[end]?.durationMs ?? 0) / 1000),
        tokensIn: usages.reduce((sum, usage) => sum + tokensIn(usage), 0),
        tokensOut: usages.reduce(
            (sum, usage) => sum + (usage.output_tokens ?? 0),
            0,
        ),
    };
}

async function harvestSession(wake: Wake, arm: Arm) {
    const session = findSession();
    if (!session) return log('session: ccrow gone before its turn');
    const path = transcriptPathOf(session.cwd, session.sessionId);
    const started = Date.now();
    while (Date.now() - started < DEADLINE_MS) {
        const run = readTurn(path, `ccrow wake ${wake.id}`);
        if (run) {
            appendJsonl(NOTES_PATH, noteOf(wake, arm, 'session', run));
            return log(`session: note logged (${run.seconds} s)`);
        }
        await sleep(POLL_MS);
    }
    log('session: no turn end within 15 min');
    appendJsonl(
        NOTES_PATH,
        noteOf(wake, arm, 'session', {
            model: null,
            note: 'timeout: no turn end within 15 min',
            seconds: DEADLINE_MS / 1000,
            tokensIn: 0,
            tokensOut: 0,
        }),
    );
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

interface Run {
    model: string | null;
    note: string;
    seconds: number;
    tokensIn: number;
    tokensOut: number;
}
