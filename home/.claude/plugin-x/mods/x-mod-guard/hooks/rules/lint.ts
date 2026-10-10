import type { Parsed, Word } from '../shell.ts';
import {
    type Command,
    LANE,
    type Refusal,
    SD_VALUE,
    gitParts,
    hasFlag,
    isFlag,
    operands,
} from './command.ts';

const GREPS = new Set([
    'grep',
    'egrep',
    'fgrep',
    'rg',
    'ugrep',
    'head',
    'tail',
]);
// a script named for a gate, a family member included: `typecheck`, `test:unit`, `mods:test`, `x-go:gate`
const GATE = /(^|:)(typecheck|test|check|tsc|vitest|gate)(:|$)/;
// a gate tool run to list or print, which checks nothing
const LISTING = [
    '--help',
    '-h',
    '--version',
    '-v',
    '--listFiles',
    '--listFilesOnly',
    '--showConfig',
];
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
export function lint(
    c: Command,
    next: Command | undefined,
): Refusal | undefined {
    const ops = operands(c.args);
    const pipedTo =
        c.sep === '|' && next && GREPS.has(next.name) ? next.name : undefined;
    // a knowledge read is logged as read: one whose text never reaches the session fakes the proof (FRM-371)
    if (
        c.name === 'x' &&
        ops[0] === 'knowledge' &&
        ops[1] === 'read' &&
        c.stdouts.length
    )
        return {
            door: `read it plainly: x knowledge read ${ops[2] ?? '<name>'}, its text in the session (| head is fine)`,
            rule: 'knowledge-read-hidden',
            targets: [ops[2] ?? 'knowledge'],
            why: `its stdout goes to ${c.stdouts.join(', ')}, so the read is logged and nothing reaches the session`,
        };
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
        // a `$` in the replacement is lost either way: the shell expands it in double quotes, sd reads `$NAME` as a capture ref in single
        const replacement = positional[1];
        if (replacement?.isExpanding || replacement?.text.includes('$'))
            return {
                door: 'python or the Edit tool for a replacement holding $',
                rule: 'sd-dollar',
                targets: ['sd'],
                why: replacement.isExpanding
                    ? 'the shell expands $ inside double quotes and the line ships hollow'
                    : 'sd reads $NAME in the replacement as a capture group and writes it empty',
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
    // the obsidian cli runs a verb on the active note: `delete --help` deleted memory-sweep.md (2026-10-07)
    if (c.name === 'obsidian' && ops.length > 0) {
        if (hasFlag(c.args, ['--help'], 'h'))
            return {
                door: 'obsidian --help, bare: it lists every verb with its options',
                rule: 'obsidian-help',
                targets: ['obsidian'],
                why: `obsidian ${ops[0]} --help runs ${ops[0]} on the active note instead of printing help`,
            };
        if (
            ops[0] === 'delete' &&
            !ops.some((o) => o.startsWith('path=') || o.startsWith('file='))
        )
            return {
                door: 'obsidian delete path=<vault path>',
                rule: 'obsidian-delete-target',
                targets: ['obsidian'],
                why: 'a delete with no file named deletes the active note',
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
    const isListing =
        hasFlag(c.args, LISTING) || ops.includes('list') || ops.includes('ls');
    const isGate =
        !isListing &&
        (['tsc', 'vitest'].includes(c.name) ||
            (['pnpm', 'npm', 'yarn', 'bun'].includes(c.name) &&
                ops.some((o) => GATE.test(o))));
    if (pipedTo && isGate)
        return {
            door: 'run the gate unpiped and read its exit code',
            rule: 'gate-pipe',
            targets: [pipedTo],
            why: `| ${pipedTo} turns a red gate quiet`,
        };
    // zsh never splits an unquoted parameter: `set -- $PIDS` sets one arg, and a watch on `$1` dies silent
    const dashes = c.args.findIndex((w) => w.text === '--');
    const unsplit =
        c.name === 'set' && dashes >= 0
            ? c.args
                  .slice(dashes + 1)
                  .find(
                      (w) =>
                          !w.hasQuote &&
                          /^\$\{?[A-Za-z_]/.test(w.text) &&
                          !w.text.startsWith('${='),
                  )
            : undefined;
    if (unsplit) {
        const name = unsplit.text.replace(/^\$\{?|\}$/g, '');
        return {
            door: `\${=${name}} — zsh's split — or write the items out`,
            rule: 'set-unsplit',
            targets: [unsplit.text],
            why: `zsh does not split ${unsplit.text}, so set -- gets one argument`,
        };
    }
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
    return undefined;
}
export function unbraced(parsed: Parsed): Refusal | undefined {
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
export function background(list: Command[]): Refusal | undefined {
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
