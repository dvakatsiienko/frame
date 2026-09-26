// hand-kept stores: raycast and cleanshot keep their bindings in encrypted or sealed files,
// 1password writes only the customised ones. re-type from the app's shortcuts pane.
export const manualHotkeys = [
    ...(
        [
            ['r', '1Password'],
            ['k', 'Calendar'],
            ['a', 'Claude'],
            ['b', 'Bartender toggle'],
            ['2', 'Cursor'],
            ['f', 'Finder'],
            ['1', 'Google Chrome'],
            ['e', 'Linear'],
            ['n', 'Notion'],
            ['m', 'Telegram'],
            ['k', 'Calendar'],
            ['d', 'Obsidian'],
            ['c', 'Slack'],
            ['s', 'Spark'],
            ['v', 'Things'],
            ['t', 'Warp'],
            ['w', 'Wispr Flow'],
            ['space', 'Search Emoji & Symbols'],
            ['y', 'Raycast Notes'],
        ] as const
    ).map(
        ([key, action]): Hotkey => ({
            action,
            app: 'raycast',
            key,
            mods: 'hyper',
        }),
    ),
    { action: 'Raycast', app: 'raycast', key: 'space', mods: 'cmd' },
    // the air75's yellow top-row key sends help (keycode 114), not del
    {
        action: 'Toggle System Appearance',
        app: 'raycast',
        key: 'help',
        mods: 'hyper',
        since: '2026-09-25',
    },
    // quicklinks on hyper — raycast keeps them sealed, hand-kept; linear-query-tickets moved off pageup on 2026-09-22 (right-hand key while the right hand holds the mouse)
    {
        action: 'linear-query-tickets (quicklink)',
        app: 'raycast',
        key: 'pageup',
        mods: 'hyper',
        since: '2026-09-18',
        until: '2026-09-22',
    },
    {
        action: 'linear-query-tickets (quicklink)',
        app: 'raycast',
        key: 'g',
        mods: 'hyper',
        since: '2026-09-22',
    },
    {
        action: 'translate selection (quicklink)',
        app: 'raycast',
        key: 'pagedown',
        mods: 'hyper',
    },
    {
        action: 'Switch to English (Birman)',
        app: 'raycast',
        key: '1',
        mods: 'opt',
    },
    { action: 'Switch to Ukrainian', app: 'raycast', key: '2', mods: 'opt' },
    {
        action: 'Switch to Russian (Birman)',
        app: 'raycast',
        key: '3',
        mods: 'opt',
    },
    // raycast window management, bound 2026-09-19 on magnet's old ctrl+opt gate (magnet retired); raycast keeps its bindings sealed, so these are hand-kept
    {
        action: 'Left Half',
        app: 'raycast',
        key: 'left',
        mods: 'ctrl+opt',
        since: '2026-09-19',
    },
    {
        action: 'Right Half',
        app: 'raycast',
        key: 'right',
        mods: 'ctrl+opt',
        since: '2026-09-19',
    },
    {
        action: 'Top Half',
        app: 'raycast',
        key: 'up',
        mods: 'ctrl+opt',
        since: '2026-09-19',
    },
    {
        action: 'Bottom Half',
        app: 'raycast',
        key: 'down',
        mods: 'ctrl+opt',
        since: '2026-09-19',
    },
    {
        action: 'Bottom Left Quarter',
        app: 'raycast',
        key: 'j',
        mods: 'ctrl+opt',
        since: '2026-09-19',
    },
    {
        action: 'Maximize',
        app: 'raycast',
        key: 'return',
        mods: 'ctrl+opt',
        since: '2026-09-19',
    },
    {
        action: 'Center',
        app: 'raycast',
        key: 'c',
        mods: 'ctrl+opt',
        since: '2026-09-19',
    },
    {
        action: 'Restore',
        app: 'raycast',
        key: 'backspace',
        mods: 'ctrl+opt',
        since: '2026-09-19',
        until: '2026-09-21',
    },
    {
        action: 'Move to Previous Display',
        app: 'raycast',
        key: 'left',
        mods: 'ctrl+opt+cmd',
        since: '2026-09-19',
    },
    {
        action: 'Move to Next Display',
        app: 'raycast',
        key: 'right',
        mods: 'ctrl+opt+cmd',
        since: '2026-09-19',
    },
    {
        action: 'Switch to Previous Space',
        app: 'raycast',
        key: 'left',
        mods: 'ctrl',
        since: '2026-09-19',
    },
    {
        action: 'Switch to Next Space',
        app: 'raycast',
        key: 'right',
        mods: 'ctrl',
        since: '2026-09-19',
    },
    // session A of the window-management pass (2026-09-21): the unused commands disabled, these added, Restore dropped
    {
        action: 'Almost Maximize',
        app: 'raycast',
        key: 'return',
        mods: 'ctrl+opt+cmd',
        since: '2026-09-21',
    },
    {
        action: 'Bottom Right Quarter',
        app: 'raycast',
        key: 'k',
        mods: 'ctrl+opt',
        since: '2026-09-21',
    },
    {
        action: 'Top Left Quarter',
        app: 'raycast',
        key: 'u',
        mods: 'ctrl+opt',
        since: '2026-09-21',
    },
    {
        action: 'Top Right Quarter',
        app: 'raycast',
        key: 'i',
        mods: 'ctrl+opt',
        since: '2026-09-21',
    },
    {
        action: 'Make Larger',
        app: 'raycast',
        key: '=',
        mods: 'ctrl+opt',
        since: '2026-09-21',
    },
    {
        action: 'Make Smaller',
        app: 'raycast',
        key: '-',
        mods: 'ctrl+opt',
        since: '2026-09-21',
    },
    {
        action: 'Minimize',
        app: 'raycast',
        key: 'm',
        mods: 'ctrl+opt',
        since: '2026-09-21',
    },
    {
        action: 'Toggle Fullscreen',
        app: 'raycast',
        key: 'f',
        mods: 'ctrl+opt',
        since: '2026-09-21',
    },
    // cleanshot commands, bound in raycast's cleanshot extension (sealed 2026-09-17; reshuffle from the monitor in ~2 weeks)
    {
        action: 'Capture Window',
        app: 'cleanshot',
        key: '1',
        mods: 'cmd+shift',
        since: '2026-09-17',
    },
    {
        action: 'Self-Timer',
        app: 'cleanshot',
        key: '`',
        mods: 'cmd+shift',
        since: '2026-09-19',
        until: '2026-09-26',
    },
    {
        action: 'Capture Text (OCR)',
        app: 'cleanshot',
        key: '2',
        mods: 'cmd+shift',
    },
    {
        action: 'Capture Fullscreen',
        app: 'cleanshot',
        key: '3',
        mods: 'cmd+shift',
    },
    { action: 'Capture Area', app: 'cleanshot', key: '4', mods: 'cmd+shift' },
    {
        action: 'Scrolling Capture',
        app: 'cleanshot',
        key: '5',
        mods: 'cmd+shift',
    },
    {
        action: 'All-In-One',
        app: 'cleanshot',
        key: '6',
        mods: 'cmd+shift',
        since: '2026-09-17',
    },
    {
        action: 'Open History',
        app: 'cleanshot',
        key: '7',
        mods: 'cmd+shift',
        since: '2026-09-17',
    },
    {
        action: 'Annotate',
        app: 'cleanshot',
        key: '8',
        mods: 'cmd+shift',
        since: '2026-09-17',
    },
    {
        action: 'Record Screen',
        app: 'cleanshot',
        key: '9',
        mods: 'cmd+shift',
        since: '2026-09-17',
    },
    {
        action: 'Open from Clipboard',
        app: 'cleanshot',
        key: '0',
        mods: 'cmd+shift',
    },
    // system settings → accessibility → read & speak → speak selection (siri voice 4); hotkey buried in its ⓘ sheet
    {
        action: 'Speak selection (read aloud)',
        app: 'macos',
        key: 'esc',
        mods: 'opt',
    },
    // system chords — obvious, but a labelled row beats a bare one in the stats tables
    ...(
        [
            ['tab', 'switch app'],
            ['v', 'paste'],
            ['c', 'copy'],
            ['a', 'select all'],
            ['w', 'close window'],
            ['q', 'quit app'],
            ['k', 'app command palette / link'],
            [',', 'app settings'],
            ['left', 'line start'],
            ['right', 'line end'],
        ] as const
    ).map(
        ([key, action]): Hotkey => ({ action, app: 'macos', key, mods: 'cmd' }),
    ),
    ...(
        [
            ['left', 'word left'],
            ['right', 'word right'],
            ['backspace', 'delete word'],
        ] as const
    ).map(
        ([key, action]): Hotkey => ({ action, app: 'macos', key, mods: 'opt' }),
    ),
    {
        action: 'select word left',
        app: 'macos',
        key: 'left',
        mods: 'opt+shift',
    },
    {
        action: 'select word right',
        app: 'macos',
        key: 'right',
        mods: 'opt+shift',
    },
    { action: 'Autofill', app: '1password', key: '\\', mods: 'cmd' },
    { action: 'Lock 1Password', app: '1password', key: 'l', mods: 'cmd+shift' },
    {
        action: 'Self-Timer',
        app: 'cleanshot',
        key: '4',
        mods: 'ctrl+shift+cmd',
        since: '2026-09-26',
    },
] satisfies readonly Hotkey[];

/* Types */
export interface Hotkey {
    app: string;
    mods: string;
    key: string;
    action: string;
    note?: string;
    // ISO date the binding took this meaning; a press before it keeps the older row's label
    since?: string;
    // ISO date it stopped. The mirror of `since`, and the half a move needs: when a chord is
    // freed its old meaning has to end, or every later press on that now-empty chord would
    // still be credited to whatever used to live there.
    //
    // 📌 Both are DAY granularity and the split is only as sharp as that: presses made earlier
    // on the same day a move is recorded fall on the new side of the line and are credited to
    // nobody. Sharpening it means comparing instants rather than strings, which labelAt cannot
    // do cheaply — it runs once per event and the log is tens of thousands. Measured on a real
    // move: 66 of that day's presses landed on the wrong side.
    until?: string;
    // Where this row came from, stamped by the scan. Only `manual` rows can be edited from the
    // ui: everything else is read out of its own app's config, so a write here would be a lie
    // the next scan erases. It is not written by hand — manual.ts never carries it in source.
    source?: 'manual' | 'scan';
}
