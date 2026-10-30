import { type Refusal, commandsDeep } from './command.ts';

// FRM-459: a ticket body is written through `x linear body --set` (it refuses a body changed since the pull), and nobody acts as
// dima. the caller checks the session is not the coordinator's. a nested shell's script and an eval count
const BODY_DOOR = 'x linear body <id> --set <file>';
// the raw cli's description flags; graphql's mutations that carry a body
const RAW_DESCRIPTION = /^(?:-d|--description(?:-file)?)(?:=|$)/;
const BODY_MUTATION = /issue(?:Batch)?Update|issueCreate/i;

// the raw cli, as typed or after `x as <member> --`
function rawBody(words: string[]): Refusal | undefined {
    const bare = words.filter((w) => !w.startsWith('-'));
    const isWrite =
        bare[0] === 'issue' &&
        (bare[1] === 'update' || bare[1] === 'create') &&
        words.some((w) => RAW_DESCRIPTION.test(w));
    return isWrite
        ? {
              door: BODY_DOOR,
              rule: 'linear-body',
              targets: [`linear issue ${bare[1]} --description`],
              why: 'a ticket body is written through x linear body --set, which refuses a body changed since the pull',
          }
        : undefined;
}

export function linearWrite(command: string, cwd: string): Refusal | undefined {
    for (const c of commandsDeep(command, cwd)) {
        const words = c.args.map((w) => w.text);
        const bare = words.filter((w) => !w.startsWith('-'));
        if (c.name === 'linear') {
            const found = rawBody(words);
            if (found) return found;
            continue;
        }
        if (c.name !== 'x') continue;
        const isLinear = bare.includes('linear');
        const isAsVerb = bare[0] === 'as';
        // a word the shell expands holds a value the guard cannot read: a variable, a substitution; a quoted `$id` in a query is text
        const isOpaque = (
            w: { text: string; isExpanding: boolean } | undefined,
        ) => w !== undefined && w.isExpanding && /[$`]/.test(w.text);
        // an actor of dima's, or one the guard cannot read
        const hasActor = c.args.some(
            (w, i) =>
                (w.text === '--as' &&
                    (c.args[i + 1]?.text.toLowerCase() === 'dima' ||
                        isOpaque(c.args[i + 1]))) ||
                /^--as=dima$/i.test(w.text) ||
                (w.text.startsWith('--as=') && isOpaque(w)),
        );
        const isAsDima =
            isAsVerb &&
            (bare[1]?.toLowerCase() === 'dima' ||
                isOpaque(c.args.find((w) => w.text === bare[1])));
        if ((isLinear || isAsVerb) && (hasActor || isAsDima))
            return {
                door: 'run it without --as; an agent acts as its own member',
                rule: 'as-dima',
                targets: ['dima'],
                why: "nobody but dima acts as dima; an agent's writes carry its own member",
            };
        if (isAsVerb) {
            const dash = words.indexOf('--');
            const inner = dash >= 0 ? words.slice(dash + 1) : [];
            if (inner[0] === 'linear') {
                const found = rawBody(inner.slice(1));
                if (found) return found;
            }
        }
        const at = bare.indexOf('linear');
        if (isLinear && bare[at + 1] === 'api') {
            // the query is one word; a variable, a substitution or xargs hides it, and an unreadable query counts
            const query = words.join(' ');
            const isHidden = c.args.some(
                (w, i) => isOpaque(w) && c.args[i - 1]?.text !== '--vars',
            );
            if (BODY_MUTATION.test(query) || isHidden)
                return {
                    door: `${BODY_DOOR}; a state or label move is x linear set`,
                    rule: 'linear-body',
                    targets: ['x linear api'],
                    why: 'a raw mutation sets a body past the door that checks the ticket did not change since the pull; a query the guard cannot read counts',
                };
        }
    }
    return undefined;
}
