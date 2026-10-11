// the one list of trials (o139): each docs/test-drive file's own status and until, grouped, live ones by date
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const dir = path.resolve(import.meta.dirname, '../docs/test-drive');
const ORDER = [
    'live',
    'frozen',
    'unsorted',
    'parked',
    'adopted',
    'dropped',
    'closed',
];

const drives = readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
        const head =
            readFileSync(path.join(dir, f), 'utf8').match(
                /^---\n([\s\S]*?)\n---/,
            )?.[1] ?? '';
        const field = (k: string) =>
            head.match(new RegExp(`^${k}: (.*)$`, 'm'))?.[1] ?? '';
        return {
            name: f.slice(0, -3),
            status: field('status') || 'missing',
            until: field('until'),
        };
    });

const groups = [...ORDER, 'missing'];
for (const status of groups) {
    const rows = drives
        .filter((d) => d.status === status)
        .sort((a, b) => a.until.localeCompare(b.until));
    if (!rows.length) continue;
    console.log(`\n${status} (${rows.length})`);
    for (const d of rows) console.log(`  ${d.name.padEnd(24)} ${d.until}`);
}
if (drives.some((d) => !groups.slice(0, -1).includes(d.status)))
    process.exitCode = 1;
