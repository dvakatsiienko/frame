import {
    type Command,
    type Refusal,
    TICK_DOOR,
    commandsDeep,
} from './command.ts';

// gh's own flags that take the next word, on `pr merge`, `stack merge`, `api` and the root
const VALUE_FLAGS = new Set([
    '--field',
    '--header',
    '--hostname',
    '--input',
    '--jq',
    '--method',
    '--raw-field',
    '--template',
    '-H',
    '-X',
    '-f',
    '-p',
    '-q',
    '-A',
    '--author-email',
    '-b',
    '--body',
    '-F',
    '--body-file',
    '--match-head-commit',
    '-R',
    '--repo',
    '-t',
    '--subject',
]);
const operands = (words: string[]) =>
    words.filter((w, i) => {
        if (w.startsWith('-')) return false;
        const before = words[i - 1];
        return before === undefined || !VALUE_FLAGS.has(before);
    });

// the words a wrapper hands gh: `x as <member> -- gh …`, `github-token-wrap pr …`, and the leading `gh` the wrap tolerates
function ghWords(c: Command) {
    const words = c.args.map((w) => w.text);
    if (c.name === 'gh') return words;
    if (c.name === 'github-token-wrap')
        return words[0] === 'gh' ? words.slice(1) : words;
    if (c.name === 'x' && words[0] === 'as') {
        const at = words.indexOf('--');
        if (at >= 0 && words[at + 1] === 'gh') return words.slice(at + 2);
    }
    return undefined;
}

const GRAPHQL_MERGE =
    /\b(mergePullRequest|enqueuePullRequest|enablePullRequestAutoMerge)\b/;
const FIELD_FLAGS = new Set(['-f', '-F', '--field', '--raw-field']);
const FIELD_GLUED = /^(?:-[fF]|--field=|--raw-field=)(.+)$/;
const GRAPHQL_PATH = /^(https?:\/\/[^/]+(\/api)?)?\/?graphql\/?(\?.*)?$/i;
const MERGE_PATH = /\/pulls\/[^/]+\/merge(-async)?\/?(\?.*)?$/;
const asPr = (digits: string | undefined) =>
    digits === undefined ? undefined : String(Number(digits));
const prOf = (target: string | undefined) =>
    asPr(
        target?.match(/^#?(\d+)$/)?.[1] ?? target?.match(/\/pull\/(\d+)/)?.[1],
    );

function isPut(words: string[]) {
    return words.some(
        (w, i) =>
            /^(-X=?|--method=)put$/i.test(w) ||
            ((w === '-X' || w === '--method') &&
                words[i + 1]?.toUpperCase() === 'PUT'),
    );
}

// what one command merges on github outside x: undefined when it merges nothing, `pr` undefined when the target cannot be read
function rawMerge(c: Command) {
    const words = ghWords(c);
    if (
        !words ||
        words.some(
            (w, i) =>
                (w === '--help' || w === '-h' || w === '--disable-auto') &&
                !VALUE_FLAGS.has(words[i - 1] ?? ''),
        )
    )
        return undefined;
    const [family, verb, target] = operands(words);
    // a stack merge lands every layer under the pr it names, and those layers are github's to list: it counts as no number
    if (family === 'stack' && verb === 'merge')
        return { isStack: true, pr: undefined };
    if (family === 'pr' && verb === 'merge') return { pr: prOf(target) };
    // the graphql door takes a node id, never a number, so it reads as a target it cannot name
    if (family === 'api' && words.some((w) => GRAPHQL_PATH.test(w))) {
        // a query read from a file or a variable holds text this rule cannot see; any other field's variable, a thread id
        // on a review-thread mutation, only counts against a hold
        if (c.args.some((a) => GRAPHQL_MERGE.test(a.text)))
            return { pr: undefined };
        const isUnread = c.args.some((a, i) => {
            if (a.text.startsWith('--input')) return true;
            const before = c.args[i - 1]?.text ?? '';
            const glued = a.text.match(FIELD_GLUED)?.[1];
            const field = FIELD_FLAGS.has(before) ? a.text : glued;
            if (field === undefined)
                return a.isExpanding && !VALUE_FLAGS.has(before);
            return field.startsWith('query=')
                ? a.isExpanding || field.startsWith('query=@')
                : a.isExpanding && !/^\w+=/.test(field);
        });
        if (isUnread) return { isUnread: true, pr: undefined };
        return undefined;
    }
    if (family !== 'api') return undefined;
    // a method or an endpoint in a variable can be a merge this rule cannot read
    const isMethodUnread = c.args.some(
        (a, i) =>
            a.isExpanding &&
            (/^(-X|--method=)/.test(a.text) ||
                c.args[i - 1]?.text === '-X' ||
                c.args[i - 1]?.text === '--method'),
    );
    if (!isPut(words) && !isMethodUnread) return undefined;
    const endpoint = c.args.find((a) => a.text === verb);
    if (endpoint?.isExpanding && !MERGE_PATH.test(endpoint.text))
        return { isUnread: true, pr: undefined };
    const prs = new Set(
        words
            .filter((w) => MERGE_PATH.test(w))
            .map((w) =>
                w.includes('/merge-async')
                    ? undefined
                    : asPr(w.match(/\/pulls\/(\d+)\/merge/)?.[1]),
            ),
    );
    if (!prs.size) return undefined;
    // a field's value can read like a merge path too, so two different targets name none
    return { pr: prs.size === 1 ? [...prs][0] : undefined };
}

export const rawMerges = (command: string, cwd: string) =>
    commandsDeep(command, cwd).flatMap((c) => rawMerge(c) ?? []);

// after the required check went, nothing on github stops a raw merge reaching production (dima's o48, BYT-94); merge-auto
// lands a linked stack itself, so his tick on an ask quoting `gh stack merge <n>` is that door
export function rawMergeRefused(
    merges: { isStack?: boolean; isUnread?: boolean; pr: string | undefined }[],
): Refusal | undefined {
    if (!merges.length) return undefined;
    const isAllUnread = merges.every((m) => m.isUnread);
    return {
        door: isAllUnread
            ? `write the query or the endpoint inline in the call, if it merges nothing; a merge goes through x lane merge-auto <pr>, or ${TICK_DOOR}`
            : `x lane merge-auto <pr>, or ${TICK_DOOR}`,
        rule: 'raw-merge',
        targets: merges.map((m) => m.pr ?? 'gh merge'),
        why: isAllUnread
            ? 'this rule cannot read a query or an endpoint held in a file or a variable, and a merge there would reach production unseen'
            : 'a raw merge skips its gates, and nothing on github stops it reaching production',
    };
}

// the brake is dima's: only his tick on an ask quoting the whole release, never the override, lets a seat take it off
export const RELEASE_BRAKE: Refusal = {
    door: "dima's look, then his tick on an orbit ask quoting this whole command",
    rule: 'raw-merge',
    targets: ['merge-brake'],
    why: 'the brake stops every merge until dima takes it off',
};
export const releasesBrake = (command: string, cwd: string) =>
    commandsDeep(command, cwd).some(
        (c) =>
            /(^|\/)x$/.test(c.name) &&
            c.args[0]?.text === 'lane' &&
            c.args[1]?.text === 'merge-auto' &&
            c.args.some((w) => w.text === '--release-brake'),
    );
