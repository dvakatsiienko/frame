// the crew's messaging contract is one table (`MESSAGE_KINDS` in x-mod-stash's hooks/quiet.ts, FRM-686): a crew skill, a rule
// or a brief template names no tag outside it and asks no member for a receipt or a per-step line
const NAMED_TAG = /`\[(?:🪜 ?)?([a-z][a-z-]{2,})\](?=[ `])/gu;
const SENT_TAG =
    /\b(?:send|sends|ping|pings|message|messages|opens?|opening|tag|tagged|as|with|leads?|starts?)(?: (?:clio|the coordinator|it|one|as|with|a|an))* [«“"]?\[(?:🪜 ?)?([a-z][a-z-]{2,})\](?![([])/giu;
// a bracketed word is a message tag only on a line about messages: `[slug]` in a route is none
const ABOUT =
    /\b(?:clio|coordinator|sends?|pings?|messages?|SendMessage|tag(?:s|ged)?)\b/u;
// «open with [x]» is an order to a sender, unless the line names what else opens so
const OPENS =
    /\bopen(?: it| them)? with\b(?!.*\b(?:pr|title|commit|branch|file|page|section)\b)/iu;
const PROGRESS = /\[(progress)\]/gu;
// «message», «report», «reply» and «answer» are nouns too, so they count only with someone after them
const SEND = String.raw`\b(?:(?:send|sends|ping|pings|tell|tells)\b(?!,)|(?:message|report|reply|answer)s? (?:to )?(?:me|us|clio|the coordinator|back|with)\b|\b(?:write|give|update|notify)s? (?:me|us|clio|the coordinator)\b|\blets? (?:me|us|clio|the coordinator) know\b|\b(?:report|post)s? (?:a |the |your )?status\b)`;
const STEP = String.raw`(?:per|each|every) (?:step|commit|push|slice|edit)\b`;
const ASKS = [
    [
        'a receipt or a status line',
        String.raw`${SEND}[^.;\n]{0,50}\b(?:receipts?|acks?|(?<!in )progress|sw done|status (?:line|ping|update)s?)\b`,
    ],
    [
        'a receipt or a status line',
        String.raw`\b(?:give|post)s? (?:(?:me|us|clio|the coordinator) )?a status\b|\bconfirms? (?:the )?receipt\b|\backnowledges? (?:every|each|all|the) messages?\b`,
    ],
    ['a per-step line', String.raw`${SEND}[^.;\n]{0,50}\b${STEP}`],
    ['a per-step line', String.raw`\b${STEP}[^.;\n]{0,50}${SEND}`],
] as const;
const REFUSED =
    /\b(?:no|never|not|nothing|nobody|without|only|unless|drops?)\b|n['’]t\b/iu;

export const CREW_DNA = 'home/.claude/plugin-x/skills/crew-dna/SKILL.md';
export const CONTRACT_HOME =
    'home/.claude/plugin-x/mods/x-mod-stash/hooks/quiet.ts';

/** the files the contract reaches: the crew skills (brief templates sit among them) and the rules */
export const isContractFile = (path: string) =>
    path.endsWith('.md') &&
    !path.includes('/fixtures/') &&
    /^home\/\.claude\/(?:plugin-x\/skills\/crew-[^/]+|rules|rules-lazy)\//.test(
        path,
    );

export function contractRefusals(
    path: string,
    body: string,
    tags: readonly string[],
): ContractRefusal[] {
    const found: ContractRefusal[] = [];
    for (const [i, text] of body.split('\n').entries()) {
        const shapes =
            ABOUT.test(text) || OPENS.test(text)
                ? [NAMED_TAG, SENT_TAG, PROGRESS]
                : [PROGRESS];
        const named = shapes.flatMap((re) =>
            [...text.matchAll(re)].map((m) => m[1]?.toLowerCase() ?? ''),
        );
        for (const tag of new Set(named))
            if (!tags.includes(tag))
                found.push({
                    line: i + 1,
                    path,
                    reason: `[${tag}] is no tag of the contract`,
                    text,
                });
        for (const [what, source] of ASKS) {
            const asked = text.match(new RegExp(source, 'iu'));
            if (!asked) continue;
            const from = text
                .slice(0, asked.index)
                .search(/(?:[^.;:\n]|:(?! )){0,60}$/);
            const clause = text.slice(
                Math.max(0, from),
                (asked.index ?? 0) + asked[0].length,
            );
            if (REFUSED.test(clause)) continue;
            found.push({
                line: i + 1,
                path,
                reason: `it asks for ${what}`,
                text,
            });
            break;
        }
    }
    if (path === CREW_DNA) found.push(...sectionRefusals(path, body, tags));
    return found;
}

// crew-dna § messages to clio names every pushing tag, and no other
function sectionRefusals(
    path: string,
    body: string,
    tags: readonly string[],
): ContractRefusal[] {
    const lines = body.split('\n');
    const first = lines.findIndex((l) => l.startsWith('**messages to clio**'));
    if (first < 0)
        return [
            {
                line: 1,
                path,
                reason: 'it has no «messages to clio» section',
                text: lines[0] ?? '',
            },
        ];
    const rest = lines
        .slice(first + 1)
        .findIndex((l) => l.startsWith('**') || l.startsWith('#'));
    const section = lines
        .slice(first, rest < 0 ? undefined : first + 1 + rest)
        .join('\n');
    const named = [
        ...section.matchAll(/\[(?:🪜 ?)?([a-z][a-z-]{2,})\](?!\()/gu),
    ].map((m) => m[1] ?? '');
    const at = { line: first + 1, path, text: lines[first] ?? '' };
    return [
        ...tags
            .filter((tag) => !named.includes(tag))
            .map((tag) => ({
                ...at,
                reason: `the section names no [${tag}], a pushing tag`,
            })),
        ...named
            .filter((tag) => !tags.includes(tag))
            .map((tag) => ({
                ...at,
                reason: `the section names [${tag}], no tag of the contract`,
            })),
    ];
}

/* Types */
export type ContractRefusal = {
    line: number;
    path: string;
    reason: string;
    text: string;
};
