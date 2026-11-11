import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
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
// `x linear read <id>` answers the ticket's current body from current-<id>.md (current-<id>.null: a null body; neither: exit
// 1); a body set says `set <id>` and keeps what it was sent in sent.md
writeFileSync(
    join(bin, 'x'),
    `#!/bin/sh
if [ "$2" = read ]; then
  [ -f "${dir}/current-$3.null" ] && { jq -n '{data: {tickets: [{description: null}]}}'; exit 0; }
  [ -f "${dir}/current-$3.md" ] || exit 1
  jq -n --rawfile d "${dir}/current-$3.md" '{data: {tickets: [{description: $d}]}}'
else
  f=; p=
  for a in "$@"; do [ "$p" = --set ] && f=$a; case $a in --set=*) f=\${a#--set=};; esac; p=$a; done
  cat "$f" > "${dir}/sent.md"
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
    current: string | null | undefined,
    file: string,
    shell: string,
    name = 'b.md',
) {
    const id = 'FRM-1';
    for (const f of [`current-${id}.md`, `current-${id}.null`, 'sent.md'])
        rmSync(join(dir, f), { force: true });
    if (current === null) writeFileSync(join(dir, `current-${id}.null`), '');
    else if (current !== undefined)
        writeFileSync(join(dir, `current-${id}.md`), current);
    writeFileSync(join(dir, name), file);
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
                TMPDIR: dir,
                ZDOTDIR: dir,
            },
            timeout: 10_000,
        },
    );
    const sent = join(dir, 'sent.md');
    return {
        code: r.status,
        err: r.stderr,
        out: r.stdout.trim(),
        sent: existsSync(sent) ? readFileSync(sent, 'utf8') : undefined,
    };
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
        ['a ticket linear gives a null body', null, '## wish\n\n* W1 x\n'],
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

    // wisphunter and security on 6c6c57cf: the set sends the copy the check judged, whatever its name or source
    it('judges a file named like an awk assignment, and refuses its new sign', () => {
        const set = 'x linear body FRM-1 --set b=1.md';
        const signed = `${SIGNED}✍️ signed 2026-11-12 · body 2\n`;
        expect([
            run(set, SIGNED, SIGNED, shell, 'b=1.md').code,
            run(set, SIGNED, signed, shell, 'b=1.md').code,
        ]).toEqual([0, 1]);
    });

    it('sends what it judged when the body comes on stdin', () => {
        const piped = 'cat $PWD/b.md | x linear body FRM-1 --set /dev/stdin';
        const r = run(piped, SIGNED, `${SIGNED}✏️ tiny\n`, shell);
        expect([r.code, r.sent]).toEqual([0, `${SIGNED}✏️ tiny\n`]);
    });

    // sixth sense's watcher race (dima's o43): a process that appends a sign line to the judged copy after the check and
    // before the send; a stub awk plays the watcher, judging first, then writing to every copy the check made
    it.runIf(shell === 'bash')(
        'sends the bytes it judged, whatever a watcher writes after the check',
        () => {
            writeFileSync(
                join(bin, 'awk'),
                `#!/bin/sh\n/usr/bin/awk "$@"; rc=$?\nfor c in "\${TMPDIR:-/tmp}"/x-mod-guard-sign.* "${dir}"/b.md; do [ -f "$c" ] && printf '✍️ signed 2026-11-12 · body 2\\n' >> "$c"; done\nexit $rc\n`,
            );
            chmodSync(join(bin, 'awk'), 0o755);
            try {
                const r = run(SET, SIGNED, SIGNED, shell);
                expect([r.code, r.sent]).toEqual([0, SIGNED]);
            } finally {
                rmSync(join(bin, 'awk'), { force: true });
            }
        },
    );

    it.each([
        [
            'a second --set',
            'x linear body FRM-1 --set $PWD/b.md --set $PWD/c.md',
        ],
        [
            'an id that is not the first word',
            'x linear body --set=$PWD/b.md FRM-1',
        ],
    ])('refuses %s', (_why, line) => {
        writeFileSync(join(dir, 'c.md'), SIGNED);
        expect(run(line, SIGNED, SIGNED, shell)).toMatchObject({
            code: 1,
            out: '',
        });
    });
});
