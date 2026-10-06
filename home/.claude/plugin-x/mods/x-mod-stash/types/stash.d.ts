// the 5h window's reset, as the last `session.measure` reported it
export type StashFiveHour = { resetsAt?: number };

declare module 'claude-code' {
    interface PluginState {
        'x-mod-stash': { open: boolean; fiveHour: StashFiveHour };
        // the mod's name before the x-mod rename: read once at start, so a session's fold and 5h reset carry over
        stash: { open: boolean; fiveHour: StashFiveHour };
    }
}
