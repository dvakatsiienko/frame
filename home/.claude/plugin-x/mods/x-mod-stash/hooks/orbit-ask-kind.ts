// an ask's kind (FRM-645): a look is ready and needs only dima's eyes, a test needs his hands; a pure rule

import type { AskKind } from '../types/stash.d.ts';

const KINDS = ['look', 'test'] as const satisfies readonly AskKind[];
// herdr reads the kind off the text (x-herdr-deck `cardKind`: the colon form past a 👀 or 🧪), so the text a typed ask is
// stored with opens «look: » or «test: » with no emoji, and the two boards never disagree
const LEAD = /^(?:👀|🧪)?\s*(look|test):\s*/iu;

// the kind a text and its argument give, and the text as stored; `kept` is the kind a followed ask already has
export function askKind(
    text: string,
    given: string,
    kept?: AskKind,
): { kind?: AskKind; text: string } | { deny: string } {
    const asked = KINDS.find((k) => k === given);
    if (given && !asked)
        return {
            deny: `kind «${given.slice(0, 40)}» is neither look nor test`,
        };
    const lead = text.match(LEAD);
    const led = lead?.[1]?.toLowerCase() as AskKind | undefined;
    if (asked && led && asked !== led)
        return { deny: `its text opens «${led}:» while its kind is ${asked}` };
    const kind = asked ?? led ?? kept;
    if (!kind) return { text };
    const words = text.slice(lead?.[0].length ?? 0);
    return words
        ? { kind, text: `${kind}: ${words}` }
        : { deny: `its text says nothing past «${kind}:»` };
}
