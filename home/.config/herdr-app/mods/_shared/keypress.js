// one press of Enter in a herdr text box acts once, a held one too. herdr tells a box's Enter as a submit, then its
// key-down in the same ms (FRM-628 step 87, 12:30): the caller asks `submitted` a beat after the submit, so this
// press's key-down has landed. the key-down's own held flag says a repeat exactly; with none seen, a key-up or a gap
// does. a mod cannot import a sibling mod's file, so each mod keeps its own copy (copies test in x-herdr-chat).

// a key-down and the submit it makes land this close together
export const KEY_PAIR_MS = 60;
// with no key-up seen, a submit this close to the last one is the held key's repeat (his first repeat at 150 ms)
export const KEY_REPEAT_MS = 180;

export function createKeyPress() {
    /** @type {{ at: number, isHeld: boolean, hasActed: boolean } | null} */
    let down = null;
    /** @type {number | null} */
    let lastAt = null;
    // when the key last went up: the submit it follows is a new press, one it precedes is still the held key's, however
    // late that submit is read
    let upAt = -Infinity;
    return {
        /** @param {number} at @param {boolean} isHeld the key-down's own repeat flag */
        down(at, isHeld) {
            down = { at, hasActed: false, isHeld };
        },
        /** ⌘ let go ends a ⌘Enter, whose Enter key-up macOS never sends @param {number} at */
        modifiersUp(at) {
            upAt = at;
        },
        /**
         * a submit seen a beat ago: the press acts, or it is a held key's repeat
         * @param {number} at the submit's time
         * @returns {'act' | 'repeat'}
         */
        submitted(at) {
            const isRepeat =
                down && Math.abs(at - down.at) < KEY_PAIR_MS
                    ? down.isHeld || down.hasActed
                    : lastAt !== null &&
                      at - lastAt < KEY_REPEAT_MS &&
                      !(upAt > lastAt && upAt < at);
            lastAt = at;
            if (isRepeat) return 'repeat';
            // one press seen as two submits: its key-down acts once
            if (down) down.hasActed = true;
            return 'act';
        },
        /** @param {number} at */
        up(at) {
            upAt = at;
        },
    };
}
