// pre-commit (FRM-314): a hazard line the commit adds or rewords carries `guard:`; `guard: none` names its ticket
import { execFileSync } from 'node:child_process';

import { addedLines, hazardRefusals } from './lib/fleet-hazards-check.ts';

const git = (...args: string[]) =>
    execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 24 });

// the same glob lefthook fires on, so a new fleet-hazards-<x>.md is checked the day it lands
const staged = git(
    'diff',
    '--cached',
    '--name-only',
    '--diff-filter=AM',
    '--',
    'home/.claude/rules/fleet-hazards*.md',
)
    .split('\n')
    .filter(Boolean);

let refused = false;
for (const path of staged) {
    const diff = git('diff', '--cached', '-U0', '--no-color', '--', path);
    if (!diff) continue;
    const refusals = hazardRefusals(git('show', `:${path}`), addedLines(diff));
    for (const { line, reason, text } of refusals) {
        console.error(`${path}:${line} — ${reason}\n  ${text.slice(0, 120)}`);
    }
    if (refusals.length) refused = true;
}
if (refused) {
    console.error(
        'fleet-hazards: every hazard names its guard — `guard: <hook | x verb>`, or `guard: none · FRM-N` as tracked debt',
    );
    process.exit(1);
}
