import { execFile } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { PopToRootType, showHUD } from '@raycast/api';

import { claudeBin, kickArgs } from './lib/kick';

const run = promisify(execFile);

// An empty dir, so no project's CLAUDE.md, hooks or mods ride the one-word call.
const FiveHKick = async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kick-5h-'));
    try {
        await run(claudeBin, kickArgs, { cwd: dir, timeout: 120_000 });
        await showHUD('5h window kicked · resets in 5 h', {
            popToRootType: PopToRootType.Immediate,
        });
    } catch (error) {
        await showHUD(`5h kick failed: ${(error as Error).message}`, {
            popToRootType: PopToRootType.Immediate,
        });
    }
};

export default FiveHKick;
