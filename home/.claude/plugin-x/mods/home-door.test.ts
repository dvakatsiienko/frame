import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// FRM-470: x-mod-guard lets a hook run under `HOME=$(mktemp -d)`; this is the other half: such a run reaches only that dir. Only
// the two top levels are listed, since other sessions write below them all day.
const STATE = join(homedir(), '.local', 'state');
const listing = () =>
    [STATE, join(STATE, 'x')]
        .map((d) => (existsSync(d) ? readdirSync(d).sort().join('\n') : ''))
        .join('\n--\n');

it('a hook under a made-up HOME leaves the real ~/.local/state alone', () => {
    const probe = `home-door-probe-${process.pid}`;
    const before = listing();
    const out = execFileSync(
        'sh',
        [
            '-c',
            `H=$(mktemp -d) && HOME=$H node -e "const { mkdirSync, writeFileSync } = require('node:fs'); const { homedir } = require('node:os'); const d = homedir() + '/.local/state/x/' + process.argv[1]; mkdirSync(d, { recursive: true }); writeFileSync(d + '/f', 'x'); console.log(d)" ${probe}; echo "$H"`,
        ],
        { encoding: 'utf8' },
    )
        .trim()
        .split('\n');
    const [written = '', made = ''] = out;
    expect(written.startsWith(made)).toBe(true);
    expect(existsSync(written)).toBe(true);
    expect(existsSync(join(STATE, 'x', probe))).toBe(false);
    expect(listing()).toBe(before);
});
