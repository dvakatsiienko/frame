// an ask's kind (FRM-645): a look is ready and needs only dima's eyes, a test needs his hands; a pure rule

import type { AskKind, KindEmoji } from '../types/stash.d.ts';

const KINDS = ['look', 'test'] as const satisfies readonly AskKind[];
// herdr reads the kind off the text (x-herdr-deck `cardKind`: the colon form past a 👀 or 🧪), so the text a typed ask is
// stored with opens «look: » or «test: » with no emoji, and the two boards never disagree
const LEAD = /^(?:👀|🧪)?\s*(look|test):\s*/iu;

export const KIND_EMOJI: Readonly<KindEmoji> = { look: '👀', test: '🧪' };

// the board's order: look asks, then test asks, then the rest, each in the order they came
export function pinned<T extends { kind?: AskKind }>(asks: readonly T[]) {
    const rank = (a: T) => (a.kind ? KINDS.indexOf(a.kind) : KINDS.length);
    return asks.toSorted((a, b) => rank(a) - rank(b));
}

// what leads an ask's line: its kind's emoji, or the mark of one answered this turn, never 👀 on a typed ask (FRM-645)
export const askLead = (
    a: { isResolved?: boolean; kind?: AskKind },
    emoji: KindEmoji = KIND_EMOJI,
) => {
    if (a.kind) return a.isResolved ? '✅ ' : `${emoji[a.kind]} `;
    return a.isResolved ? '👀 ' : '';
};

// the words as drawn: the emoji says the kind, so the text's own lead is left out while it shows
export const askWords = (a: {
    isResolved?: boolean;
    kind?: AskKind;
    text: string;
}) => (a.kind && !a.isResolved ? a.text.slice(`${a.kind}: `.length) : a.text);

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
