import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import {
    NOTES_PATH,
    type OneShotResult,
    type PlanReview,
    STATE_DIR,
    appendJsonl,
    armModels,
    armOfDay,
    blindPrompt,
    blindSections,
    claudeArgs,
    dayOf,
    fail,
    oneShotModel,
    planNotes,
    planPrompt,
    planSchema,
    readState,
    runOneShot,
    tokensIn,
    wakeIdOf,
} from './lib.ts';

const usage = `ccrow:plan-critique <plan file>

  a fresh claude -p review of one plan, on the day's arm at effort high: pass 1 sees only the
  want / constraints / done test sections, pass 2 the whole plan on the fixed template. each
  finding is one line in ${NOTES_PATH}; the full review lands in ${STATE_DIR}/plans/<run>/.`;

const [planArg, ...rest] = process.argv.slice(2);
if (planArg === '-h' || planArg === '--help') {
    console.log(usage);
    process.exit(0);
}
if (!planArg || rest.length > 0) fail(usage);

const planPath = resolve(planArg);
let planText: string;
try {
    planText = readFileSync(planPath, 'utf8');
} catch {
    fail(`cannot read plan: ${planPath}`);
}
if (!planText.trim()) fail(`plan is empty: ${planPath}`);

const now = new Date();
const arm = armOfDay(
    dayOf(readState().firstWakeAt ?? now.getTime(), now.getTime()),
);
const effort = 'high';
const id = `${wakeIdOf(now)}${String(now.getSeconds()).padStart(2, '0')}`;
const runDir = `${STATE_DIR}/plans/${id}`;
mkdirSync(runDir, { recursive: true });
// no tools: a one-shot that can read would reach cclio's transcripts and the earlier verdicts
const args = [
    ...claudeArgs(arm, '', effort),
    '--tools',
    '',
    '-n',
    `🐦‍⬛ critic: ${basename(planPath)}`,
];
const passes: OneShotResult[] = [];

const sections = blindSections(planText);
let blindTake = '';
if (sections) {
    const blind = await runOneShot(args, blindPrompt(sections), runDir);
    if ('error' in blind) fail(`pass 1: ${blind.error}`);
    passes.push(blind.result);
    blindTake = String(blind.result.result ?? '').trim();
    writeFileSync(`${runDir}/blind.md`, `${blindTake}\n`);
} else {
    console.log(
        'pass 1 skipped: no want / constraints / done test heading in the plan',
    );
}

const full = await runOneShot(
    [...args, '--json-schema', JSON.stringify(planSchema)],
    planPrompt(planText, blindTake),
    runDir,
);
if ('error' in full) fail(`pass 2: ${full.error}`);
passes.push(full.result);
const review: PlanReview | undefined = full.result.structured_output;
if (!review)
    fail(
        `pass 2 returned no structured output: ${String(full.result.result).slice(0, 200)}`,
    );
writeFileSync(`${runDir}/review.json`, `${JSON.stringify(review, null, 4)}\n`);

let model: string | null = null;
try {
    model = oneShotModel(runDir, full.result.session_id ?? '');
} catch {
    console.log(`model left null: no transcript for ${full.result.session_id}`);
}

const notes = planNotes(
    {
        arm,
        at: now.toISOString(),
        costUsd: passes.reduce(
            (sum, pass) => sum + (pass.total_cost_usd ?? 0),
            0,
        ),
        effort,
        model,
        plan: planPath,
        planText,
        runId: id,
        seconds: Math.round(
            passes.reduce((sum, pass) => sum + (pass.duration_ms ?? 0), 0) /
                1000,
        ),
        tokensIn: passes.reduce(
            (sum, pass) => sum + tokensIn(pass.usage ?? {}),
            0,
        ),
        tokensOut: passes.reduce(
            (sum, pass) => sum + (pass.usage?.output_tokens ?? 0),
            0,
        ),
    },
    review,
);
for (const note of notes) appendJsonl(NOTES_PATH, note);

const head = notes[0];
console.log(
    `plan ${id} on ${arm} (${model ?? armModels[arm]}): ${review.verdict}${review.noMaterialObjection ? ', no material objection' : ''} — ${review.findings.length} findings, $${head?.costUsd.toFixed(2)}, ${head?.seconds} s`,
);
for (const note of notes) {
    if (!note.finding) continue;
    const where = note.finding.located ? '' : ' (quote not found in the plan)';
    console.log(
        `- ${note.id} [${note.finding.severity}]${where} «${note.finding.quote}» — ${note.finding.problem} · test: ${note.finding.test}`,
    );
}
console.log(
    `review: ${runDir}/review.json · vet: pnpm ccrow:note-vet ok|miss <id> <why>`,
);
