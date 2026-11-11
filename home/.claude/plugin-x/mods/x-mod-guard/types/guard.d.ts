declare module 'claude-code' {
    interface PluginState {
        // a clio session's code edits so far: one session's count, gone with it
        // seen: the real paths this session has Read, Edited or Written, so a Write over a tracked file it never read is refused
        // prompt: dima's last prompt typed at the composer or the bridge, the proof a # dima-ok marker needs
        // told: the same prompt for the turn it started only, cleared when that turn ends; a stash drop reads this one
        // images: a clio session's image Reads in the running turn, zeroed at each prompt
        // helped: the clis whose bare --help ran, or whose verb --help hint already showed, this session
        // spent: the ticks a guarded command already ran on, `<ask id>@<tick time>:<what it authorized>`; a tick is spent per use
        // written: the files a Write or a Bash call wrote in the running turn, path to text, so a later run of one reads its commands
        // signs: the ids dima typed «sign <id>» for at the composer or the bridge, each with its prompt's time, kept 2 h
        // firstSign: the ids this session's first prompt typed «sign» for, this prompt's only; x-mod-stash reads it
        // yes: dima's bare yes typed under the one warning or sign ask of this seat's orbit added since his last prompt, kept as his tick on it for 2 h
        // yesSeen: the open warning and sign asks at his last typed prompt, id and text, which a bare yes no longer answers
        'x-mod-guard': {
            yes: { id: string; text: string; targets: string[]; at: number }[];
            yesSeen: string[];
            // tabsMade: the herdr tab ids this seat's own `herdr-app do tab.new` printed, the tabs it may close once they hold no terminal
            tabsMade: string[];
            signs: { id: string; at: number }[];
            firstSign: { ids: string[]; at: number } | null;
            prompted: boolean;
            edits: number;
            seen: string[];
            prompt: string;
            told: string;
            written: Record<string, string>;
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
                    // answered: a bare yes of his counts only while the ask is still open
                    isResolved?: boolean;
                    isClosed?: boolean;
                }[];
            };
        };
    }
}
