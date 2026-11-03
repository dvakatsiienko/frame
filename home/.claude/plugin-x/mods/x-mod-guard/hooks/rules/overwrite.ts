import { type Word, parse } from '../shell.ts';
import {
    type Command,
    type Context,
    type Refusal,
    SD_VALUE,
    basename,
    commands,
    commandsDeep,
    gitDir,
    gitParts,
    hasFlag,
    isFlag,
    isJobTmp,
    operands,
    resolve,
} from './command.ts';

// an mv or cp's dest, then the file each source lands on when that dest is a dir
export function landings(c: Command, ctx: Context) {
    // `cp -t <dir> <src…>` names its dest first; rsync's and ditto's -t is another flag
    const t = ['cp', 'mv', 'ln', 'install'].includes(c.name)
        ? c.args.findIndex((w) => w.text === '-t')
        : -1;
    const into = t >= 0 ? c.args[t + 1]?.text : undefined;
    const ops = operands(
        t < 0 ? c.args : c.args.filter((_, i) => i !== t && i !== t + 1),
    );
    const dest = into ?? ops.at(-1);
    const sources = into === undefined ? ops.slice(0, -1) : ops;
    if (!sources.length || dest === undefined) return [];
    const to = resolve(dest, resolve(c.dir, '/', ctx), ctx);
    return [
        { path: to, text: dest },
        ...sources.map((src) => ({
            path: `${to}/${basename(src)}`,
            text: dest,
        })),
    ];
}
// the paths a command may write over, for the caller to look up on disk
export function overwrittenPaths(
    command: string,
    cwd: string,
    ctx: Context = {},
) {
    return commandsDeep(command, cwd).flatMap((c) => {
        const dir = resolve(c.dir, '/', ctx);
        const moved =
            c.name === 'mv' || c.name === 'cp'
                ? landings(c, ctx).map((l) => l.path)
                : [];
        return [...c.writes.map((w) => resolve(w, dir, ctx)), ...moved];
    });
}
// python's `open('<file>', 'w'|'a'|'x')`, read off the raw text since its script is no shell
export const pythonWrites = (command: string, cwd: string, ctx: Context) =>
    [...command.matchAll(/open\(\s*['"]([^'"]+)['"]\s*,\s*['"][wax]/g)].flatMap(
        (m) => (m[1] ? [resolve(m[1], cwd, ctx)] : []),
    );
// the files one command writes: its redirects, a cp, mv, ln, install, rsync or ditto dest, and each tool's own file flag
export function commandWrites(c: Command, ctx: Context) {
    const dir = resolve(c.dir, '/', ctx);
    const out: string[] = [];
    if (['cp', 'mv', 'ln', 'install', 'rsync', 'ditto'].includes(c.name))
        out.push(...landings(c, ctx).map((l) => l.path));
    const named = [...c.writes, ...c.appends];
    const ops = operands(c.args);
    if (c.name === 'tee') named.push(...ops);
    if (c.name === 'perl' && c.args.some((w) => /^-\w*i/.test(w.text)))
        named.push(...perlFiles(c.args));
    if (c.name === 'dd')
        named.push(...ops.flatMap((o) => o.match(/^of=(.+)$/)?.[1] ?? []));
    if (c.name === 'curl') named.push(...curlOutputs(c.args));
    if (c.name === 'sd') named.push(...sdFiles(c.args));
    if (c.name === 'sed') named.push(...sedFiles(c.args));
    const isPlain = (n: string) =>
        !!n && !n.startsWith('/dev/') && !n.includes('$');
    for (const n of named) if (isPlain(n)) out.push(resolve(n, dir, ctx));
    // a checkout's files sit in the tree git runs in, -C included
    if (c.name === 'git')
        for (const n of checkedOut(c))
            if (isPlain(n)) out.push(resolve(n, gitDir(c, ctx), ctx));
    return out;
}
// every file a line writes, a nested shell's included
export function writtenPaths(command: string, cwd: string, ctx: Context = {}) {
    return [
        ...new Set([
            ...pythonWrites(command, cwd, ctx),
            ...commandsDeep(command, cwd).flatMap((c) => commandWrites(c, ctx)),
        ]),
    ];
}
// curl's -o / --output file
function curlOutputs(args: Word[]) {
    return args.flatMap((w, i) =>
        w.text === '--output' || /^-[A-Za-z]*o$/.test(w.text)
            ? [args[i + 1]?.text ?? '']
            : w.text.startsWith('--output=')
              ? [w.text.slice('--output='.length)]
              : [],
    );
}
// the worktree files a `git checkout -- <f>` or `git restore <f>` writes back
function checkedOut(c: Command) {
    const { sub, subArgs } = gitParts(c.args);
    const texts = subArgs.map((w) => w.text);
    // `--staged` alone writes the index, never the worktree
    const isStagedOnly =
        hasFlag(subArgs, ['--staged'], 'S') &&
        !hasFlag(subArgs, ['--worktree'], 'W');
    if (sub === 'restore') return isStagedOnly ? [] : operands(subArgs);
    const dash = texts.indexOf('--');
    return sub === 'checkout' && dash >= 0 ? texts.slice(dash + 1) : [];
}
// perl's files: every operand past its script, which is the first operand unless an `-e`/`-E` holds it
function perlFiles(args: Word[]) {
    const isExpr = (t = '') => /^-\w*[eE]$/.test(t);
    const ops = args
        .filter((w, i) => !isFlag(w.text) && !isExpr(args[i - 1]?.text))
        .map((w) => w.text);
    return args.some((w) => isExpr(w.text)) ? ops : ops.slice(1);
}
// sd's files follow its find and replace; a flag in SD_VALUE eats the word after it
function sdFiles(args: Word[]) {
    const out: string[] = [];
    let isRest = false;
    for (let i = 0; i < args.length; i++) {
        const t = args[i]?.text ?? '';
        if (isRest) out.push(t);
        else if (t === '--') isRest = true;
        else if (SD_VALUE.has(t)) i++;
        else if (!isFlag(t)) out.push(t);
    }
    return out.slice(2);
}
// sed edits in place only with -i; macOS spells it `-i ''`, and -e or -f carries the script
function sedFiles(args: Word[]) {
    if (!args.some((a) => /^(-i|--in-place)/.test(a.text))) return [];
    const kept = args.filter(
        (a, i) => !(a.text === '' && args[i - 1]?.text === '-i'),
    );
    const isScripted = kept.some((a) => /^-[ef]$/.test(a.text));
    const files: string[] = [];
    for (let i = 0; i < kept.length; i++) {
        const t = kept[i]?.text ?? '';
        if (/^-[ef]$/.test(t)) i++;
        else if (!isFlag(t)) files.push(t);
    }
    return isScripted ? files : files.slice(1);
}
// the file a `>`, an mv, a cp -f or a cp /dev/null would empty or replace; the job's own tmp is its scratch to write over
// a claude session's own scratchpad holds only what that session wrote (PK-138: 8 refusals in 14 days, and the >>
// workaround glued two commit messages)
const SCRATCHPAD =
    /^(\/private)?\/tmp\/claude-\d+\/[^/]+\/[0-9a-f-]{36}\/scratchpad\/[^/]/;
export function overwrite(c: Command, ctx: Context): Refusal | undefined {
    const dir = resolve(c.dir, '/', ctx);
    const isFile = (p: string) =>
        ctx.kinds?.get(p) === 'file' &&
        !isJobTmp(p, ctx) &&
        !SCRATCHPAD.test(p);
    const written = c.writes.filter((w) => isFile(resolve(w, dir, ctx)));
    if (written.length)
        return {
            door: '>> to append, a new path, or the Write tool after reading the file',
            rule: 'overwrite',
            targets: written,
            why: 'a > redirect empties the file before the command runs',
        };
    const isNull = c.name === 'cp' && operands(c.args)[0] === '/dev/null';
    const isForced =
        c.name === 'mv' ||
        (c.name === 'cp' && hasFlag(c.args, ['--force'], 'f'));
    // the last of -n, -i and -f wins: `mv -nf` overwrites
    const last = c.args
        .flatMap((w) =>
            w.text === '--no-clobber' || w.text === '--interactive'
                ? ['n']
                : w.text === '--force'
                  ? ['f']
                  : /^-[A-Za-z]+$/.test(w.text)
                    ? [...w.text.slice(1)].filter((ch) => 'nif'.includes(ch))
                    : [],
        )
        .at(-1);
    const isKept = last === 'n' || last === 'i';
    if (!(isNull || isForced) || isKept) return undefined;
    const [to, ...into] = landings(c, ctx);
    if (!to) return undefined;
    if (
        !isFile(to.path) &&
        !(ctx.kinds?.get(to.path) === 'dir' && into.some((l) => isFile(l.path)))
    )
        return undefined;
    if (isNull)
        return {
            door: 'the Write tool after reading the file',
            rule: 'overwrite',
            targets: [to.text],
            why: 'cp /dev/null empties the file',
        };
    return {
        door: `${c.name} -n, or trash the old file first`,
        rule: 'overwrite',
        targets: [to.text],
        why: `${c.name} replaces the file already there, silently`,
    };
}
