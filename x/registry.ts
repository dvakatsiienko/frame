import { laneVerbs } from './lane.ts';
import type { FlagSpec, Verb } from './verb.ts';
import { Fail, exitCodes } from './verb.ts';

export const globalFlags = {
    apply: {
        description:
            'run a verb that publishes or destroys; without it the verb prints its plan and exits 4',
        type: 'boolean',
    },
    help: { description: 'print the verb help', type: 'boolean' },
    json: { description: 'json on stdout even on a tty', type: 'boolean' },
} as const satisfies Record<string, FlagSpec>;

const schemaVerb = {
    args: [
        {
            description: 'a verb or a group, e.g. `lane` or `lane push`',
            isOptional: true,
            isVariadic: true,
            name: 'verb',
        },
    ],
    name: 'schema',
    needsApply: false,
    purpose:
        'print the json schema of a verb or a group — the same entry that dispatches it',
    run: schema,
} as const satisfies Verb;

export const verbs: readonly Verb[] = [...laneVerbs, schemaVerb];

export function findVerb(words: readonly string[]) {
    let found: { verb: Verb; depth: number } | undefined;
    for (const verb of verbs) {
        const parts = verb.name.split(' ');
        const isMatch = parts.every((part, i) => words[i] === part);
        if (isMatch && parts.length > (found?.depth ?? 0))
            found = { depth: parts.length, verb };
    }
    return found;
}

export const verbsUnder = (prefix: string) =>
    verbs.filter(
        (verb) =>
            !prefix ||
            verb.name === prefix ||
            verb.name.startsWith(`${prefix} `),
    );

export function usage(verb: Verb) {
    const args = verb.args.map((arg) => {
        const name = `<${arg.name}${arg.isVariadic ? '…' : ''}>`;
        return arg.isOptional ? `[${name}]` : name;
    });
    return [
        'x',
        verb.name,
        ...(verb.needsApply ? ['[--apply]'] : []),
        ...args,
    ].join(' ');
}

export const toSchema = (verb: Verb) => ({
    args: verb.args,
    exits: exitCodes,
    flags: globalFlags,
    name: verb.name,
    needsApply: verb.needsApply,
    purpose: verb.purpose,
    usage: usage(verb),
});

// the purpose line is what an agent picks a verb by; a vague or missing one is the
// top tool-description smell (arxiv 2602.14878)
export function lintPurpose(verb: Pick<Verb, 'name' | 'purpose'>) {
    const problems: string[] = [];
    const words = verb.purpose.trim().split(/\s+/).filter(Boolean);
    const nameWords = new Set(verb.name.split(/[\s-]/));

    if (words.length < 5)
        problems.push('purpose under 5 words — say what it does and to what');
    if (verb.purpose.length > 120)
        problems.push('purpose over 120 chars — one line');
    if (words.every((word) => nameWords.has(word)))
        problems.push('purpose only restates the name');
    if (
        /\b(todo|tbd|stuff|things|various|handles?|manages?)\b/i.test(
            verb.purpose,
        )
    )
        problems.push('purpose uses a vague word — name the effect');
    return problems;
}

function schema(args: string[]) {
    const prefix = args.join(' ');
    const matched = verbsUnder(prefix);
    if (matched.length === 0)
        throw new Fail(`no verb or group named ${prefix}`, 'x --help', true);
    return { verbs: matched.map(toSchema) };
}
