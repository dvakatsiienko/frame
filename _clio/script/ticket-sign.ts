// usage: node script/ticket-sign.ts <FRM-N|BYT-N> signed|re-signed|changed ['<what changed>']
// stamps the body `x linear body <id>` fetched with its `## signed` line and hash, then prints the write. it never writes
// linear itself: the write stays a visible `x linear body --set`, the call x-mod-guard's sign door reads for his tick

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const HEADING = '## signed';

// x is the one sign reader (FRM-598): the stamp carries the hash `x linear sign-check` prints, never a copy of its math
export function xSignHash(id: string, text: string) {
    const file = join(mkdtempSync(join(tmpdir(), 'sign-')), 'above.md');
    writeFileSync(file, text);
    const out = execFileSync(
        'x',
        ['linear', 'sign-check', id, '--body-file', file],
        { encoding: 'utf8' },
    );
    const hash: unknown = JSON.parse(out)?.data?.hash;
    if (typeof hash !== 'string' || !/^[0-9a-f]{8}$/.test(hash)) {
        throw new Error(
            `x linear sign-check printed no data.hash for ${id}: a stale x? run x once to rebuild it`,
        );
    }
    return hash;
}

// the text above the last ## signed heading, as x's sign reader cuts it
export function aboveSigned(body: string) {
    const split = body.lastIndexOf(`\n${HEADING}`);
    return split === -1 ? `${body.trimEnd()}\n\n` : body.slice(0, split + 1);
}

export function stampBody(
    body: string,
    kind: string,
    what: string,
    today: string,
    hashOf: (above: string) => string,
) {
    const above = aboveSigned(body);
    const hash = hashOf(above);
    const line =
        kind === 'signed'
            ? `✍️ signed ${today} · body ${hash}`
            : kind === 're-signed'
              ? `✍️ re-signed ${today} — ${what} · body ${hash}`
              : `✏️ changed ${today} — ${what}, no re-sign: tiny · body ${hash}`;
    const signed = body.includes(`\n${HEADING}`)
        ? body.slice(above.length).trimEnd()
        : `${HEADING}\n`;
    return `${above}${signed}\n${line}\n`;
}

function main([id, kind, what = ''] = process.argv.slice(2)) {
    const isKnown = ['signed', 're-signed', 'changed'].includes(kind ?? '');
    if (!id || !isKnown || (kind !== 'signed' && !what)) {
        console.error(
            "usage: node script/ticket-sign.ts <FRM-N|BYT-N> signed|re-signed|changed ['<what changed>']",
        );
        return 2;
    }
    // the same path `x linear body <id>` pulled to (its `.data.file`); a fresh pull here would drop the caller's edit
    const file = join(
        process.env.XDG_STATE_HOME ?? join(homedir(), '.local/state'),
        'x/linear/bodies',
        process.env.CLAUDE_CODE_SESSION_ID ?? '',
        `${id}.md`,
    );
    const today = new Date().toLocaleDateString('sv');
    writeFileSync(
        file,
        stampBody(
            readFileSync(file, 'utf8'),
            kind ?? '',
            what,
            today,
            (above) => xSignHash(id, above),
        ),
    );
    console.log(`x linear body ${id} --set ${file} --restamp-sign`);
    return 0;
}

if (import.meta.main) process.exitCode = main();
