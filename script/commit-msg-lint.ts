// commit-msg hook: the x:cmt format, refused before the commit lands; the rules live in lib/commit-msg-lint.ts
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { commitMsgLint } from './lib/commit-msg-lint.ts';

if (merging()) process.exit(0);

const { errors, warnings } = commitMsgLint(
    readFileSync(process.argv[2] ?? '', 'utf8'),
);
for (const line of warnings) console.log(`commit-msg: ⚠️ ${line}`);
for (const line of errors) console.log(`commit-msg: 🚫 ${line}`);
if (errors.length) process.exit(1);

function merging() {
    try {
        execFileSync('git', ['rev-parse', '-q', '--verify', 'MERGE_HEAD'], {
            stdio: 'ignore',
        });
        return true;
    } catch {
        return false;
    }
}
