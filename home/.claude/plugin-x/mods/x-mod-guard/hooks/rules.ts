import { type Parsed, type Sep, type Word, parse } from './shell.ts';

// a refusal names its door; an escape marker must name every one of its targets
export type Refusal = {
    rule: string;
    why: string;
    door: string;
    targets: string[];
};
// what the rules read off the machine: the job's own dir, home, and the added paths found missing
export type Context = { jobDir?: string; home?: string; missing?: Set<string> };
export type Verdict =
    | { kind: 'run' }
    | { kind: 'refused'; refusal: Refusal }
    | { kind: 'escaped'; refusals: Refusal[]; targets: string[] };

type Peeled = { name: string; args: Word[]; assigns: string[] };
// feeders: the commands whose output reaches this one, through `$( … )` or a pipe
type Command = Peeled & { sep: Sep; dir: string; feeders: Peeled[] };

const VAULT = 'iCloud~md~obsidian';
// each wrapper, and its options that take the next word as their value
const WRAPPERS = new Map<string, string[]>([
    ['builtin', []],
    ['command', []],
    ['doas', ['-u']],
    ['env', ['-u', '-C', '-S']],
    ['exec', ['-a']],
    ['nice', ['-n']],
    ['nohup', []],
    ['sudo', ['-u', '-g', '-U', '-C', '-h', '-p', '-r', '-t', '-D']],
    ['time', []],
    ['timeout', ['-s', '-k', '--signal', '--kill-after']],
    ['xargs', ['-I', '-n', '-P', '-L', '-s', '-d', '-E', '-J', '-R']],
]);
const KEYWORDS = new Set([
    'if',
    'then',
    'else',
    'elif',
    'do',
    'while',
    'until',
    '!',
    '{',
    '}',
]);
// what reads process ids by name
const FINDERS = new Set(['pgrep', 'ps', 'pidof', 'lsof', 'grep', 'rg', 'awk']);
const SHELLS = new Set(['sh', 'bash', 'zsh']);
const GREPS = new Set(['grep', 'egrep', 'fgrep', 'rg', 'ugrep', 'head']);
// a script named for a gate, a family member included: `typecheck`, `test:unit`, `mods:test`
const GATE = /(^|:)(typecheck|test|check|tsc|vitest)(:|$)/;
const SD_FLAGS = new Set([
    '-p',
    '--preview',
    '-F',
    '--fixed-strings',
    '-s',
    '--string-mode',
    '-n',
    '--max-replacements',
    '-f',
    '--flags',
    '-h',
    '--help',
    '-V',
    '--version',
]);
const SD_VALUE = new Set(['-n', '--max-replacements', '-f', '--flags']);
const REDIRECT = /^\d*(>>?|<|&>>?)&?$/;
const REDIRECT_JOINED = /^\d*(>>?|<|&>>?)&?\S/;

const basename = (p: string) => p.split('/').filter(Boolean).pop() ?? p;
const isFlag = (w: string) => w.startsWith('-') && w !== '-';

// `-rf` holds f; a long flag is matched whole
function hasFlag(args: Word[], long: string[], short = '') {
    return args.some(
        ({ text: t }) =>
            long.includes(t) ||
            long.some((l) => t.startsWith(`${l}=`)) ||
            (!!short &&
                /^-[A-Za-z]+$/.test(t) &&
                [...short].some((c) => t.includes(c))),
    );
}

function operands(args: Word[]) {
    const out: string[] = [];
    let isRest = false;
    for (const { text } of args) {
        if (isRest) out.push(text);
        else if (text === '--') isRest = true;
        else if (!isFlag(text)) out.push(text);
    }
    return out;
}

function dropRedirects(words: Word[]) {
    const out: Word[] = [];
    for (let i = 0; i < words.length; i++) {
        const t = words[i]?.text ?? '';
        if (REDIRECT.test(t)) i++;
        else if (!REDIRECT_JOINED.test(t)) out.push(words[i] as Word);
    }
    return out;
}

// a command with its assignments, shell keywords and wrappers peeled off
function peel(raw: Word[]): Peeled {
    let words = dropRedirects(raw);
    const assigns: string[] = [];
    for (;;) {
        const head = words[0]?.text ?? '';
        if (KEYWORDS.has(head)) {
            words = words.slice(1);
            continue;
        }
        if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(head)) {
            assigns.push(head);
            words = words.slice(1);
            continue;
        }
        const values = WRAPPERS.get(basename(head));
        if (!values) break;
        words = words.slice(1);
        while (isFlag(words[0]?.text ?? '')) {
            const flag = words[0]?.text ?? '';
            words = words.slice(values.includes(flag) ? 2 : 1);
        }
        // timeout's duration
        if (basename(head) === 'timeout') words = words.slice(1);
    }
    const [first, ...args] = words;
    return { args, assigns, name: first ? basename(first.text) : '' };
}

// each segment as the command it runs, `cd` followed
function commands(parsed: Parsed, cwd: string): Command[] {
    const out: Command[] = [];
    let dir = cwd;
    const peeled = parsed.segments.map((s) => ({ ...peel(s.words), s }));
    peeled.forEach(({ s, ...c }, k) => {
        if (!c.name) return;
        const piped: Peeled[] = [];
        for (let j = k - 1; j >= 0 && peeled[j]?.s.sep === '|'; j--)
            piped.push(peeled[j] as Peeled);
        const feeders = [...s.subst.map((x) => peel(x.words)), ...piped];
        if (c.name === 'cd') {
            const to = c.args[0]?.text ?? '~';
            dir = /^[/~$]/.test(to) ? to : `${dir}/${to}`;
        }
        out.push({ ...c, dir, feeders, sep: s.sep });
    });
    return out;
}

// git's own options before the subcommand; `-c` values kept, since two of them are floor
function gitParts(args: Word[]) {
    const configs: string[] = [];
    let at: string | undefined;
    let i = 0;
    for (; i < args.length; i++) {
        const t = args[i]?.text ?? '';
        if (t === '-c') configs.push(args[++i]?.text ?? '');
        else if (t === '-C') at = args[++i]?.text;
        else if (t === '--git-dir' || t === '--work-tree') i++;
        else if (!isFlag(t)) break;
    }
    return {
        at,
        configs,
        sub: args[i]?.text ?? '',
        subArgs: args.slice(i + 1),
    };
}

const or = (list: string[], fallback: string) =>
    list.length ? list : [fallback];

const TRASH = 'trash <path> — recoverable from the macos trash';
const STASH = 'git stash -u — it sets the work aside and keeps it recoverable';
// the one door that is a person: nothing safe does the job
const ASK = 'no safe door here — ask cclio, naming the target';
const NEVER =
    'fix what the hook or the signer refused, then run it without the flag';
const LANE = 'x lane commit — it commits named paths only';

// a path as the shell would land it: the job dir and ~ filled in, `.` and `..` walked; a path still holding a `$` stays unresolved
function resolve(path: string, dir: string, ctx: Context) {
    const filled = path
        .replace(
            /^\$\{?CLAUDE_JOB_DIR\}?(?=\/|$)/,
            ctx.jobDir ?? '$CLAUDE_JOB_DIR',
        )
        .replace(/^~(?=\/|$)/, ctx.home ?? '~');
    const whole = filled.startsWith('/') ? filled : `${dir}/${filled}`;
    const out: string[] = [];
    for (const part of whole.split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') out.pop();
        else out.push(part);
    }
    return `/${out.join('/')}`;
}

// the dir a git command works in: its `-C`, else the dir its `cd`s left
function gitDir(c: Command, ctx: Context) {
    const dir = resolve(c.dir, '/', ctx);
    const { at } = gitParts(c.args);
    return at === undefined ? dir : resolve(at, dir, ctx);
}

// a git add's pathspecs as typed and where they land; globs, magic and unexpanded words are git's to read
function adds(c: Command, ctx: Context) {
    if (c.name !== 'git') return [];
    const { sub, subArgs } = gitParts(c.args);
    if (sub !== 'add') return [];
    const dir = gitDir(c, ctx);
    return operands(subArgs)
        .filter((o) => !/[*?[$]/.test(o) && !o.startsWith(':'))
        .map((text) => ({ path: resolve(text, dir, ctx), text }));
}

// the paths every git add in the command names, for the caller to look up on disk
export function addedPaths(command: string, cwd: string, ctx: Context = {}) {
    return commands(parse(command), cwd).flatMap((c) =>
        adds(c, ctx).map((a) => a.path),
    );
}

function missingAdd(c: Command, ctx: Context): Refusal | undefined {
    const gone = adds(c, ctx).filter((a) => ctx.missing?.has(a.path));
    if (!gone.length) return undefined;
    return {
        door: 'stage only paths that exist; a deleted file stages with git rm <path>',
        rule: 'git-add-missing',
        targets: gone.map((a) => a.text),
        why: 'git add of a missing path stages nothing and the commit lands partial',
    };
}

// a scratch clone under the job's own tmp: everything its local git does stays there; a push or a skipped hook does not
const LOCAL_GIT = new Set(['git-discard', 'git-rewrite', 'git-sweep']);
function isJobScratch(c: Command, r: Refusal, ctx: Context) {
    if (!ctx.jobDir || c.name !== 'git' || !LOCAL_GIT.has(r.rule)) return false;
    const { sub, subArgs } = gitParts(c.args);
    if (sub === 'push') return false;
    const tmp = resolve(`${ctx.jobDir}/tmp`, '/', ctx);
    const dir = gitDir(c, ctx);
    const paths = [dir, ...operands(subArgs).map((o) => resolve(o, dir, ctx))];
    return paths.every((p) => p.startsWith(`${tmp}/`));
}

function floor(c: Command): Refusal | undefined {
    const ops = operands(c.args);
    if (c.name === 'rm' || c.name === 'unlink')
        return {
            door: TRASH,
            rule: 'rm',
            targets: or(ops, 'rm'),
            why: 'rm deletes for good',
        };
    if (c.name === 'find') {
        const exec = c.args.findIndex((w) =>
            /^-(exec|execdir|ok)$/.test(w.text),
        );
        const execRm = exec >= 0 && peel(c.args.slice(exec + 1)).name === 'rm';
        if (execRm || hasFlag(c.args, ['-delete'])) {
            const roots = c.args.findIndex((w) => /^[-(!]/.test(w.text));
            const paths = c.args
                .slice(0, roots < 0 ? undefined : roots)
                .map((w) => w.text);
            return {
                door: TRASH,
                rule: 'rm',
                targets: or(paths, '.'),
                why: 'find deletes for good',
            };
        }
    }
    const pgrep = c.feeders.find((f) => f.name === 'pgrep');
    if (
        c.name === 'pkill' ||
        c.name === 'killall' ||
        (c.name === 'kill' && c.feeders.some((f) => FINDERS.has(f.name)))
    )
        return {
            door: 'claude stop <id>, or kill the pid you captured at spawn',
            rule: 'kill',
            targets: or(
                c.name === 'kill' ? operands(pgrep?.args ?? []) : ops,
                c.name,
            ),
            why: 'a kill by pattern hits your own process too',
        };
    if (
        c.name === 'mv' &&
        (c.dir.includes(VAULT) || ops.some((o) => o.includes(VAULT)))
    )
        return {
            door: 'obsidian rename / obsidian move — they rewrite the wikilinks',
            rule: 'vault-mv',
            targets: ops,
            why: 'a plain mv in the vault breaks every wikilink to the note',
        };
    if (
        c.assigns.some((a) => a.startsWith('HOME=')) ||
        (c.name === 'export' && ops.some((o) => o.startsWith('HOME=')))
    )
        return {
            door: 'run it without the HOME override',
            rule: 'home',
            targets: ['HOME'],
            why: 'a HOME override points every tool at the wrong config',
        };
    if (
        c.name === 'npm' &&
        hasFlag(c.args, ['--global', '--location=global'], 'g')
    )
        return {
            door: 'brew first, else pnpm add -g',
            rule: 'npm-global',
            targets: ['npm'],
            why: 'npm -g is not used here',
        };
    const isPip = /^pip\d*(\.\d+)?$/.test(c.name) && ops[0] === 'install';
    const pipAt = c.args.findIndex(
        (w, i) => w.text === '-m' && c.args[i + 1]?.text === 'pip',
    );
    const isPyPip =
        /^python\d*(\.\d+)?$/.test(c.name) &&
        pipAt >= 0 &&
        operands(c.args.slice(pipAt + 2))[0] === 'install';
    if (isPip || isPyPip)
        return {
            door: 'uv pip install',
            rule: 'pip',
            targets: ['pip'],
            why: 'pip is not used here; uv is',
        };
    const bypass = c.args.find(
        (w) => w.text === '--no-verify' || w.text === '--no-gpg-sign',
    );
    if (bypass && (c.name === 'git' || c.name === 'x'))
        return {
            door: NEVER,
            rule: 'bypass',
            targets: [bypass.text],
            why: `${bypass.text} skips a gate`,
        };
    if (c.name !== 'git') return undefined;

    const { configs, sub, subArgs } = gitParts(c.args);
    const subOps = operands(subArgs);
    const config = configs.find(
        (k) =>
            /^commit\.gpgsign=false$/i.test(k) ||
            /^user\.(name|email)=/i.test(k),
    );
    if (config) {
        const key = config.split('=')[0] ?? config;
        return {
            door: NEVER,
            rule: 'bypass',
            targets: [key],
            why: `-c ${key} overrides signing or identity`,
        };
    }
    const discard = (targets: string[], what: string): Refusal => ({
        door: STASH,
        rule: 'git-discard',
        targets,
        why: `${what} throws away uncommitted work`,
    });
    if (sub === 'commit' && hasFlag(subArgs, [], 'n'))
        return {
            door: NEVER,
            rule: 'bypass',
            targets: ['-n'],
            why: 'git commit -n skips the commit hooks',
        };
    if (
        sub === 'config' &&
        /^user\.(name|email)$/i.test(subOps[0] ?? '') &&
        subOps.length > 1
    )
        return {
            door: NEVER,
            rule: 'bypass',
            targets: [subOps[0] ?? ''],
            why: 'git config changes the commit identity',
        };
    if (sub === 'reset' && hasFlag(subArgs, ['--hard']))
        return discard(or(subOps, 'HEAD'), 'git reset --hard');
    if (
        sub === 'checkout' &&
        (subArgs.some((w) => w.text === '--') ||
            subOps.includes('.') ||
            hasFlag(subArgs, ['--force'], 'f'))
    )
        return discard(or(subOps, '.'), 'git checkout over files');
    if (
        sub === 'restore' &&
        !(
            hasFlag(subArgs, ['--staged'], 'S') &&
            !hasFlag(subArgs, ['--worktree'], 'W')
        )
    )
        return discard(or(subOps, '.'), 'git restore');
    if (sub === 'clean' && hasFlag(subArgs, ['--force'], 'f'))
        return discard(or(subOps, '.'), 'git clean');
    if (sub === 'stash' && (subOps[0] === 'drop' || subOps[0] === 'clear'))
        return {
            door: ASK,
            rule: 'git-discard',
            targets: or(
                subOps.slice(1),
                subOps[0] === 'drop' ? 'stash@{0}' : 'clear',
            ),
            why: `git stash ${subOps[0]} throws away set-aside work`,
        };
    const rewrite = (targets: string[], what: string): Refusal => ({
        door: ASK,
        rule: 'git-rewrite',
        targets,
        why: `${what} cannot be undone`,
    });
    if (
        sub === 'push' &&
        (hasFlag(
            subArgs,
            ['--force', '--force-with-lease', '--delete'],
            'fd',
        ) ||
            subOps.slice(1).some((o) => /^[+:]/.test(o)))
    )
        return rewrite(or(subOps, 'push'), 'a force-push');
    if (
        sub === 'branch' &&
        (hasFlag(subArgs, [], 'D') ||
            (hasFlag(subArgs, ['--delete'], 'd') &&
                hasFlag(subArgs, ['--force'], 'f')))
    )
        return rewrite(subOps, 'git branch -D');
    if (sub === 'worktree' && subOps[0] === 'prune')
        return rewrite(['prune'], 'git worktree prune');
    if (sub === 'worktree' && subOps[0] === 'remove')
        return rewrite(or(subOps.slice(1), 'remove'), 'git worktree remove');
    return undefined;
}

function lint(c: Command, next: Command | undefined): Refusal | undefined {
    const ops = operands(c.args);
    const pipedTo =
        c.sep === '|' && next && GREPS.has(next.name) ? next.name : undefined;
    if (c.name === 'sd') {
        const hasEnd = c.args.some((w) => w.text === '--');
        const positional: Word[] = [];
        for (let i = 0; i < c.args.length; i++) {
            const w = c.args[i] as Word;
            if (w.text === '--') {
                positional.push(...c.args.slice(i + 1));
                break;
            }
            if (!isFlag(w.text)) positional.push(w);
            else if (!hasEnd && !SD_FLAGS.has(w.text))
                return {
                    door: `sd -- '${w.text}' …`,
                    rule: 'sd-dash',
                    targets: ['sd'],
                    why: `sd reads ${w.text} as a flag and edits nothing`,
                };
            else if (SD_VALUE.has(w.text)) i++;
        }
        if (positional[1]?.isExpanding)
            return {
                door: 'single-quote the replacement, or use the Edit tool',
                rule: 'sd-dollar',
                targets: ['sd'],
                why: 'the shell expands $ inside double quotes and the line ships hollow',
            };
        if (
            !hasFlag(c.args, ['--preview'], 'p') &&
            ops.some((o) => o.includes('.github/workflows/'))
        )
            return {
                door: 'the Edit tool',
                rule: 'workflow-edit',
                targets: ['sd'],
                why: 'sd drops ${{ … }} from a workflow line',
            };
    }
    if (
        (c.name === 'sed' || c.name === 'gsed') &&
        hasFlag(c.args, ['--in-place'], 'i') &&
        ops.some((o) => o.includes('.github/workflows/'))
    )
        return {
            door: 'the Edit tool',
            rule: 'workflow-edit',
            targets: ['sed'],
            why: 'sed drops ${{ … }} from a workflow line',
        };
    if (pipedTo && c.name === 'git' && gitParts(c.args).sub === 'push')
        return {
            door: 'git ls-remote <remote> <branch>',
            rule: 'push-grep',
            targets: [pipedTo],
            why: 'a push is read by git ls-remote, never by its output',
        };
    const isGate =
        ['tsc', 'vitest'].includes(c.name) ||
        (['pnpm', 'npm', 'yarn', 'bun'].includes(c.name) &&
            ops.some((o) => GATE.test(o)));
    if (pipedTo && isGate)
        return {
            door: 'run the gate unpiped and read its exit code',
            rule: 'gate-pipe',
            targets: [pipedTo],
            why: `| ${pipedTo} turns a red gate quiet`,
        };
    if (c.name === 'git') {
        const { sub, subArgs } = gitParts(c.args);
        if (sub === 'commit' && !subArgs.some((w) => w.text === '--'))
            return {
                door: LANE,
                rule: 'git-sweep',
                targets: ['commit'],
                why: 'a commit with no -- paths sweeps whatever is staged',
            };
        const sweep = subArgs.find(
            (w) => w.text === '-A' || w.text === '--all' || w.text === '.',
        );
        if (sub === 'add' && sweep)
            return {
                door: LANE,
                rule: 'git-sweep',
                targets: [sweep.text],
                why: `git add ${sweep.text} stages files that are not yours`,
            };
    }
    if (c.name === 'pnpm' && c.args.some((w) => w.text === '-s'))
        return {
            door: 'pnpm --silent',
            rule: 'pnpm-s',
            targets: ['-s'],
            why: 'pnpm 12 refuses -s',
        };
    return undefined;
}

function unbraced(parsed: Parsed): Refusal | undefined {
    const [first] = parsed.unbraced;
    if (!first) return undefined;
    const name = first.slice(1, -1);
    return {
        door: `\${${name}}`,
        rule: 'unbraced',
        targets: [`$${name}`],
        why: `${first} — zsh reads a modifier, bash a longer name`,
    };
}

function background(list: Command[]): Refusal | undefined {
    const last = list.findLastIndex((c) => c.sep === '&');
    if (
        last < 0 ||
        list
            .slice(last + 1)
            .some((c) => c.name === 'wait' || c.name === 'sleep')
    )
        return undefined;
    return {
        door: 'add wait (or a sleep) after it, or use run_in_background',
        rule: 'background',
        targets: ['&'],
        why: 'the tool wrapper exits and kills a trailing & child',
    };
}

export function refusals(
    command: string,
    cwd: string,
    ctx: Context = {},
): Refusal[] {
    const parsed = parse(command);
    const list = commands(parsed, cwd);
    const out: Refusal[] = [];
    list.forEach((c, i) => {
        const found = floor(c) ?? lint(c, list[i + 1]) ?? missingAdd(c, ctx);
        if (found && !isJobScratch(c, found, ctx)) out.push(found);
        // a nested shell's script is a command too
        // `-c` alone or in a cluster: `bash -lc`
        const dashC = SHELLS.has(c.name)
            ? c.args.findIndex((w) => /^-[A-Za-z]*c[A-Za-z]*$/.test(w.text))
            : -1;
        const script = dashC >= 0 ? c.args[dashC + 1] : undefined;
        if (script) out.push(...refusals(script.text, c.dir, ctx));
        if (c.name === 'eval')
            out.push(
                ...refusals(c.args.map((w) => w.text).join(' '), c.dir, ctx),
            );
    });
    for (const r of [background(list), unbraced(parsed)]) if (r) out.push(r);
    // one line per rule and target: a lint seen on every command of a pipeline is one finding
    return out.filter(
        (r, i) =>
            out.findIndex(
                (o) =>
                    o.rule === r.rule && o.targets.join() === r.targets.join(),
            ) === i,
    );
}

export function markers(command: string) {
    return parse(command)
        .comments.map((c) => c.match(/^\s*dima-ok:\s*(.+?)\s*$/)?.[1])
        .filter((t): t is string => !!t);
}

export function check(
    command: string,
    cwd: string,
    ctx: Context = {},
): Verdict {
    const found = refusals(command, cwd, ctx);
    if (!found.length) return { kind: 'run' };
    const marked = markers(command);
    // a marker names one target, or several split by spaces or commas; every target of a refusal must be named
    const ok = new Set(marked.flatMap((m) => [m, ...m.split(/[\s,]+/)]));
    const open = found.find((r) => !r.targets.every((t) => ok.has(t)));
    if (open) return { kind: 'refused', refusal: open };
    return { kind: 'escaped', refusals: found, targets: marked };
}

export function message(r: Refusal) {
    return `x-mod-guard stopped this one command. instead: ${r.door}. why: ${r.why}. only after dima's word, end the command with # dima-ok: ${r.targets.join(' ')}`;
}
