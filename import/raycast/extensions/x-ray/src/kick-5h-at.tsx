import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { userInfo } from 'node:os';
import { promisify } from 'node:util';
import { type LaunchProps, PopToRootType, showHUD } from '@raycast/api';

import {
    logDir,
    nextAt,
    onceLabel,
    oncePlist,
    oncePlistXml,
    wakeStamp,
} from './lib/kick';

const run = promisify(execFile);

const hud = (text: string) =>
    showHUD(text, { popToRootType: PopToRootType.Immediate });

const FiveHKickAt = async ({ arguments: { time } }: Props) => {
    const at = nextAt(time, new Date());
    if (!at) {
        await hud(`5h kick: «${time}» is not HH:MM`);
        return;
    }
    const domain = `gui/${userInfo().uid}`;
    await mkdir(logDir, { recursive: true });
    await writeFile(oncePlist, oncePlistXml(at));
    // a kick already set is replaced: bootout fails when none is loaded, and that is fine
    await run('launchctl', ['bootout', `${domain}/${onceLabel}`]).catch(
        () => undefined,
    );
    await run('launchctl', ['bootstrap', domain, oncePlist]);
    const hhmm = at.toTimeString().slice(0, 5);
    // pmset needs root, so macOS asks dima for his password; a cancel keeps the kick, unwoken
    const wake = `pmset schedule wake "${wakeStamp(at)}"`;
    const isWoken = await run('osascript', [
        '-e',
        `do shell script ${JSON.stringify(wake)} with administrator privileges`,
    ])
        .then(() => true)
        .catch(() => false);
    await hud(
        isWoken
            ? `5h kick at ${hhmm} · the mac wakes a minute before`
            : `5h kick at ${hhmm} · no wake set, the mac must be awake`,
    );
};

export default FiveHKickAt;

/* Types */
type Props = LaunchProps<{ arguments: { time: string } }>;
