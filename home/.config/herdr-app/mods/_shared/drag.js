// one drag for any herdr list or strip (FRM-664, the recipe in docs/research/herdr-drag-and-drop.md): a press lifts the
// item, past 4 px it drags, the row under the pointer is the target, a release runs the move once and settles; Escape or
// leaving the list springs it home. herdr sends no pointer outside an element, so the list's container is the zone.

/** @typedef {{ x: number, y: number }} Point */
/**
 * `item` is what the list pressed (its kind, its ids); `to` is null while the pointer is over no row that takes it
 * @template T
 * @typedef {{ name: 'idle' }
 *   | { name: 'pressed', key: string, item: T, from: number, at: Point }
 *   | { name: 'dragging', key: string, item: T, from: number, to: number | null, at: Point, pointer: Point }
 *   | { name: 'settling', key: string, item: T, from: number, to: number, token: number }} DragState
 */
/**
 * @template T
 * @typedef {{ type: 'pressed', key: string, item: T, from: number, at: Point }
 *   | { type: 'pointerMoved', at: Point }
 *   | { type: 'rowEntered', index: number | null }
 *   | { type: 'released' }
 *   | { type: 'cancelled' }
 *   | { type: 'settled', token: number }} DragEvent
 */
/**
 * @template T
 * @typedef {{ type: 'click', key: string, item: T }
 *   | { type: 'move', key: string, item: T, from: number, to: number }
 *   | null} DragEffect
 */

const THRESHOLD = 4;

/** @type {{ name: 'idle' }} */
const IDLE = { name: 'idle' };

/**
 * the drag's next state and what it asks done; pure, so a test drives every edge with no timer
 * @template T
 * @param {DragState<T>} state @param {DragEvent<T>} event @param {number} token the settle a release or cancel starts
 * @returns {{ state: DragState<T>, effect: DragEffect<T> }}
 */
export function next(state, event, token) {
    /** @type {{ state: DragState<T>, effect: DragEffect<T> }} */
    const stay = { effect: null, state };
    switch (event.type) {
        case 'pressed': {
            // a press while the last drop settles only ends the settle: the move already ran
            const { at, from, item, key } = event;
            return state.name === 'idle'
                ? {
                      effect: null,
                      state: { at, from, item, key, name: 'pressed' },
                  }
                : { effect: null, state: IDLE };
        }
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
        case 'released': {
            if (state.name === 'pressed')
                return {
                    effect: { item: state.item, key: state.key, type: 'click' },
                    state: IDLE,
                };
            if (state.name !== 'dragging') return stay;
            const { from, item, key, to } = state;
            const isMove = to !== null && to !== from;
            return {
                effect: isMove ? { from, item, key, to, type: 'move' } : null,
                state: {
                    from,
                    item,
                    key,
                    name: 'settling',
                    to: isMove ? to : from,
                    token,
                },
            };
        }
        case 'cancelled': {
            if (state.name !== 'dragging') return { effect: null, state: IDLE };
            const { from, item, key } = state;
            return {
                effect: null,
                state: { from, item, key, name: 'settling', to: from, token },
            };
        }
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
 * @template T
 * @param {{ onMove: (item: T, from: number, to: number) => void, onClick: (item: T) => void }} handlers
 */
export function createDrag({ onClick, onMove }) {
    /** @type {DragState<T>} */
    let state = IDLE;
    let tokens = 0;
    /** @param {DragEvent<T>} event @returns {boolean} whether the state changed, so the list redraws */
    const send = (event) => {
        const was = state;
        const step = next(state, event, tokens + 1);
        state = step.state;
        if (state.name === 'settling' && was.name !== 'settling') tokens++;
        if (step.effect?.type === 'move')
            onMove(step.effect.item, step.effect.from, step.effect.to);
        if (step.effect?.type === 'click') onClick(step.effect.item);
        return state !== was;
    };
    return {
        /** Escape, or the pointer left the list */
        cancel: () => send({ type: 'cancelled' }),
        /** the row at `index` is under the pointer; null: a row that does not take this item */
        over: (/** @type {number | null} */ index) =>
            send({ index, type: 'rowEntered' }),
        /** the pointer moved inside the list */
        pointer: (/** @type {Point} */ at) =>
            send({ at, type: 'pointerMoved' }),
        /** @param {string} key the pressed row's own name @param {T} item @param {number} from @param {Point} at */
        press: (key, item, from, at) =>
            send({ at, from, item, key, type: 'pressed' }),
        release: () => send({ type: 'released' }),
        /** the settle's spring ended; a stale timer's token does nothing */
        settled: (/** @type {number} */ token) =>
            send({ token, type: 'settled' }),
        state: () => state,
    };
}
