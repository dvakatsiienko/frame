// one press of Enter or ⌘Enter in a herdr text box acts once, a held one too. herdr hands the box's Enter to the mod
// as its own action, each repeat of a held key one more (FRM-648 step 111's probe), so a press is told by events alone,
// never a clock (x:guide-code § state): the key is up, or held since it acted.

/** @typedef {'up' | 'held'} KeyState */
/** @typedef {'pressed' | 'released' | 'modifiersReleased' | 'blurred'} KeyEvent */

/** the key's next state: a press holds it, any other event lets it go @param {KeyEvent} event @returns {KeyState} */
export const next = (event) => (event === 'pressed' ? 'held' : 'up');

export function createKeyPress() {
    /** @type {KeyState} */
    let state = 'up';
    return {
        /** the box lost focus: a key-up it never heard does not hold the next press */
        blurred() {
            state = next('blurred');
        },
        /** ⌘ let go ends a ⌘Enter, whose Enter key-up macOS never sends */
        modifiersReleased() {
            state = next('modifiersReleased');
        },
        /** the box's Enter or ⌘Enter action: acts once a press, a held key's repeats do nothing @returns {'act' | 'repeat'} */
        pressed() {
            const was = state;
            state = next('pressed');
            return was === 'up' ? 'act' : 'repeat';
        },
        released() {
            state = next('released');
        },
    };
}
