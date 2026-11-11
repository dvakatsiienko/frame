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
// rewrite, never what the check sends x and how it obeys x's word once the body file is final. the judge itself is
// x linear sign-check's, tested in x/go
const dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'sign-check-'));
afterAll(() => rmSync(dir, { force: true, recursive: true }));
const bin = join(dir, 'bin');
mkdirSync(bin);
// `x linear sign-check FRM-1 --body-file /dev/stdin` keeps what it judged in judged.md and counts a «body 2» sign line
// as new (exit 1); x-down: it cannot read the ticket (exit 1); watcher: a sign line lands in b.md right after the judging.
// a body set says `set <id>` and keeps what it was sent in sent.md
writeFileSync(
    join(bin, 'x'),
    `#!/bin/sh
if [ "$2" = sign-check ]; then
  cat > "${dir}/judged.md"
  [ -f "${dir}/watcher" ] && printf '✍️ signed 2026-11-12 · body 2\\n' >> "${dir}/b.md"
  [ "$3 $4 $5" = "FRM-1 --body-file /dev/stdin" ] || exit 2
  [ -f "${dir}/x-down" ] && exit 1
  grep -q 'body 2' "${dir}/judged.md" && { echo '{"ok":false}'; exit 1; }
  echo '{"ok":true}'
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
const NEW_SIGN = `${SIGNED}✍️ signed 2026-11-12 · body 2\n`;

// the Bash tool's shell is zsh; ci's check job has bash alone, so every row runs under each shell the runner has
const SHELLS = [
    'bash',
    ...(existsSync('/bin/zsh') || existsSync('/usr/bin/zsh') ? ['zsh'] : []),
];
function run(
    line: string,
    file: string,
    shell: string,
    { name = 'b.md', plant = [] as string[] } = {},
) {
    for (const f of ['judged.md', 'sent.md', 'x-down', 'watcher'])
        rmSync(join(dir, f), { force: true });
    for (const f of plant) writeFileSync(join(dir, f), '');
    writeFileSync(join(dir, name), file);
    const wrapped = withSignCheck(line, new Set(['FRM-1']));
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
    const read = (f: string) =>
        existsSync(join(dir, f))
            ? readFileSync(join(dir, f), 'utf8')
            : undefined;
    return {
        code: r.status,
        err: r.stderr,
        judged: read('judged.md'),
        out: r.stdout.trim(),
        sent: read('sent.md'),
    };
}

const SET = `x linear body FRM-1 --set ${join('$PWD', 'b.md')}`;

describe.each(SHELLS)('the run-time sign check under %s', (shell) => {
    it('sends the body x linear sign-check judged sign-free', () => {
        const file = `${SIGNED}✏️ changed 2026-11-11 — no re-sign: tiny\n`;
        expect(run(SET, file, shell)).toMatchObject({
            code: 0,
            judged: file,
            out: 'set FRM-1',
            sent: file,
        });
    });

    it.each([
        ['x linear sign-check counts a new sign', []],
        ['x linear sign-check cannot read the ticket', ['x-down']],
    ])('refuses the set when %s', (_why, plant) => {
        const r = run(SET, NEW_SIGN, shell, { plant });
        expect([r.code, r.out, r.sent, r.err]).toEqual([
            1,
            '',
            undefined,
            expect.stringContaining('x linear sign-check'),
        ]);
    });

    it('reads the id and the file the shell fills in, and the --set= form', () => {
        const loop =
            'for t in FRM-1; do x linear body $t --set=$PWD/b.md; done';
        expect([
            run(loop, SIGNED, shell).out,
            run(loop, NEW_SIGN, shell).code,
        ]).toEqual(['set FRM-1', 1]);
    });

    // wisphunter and security on 6c6c57cf: the set sends the copy the check judged, whatever its name or source
    it('judges a file named like an assignment, and refuses its new sign', () => {
        const set = 'x linear body FRM-1 --set b=1.md';
        expect([
            run(set, SIGNED, shell, { name: 'b=1.md' }).code,
            run(set, NEW_SIGN, shell, { name: 'b=1.md' }).code,
        ]).toEqual([0, 1]);
    });

    it('sends what it judged when the body comes on stdin', () => {
        const piped = 'cat $PWD/b.md | x linear body FRM-1 --set /dev/stdin';
        const r = run(piped, `${SIGNED}✏️ tiny\n`, shell);
        expect([r.code, r.sent]).toEqual([0, `${SIGNED}✏️ tiny\n`]);
    });

    // sixth sense's watcher race (dima's o43): a sign line lands in the file after the judging and before the send
    it('sends the bytes it judged, whatever a watcher writes after the check', () => {
        const r = run(SET, SIGNED, shell, { plant: ['watcher'] });
        expect([r.code, r.judged, r.sent]).toEqual([0, SIGNED, SIGNED]);
    });

    // zsh's `command printf` is /usr/bin/printf, which takes the body as one argv word (wisphunter on 93fd7f56)
    it('sends a body past the argument limit whole', () => {
        const big = `${SIGNED}${'a'.repeat(1_500_000)}\n`;
        const r = run(SET, big, shell);
        expect([r.code, r.sent?.length]).toEqual([0, big.length]);
    });

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
        expect(run(line, SIGNED, shell)).toMatchObject({
            code: 1,
            out: '',
        });
    });
});
