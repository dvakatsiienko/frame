// the body hash a sign line carries, read back from linear and cut the way x/go/merge_sign.go's bodySign cuts it

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { unescaped } from './ticket-sign.ts';

const id = process.argv[2];
if (!id) {
    console.error('usage: node script/sign-hash.ts <FRM-N>');
    process.exit(2);
}
const file = join(mkdtempSync(join(tmpdir(), 'sign-')), 'body.md');
execFileSync('x', ['linear', 'body', '--to', file, id], { stdio: 'ignore' });
const body = readFileSync(file, 'utf8');
const headings = [...body.matchAll(/^## signed\s*$/gm)];
const last = headings.at(-1);
if (last?.index === undefined) {
    console.error(`${id}: no ## signed heading`);
    process.exit(1);
}
const above = body.slice(0, last.index);
const block = body.slice(last.index + last[0].length).split(/^## /m)[0] ?? '';
const stored = [...block.matchAll(/· body ([0-9a-f]{8})\s*$/gm)].at(-1)?.[1];
const hashOf = (text: string) =>
    createHash('sha256').update(text).digest('hex').slice(0, 8);
const now = hashOf(above);
// a sign holds on the raw body or on it with linear's escapes taken out, as bodySign reads it
const isMatch = stored === now || stored === hashOf(unescaped(above));
console.log(
    `${id} now ${now} stored ${stored ?? 'none'} ${isMatch ? 'match' : 'drifted'}`,
);
