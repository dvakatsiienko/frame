import type { Parsed, Sep, Word } from '../shell.ts';
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
};
// a spawn's brief file as found on disk: whether it names codie's skill, and whether x brief check stamped its bytes
export type Brief = { isCodie: boolean; isStamped: boolean };
export type Verdict =
    | { kind: 'run' }
    | { kind: 'refused'; refusal: Refusal }
    | { kind: 'escaped'; refusals: Refusal[]; targets: string[] };
// wrappers: the peeled heads (`sudo`, `env`); writes: the targets of its `>` redirects; reads: of its `<`
type Peeled = {
    name: string;
    args: Word[];
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
export const SD_VALUE = new Set(['-n', '--max-replacements', '-f', '--flags']);
const REDIRECT = /^\d*(>>?|<|&>>?)&?$/;
const REDIRECT_JOINED = /^\d*(>>?|<|&>>?)&?\S/;
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
// a `>` that truncates its target; `>>` appends and `>&` names a descriptor
const TRUNCATE = /^\d*&?>$/;
const TRUNCATE_JOINED = /^\d*&?>([^>&].*)$/;
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
        (to) => !to.startsWith('/dev/'),
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
export function peel(raw: Word[]): Peeled {
    let words = dropRedirects(raw);
    const assigns: string[] = [];
    const wrappers: string[] = [];
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
        wrappers.push(basename(head));
        words = words.slice(1);
        while (isFlag(words[0]?.text ?? '')) {
            const flag = words[0]?.text ?? '';
            words = words.slice(values.includes(flag) ? 2 : 1);
        }
        // timeout's duration
        if (basename(head) === 'timeout') words = words.slice(1);
    }
    const [first, ...args] = words;
    return {
        appends: redirected(raw, APPEND, APPEND_JOINED),
        args,
        assigns,
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
    if (!value.startsWith('$(')) return undefined;
    for (const x of subst) {
        const m = peel(x.words);
        if (m.name !== 'mktemp') continue;
        const ops = operands(m.args);
        if (hasFlag(m.args, ['--directory'], 'd') && ops[0]) return ops[0];
    }
    return undefined;
}
// each segment as the command it runs, `cd` followed; a `cd $R` or `git -C $R` follows a `R=<path>` set earlier in the command
export function commands(parsed: Parsed, cwd: string): Command[] {
    const out: Command[] = [];
    let dir = cwd;
    const vars = new Map<string, string>();
    const expand = (t: string) =>
        t.replace(
            /^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?(?=\/|$)/,
            (m, name: string) => vars.get(name) ?? m,
        );
    const peeled = parsed.segments.map((s) => ({ ...peel(s.words), s }));
    peeled.forEach(({ s, ...c }, k) => {
        for (const a of c.assigns) {
            const at = a.indexOf('=');
            const path = pathAssigned(a.slice(at + 1), s.subst);
            if (path) vars.set(a.slice(0, at), path);
            else vars.delete(a.slice(0, at));
        }
        if (!c.name) return;
        if (c.name === 'git')
            c.args = c.args.map((w, i) =>
                c.args[i - 1]?.text === '-C'
                    ? { ...w, text: expand(w.text) }
                    : w,
            );
        const piped: Peeled[] = [];
        for (let j = k - 1; j >= 0 && peeled[j]?.s.sep === '|'; j--)
            piped.push(peeled[j] as Peeled);
        const feeders = [...s.subst.map((x) => peel(x.words)), ...piped];
        if (c.name === 'cd') {
            const to = expand(c.args[0]?.text ?? '~');
            dir = /^[/~$]/.test(to) ? to : `${dir}/${to}`;
        }
        out.push({ ...c, dir, feeders, sep: s.sep });
    });
    return out;
}
// every command of a line, a nested shell's script and an eval's words included, so a lookup sees what a rule will
const NESTED_SHELLS = new Set(['sh', 'bash', 'zsh']);
export function commandsDeep(command: string, cwd: string): Command[] {
    return commands(parse(command), cwd).flatMap((c) => {
        const dashC = NESTED_SHELLS.has(c.name)
            ? c.args.findIndex((w) => /^-[A-Za-z]*c[A-Za-z]*$/.test(w.text))
            : -1;
        const script = dashC >= 0 ? c.args[dashC + 1]?.text : undefined;
        const nested = script
            ? commandsDeep(script, c.dir)
            : c.name === 'eval'
              ? commandsDeep(c.args.map((w) => w.text).join(' '), c.dir)
              : [];
        return [c, ...nested];
    });
}
// git's own options before the subcommand; `-c` values kept, since two of them are floor
export function gitParts(args: Word[]) {
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
        c.args.some((w) => GIT_REDIRECT_FLAG.test(w.text));
    if (isRedirected) return undefined;
    return c.name === 'git' ? gitDir(c, ctx) : resolve(c.dir, '/', ctx);
}
// a command that acts inside the job's own tmp and stays there: its repo is a throwaway one, the git it runs is local
export function isThrowaway(c: Command, ctx: Context) {
    const dir = actsIn(c, ctx);
    return dir !== undefined && isJobTmp(dir, ctx) && !ctx.unsafeTmp?.has(dir);
}
// every file a command writes, resolved: `>` and `>>` targets, `tee`, `sd` and `sed -i` files, python's `open(…, 'w')`.
// x-mod-holds' files are checked against it; a path held in a variable is not read
const APPEND = /^\d*&?>>$/;
const APPEND_JOINED = /^\d*&?>>([^&].*)$/;
