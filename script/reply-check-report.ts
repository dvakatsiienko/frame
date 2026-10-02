/**
 * reply-check:report — counts what the reply-check Stop hook logged, per rule, over the last N days
 * (default 7). a rule near the top is one to fix at its root, not one to start blocking on.
 *   pnpm reply-check:report [--days N]
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
    options: { days: { default: '7', type: 'string' } },
});
const days = Number(values.days);
const log =
    process.env.REPLY_CHECK_LOG ??
    join(homedir(), '.local/state/reply-check.tsv');

if (!existsSync(log)) {
    console.log('reply-check: nothing logged yet');
    process.exit(0);
}

const since = Date.now() - days * 86_400_000;
const rows = readFileSync(log, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'))
    .filter(([stamp]) => Date.parse(stamp ?? '') >= since);

const byRule = new Map<
    string,
    { count: number; replies: Set<string>; sample: string }
>();
for (const [stamp = '', session = '', , rule = '', snippet = ''] of rows) {
    const entry = byRule.get(rule) ?? {
        count: 0,
        replies: new Set(),
        sample: snippet,
    };
    entry.count += 1;
    entry.replies.add(`${session}${stamp}`);
    byRule.set(rule, entry);
}

console.log(`reply-check — last ${days} d, ${rows.length} findings`);
for (const [rule, { count, replies, sample }] of [...byRule].sort(
    (a, b) => b[1].count - a[1].count,
))
    console.log(
        `  ${rule.padEnd(15)} ${String(count).padStart(4)} in ${replies.size} replies · e.g. ${sample}`,
    );
