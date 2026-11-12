declare module 'claude-code' {
    interface PluginState {
        // edits: a clio session's code edits so far: one session's count, gone with it
        // images: a clio session's image Reads in the running turn, zeroed at each prompt
        // helped: the clis whose bare --help ran, or whose verb --help hint already showed, this session
        // spent: the ticks a floor command already ran on, `<ask id>@<tick time>:<what it authorized>`; a tick is spent per use
        'x-mod-guard': {
            // tabsMade: the herdr tab ids this seat's own `herdr-app do tab.new` printed, the tabs it may close once they hold no terminal
            tabsMade: string[];
            edits: number;
            spent: string[];
            helped: string[];
            images: number;
        };
        // read-only here: x-mod-stash's tick record, written by dima's press alone (its contract owns the shape)
        'x-mod-stash': {
            ticks: {
                id: string;
                text: string;
                targets: string[];
                at: number;
            }[];
            // the session's own asks; a x-herdr-deck press counts only on one he accepted here
            orbit: {
                asks: {
                    id: string;
                    text: string;
                    mark?: string;
                    // a mark read off his x-herdr-deck press, and when it was made
                    isHerdrMark?: boolean;
                    markedAt?: number;
                    // answered or closed, as x-mod-stash keeps them
                    isResolved?: boolean;
                    isClosed?: boolean;
                }[];
            };
        };
    }
}
