declare module 'claude-code' {
    interface PluginState {
        // a cclio session's code edits so far: one session's count, gone with it
        // seen: the real paths this session has Read, Edited or Written, so a Write over a tracked file it never read is refused
        // prompt: dima's last prompt typed at the composer or the bridge, the proof a # dima-ok marker needs
        // spent: the ticks a guarded command already ran on, `<ask id>@<tick time>:<what it authorized>`; a tick is spent per use
        'x-mod-guard': {
            edits: number;
            seen: string[];
            prompt: string;
            spent: string[];
        };
        // read-only here: x-mod-stash's tick record, written by dima's press alone (its contract owns the shape)
        'x-mod-stash': {
            ticks: {
                id: string;
                text: string;
                targets: string[];
                at: number;
            }[];
        };
    }
}
