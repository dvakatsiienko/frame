// the 5h window's reset, as the last `session.measure` reported it
export type StashFiveHour = { resetsAt?: number };

declare module 'claude-code' {
    interface PluginState {
        stash: { open: boolean; fiveHour: StashFiveHour };
    }
}
