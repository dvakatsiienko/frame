import {
    type Command,
    type Context,
    type Refusal,
    commandsDeep,
    operands,
    resolve,
} from './command.ts';
import { linearWords } from './milestone.ts';

// FRM-486: a cli or mods ticket is planned only past ⚖️ worth it — a `## ⚖️ worth it` section saying what it removes
// and a `🔌 fleet wired: <caller>` line, or `none — fix|chore` for plain work (clio:pm's references/body.md); a re-sign
// carries a changed section or says why not
export const WORTH_DOOR =
    "add a `## ⚖️ worth it` section — what it removes against today's door, before → after, and a `🔌 fleet wired: <caller>` line naming who calls the new surface; plain work writes `none — fix` or `none — chore` under it";
export const RESIGN_DOOR =
    'change the `## ⚖️ worth it` section to the new scope, or end the re-signed line with `worth unchanged — <why>`';
const UNCHANGED = /worth unchanged —/;
const RESIGNED = /^✍️ re-signed\b/u;
const FENCE = /^\s*(```|~~~)/;
const HEADING = /^#{1,6}\s/;
const WORTH_HEADING = /^##\s+⚖\uFE0F?\s*worth it\s*$/iu;
const WIRED = /^\s*(?:-\s+)?🔌\s*fleet wired:\s*\S/u;
const PLAIN = /none — (?:fix|chore)\b/;

type Body = { file: string } | { text: string } | { hidden: true };
type Create = { project: string; milestone?: string; body: Body };

// a flag's value, spaced or joined
function flag(words: string[], name: string) {
    const at = words.findIndex((w) => w === name || w.startsWith(`${name}=`));
    if (at < 0) return undefined;
    const word = words[at] ?? '';
    return word === name ? words[at + 1] : word.slice(name.length + 1);
}

// the body a command hands linear: a file (resolved against its cwd), stdin's heredoc, an inline text, or one the line hides
function bodyOf(c: Command, words: string[], ctx: Context): Body {
    const file = flag(words, '--description-file');
    if (file === '-' || file === '/dev/stdin') {
        const heredoc = c.bodies[0];
        if (heredoc !== undefined) return { text: heredoc };
        // `cat <file> | linear issue create … --description-file -` hands linear that file
        const piped = c.feeders.find((f) => f.name === 'cat');
        const path = piped && operands(piped.args).at(-1);
        return path && !/[$`]/.test(path)
            ? { file: resolve(path, c.dir, ctx) }
            : { hidden: true };
    }
    if (file !== undefined)
        return /[$`]/.test(file)
            ? { hidden: true }
            : { file: resolve(file, c.dir, ctx) };
    const at = c.args.findIndex(
        (w) =>
            w.text === '--description' ||
            w.text === '-d' ||
            w.text.startsWith('--description='),
    );
    const word = c.args[at]?.text.includes('=') ? c.args[at] : c.args[at + 1];
    if (at < 0 || !word) return { text: '' };
    if (word.isExpanding) return { hidden: true };
    return {
        text: word.text.startsWith('--description=')
            ? word.text.slice('--description='.length)
            : word.text,
    };
}

// a raw `linear issue create`, typed or through `x as <member> -- linear …`; x's own verbs create nothing
function createOf(c: Command, ctx: Context): Create | undefined {
    const linear = linearWords(c);
    if (!linear || linear.isX) return undefined;
    const { words } = linear;
    const at = words.indexOf('issue');
    if (at < 0 || words[at + 1] !== 'create') return undefined;
    const project = flag(words, '--project');
    if (!project) return undefined;
    return {
        body: bodyOf(c, words, ctx),
        milestone: flag(words, '--milestone'),
        project,
    };
}
// the creates a command runs, for the caller to read their body files and resolve milestone ids
export function worthCreates(command: string, cwd: string, ctx: Context = {}) {
    return commandsDeep(command, cwd).flatMap((c) => {
        const create = createOf(c, ctx);
        return create ? [create] : [];
    });
}

export const isWorthScope = (project: string, milestone?: string) => {
    const p = project.toLowerCase();
    return p === 'cli' || (p === 'fleet' && /mods/i.test(milestone ?? ''));
};

// the `## ⚖️ worth it` section's text, any case, outside code fences, up to the next heading; undefined when there is none
export function worthSection(body: string) {
    let isFenced = false;
    let text: string[] | undefined;
    for (const line of body.split('\n')) {
        if (FENCE.test(line)) isFenced = !isFenced;
        if (isFenced) {
            text?.push(line);
            continue;
        }
        if (HEADING.test(line)) {
            if (text) break;
            if (WORTH_HEADING.test(line)) text = [];
            continue;
        }
        text?.push(line);
    }
    return text?.join('\n');
}
// linear stores markdown rewritten: `*` and `+` list markers as `-`, punctuation escaped (`\_`); both sides read alike
const plain = (line: string) =>
    line
        .replaceAll(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1')
        .replace(/^(\s*)[*+]\s/, '$1- ');
const collapse = (s: string | undefined) =>
    s?.split('\n').map(plain).join(' ').replaceAll(/\s+/g, ' ').trim();
// what a section lacks: all of it, its `🔌 fleet wired:` line, or nothing; plain work needs no wired line
function worthGap(body: string) {
    const section = worthSection(body);
    if (!collapse(section)) return 'section' as const;
    const lines = (section ?? '').split('\n').map(plain);
    return PLAIN.test(collapse(section) ?? '') ||
        lines.some((l) => WIRED.test(l))
        ? undefined
        : ('wired' as const);
}

export function worth(c: Command, ctx: Context): Refusal | undefined {
    const create = createOf(c, ctx);
    if (!create) return undefined;
    const milestone =
        (create.milestone && ctx.milestoneNames?.get(create.milestone)) ||
        create.milestone;
    if (!isWorthScope(create.project, milestone)) return undefined;
    const { body } = create;
    const text =
        'file' in body
            ? ctx.worthFiles?.get(body.file)
            : 'text' in body
              ? body.text
              : undefined;
    const gap = text === undefined ? 'section' : worthGap(text);
    if (!gap) return undefined;
    return {
        door: WORTH_DOOR,
        rule: 'worth',
        targets: [create.project],
        why:
            text === undefined
                ? 'the body cannot be read before the call, so it shows no `## ⚖️ worth it` section'
                : gap === 'wired'
                  ? `a ${create.project} ticket's \`## ⚖️ worth it\` section names no \`🔌 fleet wired: <caller>\` line`
                  : `a ${create.project} ticket is planned only with a \`## ⚖️ worth it\` section, and this body has none`,
    };
}

// the body writes that may re-sign: `x linear body <id> --set <file>`, and a raw `linear issue update <id> --description-file`
export function worthRewrites(command: string, cwd: string, ctx: Context = {}) {
    return commandsDeep(command, cwd).flatMap((c) => {
        const linear = linearWords(c);
        if (!linear) return [];
        const { isX, words } = linear;
        const id = words.find((w) => /^(FRM|BYT)-\d+$/.test(w));
        const file = isX
            ? words.includes('body')
                ? flag(words, '--set')
                : undefined
            : words[words.indexOf('issue') + 1] === 'update'
              ? flag(words, '--description-file')
              : undefined;
        return id && file && !/[$`]/.test(file)
            ? [{ file: resolve(file, c.dir, ctx), id }]
            : [];
    });
}

// a re-sign the current body lacks, on a ticket in scope, whose worth section stands as it was and whose line names no reason
export function resignGap(
    next: string,
    current: { description: string; milestone?: string; project: string },
) {
    const held = new Set(current.description.split('\n').map(plain));
    const added = next
        .split('\n')
        .filter((l) => RESIGNED.test(l) && !held.has(plain(l)));
    if (!added.length || !isWorthScope(current.project, current.milestone))
        return false;
    if (added.some((l) => UNCHANGED.test(l))) return false;
    return (
        collapse(worthSection(next)) ===
        collapse(worthSection(current.description))
    );
}
export const hasResign = (next: string) =>
    next.split('\n').some((l) => RESIGNED.test(l));
