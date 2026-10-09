// one session's open asks, as its last reply left them
export type StashEntry = {
    label: string;
    name?: string;
    asks: string[];
    at: number;
};

// one x-mod-guard refusal or escape, read from x-mod-guard's own store file
export type StashGuardLine = {
    key: string;
    sid: string;
    name?: string;
    command: string;
    kind: 'refused' | 'escaped';
    door: string;
    target: string;
    at: number;
    // why it was refused; an event kept before x-mod-guard wrote one shows its door
    why?: string;
};

// what the fleet did while dima was afk
export type StashDigest = {
    needs: { sid: string; name: string; asks: number }[];
    done: { sid: string; name: string }[];
};

// what a press on a board row's name does: open a desktop url, or copy the terminal door
export type StashDoor =
    | { kind: 'open'; url: string }
    | { kind: 'copy'; text: string };

// one row of the fleet board
export type StashMember = {
    sid: string;
    name: string;
    status?: string;
    statusSince?: number;
    door?: StashDoor;
    wait?: string;
    asks: number;
    context?: number;
    model?: string;
    offPattern: boolean;
};

// everything the band and the board draw, written by the poll and the hooks; a render reads it and redraws on a write
export type StashView = {
    selfId?: string;
    entries: Record<string, StashEntry>;
    afk: boolean;
    isHot: boolean;
    holds: { others: number; warned: boolean };
    guards: StashGuardLine[];
    areGuardsOpen: boolean;
    digest?: StashDigest;
    isBoardOpen: boolean;
};

// what only the board pane draws, kept apart from the band's view: its clock moves every poll, and a band that read it
// would redraw — rebuilding x-mod-breather's svg — every 4 s (FRM-354)
export type StashBoardView = {
    members?: StashMember[];
    isColour: boolean;
    // the poll's clock, so the board's «busy 3m» spans move on their own
    at: number;
};

// the running turn, kept so a mid-turn reload still knows it: busy, dima's own, a keep-hot ping, afk as it began
export type StashTurn = {
    isBusy: boolean;
    isUserTurn: boolean;
    isPinged: boolean;
    afk?: boolean;
};

declare module 'claude-code' {
    interface PluginState {
        'x-mod-stash': {
            open: boolean;
            view: StashView;
            board: StashBoardView;
            turn: StashTurn;
        };
    }
}
