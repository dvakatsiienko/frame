import { type Refusal, commandsDeep } from './command.ts';

// FRM-459: a ticket body is written through `x linear body --set` (it refuses a body changed since the pull), and nobody acts as
// dima. the caller checks the session is not the coordinator's. a nested shell's script and an eval count
const BODY_DOOR = 'x linear body <id> --set <file>';
// the raw cli's description flags and graphql's `issueUpdate`, which set a body past the door
const RAW_DESCRIPTION = /^(?:-d|--description(?:-file)?)(?:=|$)/;

export function linearWrite(command: string, cwd: string): Refusal | undefined {
    for (const c of commandsDeep(command, cwd)) {
        const words = c.args.map((w) => w.text);
        const bare = words.filter((w) => !w.startsWith('-'));
        if (c.name === 'linear') {
            const isWrite =
                bare[0] === 'issue' &&
                (bare[1] === 'update' || bare[1] === 'create') &&
                words.some((w) => RAW_DESCRIPTION.test(w));
            if (isWrite)
                return {
                    door: BODY_DOOR,
                    rule: 'linear-body',
                    targets: [`linear issue ${bare[1]} --description`],
                    why: 'a ticket body is written through x linear body --set, which refuses a body changed since the pull',
                };
            continue;
        }
        if (c.name !== 'x') continue;
        const isLinear = bare.includes('linear');
        if (isLinear && bare[bare.indexOf('linear') + 1] === 'api') {
            const query = words.join(' ');
            if (/issueUpdate/i.test(query))
                return {
                    door: `${BODY_DOOR}; a state or label move is x linear set`,
                    rule: 'linear-body',
                    targets: ['issueUpdate'],
                    why: 'a raw issueUpdate sets a body past the door that checks the ticket did not change since the pull',
                };
        }
        const asDima = words.some(
            (w, i) =>
                (w === '--as' && words[i + 1]?.toLowerCase() === 'dima') ||
                w.toLowerCase() === '--as=dima',
        );
        const isAs = bare[0] === 'as' && bare[1]?.toLowerCase() === 'dima';
        if ((isLinear || bare[0] === 'as') && (asDima || isAs))
            return {
                door: 'run it without --as; an agent acts as its own member',
                rule: 'as-dima',
                targets: ['dima'],
                why: "nobody but dima acts as dima; an agent's writes carry its own member",
            };
    }
    return undefined;
}
