// x-herdr's keys (FRM-577): a key reaches a mod only through herdr's keys.json, so our list is the source and its
// entries are written into his `global` section. an action that opens with `x-herdr-` is ours: rewritten every load,
// never his. a key herdr already binds to anything else stays herdr's, and ours is refused by name

/** @typedef {{ key: string, action: string, title: string }} OurKey */

// a mod cannot import a sibling mod's file, so the chatter holds every x-herdr key, its action naming the mod that
// takes it; herdr calls a command of a mod that is not drawn «unknown», so a key goes to a mod that is always placed
/** @type {OurKey[]} */
export const OUR_KEYS = [
    {
        action: 'x-herdr-status.quill',
        key: 'cmd-k',
        title: 'Write in the quill',
    },
    {
        action: 'x-herdr-status.deck',
        key: 'cmd-e',
        title: 'Show or hide the deck',
    },
];
/** @typedef {OurKey & { takenBy: string }} Refused */

const isOurs = (/** @type {unknown} */ action) =>
    typeof action === 'string' && action.startsWith('x-herdr-');

/**
 * @param {Record<string, Record<string, unknown>>} herdrKeys his keys.json as read
 * @param {OurKey[]} ours every x-herdr key, in the order the mods registered them
 */
export function keysWithOurs(herdrKeys, ours) {
    const actions = new Set(ours.map((k) => k.action));
    // a registered action of ours stays on the key it holds, a rebind kept; an unregistered one leaves
    const global = Object.fromEntries(
        Object.entries(herdrKeys.global ?? {}).filter(
            ([, a]) => !isOurs(a) || actions.has(/** @type {string} */ (a)),
        ),
    );
    const placed = new Set(Object.values(global));
    /** @type {Refused[]} */
    const refused = [];
    for (const k of ours) {
        if (placed.has(k.action)) continue;
        const taken = global[k.key];
        if (taken !== undefined) {
            refused.push({
                ...k,
                takenBy:
                    typeof taken === 'string' ? taken : JSON.stringify(taken),
            });
            continue;
        }
        global[k.key] = k.action;
        placed.add(k.action);
    }
    // his keys keep their order, ours follow: a load that changes nothing writes the same file back
    return { keys: { ...herdrKeys, global }, refused };
}

// keys herdr hands the program, never a binding: a plain key types, a bare ctrl-letter is the shell's (herdr's guide
// § Keys: ctrl+c, ctrl+d, ctrl+r, …)
const TYPES = /^(shift-)?[^-]$|^ctrl-[a-z[]$/;

/**
 * a key moved from one chord to another, ours or herdr's, kept in his keys.json in its place; a chord already held is
 * refused by the name of what holds it, a chord that types by `typing`
 * @param {Record<string, Record<string, unknown>>} herdrKeys @param {string} from @param {string} to
 * @returns {{ keys: Record<string, Record<string, unknown>> } | { refused: string | null }}
 */
export function rebind(herdrKeys, from, to) {
    const global = herdrKeys.global ?? {};
    if (!(from in global)) return { refused: null };
    if (from === to) return { keys: herdrKeys };
    if (TYPES.test(to)) return { refused: 'typing' };
    const holder = global[to];
    if (holder !== undefined)
        return {
            refused:
                typeof holder === 'string' ? holder : JSON.stringify(holder),
        };
    const moved = Object.fromEntries(
        Object.entries(global).map(([k, a]) => [k === from ? to : k, a]),
    );
    return { keys: { ...herdrKeys, global: moved } };
}
