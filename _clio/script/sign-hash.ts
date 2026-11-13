// usage: node script/sign-hash.ts <FRM-N>
// the body hash a sign line carries beside x's hash of the live body; x's sign reader is the one truth (FRM-598)

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { aboveSigned, xSignHash } from './ticket-sign.ts';

const id = process.argv[2];
if (!id) {
    console.error('usage: node script/sign-hash.ts <FRM-N>');
    process.exit(2);
}
const file = join(mkdtempSync(join(tmpdir(), 'sign-')), 'body.md');
execFileSync('x', ['linear', 'body', '--to', file, id], { stdio: 'ignore' });
const body = readFileSync(file, 'utf8');
if (!/^## signed\s*$/m.test(body)) {
    console.error(`${id}: no ## signed heading`);
    process.exit(1);
}
const above = aboveSigned(body);
const block = body.slice(above.length).split(/^## (?!signed)/m)[0] ?? '';
const stored = [...block.matchAll(/· body ([0-9a-f]{8})\s*$/gm)].at(-1)?.[1];
const now = xSignHash(id, above);
// no verdict here: x also accepts the legacy stamp form, so match or drifted is `x linear list`'s `.sign` alone
console.log(`${id} x ${now} stored ${stored ?? 'none'}`);
