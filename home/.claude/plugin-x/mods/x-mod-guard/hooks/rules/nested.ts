import type { Word } from '../shell.ts';
import { parse } from '../shell.ts';
import {
    type Command,
    basename,
    commands,
    gitParts,
    herestrings,
    isFlag,
    operands,
    printed,
} from './command.ts';

// the scripts a line runs without showing them as commands, and every command of a line with them read in

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
    const herdr = herdrStarted(c);
    if (herdr) return [herdr];
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
function shellOperands(args: Word[]) {
    return args
        .filter((_, i) => !/^[-+][A-Za-z]*[oO]$/.test(args[i - 1]?.text ?? ''))
        .filter((w) => !/^[-+]/.test(w.text) || w.text === '-')
        .map((w) => w.text);
}
// a shell given no script, `-s` or a lone `-` reads its script on stdin, its operands only positional args; an `-s`
// past the script is the script's own arg
function readsStdin(args: Word[]) {
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
// the command `hc exec` runs, or the program an `hc run` starts that is no claude: judged as
// the line it is, so `hc run -- hc kill <t>` meets herdr-close (sixth sense round 2 on a3cfd939); one word holding a space
// reads as the line it spells, the cautious side of a program name no shell splits
// as `hc exec --help` lists them; a missed one reads its value as the program (sixth sense round 3: `--timeout 30`)
const HC_EXEC_VALUED = new Set(['--cwd', '--env', '--on', '--timeout']);
// `hc run`'s own options that take the next word as their value
const HC_RUN_VALUED = new Set([
    '--cwd',
    '--label',
    '--name',
    '--on',
    '--parent',
    '--timeout',
]);
const shellQuote = (w: string) => `'${w.replaceAll("'", `'\\''`)}'`;
function herdrStarted(c: Command) {
    if (c.name !== 'hc') return undefined;
    const words = c.args.map((w) => w.text);
    const verb = words.findIndex((w) => !w.startsWith('-'));
    if (words[verb] !== 'exec' && words[verb] !== 'run') return undefined;
    const valued = words[verb] === 'exec' ? HC_EXEC_VALUED : HC_RUN_VALUED;
    let i = verb + 1;
    for (; i < words.length; i++) {
        const w = words[i] ?? '';
        if (w === '--') {
            i++;
            break;
        }
        if (!w.startsWith('-')) break;
        if (valued.has(w)) i++;
    }
    const argv = words.slice(i);
    if (!argv.length || basename(argv[0] ?? '') === 'claude') return undefined;
    return argv.length === 1 ? argv[0] : argv.map(shellQuote).join(' ');
}
