import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { withSignCheck } from './x-mod-guard/hooks/rules/sign-check.ts';

// x-mod-guard's run-time sign check, run by a real shell against a stub `x`: the guard's own tests can only see the
// rewrite, never what the check decides once the body file is final
const dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'sign-check-'));
afterAll(() => rmSync(dir, { force: true, recursive: true }));
const bin = join(dir, 'bin');
mkdirSync(bin);
// `x linear read <id>` answers the ticket's current body from current-<id>.md (no file: exit 1); a body set says `set <id>`
writeFileSync(
    join(bin, 'x'),
    `#!/bin/sh
if [ "$2" = read ]; then
  [ -f "${dir}/current-$3.md" ] || exit 1
  jq -n --rawfile d "${dir}/current-$3.md" '{data: {tickets: [{description: $d}]}}'
else
  echo "set $3"
fi
`,
);
chmodSync(join(bin, 'x'), 0o755);

const SIGNED =
    '## wish\n\n* W1 (2026-11-11, dima): x\n\n## signed\n\n✍️ signed 2026-11-11 · body 5a0d10c0\n';
const GRANTED = `${SIGNED}merge: pre-approved\n🚫 cancelled 2026-11-11 — the merge waits for his word\n`;

// the Bash tool's shell is zsh; ci's check job has bash alone, so every row runs under each shell the runner has
const SHELLS = [
    'bash',
    ...(existsSync('/bin/zsh') || existsSync('/usr/bin/zsh') ? ['zsh'] : []),
];
function run(
    line: string,
    current: string | undefined,
    file: string,
    shell: string,
) {
    const id = 'FRM-1';
    rmSync(join(dir, `current-${id}.md`), { force: true });
    if (current !== undefined)
        writeFileSync(join(dir, `current-${id}.md`), current);
    writeFileSync(join(dir, 'b.md'), file);
    const wrapped = withSignCheck(line, new Set([id]));
    if (!wrapped) throw new Error(`no check put in front of: ${line}`);
    // no startup file: ~/.zshenv puts ~/.local/bin ahead of the stub, and the real x would read and write real tickets
    const r = spawnSync(
        shell,
        shell === 'zsh' ? ['-f', '-c', wrapped] : ['-c', wrapped],
        {
            cwd: dir,
            encoding: 'utf8',
            env: {
                BASH_ENV: '',
                HOME: dir,
                PATH: `${bin}:/usr/bin:/bin:/opt/homebrew/bin`,
                ZDOTDIR: dir,
            },
            timeout: 10_000,
        },
    );
    return { code: r.status, err: r.stderr, out: r.stdout.trim() };
}

const SET = `x linear body FRM-1 --set ${join('$PWD', 'b.md')}`;

describe.each(SHELLS)('the run-time sign check under %s', (shell) => {
    it.each([
        [
            'a tiny edit keeping the sign line',
            SIGNED,
            `${SIGNED}✏️ changed 2026-11-11 — no re-sign: tiny\n`,
        ],
        ['an unsigned ticket with an empty body', '', '## wish\n\n* W1 x\n'],
        [
            'a «re-sign pending» line, which is no sign',
            SIGNED,
            `${SIGNED}✍️ re-sign pending 2026-11-11\n`,
        ],
    ])('runs the set: %s', (_why, current, file) => {
        expect(run(SET, current, file, shell)).toMatchObject({
            code: 0,
            out: 'set FRM-1',
        });
    });

    it.each([
        [
            'a sign line the body lacks',
            '## wish\n\n* W1 x\n',
            `## wish\n\n* W1 x\n\n## signed\n\n✍️ signed 2026-11-11 · body 1\n`,
        ],
        [
            "a changed sign line's text",
            SIGNED,
            SIGNED.replace('5a0d10c0', '99999999'),
        ],
        [
            'a cancel removed under a merge grant',
            GRANTED,
            GRANTED.replace(/🚫.*\n/u, ''),
        ],
        ['a body linear cannot read', undefined, SIGNED],
    ])('refuses the set: %s', (_why, current, file) => {
        const r = run(SET, current, file, shell);
        expect([r.code, r.out, r.err]).toEqual([
            1,
            '',
            expect.stringContaining('sign FRM-1'),
        ]);
    });

    it('reads the id and the file the shell fills in, and the --set= form', () => {
        const loop =
            'for t in FRM-1; do x linear body $t --set=$PWD/b.md; done';
        expect([
            run(loop, SIGNED, SIGNED, shell).out,
            run(loop, SIGNED, `${SIGNED}✍️ signed 2026-11-12 · body 2\n`, shell)
                .code,
        ]).toEqual(['set FRM-1', 1]);
    });
});
