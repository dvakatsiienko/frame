declare module 'claude-code' {
    interface PluginState {
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
