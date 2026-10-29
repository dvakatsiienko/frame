// one session's open asks, as its orbit holds them
export type StashEntry = {
    label: string;
    name?: string;
    asks: string[];
    // the open asks whole, so a glide card on another board draws and marks them (FRM-385 exit 3)
    items?: PublishedAsk[];
    at: number;
};

export type PublishedAsk = {
    id: string;
    text: string;
    pick: string;
    link?: string;
    mark?: 'accepted' | 'rejected';
    steer?: string;
    isLocked?: boolean;
    // a mark still inside its 5 s sending window ends here (ms)
    sendAt?: number;
};

// a mark or steer dima made on another board's glide card, waiting in the store for the member to take it in
export type RemoteMark = {
    mark?: 'accepted' | 'rejected';
    steer?: string;
    // the steer was typed on that board, so it replaces the member's own instead of yielding to it
    isSteerEdit?: boolean;
    at: number;
    // when the mark itself last changed, so a steer edit never restarts its sending window
    markAt?: number;
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
    // ccrow's row only: her newest 👀 «for you» tip, which takes the wait's place (PK-73)
    tip?: string;
    // cclio's row only: the member pings quiet comms holds for her next turn, opened from her row's 🤫 n
    held?: QuietPing[];
    // a held ping older than the idle wait + 2 min: the 🤫 n reads red
    isHeldStuck?: boolean;
    asks: number;
    context?: number;
    model?: string;
    offPattern: boolean;
    // second wind asked of this session from a board, and where it stands
    wind?: StashWind;
};

// second wind for one session, a store key every board reads: asked from a board, writing once its turn carried the
// note, refreshing once it named its handoff, cancelled when a second press took it back after the note went out
export type StashWind = {
    state: 'asked' | 'writing' | 'refreshing' | 'cancelled' | 'refused';
    at: number;
    slug?: string;
    // work started after «pending: none» and before the compact: the wind refuses, and says what
    blocked?: string;
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
    // this session's own second wind, for the band's button
    wind?: StashWind['state'];
    // the settings view: open in this session, and each part's switch as every session reads it (a missing key is shown)
    isSettingsOpen: boolean;
    shown: Record<string, boolean>;
};

// what only the board pane draws, kept apart from the band's view: its clock moves every poll, and a band that read it
// would redraw — rebuilding the bars' svg (FRM-354)
export type StashBoardView = {
    members?: StashMember[];
    isColour: boolean;
    // the ctx meter drawn as a ring (C), else the % with a bar under it (B)
    isRing: boolean;
    // the poll's clock, so the board's «busy 3m» spans move on their own
    at: number;
    // cclio's board only: each dev-mods probe past its probe, «<mod> (<session short id>)»
    staleProbes?: string[];
};

// the running turn, kept so a mid-turn reload still knows it: busy, dima's own, a keep-hot ping, afk as it began
export type StashTurn = {
    isBusy: boolean;
    isUserTurn: boolean;
    isPinged: boolean;
    afk?: boolean;
};

// one ask to dima in orbit: what is asked and cclio's pick, the steer cclio keeps for herself, dima's mark and steer;
// locked while the turn it joined runs, changed after a follow-up, resolved until that turn ends
export type OrbitAsk = {
    id: string;
    text: string;
    pick: string;
    hiddenNote?: string;
    // one https url or file path dima opens in a click (brief 8: proposals sat in scratch files he dug for)
    link?: string;
    mark?: 'accepted' | 'rejected';
    steer?: string;
    isLocked?: boolean;
    isChanged?: boolean;
    isResolved?: boolean;
    // when a mark came in from another board: an idle session wakes once dima prompts anywhere after it
    markedAt?: number;
    // a fresh mark is «sending» until this time (ms): a second press before it unsends it, and no turn takes it yet
    sendAt?: number;
    // the closing word a resolve gave it («landed», «dropped: superseded by o58»)
    word?: string;
    // resolved with a word in a turn that has ended: drawn dim for one more turn, then it leaves
    isClosed?: boolean;
};

// one choice the session made without asking, that costs a redo if wrong: born at a turn count; dima's send-back
// button marks it wrong, with his steer
export type OrbitAssumption = {
    id: string;
    text: string;
    at: number;
    isWrong?: boolean;
    steer?: string;
};

// quiet comms (PK-93): a [progress] ping from a member, held off cclio's thread until her next turn
// `canary`: the nonce of a `/quiet-canary` test ping, so its run finds its own log lines
export type QuietPing = {
    at: number;
    from: string;
    text: string;
    canary?: string;
};
// the pings held for cclio's next turn; the on/off switch is a settings knob in the store
export type StashQuiet = { held: QuietPing[] };
// one delivery as the a/b reads it
export type QuietLogLine = {
    at: number;
    from: string;
    tag: string;
    // failed-open: the hook threw, so the delivery passed unjudged
    verdict: 'held' | 'passed' | 'flushed' | 'failed-open';
    startedTurn: boolean;
    arm: 'on' | 'off';
    canary?: string;
    // the sender's session id when the registry names it, so a rename mid-day never loses its lines
    sid?: string;
};
// the ledger: a member whose transcript sent cclio more pings than her quiet log holds since the window opened
export type QuietGap = { from: string; sent: number; logged: number };

// dima's tick on an ask, written only by his press: the ask's text, its backtick-quoted targets, and when it counts (once
// its sending window passed); x-mod-guard reads it as his word for a guarded command (FRM-427)
export type StashTick = {
    id: string;
    text: string;
    targets: string[];
    at: number;
};

// the session's orbit: its asks oldest first, the next id's number, the main turns ended so far, and the plan with
// the turn count it was set at
export type StashOrbit = {
    asks: OrbitAsk[];
    assumed?: OrbitAssumption[];
    next: number;
    turns: number;
    plan?: StashPlan;
};

// the session's phases: its next moves, the turn count they were set at, and what dima did to them on the board — a
// reorder, a tick on the order, his steer — waiting, like an orbit tick, until `sendAt` before a turn takes it (o84)
export type StashPlan = {
    lines: string[];
    at: number;
    isMoved?: boolean;
    mark?: 'accepted';
    steer?: string;
    sendAt?: number;
};

// 🛼 glide (FRM-385): one live lane of the fleet, kept in one shelf file every board reads and only cclio writes;
// ≤5 plain steps, the pointer and what moved it; done steps stay listed
export type LaneItem = { text: string; ticket?: string; isDone: boolean };
export type LaneRole = 'coder' | 'verifier';
export type StashLane = {
    id: string;
    title: string;
    items: LaneItem[];
    // the lane plan file this card follows: its numbered lines are the steps, so a tick there moves the card (FRM-429)
    plan?: string;
    // the linked file could not be read: the card keeps its last state until the lane ends
    isPlanGone?: boolean;
    // the step we are on; items.length once every step is done
    current: number;
    // cclio's orbit turn count when the pointer or a done flag last moved
    movedAt: number;
    // the linked members as the registry names them (an id the registry did not know stays as given); a re-link of a
    // role replaces the old one
    members: Partial<Record<LaneRole, string>>;
    // the board's view only: each member's session id now, resolved from its name at every draw
    memberSids?: Partial<Record<LaneRole, string>>;
    // dima's steer on the current step: a draft until his take, then it joins cclio's next prompt or running turn once
    steer?: string;
    isSteerTaken?: boolean;
    // `by`: the linked coder whose plan step moved the pointer forward, written by cclio's stash
    history: {
        at: number;
        act: string;
        by?: string;
        current: number;
        done: number;
    }[];
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
            // speak is reading aloud and not paused: the board's play button reads pause (dima, 15:51)
            speaking: boolean;
            quiet: StashQuiet;
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
            // the board's cards folded to their head row, by card: sessions, orbit, phases
            folds: Record<string, boolean>;
            // dima's ticks, newest last; any plugin reads them, only this mod's press handler writes them
            ticks: StashTick[];
        };
    }
}
