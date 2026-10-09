// one session's open asks, as its last reply left them
export type StashEntry = {
    label: string;
    name?: string;
    asks: string[];
    at: number;
};

// the session's last main turn stopped on the 5h cap: the reset it waits for, and the reset a resume already went for
export type StashCap = { resetsAt?: number; sentFor?: number };

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
    compactions?: StashCompaction[];
    model?: string;
    offPattern: boolean;
};

// one compaction of a session: when it fired, its context % before, and after once a response measured it
export type StashCompaction = { at: number; from?: number; to?: number };

// the band's two meters: this session's context against its compaction point, and the account's 5h window;
// `note` is the one line a refused threshold leaves
export type StashMeter = {
    context?: number;
    compactAt?: number;
    fiveHour?: { used: number; resetsAt?: number };
    note?: string;
    // the poll's minute, so an idle band's time left moves on its own
    minute?: number;
};

// everything the band draws, written by the poll and the hooks; a render reads it and redraws on a write
export type StashView = {
    selfId?: string;
    entries: Record<string, StashEntry>;
    afk: boolean;
    isHot: boolean;
    isWaker: boolean;
    digest?: StashDigest;
    isBoardOpen: boolean;
};

// what only the board pane draws, kept apart from the band's view: its clock moves every poll, and a band that read it
// would redraw — rebuilding x-mod-breather's svg (FRM-354)
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
            meter: StashMeter;
            // null: the last main turn did not stop on the cap
            cap: StashCap | null;
            // epoch ms of the last main turn end
            ended: number;
        };
    }
}
