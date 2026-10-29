import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { NOTES_PATH, STATE_DIR, VERDICTS_PATH } from './lib.ts';

// clio's Stop hook: a note crow sent with no verdict blocks the turn end once, naming the vet command;
// green and held notes reach clio as nothing to answer, so only a 🔴 sent one needs a verdict
const FLAGGED_PATH = join(STATE_DIR, 'unvetted-flagged.txt');

function jsonl(path: string): Array<Record<string, unknown>> {
    if (!existsSync(path)) return [];
    return readFileSync(path, 'utf8')
        .split('\n')
        .flatMap((line) => {
            try {
                return [JSON.parse(line)];
            } catch {
                return [];
            }
        });
}

const vetted = new Set(jsonl(VERDICTS_PATH).map((v) => v.id));
const flagged = new Set(
    existsSync(FLAGGED_PATH)
        ? readFileSync(FLAGGED_PATH, 'utf8').split('\n').filter(Boolean)
        : [],
);
const open = jsonl(NOTES_PATH)
    .filter((n) =>
        String(n.note ?? '')
            .split('\n')[1]
            ?.startsWith('🔴 sent'),
    )
    .map((n) => String(n.id))
    .filter((id) => !vetted.has(id) && !flagged.has(id));

if (open.length > 0) {
    writeFileSync(FLAGGED_PATH, `${[...flagged, ...open].join('\n')}\n`);
    console.log(
        JSON.stringify({
            decision: 'block',
            reason: `crow sent ${open.length === 1 ? 'a note' : 'notes'} with no verdict: ${open.join(', ')}. vet each with \`pnpm -C ~/frame crow:note-vet ok|miss <id> <why>\` — every one is counted; dima already sees the reply above, so print nothing new unless the verdict changes it.`,
        }),
    );
}
