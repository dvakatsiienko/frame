declare module 'claude-code' {
    interface PluginState {
        // a cclio session's code edits so far: one session's count, gone with it
        // seen: the real paths this session has Read, Edited or Written, so a Write over a tracked file it never read is refused
        // prompt: dima's last prompt typed at the composer or the bridge, the proof a # dima-ok marker needs
        'x-mod-guard': { edits: number; seen: string[]; prompt: string };
    }
}
