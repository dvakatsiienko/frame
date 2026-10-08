import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';

// A bare one-word call opens the 5h usage window. Never `--bare`: it skips the subscription login.
export const claudeBin = join(homedir(), '.local', 'bin', 'claude');
export const kickArgs = [
    '-p',
    '--model',
    'haiku',
    '--tools',
    '',
    '--setting-sources',
    '',
    '--strict-mcp-config',
    '--no-session-persistence',
    '--system-prompt',
    'Reply ok.',
    'ok',
];

export const onceLabel = 'com.dima.kick-5h-once';
export const oncePlist = join(
    homedir(),
    'Library',
    'LaunchAgents',
    `${onceLabel}.plist`,
);
export const logDir = join(homedir(), '.local', 'share', 'kick-5h');

// `HH:MM` as the next time the clock shows it: today while it is still ahead, else tomorrow
export const nextAt = (hhmm: string, now: Date) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
    const hour = Number(match?.[1]);
    const minute = Number(match?.[2]);
    if (!match || hour > 23 || minute > 59) return undefined;
    const at = new Date(now);
    at.setHours(hour, minute, 0, 0);
    if (at <= now) at.setDate(at.getDate() + 1);
    return at;
};

// pmset's `MM/dd/yy HH:mm:ss`, one minute before the kick so the mac is awake when launchd fires
export const wakeStamp = (at: Date) => {
    const wake = new Date(at.getTime() - 60_000);
    const two = (n: number) => String(n).padStart(2, '0');
    return `${two(wake.getMonth() + 1)}/${two(wake.getDate())}/${two(wake.getFullYear() % 100)} ${two(wake.getHours())}:${two(wake.getMinutes())}:00`;
};

const quote = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`;

// The job runs the kick once from an empty dir, trashes its own plist so a login never reloads it,
// then boots itself out — last, because the bootout ends this very shell.
export const oncePlistXml = (at: Date) => {
    const script = [
        `cd "$(mktemp -d)"`,
        [claudeBin, ...kickArgs].map(quote).join(' '),
        `/usr/bin/trash ${quote(oncePlist)}`,
        `launchctl bootout gui/${userInfo().uid}/${onceLabel}`,
    ].join('; ');
    const xml = (s: string) =>
        s
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;');
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- ⏱️ opens the claude 5h usage window once, at a time picked in raycast («5h kick at»), then removes itself -->
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${onceLabel}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/sh</string>
        <string>-c</string>
        <string>${xml(script)}</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>${at.getHours()}</integer>
        <key>Minute</key>
        <integer>${at.getMinutes()}</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>${join(logDir, 'out.log')}</string>
    <key>StandardErrorPath</key>
    <string>${join(logDir, 'err.log')}</string>
</dict>
</plist>
`;
};
