import type { Parsed, Segment, Sep, Word } from '../shell.ts';
import { parse } from '../shell.ts';

// a refusal names its door; an escape marker must name every one of its targets
export type Refusal = {
    rule: string;
    why: string;
    door: string;
    targets: string[];
};
// what the rules read off the machine: the job's own dir, home, and the added paths found missing
// kinds: what each written-over or trashed path found on disk is
export type Context = {
    jobDir?: string;
    home?: string;
    missing?: Set<string>;
    kinds?: Map<string, 'file' | 'dir' | 'other'>;
    briefs?: Map<string, Brief>;
    // the session is clio's: it cleans its fleet's scratch trees and branches on its own
    isClio?: boolean;
    // the trees looked up and found safe to drop: no `.scratch/`, no commit only their HEAD reaches
    cleanTrees?: Set<string>;
    // the job-tmp dirs where a symlink or a repo whose git dir sits outside the job tmp (a worktree of frame) reaches out
    unsafeTmp?: Set<string>;
    // the dirs whose working tree changed a package.json or pnpm-workspace.yaml since HEAD (FRM-393)
    manifestDirs?: Set<string>;
    // the backlog tasks a `--notes` edit names whose file already holds notes, keyed by notes.ts's notedKey
    notedTasks?: Set<string>;
    // the linear projects that hold milestones, each by id, name and slug, lowercased (milestone.ts)
    milestoneProjects?: Set<string>;
    // the projects a linear call moves tickets into while linear could not be read: the milestone check skipped them
    milestoneUnread?: string[];
    // the frame and clio scripts a `--help` run names whose source parses no help flag, so `--help` runs them
    helpless?: Set<string>;
    // the clis whose bare `--help` already ran this session
    helped?: Set<string>;
    // the registry names of the live sixth senses, read only when the command summons one (FRM-479)
    sixthSenses?: string[];
};
// a spawn's brief file as found on disk: whether it names codie's skill, and whether x brief check stamped its bytes
export type Brief = { isCodie: boolean; isStamped: boolean };
export type Verdict =
    | { kind: 'run' }
    | { kind: 'refused'; refusal: Refusal }
    | { kind: 'escaped'; refusals: Refusal[]; targets: string[] };
// wrappers: the peeled heads (`sudo`, `env`); writes: the targets of its `>` redirects; reads: of its `<`
// envArgs: the words env and exec took for themselves (`-i`, `-u NAME`, `-c`); envSplit: env -S's string; bodies: its heredocs
// head: the word the name came from
type Peeled = {
    name: string;
    head?: Word;
    args: Word[];
    envArgs: string[];
    envSplit?: string;
    bodies: string[];
    assigns: string[];
    wrappers: string[];
    writes: string[];
    appends: string[];
    reads: string[];
    // where its stdout lands when redirected: `>`, `1>`, `&>` and their `>>`, `/dev/null` included
    stdouts: string[];
};
// feeders: the commands whose output reaches this one, through `$( … )` or a pipe
export type Command = Peeled & { sep: Sep; dir: string; feeders: Peeled[] };
export const VAULT = 'iCloud~md~obsidian';
// the linear teams whose ticket ids the rules read: `x schema linear` lists the workspace's, and a new team joins here
export const TICKET_KEY = ['FRM', 'BYT'].join('|');
// each wrapper, and its options that take the next word as their value
const WRAPPERS = new Map<string, string[]>([
    ['builtin', []],
    ['command', []],
    ['doas', ['-u']],
    ['arch', []],
    ['caffeinate', ['-t', '-w']],
    ['env', ['-u', '-C', '-S', '-P', '-L', '-U', '--unset', '--chdir']],
    ['exec', ['-a']],
    ['nice', ['-n']],
    ['nohup', []],
    ['npx', ['-p', '--package']],
    ['parallel', ['-j', '-S', '--jobs']],
    ['script', ['-F', '-t', '-T']],
    ['stdbuf', ['-i', '-o', '-e']],
    ['sudo', ['-u', '-g', '-U', '-C', '-h', '-p', '-r', '-t', '-D']],
    ['time', []],
    ['timeout', ['-s', '-k', '--signal', '--kill-after']],
    [
        'xargs',
        [
            '-I',
            '-n',
            '-P',
            '-L',
            '-s',
            '-d',
            '-E',
            '-J',
            '-R',
            '-S',
            '-a',
            '--max-args',
            '--max-lines',
            '--max-procs',
            '--max-chars',
            '--arg-file',
            '--delimiter',
            '--eof',
            '--replace',
        ],
    ],
]);
// a runner whose verb runs the next word as a command: `pnpm exec rm`, `npm exec`, `pnpm dlx`
const RUNNERS = new Map([
    ['pnpm', ['exec', 'dlx']],
    ['npm', ['exec', 'x']],
    ['bun', ['x']],
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
    'coproc',
    'function',
]);
// a `[[ … ]]` test opens on an unquoted `[[` where a command name stands and closes on an unquoted `]]`; the parser splits
// it at its `&&`, so the state runs across segments: the state after this segment's words
export function testSpan(words: Word[], isOpen: boolean) {
    const head = words.find(
        (w) =>
            !KEYWORDS.has(w.text) &&
            !/^[A-Za-z_][A-Za-z0-9_]*\+?=/.test(w.text),
    );
    let open = isOpen;
    for (const w of words) {
        if (w.hasQuote) continue;
        if (w.text === '[[' && w === head) open = true;
        else if (w.text === ']]') open = false;
    }
    return open;
}
export const SD_VALUE = new Set(['-n', '--max-replacements', '-f', '--flags']);
const REDIRECT = /^\d*(>>?|<>?|&>>?|>[|!])&?$/;
const REDIRECT_JOINED = /^\d*(>>?|<(?!<)|&>>?|>[|!])&?\S/;
export const basename = (p: string) => p.split('/').filter(Boolean).pop() ?? p;
export const isFlag = (w: string) => w.startsWith('-') && w !== '-';
// `-rf` holds f; a long flag is matched whole
export function hasFlag(args: Word[], long: string[], short = '') {
    return args.some(
        ({ text: t }) =>
            long.includes(t) ||
            long.some((l) => t.startsWith(`${l}=`)) ||
            (!!short &&
                /^-[A-Za-z]+$/.test(t) &&
                [...short].some((c) => t.includes(c))),
    );
}
export function operands(args: Word[]) {
    const out: string[] = [];
    let isRest = false;
    for (const { text } of args) {
        if (isRest) out.push(text);
        else if (text === '--') isRest = true;
        else if (!isFlag(text)) out.push(text);
    }
    return out;
}
// a `>` that truncates its target, or a `<>` that writes over it in place; `>>` appends and `>&` names a descriptor
const TRUNCATE = /^\d*(?:&?>[|!]?|<>)$/;
const TRUNCATE_JOINED = /^\d*(?:&?>[|!]?|<>)([^>&|!].*)$/;
// the device files a write onto loses nothing
const HARMLESS_DEV =
    /^\/dev\/(?:null|zero|u?random|tty|std(?:in|out|err)|fd\/)/;
const READ = /^\d*<$/;
const READ_JOINED = /^\d*<([^<&>].*)$/;
// the paths a redirect names, apart (`> f`) or joined (`>f`)
function redirected(words: Word[], apart: RegExp, joined: RegExp) {
    return words.flatMap((w, i) => {
        const path = apart.test(w.text)
            ? words[i + 1]?.text
            : w.text.match(joined)?.[1];
        return path ? [path] : [];
    });
}
const writes = (words: Word[]) =>
    redirected(words, TRUNCATE, TRUNCATE_JOINED).filter(
        (to) => !HARMLESS_DEV.test(to),
    );
export const reads = (words: Word[]) => redirected(words, READ, READ_JOINED);
const STDOUT = /^[1&]?>>?$/;
const STDOUT_JOINED = /^[1&]?>>?([^>&].*)$/;
const stdouts = (words: Word[]) => redirected(words, STDOUT, STDOUT_JOINED);
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
export function peel(raw: Word[], bodies: string[] = []): Peeled {
    let words = dropRedirects(raw);
    const assigns: string[] = [];
    const wrappers: string[] = [];
    const envArgs: string[] = [];
    let envSplit: string | undefined;
    for (;;) {
        const head = words[0]?.text ?? '';
        if (KEYWORDS.has(head)) {
            words = words.slice(1);
            continue;
        }
        if (/^[A-Za-z_][A-Za-z0-9_]*\+?=/.test(head)) {
            assigns.push(head);
            words = words.slice(1);
            continue;
        }
        const verbs = RUNNERS.get(basename(head));
        if (verbs?.includes(words[1]?.text ?? '')) {
            wrappers.push(`${basename(head)} ${words[1]?.text}`);
            words = words.slice(2);
            while (isFlag(words[0]?.text ?? '')) words = words.slice(1);
            continue;
        }
        const values = WRAPPERS.get(basename(head));
        if (!values) break;
        // `command -v x` / `-V` names x, never runs it
        if (head === 'command' && /^-[a-zA-Z]*[vV]/.test(words[1]?.text ?? ''))
            break;
        const wrapper = basename(head);
        wrappers.push(wrapper);
        words = words.slice(1);
        const isEnv = wrapper === 'env' || wrapper === 'exec';
        // env's `-` is its -i
        while (
            isFlag(words[0]?.text ?? '') ||
            (wrapper === 'env' && words[0]?.text === '-')
        ) {
            const flag = words[0]?.text ?? '';
            const long = flag.split('=')[0] ?? flag;
            const takes = values.includes(flag);
            if (isEnv)
                envArgs.push(flag, ...(takes ? [words[1]?.text ?? ''] : []));
            if (
                wrapper === 'env' &&
                (flag === '-S' || flag === '--split-string')
            )
                envSplit = words[1]?.text ?? '';
            else if (wrapper === 'env' && /^-S./.test(flag))
                envSplit = flag.slice(2);
            else if (wrapper === 'env' && long === '--split-string')
                envSplit = flag.slice(long.length + 1);
            words = words.slice(takes ? 2 : 1);
        }
        // timeout's duration, script's log file
        if (wrapper === 'timeout' || wrapper === 'script')
            words = words.slice(1);
    }
    const [first, ...args] = words;
    return {
        appends: redirected(raw, APPEND, APPEND_JOINED),
        args,
        assigns,
        bodies,
        envArgs,
        ...(envSplit !== undefined && { envSplit }),
        ...(first && { head: first }),
        name: first ? basename(first.text) : '',
        reads: reads(raw),
        stdouts: stdouts(raw),
        wrappers,
        writes: writes(raw),
    };
}
// the path a `NAME=` assignment holds: a literal path, or the template of an `$(mktemp -d <template>)`; a value of any
// other shape is unknown
function pathAssigned(value: string, subst: Parsed['segments'][number][]) {
    if (/^(\/|~|\$\{?CLAUDE_JOB_DIR\}?\/)/.test(value)) return value;
    // only a substitution that is exactly one mktemp: `$(echo ~/frame || mktemp -d …)` prints something else
    const [only] = subst;
    if (value !== '$(…)' || subst.length !== 1 || !only) return undefined;
    const m = peel(only.words);
    const ops = operands(m.args);
    return m.name === 'mktemp' && hasFlag(m.args, ['--directory'], 'd')
        ? ops[0]
        : undefined;
}
const REBINDERS = new Set([
    'declare',
    'export',
    'for',
    'local',
    'mapfile',
    'printf',
    'read',
    'readarray',
    'readonly',
    'select',
    'typeset',
    'unset',
]);
// each segment as the command it runs, `cd` followed; a `cd $R` or `git -C $R` follows a `R=<path>` set earlier in the command
export function commands(parsed: Parsed, cwd: string): Command[] {
    const out: Command[] = [];
    let dir = cwd;
    const vars = new Map<string, string>();
    // GIT_DIR or GIT_WORK_TREE set by an earlier segment points every later git elsewhere
    const sticky: string[] = [];
    const expand = (t: string) =>
        t.replace(
            /^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?(?=\/|$)/,
            (m, name: string) => vars.get(name) ?? m,
        );
    // every literal a name takes on the line (`R=rm`, `for R in rm`, `read R <<< rm`, `R=$(echo rm)`, `y=$x`), in any order
    // or branch, since the walker never reads which runs: one value fills a later `$R`; an argument takes every value; a head
    // with two values, or one the line cannot read (`read R`, `R=$(cat f)`), stays a `$` for the opaque-head rule
    const literals = new Map<
        string,
        { values: string[]; isUnknown: boolean }
    >();
    const bind = (name: string, values: string[], isUnknown = false) => {
        const was = literals.get(name) ?? { isUnknown: false, values: [] };
        literals.set(name, {
            isUnknown: was.isUnknown || isUnknown,
            values: [...new Set([...was.values, ...values])],
        });
    };
    // a value that only names other variables (`V="$HOME/vault"`) fills a later `$V/…` as its text, still expanding
    const templates = new Map<string, string>();
    // a `NAME=$( … )` hands its substitutions to every later word naming $NAME: `P=$(pgrep x); kill $P` is fed by pgrep
    const fed = new Map<string, Peeled[]>();
    // a value naming only names that hold one literal, filled: `R=$D/.bin/x` with `D=/tmp/d` is /tmp/d/.bin/x
    const single = (value: string) =>
        value.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (m, n: string) => {
            const b = literals.get(n);
            return b?.values.length === 1 && !b.isUnknown
                ? (b.values[0] ?? m)
                : m;
        });
    // the words a lone `$( echo … )` or `$( printf … )` prints
    const echoed = (subst: Segment[]) => {
        const [only] = subst;
        if (subst.length !== 1 || !only) return undefined;
        const inner = peel(only.words);
        return ['echo', 'printf'].includes(inner.name) ? inner.args : undefined;
    };
    // a `[[ … ]]` split at its `&&` leaves test operands as segments; they run nothing
    let isInTest = false;
    const filled = parsed.segments.map((s) => {
        const isTest = isInTest;
        isInTest = testSpan(s.words, isInTest);
        // a word bound to several literals: the command runs as each of them (a head), or takes each (an argument)
        const alternates = new Map<string, string[]>();
        const inherited = [...fed].flatMap(([name, by]) =>
            s.words.some((w) =>
                new RegExp(`\\$\\{?${name}(?![A-Za-z0-9_])`).test(w.text),
            )
                ? by
                : [],
        );
        const words = s.words.flatMap((w): Word[] => {
            const [, name, rest = ''] =
                w.text.match(
                    /^\$\{=?([A-Za-z_][A-Za-z0-9_]*|[@*0-9])\}(.*)$/s,
                ) ??
                w.text.match(/^\$([A-Za-z_][A-Za-z0-9_]*|[@*0-9])(\/.*)?$/s) ??
                [];
            const bound = name === undefined ? undefined : literals.get(name);
            const template =
                name === undefined ? undefined : templates.get(name);
            if (
                !bound?.values.length &&
                template !== undefined &&
                /^(?:\/|$)/.test(rest)
            )
                return [{ ...w, isExpanding: true, text: template + rest }];
            const one = bound?.values.length === 1 && !bound.isUnknown;
            const values = bound?.values.map((v) => v + rest) ?? [];
            const split = (v: string) =>
                v
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((text) => ({ isExpanding: false, text }));
            if (one)
                return w.hasQuote && name !== '@' && name !== '*'
                    ? [{ isExpanding: false, text: values[0] ?? '' }]
                    : split(values[0] ?? '');
            if (bound && !bound.isUnknown && values.length)
                alternates.set(w.text, values);
            const printed = w.text === '$(…)' ? echoed(s.subst) : undefined;
            if (printed)
                return printed.map((a) => ({
                    isExpanding: a.isExpanding,
                    isFilled: true,
                    text: a.text,
                }));
            return [w];
        });
        const texts = s.words.map((w) => w.text);
        const head = texts.findIndex(
            (t) => !/^[A-Za-z_][A-Za-z0-9_]*\+?=/s.test(t),
        );
        // a prefix assignment (`R=x cmd`) lasts for that command only, so it binds nothing for the rest of the line
        const assigning = s.words.filter(
            (w, i) =>
                (head < 0 || i > head) &&
                /^[A-Za-z_][A-Za-z0-9_]*\+?=/s.test(w.text),
        );
        for (const w of head < 0 ? s.words : assigning) {
            const m = w.text.match(/^([A-Za-z_][A-Za-z0-9_]*)(\+?)=(.*)$/s);
            if (m?.[1] === undefined) continue;
            const [, key, plus, value = ''] = m;
            templates.delete(key);
            fed.delete(key);
            const from = value.match(/^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?$/)?.[1];
            const via = from === undefined ? undefined : literals.get(from);
            const said = value === '$(…)' ? echoed(s.subst) : undefined;
            if (plus) bind(key, [], true);
            else if (!w.isExpanding) bind(key, [value]);
            else if (via) bind(key, via.values, via.isUnknown);
            else if (said)
                bind(
                    key,
                    [said.map((a) => a.text).join(' ')],
                    said.some((a) => a.isExpanding),
                );
            else if (!/[$`]/.test(single(value))) bind(key, [single(value)]);
            else {
                bind(key, [], true);
                if (value.includes('$(…)') && s.subst.length)
                    fed.set(
                        key,
                        s.subst.map((x) => peel(x.words)),
                    );
                else if (!/[`(]/.test(value)) templates.set(key, value);
            }
        }
        // the builtins that bind a name another way: a loop's words, read's here-string, `set --`'s positions, an unset
        const verb = texts[head < 0 ? texts.length : head];
        const after = s.words.slice(head + 1);
        if (verb === 'for' || verb === 'select') {
            const key = after[0]?.text ?? '';
            const list = after.slice(2);
            bind(
                key,
                list.filter((w) => !w.isExpanding).map((w) => w.text),
                after[1]?.text !== 'in' || list.some((w) => w.isExpanding),
            );
        } else if (
            verb === 'read' ||
            verb === 'mapfile' ||
            verb === 'readarray'
        ) {
            const here = after.findIndex((w) => w.text === '<<<');
            const said = here >= 0 ? after[here + 1] : undefined;
            for (const w of after.slice(0, here < 0 ? undefined : here))
                if (!/^-/.test(w.text))
                    bind(
                        w.text,
                        said && !said.isExpanding ? [said.text] : [],
                        !said || said.isExpanding,
                    );
        } else if (verb === 'set' && after[0]?.text === '--') {
            const list = after.slice(1);
            const isUnknown = list.some((w) => w.isExpanding);
            bind('@', [list.map((w) => w.text).join(' ')], isUnknown);
            bind('*', [list.map((w) => w.text).join(' ')], isUnknown);
            for (const [i, w] of list.entries())
                bind(String(i + 1), [w.text], w.isExpanding);
        } else if (verb && REBINDERS.has(verb))
            for (const w of after) {
                const key = w.text.match(/^([A-Za-z_][A-Za-z0-9_]*)/)?.[1];
                if (key && !w.text.includes('=')) bind(key, [], true);
            }
        return { ...s, alternates, inherited, isTest, words };
    });
    const peeled = filled.map((s) => ({
        ...peel(
            s.words,
            s.bodies.map((b) => b.text),
        ),
        s,
    }));
    peeled.forEach(({ s, ...c }, k) => {
        // a prefix assignment binds for its own command only
        for (const a of c.name ? [] : c.assigns) {
            const at = a.indexOf('=');
            const name = a.slice(0, at);
            const path = pathAssigned(a.slice(at + 1), s.subst);
            if (name.endsWith('+')) vars.delete(name.slice(0, -1));
            else if (path) vars.set(name, path);
            else vars.delete(name);
        }
        const appended = s.words[0]?.text.match(/^([A-Za-z_][A-Za-z0-9_]*)\+=/);
        if (appended?.[1]) vars.delete(appended[1]);
        // a command that rebinds a variable other than by `NAME=` (read, for, unset, declare, export R=…) forgets it
        if (REBINDERS.has(c.name))
            for (const w of c.args) vars.delete(w.text.replace(/\+?=.*$/, ''));
        sticky.push(
            ...[
                ...c.assigns,
                ...(c.name === 'export' ? c.args.map((w) => w.text) : []),
            ].filter((a) => /^GIT_(?:DIR|WORK_TREE)=/.test(a)),
        );
        if (s.isTest) return;
        // a bare redirect (`> f`, `exec > f`, `{ …; } > f`) writes with no command
        if (
            !c.name &&
            !c.writes.length &&
            !c.appends.length &&
            !c.assigns.length &&
            c.envSplit === undefined
        )
            return;
        if (c.name === 'git')
            c.args = c.args.map((w, i) =>
                c.args[i - 1]?.text === '-C'
                    ? { ...w, text: expand(w.text) }
                    : { ...w, text: gitLong(w.text) },
            );
        const piped: Peeled[] = [];
        for (let j = k - 1; j >= 0 && peeled[j]?.s.sep === '|'; j--)
            piped.push(peeled[j] as Peeled);
        const feeders = [
            ...s.subst.map((x) => peel(x.words)),
            ...piped,
            ...s.inherited,
        ];
        if (c.name === 'cd' || c.name === 'pushd' || c.name === 'popd') {
            const target = operands(c.args)[0];
            // `cd -`, `popd` and a bare `pushd` land where the line cannot say: left as a `$` the rules never trust
            const to =
                target === undefined && c.name !== 'cd'
                    ? '$OLDPWD'
                    : expand(target === '-' ? '$OLDPWD' : (target ?? '~'));
            dir = /^[/~$]/.test(to) ? to : `${dir}/${to}`;
        }
        // an argument keeps its `$` word for the rules that read it, beside every value it may take
        c.args = c.args.flatMap((w) => [
            w,
            ...(s.alternates.get(w.text) ?? []).flatMap((v) =>
                v
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((text) => ({ isExpanding: false, text })),
            ),
        ]);
        const runs = (s.alternates.get(c.name) ?? []).map((v): Peeled => {
            const [name = '', ...rest] = v.split(/\s+/).filter(Boolean);
            return {
                ...c,
                args: [
                    ...rest.map((text) => ({ isExpanding: false, text })),
                    ...c.args,
                ],
                head: { isExpanding: false, isFilled: true, text: name },
                name,
            };
        });
        for (const run of runs.length ? runs : [c])
            out.push({
                ...run,
                assigns: [...run.assigns, ...sticky],
                dir,
                feeders,
                sep: s.sep,
            });
    });
    return out;
}
// git takes any unique prefix of a long flag: `--har` is --hard. a prefix of one the rules read is read as it
const GIT_LONGS = [
    '--delete',
    '--force',
    '--force-with-lease',
    '--hard',
    '--mirror',
    '--no-gpg-sign',
    '--no-verify',
    '--staged',
    '--worktree',
];
function gitLong(word: string) {
    if (!/^--[a-z-]{2,}$/.test(word) || GIT_LONGS.includes(word)) return word;
    return (
        GIT_LONGS.filter((l) => l.startsWith(word)).sort(
            (a, b) => a.length - b.length,
        )[0] ?? word
    );
}
export const SHELLS = new Set([
    'sh',
    'bash',
    'zsh',
    'dash',
    'ksh',
    'mksh',
    'fish',
]);
// a shell or `source` reads its script from stdin through these operands
const STDIN_PATHS = new Set([
    '-',
    '/dev/stdin',
    '/dev/fd/0',
    '/proc/self/fd/0',
]);
// what a feeder writes to a shell's stdin: echo's words past its flags, each printf operand alone and together (its format
// fills them in), a heredoc body
function printed(f: Peeled): string[] {
    const texts = f.args.map((a) => a.text);
    if (f.name === 'echo') {
        const at = texts.findIndex((t) => !/^-[neE]+$/.test(t));
        return [texts.slice(at < 0 ? texts.length : at).join(' ')];
    }
    if (f.name === 'printf') {
        const ops = texts.slice(texts[0] === '--' ? 1 : 0);
        return [...ops, ops.slice(1).join(' ')];
    }
    return f.bodies;
}
// a word as the shell would read it back as one argv entry
const quoted = (w: string) => `'${w.replaceAll("'", "'\\''")}'`;
// the scripts a command runs that the line does not show as commands: a shell's `-c` script, or what it reads on stdin
// (a heredoc, a `<<<` string, an echo or a cat heredoc piped in); an eval's words; trap, alias and `!` git alias strings;
// env -S's string; `find -exec` and `fd -x` commands; a function's body
export function nestedScripts(c: Command): string[] {
    const texts = c.args.map((w) => w.text);
    const isSource = c.name === 'source' || c.name === '.';
    if (SHELLS.has(c.name) || isSource) {
        const dashC = texts.findIndex((t) => /^-[A-Za-z]*c[A-Za-z]*$/.test(t));
        if (dashC >= 0) {
            const script = texts.slice(dashC + 1).find((t) => t !== '--');
            return script === undefined ? [] : [script];
        }
        const script = operands(
            c.args.filter(
                (w, i) => w.text !== '<<<' && c.args[i - 1]?.text !== '<<<',
            ),
        ).filter((o) => !o.startsWith('<<<'));
        const isStdin =
            texts.some((t) => /^-[A-Za-z]*s[A-Za-z]*$/.test(t)) ||
            !script.length ||
            STDIN_PATHS.has(script[0] ?? '');
        if (!isStdin) return [];
        const here = texts.flatMap((t, i) =>
            t === '<<<'
                ? [texts[i + 1] ?? '']
                : t.startsWith('<<<')
                  ? [t.slice(3)]
                  : [],
        );
        const piped = c.feeders.flatMap(printed);
        return [...here, ...c.bodies, ...piped];
    }
    if (c.name === 'eval') return [texts.join(' ')];
    // a script held in a string: trap's action, an alias's body, a git alias that starts with `!`
    if (c.name === 'trap') return operands(c.args).slice(0, 1);
    if (c.name === 'alias')
        return operands(c.args).flatMap(
            (o) => o.match(/^[^=]+=(.+)$/s)?.[1] ?? [],
        );
    // a `!` alias runs its shell text, any other names a git subcommand with its flags
    if (c.name === 'git')
        return gitParts(c.args).configs.flatMap((k) => {
            const body = k.match(/^alias\.[^=]+=(.+)$/is)?.[1];
            if (body === undefined) return [];
            return body.startsWith('!') ? [body.slice(1)] : [`git ${body}`];
        });
    const out: string[] = [];
    if (c.envSplit !== undefined)
        out.push(
            [
                'env',
                c.envSplit,
                ...(c.name ? [quoted(c.name)] : []),
                ...texts.map(quoted),
            ].join(' '),
        );
    const runs = (from: number, end: (t: string) => boolean) => {
        const rest = texts.slice(from + 1);
        const stop = rest.findIndex(end);
        const words = stop < 0 ? rest : rest.slice(0, stop);
        if (words.length) out.push(words.map(quoted).join(' '));
    };
    if (c.name === 'find')
        texts.forEach((t, i) => {
            if (['-exec', '-execdir', '-ok', '-okdir'].includes(t))
                runs(i, (w) => w === ';' || w === '+');
        });
    if (c.name === 'fd')
        texts.forEach((t, i) => {
            if (['-x', '--exec', '-X', '--exec-batch'].includes(t))
                runs(i, () => false);
        });
    const brace = c.args.findIndex((w) => w.text === '{' && !w.hasQuote);
    if (brace >= 0) runs(brace, (w) => w === '}');
    return out;
}
// every command of a line, each nested script's commands included, so a lookup sees what a rule will
export function commandsDeep(
    command: string,
    cwd: string,
    depth = 0,
): Command[] {
    return commands(parse(command), cwd).flatMap((c) => [
        c,
        ...(depth < 8
            ? nestedScripts(c).flatMap((s) => commandsDeep(s, c.dir, depth + 1))
            : []),
    ]);
}
// a script the line never shows as typed: printed into a shell or `source`, a `<( … )` sourced, a git alias's body
export function hidingScript(c: Command) {
    if (
        c.name === 'git' &&
        gitParts(c.args).configs.some((k) => /^alias\./i.test(k))
    )
        return 'a git alias';
    if (c.name === 'source' || c.name === '.') return `${c.name} of a script`;
    const isDashC = c.args.some((w) => /^-[A-Za-z]*c[A-Za-z]*$/.test(w.text));
    const printer = c.feeders.find(
        (f) => f.name === 'echo' || f.name === 'printf',
    );
    if (SHELLS.has(c.name) && !isDashC && printer)
        return `${printer.name} piped into ${c.name}`;
    return undefined;
}
// a typed path the shell fills or climbs at run time: a variable, a glob, a `~user`, a `..`
export const isUnsafePath = (path: string) =>
    /[`$*?[{\\~]/.test(path) || /(?:^|\/)\.\.(?:\/|$)/.test(path);
// git's own options that take the next word as their value
const GIT_VALUED = new Set([
    '--git-dir',
    '--work-tree',
    '--namespace',
    '--attr-source',
    '--super-prefix',
    '--list-cmds',
]);
// git's own options before the subcommand; `-c` values kept, since two of them are floor
export function gitParts(args: Word[]) {
    const configs: string[] = [];
    let at: string | undefined;
    let i = 0;
    for (; i < args.length; i++) {
        const t = args[i]?.text ?? '';
        if (t === '-c') configs.push(args[++i]?.text ?? '');
        else if (t === '-C') at = args[++i]?.text;
        else if (t === '--config-env') configs.push(args[++i]?.text ?? '');
        else if (t.startsWith('--config-env='))
            configs.push(t.slice('--config-env='.length));
        else if (GIT_VALUED.has(t)) i++;
        else if (!isFlag(t)) break;
    }
    return {
        at,
        configs,
        sub: args[i]?.text ?? '',
        subArgs: args.slice(i + 1),
    };
}
export const or = (list: string[], fallback: string) =>
    list.length ? list : [fallback];
export const TRASH = 'trash <path> — recoverable from the macos trash';
export const STASH =
    'git stash push -u -- <your paths> — it sets only your work aside, untracked files included, recoverable';
// the one door that is a person: nothing safe does the job
export const ASK = 'no safe door here — ask clio, naming the target';
export const NEVER =
    'fix what the hook or the signer refused, then run it without the flag';
export const LANE = 'x lane commit — it commits named paths only';
// a path as the shell would land it: the job dir and ~ filled in, `.` and `..` walked; a path still holding a `$` stays unresolved
export function resolve(path: string, dir: string, ctx: Context) {
    const filled = path
        .replace(
            /^\$\{?CLAUDE_JOB_DIR\}?(?=\/|$)/,
            ctx.jobDir ?? '$CLAUDE_JOB_DIR',
        )
        .replace(/^(~|\$\{?HOME\}?)(?=\/|$)/, ctx.home ?? '~');
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
export function gitDir(c: Command, ctx: Context) {
    const dir = resolve(c.dir, '/', ctx);
    const { at } = gitParts(c.args);
    return at === undefined ? dir : resolve(at, dir, ctx);
}
// a git add's pathspecs as typed and where they land; globs, magic and unexpanded words are git's to read
export function adds(c: Command, ctx: Context) {
    if (c.name !== 'git') return [];
    const { sub, subArgs } = gitParts(c.args);
    if (sub !== 'add') return [];
    const dir = gitDir(c, ctx);
    return operands(subArgs)
        .filter((o) => !/[*?[$]/.test(o) && !o.startsWith(':'))
        .map((text) => ({ path: resolve(text, dir, ctx), text }));
}
// a resolved path under the session's own `$CLAUDE_JOB_DIR/tmp`
export function isJobTmp(path: string, ctx: Context) {
    return (
        !!ctx.jobDir &&
        path.startsWith(`${resolve(`${ctx.jobDir}/tmp`, '/', ctx)}/`)
    );
}
// where a command acts: git's own dir, else its cwd; undefined when an env or a flag points git at another repo
const GIT_REDIRECT_FLAG = /^--(?:git-dir|work-tree)(?:=|$)/;
export function actsIn(c: Command, ctx: Context) {
    const isRedirected =
        c.assigns.some((a) => /^GIT_(?:DIR|WORK_TREE)=/.test(a)) ||
        c.args.some((w) => GIT_REDIRECT_FLAG.test(w.text)) ||
        gitParts(c.args).configs.some((k) =>
            /^core\.(?:worktree|gitdir)=/i.test(k),
        );
    if (isRedirected) return undefined;
    return c.name === 'git' ? gitDir(c, ctx) : resolve(c.dir, '/', ctx);
}
// a command that acts inside the job's own tmp and stays there: its repo is a throwaway one, the git it runs is local
export function isThrowaway(c: Command, ctx: Context) {
    const dir = actsIn(c, ctx);
    return (
        dir !== undefined &&
        !dir.includes('$') &&
        isJobTmp(dir, ctx) &&
        !ctx.unsafeTmp?.has(dir)
    );
}
// every file a command writes, resolved: `>` and `>>` targets, `tee`, `sd` and `sed -i` files, python's `open(…, 'w')`.
// x-mod-holds' files are checked against it; a path held in a variable is not read
const APPEND = /^\d*&?>>$/;
const APPEND_JOINED = /^\d*&?>>([^&].*)$/;
