// one drag for any herdr list or strip (FRM-664, the recipe in docs/research/herdr-drag-and-drop.md): a press lifts the
// item, past 4 px it drags, the row under the pointer is the target, a release runs the move once and settles; Escape or
// leaving the list springs it home. herdr sends no pointer outside an element, so the list's container is the zone.

/** @typedef {{ x: number, y: number }} Point */
/**
 * @typedef {{ name: 'idle' }
 *   | { name: 'pressed', key: string, from: number, at: Point }
 *   | { name: 'dragging', key: string, from: number, to: number, at: Point, pointer: Point }
 *   | { name: 'settling', key: string, from: number, to: number, token: number }} DragState
 */
/**
 * @typedef {{ type: 'pressed', key: string, from: number, at: Point }
 *   | { type: 'pointerMoved', at: Point }
 *   | { type: 'rowEntered', index: number }
 *   | { type: 'released' }
 *   | { type: 'cancelled' }
 *   | { type: 'settled', token: number }} DragEvent
 */
/** @typedef {{ type: 'click', key: string } | { type: 'move', key: string, from: number, to: number } | null} DragEffect */

const THRESHOLD = 4;

/** @type {DragState} */
const IDLE = { name: 'idle' };

/**
 * the drag's next state and what it asks done; pure, so a test drives every edge with no timer
 * @param {DragState} state @param {DragEvent} event @param {number} token the settle a release or cancel starts
 * @returns {{ state: DragState, effect: DragEffect }}
 */
export function next(state, event, token) {
    const stay = { effect: null, state };
    switch (event.type) {
        case 'pressed':
            // a press while the last drop settles only ends the settle: the move already ran
            return state.name === 'idle'
                ? {
                      effect: null,
                      state: {
                          at: event.at,
                          from: event.from,
                          key: event.key,
                          name: 'pressed',
                      },
                  }
                : { effect: null, state: IDLE };
        case 'pointerMoved':
            if (state.name === 'pressed')
                return Math.hypot(
                    event.at.x - state.at.x,
                    event.at.y - state.at.y,
                ) > THRESHOLD
                    ? {
                          effect: null,
                          state: {
                              ...state,
                              name: 'dragging',
                              pointer: event.at,
                              to: state.from,
                          },
                      }
                    : stay;
            return state.name === 'dragging'
                ? { effect: null, state: { ...state, pointer: event.at } }
                : stay;
        case 'rowEntered':
            return state.name === 'dragging' && state.to !== event.index
                ? { effect: null, state: { ...state, to: event.index } }
                : stay;
        case 'released':
            if (state.name === 'pressed')
                return {
                    effect: { key: state.key, type: 'click' },
                    state: IDLE,
                };
            if (state.name !== 'dragging') return stay;
            return {
                effect:
                    state.to === state.from
                        ? null
                        : {
                              from: state.from,
                              key: state.key,
                              to: state.to,
                              type: 'move',
                          },
                state: {
                    from: state.from,
                    key: state.key,
                    name: 'settling',
                    to: state.to,
                    token,
                },
            };
        case 'cancelled':
            return state.name === 'dragging'
                ? {
                      effect: null,
                      state: {
                          from: state.from,
                          key: state.key,
                          name: 'settling',
                          to: state.from,
                          token,
                      },
                  }
                : { effect: null, state: IDLE };
        case 'settled':
            return state.name === 'settling' && state.token === event.token
                ? { effect: null, state: IDLE }
                : stay;
        default: {
            /** @type {never} */
            const unhandled = event;
            return unhandled;
        }
    }
}

/**
 * a list's drag: it owns the state, the list feeds it the pointer and draws from `state()`
 * @param {{ onMove: (key: string, from: number, to: number) => void, onClick: (key: string) => void }} handlers
 */
export function createDrag({ onClick, onMove }) {
    /** @type {DragState} */
    let state = IDLE;
    let tokens = 0;
    /** @param {DragEvent} event @returns {boolean} whether the state changed, so the list redraws */
    const send = (event) => {
        const was = state;
        const step = next(state, event, tokens + 1);
        state = step.state;
        if (state.name === 'settling' && was.name !== 'settling') tokens++;
        if (step.effect?.type === 'move')
            onMove(step.effect.key, step.effect.from, step.effect.to);
        if (step.effect?.type === 'click') onClick(step.effect.key);
        return state !== was;
    };
    return {
        /** Escape, or the pointer left the list */
        cancel: () => send({ type: 'cancelled' }),
        /** the row at `index` is under the pointer */
        over: (/** @type {number} */ index) =>
            send({ index, type: 'rowEntered' }),
        /** the pointer moved inside the list */
        pointer: (/** @type {Point} */ at) =>
            send({ at, type: 'pointerMoved' }),
        /** @param {string} key @param {number} from @param {Point} at */
        press: (key, from, at) => send({ at, from, key, type: 'pressed' }),
        release: () => send({ type: 'released' }),
        /** the settle's spring ended; a stale timer's token does nothing */
        settled: (/** @type {number} */ token) =>
            send({ token, type: 'settled' }),
        state: () => state,
    };
}
