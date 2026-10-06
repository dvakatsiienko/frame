// pre-commit (FRM-314): a hazard line the commit adds or rewords carries `guard:`; `guard: none` names its ticket
import { execFileSync } from 'node:child_process';

import { addedLines, hazardRefusals } from './lib/fleet-hazards-check.ts';

const PATH = 'home/.claude/rules/fleet-hazards.md';

const git = (...args: string[]) =>
    execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 24 });

const diff = git('diff', '--cached', '-U0', '--no-color', '--', PATH);
if (!diff) process.exit(0);

const refusals = hazardRefusals(git('show', `:${PATH}`), addedLines(diff));
for (const { line, reason, text } of refusals) {
    console.error(`${PATH}:${line} — ${reason}\n  ${text.slice(0, 120)}`);
}
if (refusals.length) {
    console.error(
        'fleet-hazards: every hazard names its guard — `guard: <hook | x verb>`, or `guard: none · FRM-N` as tracked debt',
    );
    process.exit(1);
}
