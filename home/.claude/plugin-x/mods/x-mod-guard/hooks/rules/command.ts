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
    // the files earlier calls of the running turn wrote, by resolved path: a run of one reads its text
    written?: ReadonlyMap<string, string>;
    // the session is clio's: it cleans its fleet's scratch trees and branches on its own
    isClio?: boolean;
    // the call holds this session until it ends: no run_in_background
    isForeground?: boolean;
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
    // the body files a ticket create hands linear, as read before the call; undefined when the hook cannot read one (FRM-486)
    worthFiles?: Map<string, string | undefined>;
    // a create's milestone id, resolved to its name through linear
    milestoneNames?: Map<string, string>;
    // the herdr closes (herdr-close.ts's herdrCloseKey) whose terminals herdr named, none of them a live seat
    herdrSafe?: Set<string>;
};
// a spawn's brief file as found on disk: whether it names codie's skill, and whether x brief check stamped its bytes
export type Brief = { isCodie: boolean; isStamped: boolean };
// a file a command writes: its resolved path, the text, and whether the text is appended
export type Written = [path: string, text: string, isAppend?: boolean];
export type Verdict =
    | { kind: 'run' }
    | { kind: 'refused'; refusal: Refusal }
    | { kind: 'escaped'; refusals: Refusal[] };
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
// the linear teams whose ticket ids the rules read: `x schema linear` lists the workspace's, and a new team joins here, in the `sign-ask` twin and in x-mod-stash's `ticketOf`
export const TICKET_KEY = ['FRM', 'BYT'].join('|');
// a line that reads its pipe's real exit: a pipe into jq hides nothing there
export const PIPE_READ = /\bpipefail\b|\bpipestatus\b/i;
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
    ['gtimeout', ['-s', '-k', '--signal', '--kill-after']],
    ['flock', ['-w', '-E', '--timeout', '--conflict-exit-code']],
    ['watch', ['-n', '--interval']],
    ['chronic', []],
    ['unbuffer', []],
    ['bunx', ['-p', '--package']],
    ['pnpx', []],
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
// the wrapper `x as <member>` leaves on the command it runs, the member after it
export const X_AS = 'x as ';
export const asMember = (c: { wrappers: string[] }) =>
    c.wrappers.find((w) => w.startsWith(X_AS))?.slice(X_AS.length);
// a runner whose verb runs the next word as a command: `pnpm exec rm`, `npm exec`, `pnpm dlx`; the verb may sit past the
// runner's own flags (`pnpm -C app exec`), the values of those listed skipped with them
const RUNNERS = new Map([
    [
        'pnpm',
        {
            values: [
                '-C',
                '--dir',
                '-F',
                '--filter',
                '--filter-prod',
                '--loglevel',
                '--reporter',
                '--workspace-concurrency',
            ],
            verbs: ['exec', 'dlx'],
        },
    ],
    [
        'npm',
        {
            values: ['-w', '--workspace', '--prefix', '--loglevel'],
            verbs: ['exec', 'x'],
        },
    ],
    ['bun', { values: ['--cwd'], verbs: ['x'] }],
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
// `>& f` truncates f as `&> f` does; only a number or `-` after it names a descriptor
const TO_FILE = /^\d*>&$/;
const TO_FILE_JOINED = /^\d*>&(.+)$/;
const writes = (words: Word[]) =>
    [
        ...redirected(words, TRUNCATE, TRUNCATE_JOINED),
        ...redirected(words, TO_FILE, TO_FILE_JOINED).filter(
            (to) => !/^(\d+-?|-)$/.test(to),
        ),
    ].filter((to) => !HARMLESS_DEV.test(to));
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
    // `sudo -s` or `-i` with no command left runs root's shell, reading stdin
    let isRootShell = false;
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
        // `x as <member> [--] <command…>` runs its command as that member: a wrapper, its member kept on it
        const asAt =
            basename(head) === 'x'
                ? xAsCommand(words.slice(1).map((w) => w.text))
                : -1;
        if (asAt >= 0 && asAt + 1 < words.length) {
            const rest = words.slice(1, asAt + 1).map((w) => w.text);
            const member = rest
                .slice(rest.indexOf('as') + 1)
                .find((t) => !isFlag(t));
            wrappers.push(`${X_AS}${member ?? ''}`);
            words = words.slice(asAt + 1);
            continue;
        }
        // `x gate run [--] <command…>` runs its command in the queue: a wrapper, the command behind it read as itself
        const gateAt =
            basename(head) === 'x'
                ? xGateRunCommand(words.slice(1).map((w) => w.text))
                : -1;
        if (gateAt >= 0 && gateAt + 1 < words.length) {
            wrappers.push('x gate run');
            words = words.slice(gateAt + 1);
            continue;
        }
        const runner = RUNNERS.get(basename(head));
        let verbAt = 1;
        while (runner && isFlag(words[verbAt]?.text ?? ''))
            verbAt += runner.values.includes(words[verbAt]?.text ?? '') ? 2 : 1;
        const verb = words[verbAt]?.text ?? '';
        if (runner?.verbs.includes(verb)) {
            wrappers.push(`${basename(head)} ${verb}`);
            words = words.slice(verbAt + 1);
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
            if (
                wrapper === 'sudo' &&
                (/^-[A-Za-z]*[si]/.test(flag) ||
                    long === '--shell' ||
                    long === '--login')
            )
                isRootShell = true;
            // a short cluster read as getopt does: its first valued letter takes the rest, or the next word when last
            const letters: string =
                /^-[A-Za-z]/.test(flag) && !values.includes(flag)
                    ? flag.slice(1)
                    : '';
            const at = [...letters].findIndex((l) => values.includes(`-${l}`));
            const inline =
                at >= 0 && at < letters.length - 1
                    ? letters.slice(at + 1)
                    : undefined;
            const takes =
                values.includes(flag) || (at >= 0 && inline === undefined);
            if (isEnv)
                envArgs.push(
                    ...(at >= 0
                        ? [...letters.slice(0, at + 1)].map((l) => `-${l}`)
                        : [flag]),
                    ...(takes
                        ? [words[1]?.text ?? '']
                        : inline === undefined
                          ? []
                          : [inline]),
                );
            if (
                wrapper === 'env' &&
                (flag === '-S' ||
                    flag === '--split-string' ||
                    (letters[at] === 'S' && inline === undefined))
            )
                envSplit = words[1]?.text ?? '';
            else if (wrapper === 'env' && /^-S./.test(flag))
                envSplit = flag.slice(2);
            else if (wrapper === 'env' && long === '--split-string')
                envSplit = flag.slice(long.length + 1);
            words = words.slice(takes ? 2 : 1);
        }
        // timeout's duration, script's log file, flock's lock file
        if (['timeout', 'gtimeout', 'script', 'flock'].includes(wrapper))
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
        name: first ? basename(first.text) : isRootShell ? 'sh' : '',
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
    // the words a lone `$( echo … )`, `$( printf … )` or `$( cat <<EOF … )` prints: echo's past its flags, printf's
    // format filled, cat's text as one word that keeps its lines (split on whitespace where the $(…) is unquoted), each with
    // its trailing newlines dropped as the shell does
    const echoed = (subst: Segment[], isSplit: boolean): Word[] | undefined => {
        const [only] = subst;
        if (subst.length !== 1 || !only) return undefined;
        const inner = peel(
            only.words,
            only.bodies.map((b) => b.text),
        );
        if (inner.name === 'echo') {
            const at = inner.args.findIndex((a) => !/^-[neE]+$/.test(a.text));
            return at < 0 ? [] : inner.args.slice(at);
        }
        if (inner.name === 'printf') {
            const isExpanding = inner.args.some((a) => a.isExpanding);
            return (printed(inner)[0] ?? '')
                .replace(/\n+$/, '')
                .split(/[ \t]+/)
                .filter(Boolean)
                .map((text) => ({ isExpanding, text }));
        }
        const text =
            inner.name === 'cat' && !operands(inner.args).length
                ? printed(inner)[0]
                : undefined;
        if (text === undefined) return undefined;
        const kept = text.replace(/\n+$/, '');
        return (isSplit ? kept.split(/\s+/).filter(Boolean) : [kept]).map(
            (t) => ({ isExpanding: false, text: t }),
        );
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
            // a value the line cannot read beside known ones still runs as each known one
            if (values.length) alternates.set(w.text, values);
            const printed =
                w.text === '$(…)' ? echoed(s.subst, !w.hasQuote) : undefined;
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
            const said = value === '$(…)' ? echoed(s.subst, false) : undefined;
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
    if (f.name === 'printf')
        return [printfText(texts.slice(texts[0] === '--' ? 1 : 0))];
    return [...f.bodies, ...herestrings(texts)];
}
// what printf prints: its format with each conversion filled from the operands in turn, the format reused while operands
// last, and `\n`, `\t`, `\0` read as bash does (a NUL, xargs -0's split, as a line end)
export function printfText([format = '', ...rest]: string[]) {
    const conversion = /%[-+ #0-9.]*([sbdiqcxX%])/g;
    const isFilling = [...format.matchAll(conversion)].some(
        (m) => m[1] !== '%',
    );
    let at = 0;
    let out = '';
    do
        out += format.replace(conversion, (_m, k: string) =>
            k === '%' ? '%' : (rest[at++] ?? ''),
        );
    while (isFilling && at < rest.length);
    return out
        .replaceAll('\\n', '\n')
        .replaceAll('\\t', '\t')
        .replaceAll('\\0', '\n');
}
// the strings a command's `<<<` hands its stdin, joined or a word apart
const herestrings = (texts: string[]) =>
    texts.flatMap((t, i) =>
        t === '<<<'
            ? [texts[i + 1] ?? '']
            : t.startsWith('<<<')
              ? [t.slice(3)]
              : [],
    );
// ssh's options that take the next word as their value
const SSH_VALUED = new Set([
    '-B',
    '-b',
    '-c',
    '-D',
    '-E',
    '-e',
    '-F',
    '-I',
    '-i',
    '-J',
    '-L',
    '-l',
    '-m',
    '-O',
    '-o',
    '-p',
    '-Q',
    '-R',
    '-S',
    '-W',
    '-w',
]);
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
            if (script !== undefined) return [script];
            // `… | xargs bash -c`: each item xargs reads becomes the script
            return c.wrappers.includes('xargs')
                ? c.feeders.flatMap(printed)
                : [];
        }
        const args = c.args.filter(
            (w, i) =>
                w.text !== '<<<' &&
                c.args[i - 1]?.text !== '<<<' &&
                !w.text.startsWith('<<<'),
        );
        const isStdin =
            readsStdin(args) || STDIN_PATHS.has(shellOperands(args)[0] ?? '');
        if (!isStdin) return [];
        const piped = c.feeders.flatMap(printed);
        return [...herestrings(texts), ...c.bodies, ...piped];
    }
    // su runs its -c string, or else what it reads on stdin, in the user's shell
    if (c.name === 'su') {
        const inline = texts.find((t) => t.startsWith('--command='));
        if (inline) return [inline.slice('--command='.length)];
        const at = texts.findIndex(
            (t) => /^-[A-Za-z]*c[A-Za-z]*$/.test(t) || t === '--command',
        );
        if (at >= 0) return texts.slice(at + 1, at + 2);
        return [
            ...herestrings(texts),
            ...c.bodies,
            ...c.feeders.flatMap(printed),
        ];
    }
    // ssh runs its command, or else what it reads on stdin, in the remote shell
    if (c.name === 'ssh') {
        let i = 0;
        while (i < texts.length && isFlag(texts[i] ?? ''))
            i += SSH_VALUED.has(texts[i] ?? '') ? 2 : 1;
        // options, then one `--`, may follow the host too
        let at = i + 1;
        while (
            at < texts.length &&
            isFlag(texts[at] ?? '') &&
            texts[at] !== '--'
        )
            at += SSH_VALUED.has(texts[at] ?? '') ? 2 : 1;
        if (texts[at] === '--') at++;
        const remote = texts.slice(at);
        const stdin = [
            ...herestrings(texts),
            ...c.bodies,
            ...c.feeders.flatMap(printed),
        ];
        if (!remote.length) return stdin;
        // a remote shell with no script of its own reads the stdin ssh hands it
        const [head] = commands(parse(remote.join(' ')), c.dir);
        const isShellOnStdin =
            head !== undefined &&
            SHELLS.has(head.name) &&
            !head.args.some((w) => /^-[A-Za-z]*c[A-Za-z]*$/.test(w.text)) &&
            readsStdin(head.args);
        return [remote.join(' '), ...(isShellOnStdin ? stdin : [])];
    }
    if (c.name === 'eval') return [texts.join(' ')];
    // a script held in a string: trap's action, an alias's body, a git alias that starts with `!`
    if (c.name === 'trap') return operands(c.args).slice(0, 1);
    if (c.name === 'alias')
        return operands(c.args).flatMap(
            (o) => o.match(/^[^=]+=(.+)$/s)?.[1] ?? [],
        );
    // a `-c alias.<name>=<body>` runs for the call that names it, with that call's args; a persisted alias is read as set
    if (c.name === 'git') {
        const { configs, sub, subArgs } = gitParts(c.args);
        const persisted = persistedAlias(c);
        return [
            ...configs.flatMap((k) => {
                const [, name, body] = k.match(/^alias\.([^=]+)=(.+)$/is) ?? [];
                if (body === undefined) return [];
                const isNamed = sub.toLowerCase() === name?.toLowerCase();
                return [aliasRun(body, isNamed ? subArgs : [])];
            }),
            ...(persisted ? [aliasRun(persisted[1], [])] : []),
        ];
    }

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
// the files a command writes with the text it writes them: a heredoc into cat or tee, an echo or a printf format, each to its
// `>`, `>>` and tee targets, resolved where the command runs; an append is marked so it adds to the text written before
export function writtenScripts(c: Command, ctx: Context): Written[] {
    const text =
        c.name === 'echo' || c.name === 'printf'
            ? printed(c)[0]
            : (c.name === 'cat' || c.name === 'tee') && c.bodies.length
              ? c.bodies.join('\n')
              : undefined;
    if (text === undefined) return [];
    const tees = c.name === 'tee' ? operands(c.args) : [];
    const isTeeAppend = hasFlag(c.args, ['--append'], 'a');
    return [
        ...c.writes.map((p) => [p, false] as const),
        ...c.appends.map((p) => [p, true] as const),
        ...tees.map((p) => [p, isTeeAppend] as const),
    ].map(([p, isAppend]) => [resolve(p, c.dir, ctx), text, isAppend]);
}
// stands for text the turn wrote that the guard could not keep: past its size cap, or edited in a way the kept text misses
export const UNREAD = '\u0000x-mod-guard: unread';
// the writes laid over the files written so far, in order: `>` replaces a file's text, `>>` adds to it; newest last
export function laidOver(files: Map<string, string>, writes: Written[]) {
    for (const [path, text, isAppend] of writes) {
        const before = isAppend ? files.get(path) : undefined;
        files.delete(path);
        files.set(path, before === undefined ? text : `${before}\n${text}`);
    }
    return files;
}
// the alias a `git config [--global] [set] alias.<name> <body>` persists, its name lowercased as git reads it
export function persistedAlias(c: Command): [string, string] | undefined {
    if (c.name !== 'git') return undefined;
    const { sub, subArgs } = gitParts(c.args);
    const ops = operands(subArgs);
    const [key, body] = ops[0] === 'set' ? ops.slice(1) : ops;
    const name =
        sub === 'config' ? key?.match(/^alias\.(.+)$/is)?.[1] : undefined;
    return name && body ? [name.toLowerCase(), body] : undefined;
}
// what a git alias runs: a `!` body's shell text, any other body as a git subcommand, the call's own args handed on
export function aliasRun(body: string, args: Word[]) {
    const tail = args.map((w) => ` ${quoted(w.text)}`).join('');
    return body.startsWith('!')
        ? `${body.slice(1)}${tail}`
        : `git ${body}${tail}`;
}
// a shell's operands: past its flags and the option names `-o`/`+o`/`-O`/`+O` take
export function shellOperands(args: Word[]) {
    return args
        .filter((_, i) => !/^[-+][A-Za-z]*[oO]$/.test(args[i - 1]?.text ?? ''))
        .filter((w) => !/^[-+]/.test(w.text) || w.text === '-')
        .map((w) => w.text);
}
// a shell given no script, `-s` or a lone `-` reads its script on stdin, its operands only positional args; an `-s`
// past the script is the script's own arg
export function readsStdin(args: Word[]) {
    const [first] = shellOperands(args);
    const at = args.findIndex(
        (w, i) =>
            !/^[-+][A-Za-z]*[oO]$/.test(args[i - 1]?.text ?? '') &&
            (!/^[-+]/.test(w.text) || w.text === '-'),
    );
    return (
        first === undefined ||
        first === '-' ||
        args.slice(0, at).some((w) => /^-[A-Za-z]*s[A-Za-z]*$/.test(w.text))
    );
}
// the file a command runs as a script: a shell's or `source`'s first operand, what a shell reads on stdin from a `< file`
// or a `cat file |`, or a head typed as a path (`./x.sh`)
export function scriptRun(c: Command, ctx: Context) {
    const isSource = c.name === 'source' || c.name === '.';
    const texts = c.args.map((w) => w.text);
    const isDashC = texts.some((t) => /^-[A-Za-z]*c[A-Za-z]*$/.test(t));
    const [feeder] = c.feeders;
    const catted =
        c.feeders.length === 1 && feeder?.name === 'cat'
            ? operands(feeder.args)
            : [];
    const stdin =
        c.reads.at(-1) ?? (catted.length === 1 ? catted[0] : undefined);
    const [first] = shellOperands(c.args);
    const isOnStdin = SHELLS.has(c.name) && readsStdin(c.args);
    const path =
        (SHELLS.has(c.name) || isSource) && !isDashC
            ? isOnStdin
                ? stdin
                : first
            : c.head?.text.includes('/')
              ? c.head.text
              : undefined;
    return path === undefined || STDIN_PATHS.has(path)
        ? undefined
        : resolve(path, c.dir, ctx);
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
// where `x [flags] as <member> [flags] [--]` hands over its command, or -1: x takes flags before its family, and the
// member's own flags sit before or after it
// where the command of `x gate run [--] <command…>` starts among x's words, -1 for any other x call
function xGateRunCommand(words: string[]) {
    // a word behind a flag may be that flag's value, so the family is the first `gate` with only such words ahead of it
    const family = words.findIndex(
        (w, i) =>
            w === 'gate' &&
            words
                .slice(0, i)
                .every(
                    (v, j) =>
                        v.startsWith('-') || words[j - 1]?.startsWith('-'),
                ),
    );
    const verb = words.findIndex((w, i) => i > family && !w.startsWith('-'));
    if (family < 0 || words[verb] !== 'run') return -1;
    for (let i = verb + 1; i < words.length; i++) {
        if (words[i] === '--') return i + 1;
        if (!words[i]?.startsWith('-')) return i;
    }
    return -1;
}
function xAsCommand(words: string[]) {
    const family = words.findIndex(
        (w, i) =>
            (w === 'linear' || w === 'as') &&
            words
                .slice(0, i)
                .every(
                    (v, j) =>
                        v.startsWith('-') || words[j - 1]?.startsWith('-'),
                ),
    );
    if (words[family] !== 'as') return -1;
    let isMemberRead = false;
    for (let i = family + 1; i < words.length; i++) {
        const w = words[i] ?? '';
        if (w === '--') return i + 1;
        if (w.startsWith('-')) continue;
        if (isMemberRead) return i;
        isMemberRead = true;
    }
    return -1;
}
