// how the quill-mini comes and goes (FRM-585 C2): it fades in sliding up and out sliding down, 120 ms each way. herdr
// animates only a change after a drawn frame, so it draws its start look once, then its shown one; a box shut while it
// comes in leaves at once, so a fast F6 F6 leaves no box behind and no timer; with reduce motion on it neither moves nor
// fades. the ghost is the shut box as last drawn, for the frames it goes

/** @typedef {import('./chat-types.js').Context} Context */

export const MINI_MOTION_MS = 120;
// how far below its place it starts and ends
const LIFT = 6;
// one frame drawn in the start look before the move
const FRAME_MS = 16;

/** @typedef {'shut' | 'entering' | 'rising' | 'shown' | 'leaving'} MiniPhase `entering`: its start look's one frame; `rising`: on its way in */

/**
 * @template T
 * @param {() => boolean} isReduced reduce motion is on in macOS
 */
export function createMiniMotion(isReduced) {
    /** @type {MiniPhase} */
    let phase = 'shut';
    /** @type {T | null} */
    let ghost = null;
    /** @type {{ cancel: () => void } | null} */
    let task = null;

    function stop() {
        task?.cancel();
        task = null;
    }

    /** @param {MiniPhase} next @param {number} ms @param {Context} cx */
    function later(next, ms, cx) {
        task = cx.timer.after(ms, (cx) => {
            task = null;
            phase = next;
            if (next === 'shut') ghost = null;
            if (next === 'rising') later('shown', MINI_MOTION_MS, cx);
            cx.notify();
        });
    }

    return {
        /** it shut, `drawn` as it was last drawn @param {T} drawn @param {Context} cx */
        closed(drawn, cx) {
            stop();
            // one shut on its way in was never seen whole: it goes at once
            if (phase !== 'shown' || isReduced()) {
                phase = 'shut';
                ghost = null;
                return;
            }
            phase = 'leaving';
            ghost = drawn;
            later('shut', MINI_MOTION_MS, cx);
        },
        /** gone at once, as with the thread it stood on */
        cut() {
            stop();
            phase = 'shut';
            ghost = null;
        },
        /** the shut box as it goes, null once gone @returns {T | null} */
        ghost: () => (phase === 'leaving' ? ghost : null),
        /** a move under way */
        isMoving: () => task !== null,
        /** where it stands against its place and how much it shows */
        look: () =>
            phase === 'shown' || phase === 'rising'
                ? { lift: 0, opacity: 1 }
                : { lift: LIFT, opacity: 0 },
        /** it opened, or moved onto another note: one already shown stays so @param {Context} cx */
        opened(cx) {
            if (phase === 'shown' || phase === 'rising') return;
            stop();
            ghost = null;
            if (isReduced()) {
                phase = 'shown';
                return;
            }
            phase = 'entering';
            later('rising', FRAME_MS, cx);
        },
    };
}
