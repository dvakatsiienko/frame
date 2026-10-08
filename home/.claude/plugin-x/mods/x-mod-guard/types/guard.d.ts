declare module 'claude-code' {
    interface PluginState {
        // a cclio session's code edits so far: one session's count, gone with it
        'x-mod-guard': { edits: number };
    }
}
