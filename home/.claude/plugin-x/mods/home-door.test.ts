import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// FRM-470: x-mod-guard lets a hook run under `HOME=$(mktemp -d)`; this is the other half: such a run reaches only that dir. It
// checks the probe's own path, not a listing of the state dir, which other sessions write all day
it('a hook under a made-up HOME writes there and not into the real ~/.local/state', () => {
    const probe = `home-door-probe-${process.pid}`;
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
    expect(existsSync(join(homedir(), '.local/state/x', probe))).toBe(false);
});
