// the shelf file `~/.claude/shelf/lanes.json` as x-mod-stash writes it and x-herdr-deck reads it: one fixture both sides
// test (FRM-659). the writer's test (lanes-shelf.test.ts) reds when it writes a field missing here; the deck's
// (x-herdr-deck/lanes.test.ts) reds when a field it reads goes missing here. shapes copied from a real row, 2026-11-19
export const LANES_SHELF = {
    lanes: [
        {
            current: 1,
            done: 1,
            endedAt: null,
            history: [{ at: 1763560000000, step: 0 }],
            id: 'l98',
            items: [
                {
                    isDone: true,
                    text: 'the chat follows its own Claude',
                    ticket: 'FRM-659',
                },
                {
                    isDone: false,
                    text: 'the main file split by view',
                    ticket: 'FRM-659',
                },
            ],
            members: {},
            movedAt: 1763560000000,
            ticket: 'FRM-659',
            title: 'herdr — FRM-659 herdr mods',
        },
        {
            current: 2,
            done: 2,
            endedAt: 1763500000000,
            history: [],
            id: 'l97',
            items: [
                { isDone: true, text: 'shape the settings pane' },
                { isDone: true, text: 'guard rules' },
            ],
            members: {},
            movedAt: 1763500000000,
            title: 'mods — ended',
        },
    ],
};
