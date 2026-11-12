import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { LiveThread } from '../lib.ts';

// a fake `x` in <home>/bin that answers `x thread list` with these records, so a test never reads the live fleet
export function plantThreads(home: string, threads: LiveThread[]) {
    mkdirSync(join(home, 'bin'), { recursive: true });
    writeFileSync(
        join(home, 'threads.fake.json'),
        JSON.stringify({ data: { threads } }),
    );
    writeFileSync(
        join(home, 'bin/x'),
        '#!/bin/sh\ncat "$HOME/threads.fake.json"\n',
    );
    chmodSync(join(home, 'bin/x'), 0o755);
}

export const CROW_RECORD: LiveThread = {
    role: 'adviser',
    sessionId: 'crow-1',
};
