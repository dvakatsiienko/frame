// usage: node script/ticket-sign.ts <FRM-N|BYT-N> signed|re-signed|changed ['<what changed>']
// pulls the body fresh (`x linear body <id> --json`), stamps it with its `## signed` line and hash, then prints the write. it never writes
// linear itself: the write stays a visible `x linear body --set`, the call x-mod-guard's sign door reads for his tick

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const HEADING = '## signed';

export function stampBody(
    body: string,
    kind: string,
    what: string,
    today: string,
) {
    const split = body.indexOf(`\n${HEADING}`);
    const above =
        split === -1 ? `${body.trimEnd()}\n\n` : body.slice(0, split + 1);
    const hash = createHash('sha256').update(above).digest('hex').slice(0, 8);
    const line =
        kind === 'signed'
            ? `✍️ signed ${today} · body ${hash}`
            : kind === 're-signed'
              ? `✍️ re-signed ${today} — ${what} · body ${hash}`
              : `✏️ changed ${today} — ${what}, no re-sign: tiny · body ${hash}`;
    const signed =
        split === -1 ? `${HEADING}\n` : body.slice(split + 1).trimEnd();
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
    const pull = JSON.parse(
        execFileSync('x', ['linear', 'body', id, '--json'], {
            encoding: 'utf8',
        }),
    ) as { data: { file: string } };
    const file = pull.data.file;
    const today = new Date().toLocaleDateString('sv');
    writeFileSync(
        file,
        stampBody(readFileSync(file, 'utf8'), kind ?? '', what, today),
    );
    console.log(`x linear body ${id} --set ${file}`);
    return 0;
}

if (import.meta.main) process.exitCode = main();
