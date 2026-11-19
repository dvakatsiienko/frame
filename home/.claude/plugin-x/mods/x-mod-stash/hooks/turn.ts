import type { EngineInterface } from 'claude-code';

// the turn as this session runs it: busy or not, whose turn, what it did, when it ended; one owner, read through
// `turn`, changed through the functions below; `$.state` turn mirrors the band's part so a reload keeps it
const TURN = { key: 'turn', plugin: 'x-mod-stash' } as const;
type TurnState = {
    // the turn clock: the last press or keystroke, and the poll's last bookkeeping pass (FRM-555)
    activeAt: number;
    bookkeptAt: number;
    endedAt?: number;
    // this turn's wrap_up carried an ask, and the Q numbers its orbit adds opened with: the Stop checks read both (FRM-427)
    gridQs: string[];
    isBusy: boolean;
    isNudged: boolean;
    isPrimed: boolean;
    isUserTurn: boolean;
    // the phases nudge fires only on a turn that did real work: an edit, a spawn or a stop, a commit, a lane move — a q&a
    // turn keeps quiet and the 3-turn stale mark covers it (PK-70: 235 plan calls in a session, the nudge on every turn)
    isWorkTurn: boolean;
    isWrapAsked: boolean;
    pinged: boolean;
    turnAfk?: boolean;
    turnTools: number;
};
const state: TurnState = {
    activeAt: 0,
    bookkeptAt: 0,
    gridQs: [],
    isBusy: false,
    isNudged: false,
    isPrimed: false,
    isUserTurn: false,
    isWorkTurn: false,
    isWrapAsked: false,
    pinged: false,
    turnTools: 0,
};
export const turn: Readonly<TurnState> = state;

export function patchTurn(patch: Partial<TurnState>) {
    Object.assign(state, patch);
}

// a turn starts: dima's, a peer's or the mod's own; every per-turn mark resets
export function beginTurn(isUser: boolean, isPing: boolean) {
    Object.assign(state, {
        gridQs: [],
        isBusy: true,
        isNudged: false,
        isUserTurn: isUser,
        isWorkTurn: false,
        isWrapAsked: false,
        pinged: isPing,
        turnTools: 0,
    });
}

// one more tool call this turn, the count after it
export function countTool() {
    state.turnTools += 1;
    return state.turnTools;
}

export function addGridQs(...qs: string[]) {
    state.gridQs.push(...qs);
}

export async function markActive($: EngineInterface) {
    state.activeAt = await $.clock.now();
}

export async function keepTurn($: EngineInterface) {
    await $.state
        .set(TURN, {
            afk: state.turnAfk,
            isBusy: state.isBusy,
            isPinged: state.pinged,
            isUserTurn: state.isUserTurn,
        })
        .catch(() => undefined);
}

export async function isTurnBusy($: EngineInterface) {
    return (
        (await $.state.get(TURN).catch(() => undefined))?.value?.isBusy ??
        state.isBusy
    );
}
