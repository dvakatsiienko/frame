// x-mod-stash's board value, read (never written) so each board write redraws the band with a fresh breath phase:
// the desktop rebuilds the band's svg on every pane redraw, and a rebuild from a stale source jumps the breath back
// (FRM-354). only the shape breather touches; x-mod-stash's own contract owns the rest
export type StashBoardSeen = { at: number };

declare module 'claude-code' {
    interface PluginState {
        'x-mod-stash': {
            board: StashBoardSeen;
        };
    }
}
