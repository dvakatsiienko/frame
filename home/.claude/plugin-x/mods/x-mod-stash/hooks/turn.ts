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

// every turn starts here: dima's and a peer's through prompt.submit, the mod's own through selfSubmit; `prepare` is the
// wiring's share, answering whether dima is afk
export async function startTurn(
    $: EngineInterface,
    isUser: boolean,
    isPing: boolean,
    prepare: () => Promise<boolean>,
) {
    beginTurn(isUser, isPing);
    patchTurn({ turnAfk: await prepare() });
    await keepTurn($);
}

// the mod's own prompt (the keep-hot ping, the waker's resume, a wake for marks) skips this plugin's prompt.submit hook
// (mods AGENTS, probe (d)), so its turn starts here; a submit the engine refuses leaves the session idle again
export async function selfSubmit(
    $: EngineInterface,
    text: string,
    isPing: boolean,
    prepare: () => Promise<boolean>,
) {
    await startTurn($, false, isPing, prepare);
    return $.prompt.submit({ text }).catch(async (err: unknown) => {
        patchTurn({ isBusy: false });
        await keepTurn($);
        throw err;
    });
}
