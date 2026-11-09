import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    realpathSync,
    renameSync,
    rmSync,
    symlinkSync,
    truncateSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

const repo = join(import.meta.dirname, '../..');
const script = join(repo, 'script/git-slim.sh');

// the script is this mac's: ci's runner has no brew, no zsh and a gnu mv
const onMac = describe.runIf(process.platform === 'darwin');
const macShell = 'zsh';

// a built git that answers the way a real one does, its exec path through the path it ran by; a script under /bin/bash never sees a DYLD_ variable, so libraries come from a real binary below
const stubBuiltGit = (
    version: string,
    execPath = '"$tree/libexec/git-core"',
) => `#!/bin/bash
tree=$(cd "$(dirname "$0")/.." && pwd)
case $1 in
--version) echo "git version ${version}" ;;
--exec-path) echo ${execPath} ;;
esac
`;

function write(path: string, body: string) {
    writeFileSync(path, body);
    chmodSync(path, 0o755);
}

// the clone a real build fetches: a tree that names the tag it was asked for
const stubClone = `#!/bin/bash
case " $* " in *" clone "*) ;; *) exit 0 ;; esac
for arg in "$@"; do
    [ "\${previous-}" = --branch ] && tag=$arg
    previous=$arg
done
dest=$arg
mkdir -p "$dest"
echo "framework CoreServices" >"$dest/config.mak.uname"
echo "$tag" >"$dest/tag"
`;

function fixture(brewVersion = '2.56.0') {
    const dir = realpathSync(
        mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'git-slim-')),
    );
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    const state = join(dir, 'state');
    const makeLog = join(dir, 'make.log');

    const setBrew = (version: string) =>
        write(
            join(bin, 'brew'),
            `#!/bin/bash
case "$*" in
"list --versions git") echo "git ${version}_2" ;;
"--prefix") echo "${dir}/brew" ;;
esac
`,
        );
    setBrew(brewVersion);
    write(join(bin, 'git'), stubClone);
    write(
        join(bin, 'make'),
        `#!/bin/bash
echo make >>"${makeLog}"
[ -z "\${FORCE_MAKE_FAIL-}" ] || exit 2
# what a real tree needs and no answer of the stub git can show
case " $* " in *" RUNTIME_PREFIX=YesPlease "*) ;; *) exit 3 ;; esac
case " $* " in *" sysconfdir="*) ;; *) exit 3 ;; esac
for arg in "$@"; do
    case $arg in
    prefix=*) prefix=\${arg#prefix=} ;;
    GIT_VERSION=*) version=\${arg#GIT_VERSION=} ;;
    esac
done
# a real tree the recipe edited reads dirty unless the build names its version
version=\${FORCE_BUILT_VERSION:-\${version:-$(cat "$2/tag").dirty}}
mkdir -p "$prefix/bin" "$prefix/libexec/git-core"
touch "$prefix/libexec/git-core/git-remote-https"
chmod +x "$prefix/libexec/git-core/git-remote-https"
case " $* " in *" install-git-credential-osxkeychain "*)
    touch "$prefix/libexec/git-core/git-credential-osxkeychain"
    chmod +x "$prefix/libexec/git-core/git-credential-osxkeychain" ;;
esac
cat >"$prefix/bin/git" <<'BUILT'
${stubBuiltGit('VERSION_HERE')}
BUILT
sed -i '' "s/VERSION_HERE/\${version#v}/" "$prefix/bin/git"
chmod +x "$prefix/bin/git"
`,
    );

    const run = (args: string[] = [], extra: NodeJS.ProcessEnv = {}) =>
        spawnSync(script, args, {
            encoding: 'utf8',
            env: {
                ...process.env,
                PATH: `${bin}${delimiter}/usr/bin${delimiter}/bin`,
                X_STATE: state,
                ...extra,
            },
            timeout: 10_000,
        });
    const home = join(state, 'git-slim');
    const builds = () =>
        existsSync(makeLog)
            ? readFileSync(makeLog, 'utf8').trimEnd().split('\n').length
            : 0;
    return {
        bin,
        builds,
        current: join(home, 'current'),
        home,
        run,
        setBrew,
    };
}

type Fixture = ReturnType<typeof fixture>;

function built(f: Fixture) {
    const got = f.run();
    expect(got.status, got.stderr).toBe(0);
    return join(f.current, 'bin/git');
}

const ask = (git: string, arg: string) =>
    spawnSync(git, [arg], { encoding: 'utf8', timeout: 10_000 }).stdout.trim();

onMac('the build', () => {
    test('with no home, its git reads brew version and its exec path lies under the live tree', () => {
        const f = fixture();

        const git = built(f);

        expect(ask(git, '--version')).toBe('git version 2.56.0');
        expect(
            realpathSync(ask(git, '--exec-path')).startsWith(
                `${realpathSync(f.current)}/`,
            ),
        ).toBe(true);
    });

    test('a new brew version moves current and keeps the old tree for a lane mid-run', () => {
        const f = fixture();
        const git = built(f);
        const old = realpathSync(f.current);

        f.setBrew('2.57.0');
        built(f);

        expect(ask(git, '--version')).toBe('git version 2.57.0');
        expect(realpathSync(f.current)).not.toBe(old);
        expect(existsSync(join(old, 'bin/git'))).toBe(true);
    });

    test('a second run at the same version builds nothing', () => {
        const f = fixture();
        built(f);

        const got = f.run();

        expect(got.status, got.stderr).toBe(0);
        expect(f.builds()).toBe(1);
    });

    test('a broken live git is rebuilt into its own tree, never over the live one', () => {
        const f = fixture();
        const git = built(f);
        const old = realpathSync(f.current);
        truncateSync(join(old, 'bin/git'));

        // first on PATH, as in an agent shell: a 0-byte git would answer the clone with silence
        const got = f.run([], {
            PATH: `${join(f.current, 'bin')}${delimiter}${f.bin}${delimiter}/usr/bin${delimiter}/bin`,
        });

        expect(got.status, got.stderr).toBe(0);
        expect(realpathSync(f.current)).not.toBe(old);
        expect(ask(git, '--version')).toBe('git version 2.56.0');
    });

    test('a failure mid-build leaves the live home running and nothing half built', () => {
        const f = fixture();
        const git = built(f);
        const old = realpathSync(f.current);
        f.setBrew('2.57.0');

        const got = f.run([], { FORCE_MAKE_FAIL: '1' });

        expect(got.status).not.toBe(0);
        expect(realpathSync(f.current)).toBe(old);
        expect(ask(git, '--version')).toBe('git version 2.56.0');
        expect(readdirSync(f.home).sort()).toEqual(['current', 'versions']);
        expect(readdirSync(join(f.home, 'versions'))).toHaveLength(1);
    });

    test('a build whose git fails the check never goes live', () => {
        const f = fixture();
        const git = built(f);
        const old = realpathSync(f.current);
        f.setBrew('2.57.0');

        const got = f.run([], { FORCE_BUILT_VERSION: '2.55.0' });

        expect(got.status).not.toBe(0);
        expect(realpathSync(f.current)).toBe(old);
        expect(ask(git, '--version')).toBe('git version 2.56.0');
    });
});

onMac('the check', () => {
    test('a healthy build exits 0 and builds nothing', () => {
        const f = fixture();
        built(f);

        const got = f.run(['--check']);

        expect(got.status, got.stderr).toBe(0);
        expect(f.builds()).toBe(1);
    });

    const breaks: [string, RegExp, (f: Fixture) => void][] = [
        [
            'the build removed',
            /no executable git/,
            (f) => rmSync(f.home, { recursive: true }),
        ],
        [
            'current dangling',
            /no executable git/,
            (f) => {
                rmSync(f.current);
                symlinkSync(join(f.home, 'gone'), f.current);
            },
        ],
        [
            'its git not executable',
            /no executable git/,
            (f) => chmodSync(join(f.current, 'bin/git'), 0o644),
        ],
        [
            'its git 0 bytes',
            /0 bytes/,
            (f) => truncateSync(join(f.current, 'bin/git')),
        ],
        [
            'its git failing to run',
            /does not run/,
            (f) => write(join(f.current, 'bin/git'), '#!/bin/bash\nexit 3\n'),
        ],
        [
            'its http helper gone',
            /no git-remote-https/,
            (f) => rmSync(join(f.current, 'libexec/git-core/git-remote-https')),
        ],
        [
            'brew one version ahead',
            /brew's is 2\.57\.0/,
            (f) => f.setBrew('2.57.0'),
        ],
        [
            'brew git copied in at about 706 libraries',
            /libraries/,
            (f) => {
                const brewGit = realpathSync('/opt/homebrew/bin/git');
                cpSync(brewGit, join(f.current, 'bin/git'));
                f.setBrew(
                    ask(brewGit, '--version').replace('git version ', ''),
                );
            },
        ],
        [
            'a moved tree with its exec path outside',
            /exec path/,
            (f) => {
                const tree = realpathSync(f.current);
                const moved = `${tree}-moved`;
                cpSync(tree, moved, { recursive: true });
                write(
                    join(moved, 'bin/git'),
                    stubBuiltGit('2.56.0', `${tree}/libexec/git-core`),
                );
                rmSync(f.current);
                symlinkSync(moved, f.current);
            },
        ],
    ];

    test.each(breaks)(
        'with %s it exits 1 naming the rebuild',
        (_name, reason, breakIt) => {
            const f = fixture();
            built(f);
            breakIt(f);

            const got = f.run(['--check']);

            expect(got.status, got.stdout).toBe(1);
            expect(got.stderr).toMatch(reason);
            expect(got.stderr).toContain('script/git-slim.sh');
            expect(f.builds()).toBe(1);
        },
    );
});

onMac(
    'the session hook, the Bash tool shell whose snapshot resets PATH',
    () => {
        const hook = join(repo, 'home/.claude/shelf/hooks/git-slim-path.sh');
        const slimDir = '$HOME/.local/state/x/git-slim/current/bin';

        test('writes a line that puts the slim dir first, with the PATH of that moment kept', () => {
            const dir = realpathSync(
                mkdtempSync(
                    join(process.env.TMPDIR ?? tmpdir(), 'git-slim-hook-'),
                ),
            );
            const envFile = join(dir, 'env.sh');
            const slimGit = join(
                dir,
                '.local/state/x/git-slim/current/bin/git',
            );
            mkdirSync(dirname(slimGit), { recursive: true });
            write(slimGit, '#!/bin/bash\n');

            const got = spawnSync(hook, {
                encoding: 'utf8',
                env: { ...process.env, CLAUDE_ENV_FILE: envFile, HOME: dir },
                timeout: 10_000,
            });
            const read = spawnSync(
                '/bin/bash',
                [
                    '-c',
                    `HOME=/h PATH=/fnm/bin:/b; . "${envFile}"; echo "$PATH"`,
                ],
                { encoding: 'utf8', timeout: 10_000 },
            );

            expect(got.status, got.stderr).toBe(0);
            expect(readFileSync(envFile, 'utf8')).toContain(slimDir);
            expect(read.stdout.trim()).toBe(
                '/h/.local/state/x/git-slim/current/bin:/fnm/bin:/b',
            );
        });

        test('with a git that fails it writes nothing', () => {
            const dir = realpathSync(
                mkdtempSync(
                    join(process.env.TMPDIR ?? tmpdir(), 'git-slim-hook-'),
                ),
            );
            const envFile = join(dir, 'env.sh');
            const slimGit = join(
                dir,
                '.local/state/x/git-slim/current/bin/git',
            );
            mkdirSync(dirname(slimGit), { recursive: true });
            write(slimGit, '#!/bin/bash\nexit 1\n');

            const got = spawnSync(hook, {
                encoding: 'utf8',
                env: { ...process.env, CLAUDE_ENV_FILE: envFile, HOME: dir },
                timeout: 10_000,
            });

            expect(got.status, got.stderr).toBe(0);
            expect(existsSync(envFile)).toBe(false);
        });

        test('with no env file it exits 0 and writes nothing', () => {
            const { CLAUDE_ENV_FILE: _file, ...env } = process.env;

            const got = spawnSync(hook, {
                encoding: 'utf8',
                env,
                timeout: 10_000,
            });

            expect(got.status, got.stderr).toBe(0);
        });
    },
);

onMac('the door, read by a new shell', () => {
    function shell(
        mode: '-c' | '-lc',
        agent: boolean,
        slim: 'healthy' | 'removed' | 'dangling' | 'not executable' | 'empty',
    ) {
        const dir = realpathSync(
            mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'git-slim-door-')),
        );
        const brewBin = join(dir, 'brew');
        mkdirSync(brewBin);
        write(join(brewBin, 'git'), '#!/bin/bash\n');
        for (const name of ['.zshenv', '.zprofile']) {
            writeFileSync(join(dir, name), `source "${repo}/home/${name}"\n`);
        }
        const home = join(dir, '.local/state/x/git-slim');
        const tree = join(home, 'versions/2.56.0');
        const slimGit = join(tree, 'bin/git');
        mkdirSync(join(tree, 'bin'), { recursive: true });
        write(slimGit, '#!/bin/bash\n');
        symlinkSync(tree, join(home, 'current'));
        if (slim === 'removed') rmSync(home, { recursive: true });
        if (slim === 'dangling') renameSync(tree, `${tree}-gone`);
        if (slim === 'not executable') chmodSync(slimGit, 0o644);
        if (slim === 'empty') writeFileSync(slimGit, '');

        const { CLAUDECODE: _agent, ...env } = process.env;
        const got = spawnSync(macShell, [mode, 'whence -p git'], {
            encoding: 'utf8',
            env: {
                ...env,
                ...(agent ? { CLAUDECODE: '1' } : {}),
                HOME: dir,
                PATH: `${brewBin}${delimiter}/usr/bin${delimiter}/bin`,
            },
            timeout: 10_000,
        });
        return {
            brew: join(brewBin, 'git'),
            door: join(home, 'current/bin/git'),
            printed: got.stdout.trim(),
        };
    }

    test.each(['-c', '-lc'] as const)(
        'an agent %s shell finds the slim git',
        (mode) => {
            const { door, printed } = shell(mode, true, 'healthy');

            expect(printed).toBe(door);
        },
    );

    test.each(['-c', '-lc'] as const)(
        'a %s shell with no agent env never does',
        (mode) => {
            const { door, printed } = shell(mode, false, 'healthy');

            expect(printed).not.toBe(door);
        },
    );

    test.each(['removed', 'dangling', 'not executable', 'empty'] as const)(
        'an agent shell with the build %s falls back',
        (slim) => {
            const { brew, printed } = shell('-c', true, slim);

            expect(printed).toBe(brew);
        },
    );
});

onMac('the bash door, BASH_ENV for hooks and their scripts', () => {
    const door = join(repo, 'home/.claude/shelf/hooks/git-slim-bash-env.sh');

    function bashGit(firstOnPath: string, slimBody: string) {
        const dir = realpathSync(
            mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'git-slim-bash-')),
        );
        const slimGit = join(dir, '.local/state/x/git-slim/current/bin/git');
        mkdirSync(dirname(slimGit), { recursive: true });
        write(slimGit, slimBody);
        // a script file, as a hook runs: bash -c on a socket stdin skips BASH_ENV
        const script = join(dir, 'hook.sh');
        write(script, 'command -v git\n');
        const got = spawnSync('/bin/bash', [script], {
            encoding: 'utf8',
            env: {
                BASH_ENV: door,
                HOME: dir,
                PATH: `${firstOnPath}${delimiter}/usr/bin${delimiter}/bin`,
            },
            timeout: 10_000,
        });
        return { printed: got.stdout.trim(), slimGit };
    }

    test("swaps brew's git for the slim one", () => {
        const { printed, slimGit } = bashGit(
            '/opt/homebrew/bin',
            '#!/bin/bash\n',
        );

        expect(printed).toBe(slimGit);
    });

    test("leaves a test's fake git first", () => {
        const fake = realpathSync(
            mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'git-slim-fake-')),
        );
        write(join(fake, 'git'), '#!/bin/bash\n');

        expect(bashGit(fake, '#!/bin/bash\n').printed).toBe(join(fake, 'git'));
    });

    test('keeps brew when the slim git is empty', () => {
        expect(bashGit('/opt/homebrew/bin', '').printed).toBe(
            '/opt/homebrew/bin/git',
        );
    });
});
