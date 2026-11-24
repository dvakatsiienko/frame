// pre-commit (FRM-686): the crew skills and rules, read whole, against the messaging contract's one table; it runs in the
// index copy, so it reads what the commit holds, the table's own edit included
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    CONTRACT_HOME,
    contractRefusals,
    isContractFile,
} from './lib/crew-contract.ts';

const { MESSAGE_KINDS } = (await import(resolve(CONTRACT_HOME))) as {
    MESSAGE_KINDS: readonly { isTag?: true; kind: string }[];
};
const tags = MESSAGE_KINDS.flatMap((row) => (row.isTag ? [row.kind] : []));
const refusals = execFileSync('git', ['ls-files', '-z', 'home/.claude'], {
    encoding: 'utf8',
    maxBuffer: 1 << 24,
})
    .split('\0')
    .filter(isContractFile)
    .flatMap((path) =>
        contractRefusals(path, readFileSync(path, 'utf8'), tags),
    );
for (const { line, path, reason, text } of refusals)
    console.error(
        `${path}:${line} — ${reason}\n  ${text.trim().slice(0, 160)}`,
    );
if (refusals.length) {
    console.error(
        `crew-contract: a member sends only ${tags.map((t) => `[${t}]`).join(', ')}, never a receipt or a step line; the table is MESSAGE_KINDS in ${CONTRACT_HOME}`,
    );
    process.exit(1);
}
