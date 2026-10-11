// one session's open asks, as its orbit holds them
export type StashEntry = {
    label: string;
    name?: string;
    asks: string[];
    // the open asks whole, so a lane card on another board draws and marks them (FRM-385 exit 3)
    items?: PublishedAsk[];
    at: number;
};

export type PublishedAsk = {
    id: string;
    text: string;
    pick: string;
    mark?: 'accepted' | 'rejected';
    note?: string;
    isLocked?: boolean;
};

// a mark or note dima made on another board's lane card, waiting in the store for the member to take it in
export type RemoteMark = {
    mark?: 'accepted' | 'rejected';
    note?: string;
    at: number;
};

// the session's last main turn stopped on the 5h cap: the reset it waits for, and the reset a resume already went for
export type StashCap = { resetsAt?: number; sentFor?: number };

// what the fleet did while dima was afk
export type StashDigest = {
    needs: { sid: string; name: string; asks: number }[];
    done: { sid: string; name: string }[];
};

// one row of the fleet board
export type StashMember = {
    sid: string;
    name: string;
    status?: string;
    statusSince?: number;
    wait?: string;
    asks: number;
    context?: number;
    model?: string;
    offPattern: boolean;
};

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
    // what this session's last reply waits on, its 🔭 line
    wait?: string;
    afk: boolean;
    isHot: boolean;
    isWaker: boolean;
    digest?: StashDigest;
    isBoardOpen: boolean;
    // the settings view: open in this session, and each part's switch as every session reads it (a missing key is shown)
    isSettingsOpen: boolean;
    shown: Record<string, boolean>;
};

// what only the board pane draws, kept apart from the band's view: its clock moves every poll, and a band that read it
// would redraw — rebuilding the bars' svg (FRM-354)
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

// one ask to dima in orbit: what is asked and cclio's pick, the note cclio keeps for herself, dima's mark and note;
// locked while the turn it joined runs, changed after a follow-up, resolved until that turn ends
export type OrbitAsk = {
    id: string;
    text: string;
    pick: string;
    hiddenNote?: string;
    mark?: 'accepted' | 'rejected';
    note?: string;
    isLocked?: boolean;
    isChanged?: boolean;
    isResolved?: boolean;
    // when a mark came in from another board: an idle session wakes once dima prompts anywhere after it
    markedAt?: number;
};

// one choice the session made without asking, that costs a redo if wrong: born at a turn count; dima's send-back
// button marks it wrong, with his note
export type OrbitAssumption = {
    id: string;
    text: string;
    at: number;
    isWrong?: boolean;
    note?: string;
};

// the session's orbit: its asks oldest first, the next id's number, the main turns ended so far, and the plan with
// the turn count it was set at
export type StashOrbit = {
    asks: OrbitAsk[];
    assumed?: OrbitAssumption[];
    next: number;
    turns: number;
    plan?: { lines: string[]; at: number };
};

// 🛼 lane (FRM-385): one live lane of the fleet, kept in one shelf file every board reads and only cclio writes;
// ≤5 plain steps, the pointer and what moved it; done steps stay listed
export type LaneItem = { text: string; ticket?: string; isDone: boolean };
export type LaneRole = 'coder' | 'verifier';
export type StashLane = {
    id: string;
    title: string;
    items: LaneItem[];
    // the step we are on; items.length once every step is done
    current: number;
    // cclio's orbit turn count when the pointer or a done flag last moved
    movedAt: number;
    // the linked members' session ids; a re-link of a role replaces the old one
    members: Partial<Record<LaneRole, string>>;
    // dima's note on the current step: a draft until his take, then it joins cclio's next prompt or running turn once
    note?: string;
    isNoteTaken?: boolean;
    history: { at: number; act: string; current: number; done: number }[];
    endedAt?: number;
};

// the prompt enhancer: the box at the last press and the enhanced text as last seen (his edits kept), the call's
// state, and why the last press left the box alone
export type StashEnhancer = {
    original?: string;
    latest?: string;
    status: 'idle' | 'running';
    error?: string;
};

declare module 'claude-code' {
    interface PluginState {
        'x-mod-stash': {
            view: StashView;
            board: StashBoardView;
            turn: StashTurn;
            meter: StashMeter;
            // null: the last main turn did not stop on the cap
            cap: StashCap | null;
            // epoch ms of the last main turn end
            ended: number;
            orbit: StashOrbit;
            // dima is on mobile: the reminder asks for the asks fence instead of orbit
            mobile: boolean;
            enhancer: StashEnhancer;
            // the fleet's live lanes as this session last read the shelf file
            lanes: StashLane[];
            // each linked member's open asks, by session id, its pending remote marks laid over them
            laneAsks: Record<string, PublishedAsk[]>;
            // the first orbit ask a docked board shows, moved by a scroll over the board
            orbitTop: number;
            // the board's cards folded to their head row, by card: sessions, orbit, phases
            folds: Record<string, boolean>;
        };
    }
}
