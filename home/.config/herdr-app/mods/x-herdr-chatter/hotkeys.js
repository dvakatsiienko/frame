// x-herdr's keys (FRM-577): a key reaches a mod only through herdr's keys.json, so our list is the source and its
// entries are written into his `global` section. an action that opens with `x-herdr-` is ours: rewritten every load,
// never his. a key herdr already binds to anything else stays herdr's, and ours is refused by name

/** @typedef {{ key: string, action: string, title: string }} OurKey */

// a mod cannot import a sibling mod's file, so the chatter holds every x-herdr key; a key whose mod is not the chatter
// still lands here, its action naming that mod
/** @type {OurKey[]} */
export const OUR_KEYS = [
    {
        action: 'x-herdr-chatter.focus',
        key: 'cmd-k',
        title: 'Write in the quill',
    },
    {
        action: 'x-herdr-chatter.deck',
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
    const global = Object.fromEntries(
        Object.entries(herdrKeys.global ?? {}).filter(([, a]) => !isOurs(a)),
    );
    /** @type {Refused[]} */
    const refused = [];
    for (const k of ours) {
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
    }
    // his keys keep their order, ours follow: a load that changes nothing writes the same file back
    return { keys: { ...herdrKeys, global }, refused };
}
