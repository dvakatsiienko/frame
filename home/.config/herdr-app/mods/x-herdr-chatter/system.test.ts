import { describe, expect, test } from 'vitest';

import {
    cleanTyped,
    dropImageMarks,
    midTurnPrompt,
    systemLine,
} from './system.js';

// real rows from clio's transcript (a741b7d8, 2026-11-10), cut short
const paste = {
    message: {
        content:
            '\n\n<pasted_content id="c76c">\n⏰ due today: the next cli lane runs delve\'s test round\n</pasted_content>\nwhy?',
    },
    origin: { kind: 'human' },
    type: 'user',
};
const tick = {
    message: {
        content:
            "The x-mod-stash plugin sent a message:\norbit: dima marked 4 asks. answer each in this reply.\n- o34 🛎️ accepted\n\nThis is how Claude Code surfaces a prompt a plugin submits between turns — it starts this turn in the user's place. Address the message above.",
    },
    origin: { kind: 'plugin', name: 'x-mod-stash' },
    type: 'user',
};
const slash = {
    message: {
        content:
            '<command-message>x:handoff-ingest</command-message>\n<command-name>/x:handoff-ingest</command-name>\n<command-args>pm-revamp-checkpoint-1</command-args>',
    },
    origin: { kind: 'plugin', name: 'x-mod-stash' },
    type: 'user',
};
const task = {
    message: {
        content:
            '<task-notification>\n<task-id>b4pp1euml</task-id>\n<status>completed</status>\n<summary>Background command "commit helga" completed (exit code 0)</summary>\n</task-notification>',
    },
    origin: { kind: 'task-notification', producer: 'session-task' },
    type: 'user',
};
const synthetic = {
    message: {
        content: [{ text: 'No response requested.', type: 'text' }],
        model: '<synthetic>',
    },
    type: 'assistant',
};

describe('his own text reads as he typed it', () => {
    test('a paste whose closing tag carries its id too reads as his text', () => {
        // dima's 22:26 prompt: Claude Code wrote the id on both tags
        expect(
            cleanTyped(
                '<pasted_content id="c76c">\nwisp: bold rendering broke\n</pasted_content id="c76c">',
            ),
        ).toBe('wisp: bold rendering broke');
    });

    test('a paste reads as his plain text, the tags gone', () => {
        expect(cleanTyped(paste.message.content)).toBe(
            "⏰ due today: the next cli lane runs delve's test round\n\nwhy?",
        );
    });

    test('a reminder with an id attribute goes too', () => {
        expect(
            cleanTyped(
                'hi <system-reminder id="58c5">\nnoise\n</system-reminder> there',
            ),
        ).toBe('hi  there');
    });

    test('his own message is no system line', () => {
        expect(systemLine(paste)).toBeNull();
    });
});

describe('a line he never typed is told apart by its entry', () => {
    test('an orbit tick folds to its first line, the full text kept', () => {
        const line = systemLine(tick);
        expect(line?.label).toBe(
            '⚙︎ x-mod-stash: orbit: dima marked 4 asks. answer each in this reply.',
        );
        expect(line?.text).toContain('o34 🛎️ accepted');
        expect(line?.text).not.toContain('This is how Claude Code surfaces');
    });

    test('a plugin slash command folds to the command', () => {
        expect(systemLine(slash)?.label).toBe(
            '⚙︎ x-mod-stash: /x:handoff-ingest',
        );
    });

    test('a task notice folds to its status and summary', () => {
        expect(systemLine(task)?.label).toBe(
            '⏱ completed: Background command "commit helga" completed (exit code 0)',
        );
    });

    test('a synthetic reply is a system line', () => {
        expect(systemLine(synthetic)?.label).toBe('No response requested.');
    });
});

describe('an image he sent reads as its chip, never as its marker', () => {
    // a real row (clio's transcript, 20:32): the text block opens with the marker Claude Code adds beside the image
    const content = [
        { text: '[Image #26]whats next for you?', type: 'text' },
        { source: {}, type: 'image' },
    ];

    test('the marker goes when the entry holds the image', () => {
        expect(dropImageMarks(content)).toEqual([
            { text: 'whats next for you?', type: 'text' },
            { source: {}, type: 'image' },
        ]);
    });

    test('text that only names an image stays as he typed it', () => {
        const typed = [{ text: 'see [Image #3] above', type: 'text' }];
        expect(dropImageMarks(typed)).toEqual(typed);
    });
});

describe('a prompt he typed while a turn ran draws like any other', () => {
    // cut from clio's transcript a741b7d8, 21:15: Claude Code wrote it as a queued command, never a user entry
    const typed = {
        attachment: {
            commandMode: 'prompt',
            delivery_id: '8f8d6aa4-4ae2-4885-8d63-2170b8901af3',
            humanTurn: true,
            origin: { kind: 'human' },
            prompt: 'herder codie needs a SW tell him.',
            source_uuid: '0486b5d4-1584-41dd-8fe4-dacee3afd515',
            timestamp: '2026-11-10T19:15:35.577Z',
            type: 'queued_command',
        },
        isSidechain: false,
        parentUuid: '17b2b2a7-90b2-4abe-97b3-ccb77acfd6ad',
        sessionId: 'a741b7d8-dbde-4ae9-95c8-28d502c57cd0',
        timestamp: '2026-11-10T19:15:35.577Z',
        type: 'attachment',
        uuid: '8fa796eb-7214-4fcb-828b-13cefb4843a6',
    };

    test('his mid-turn prompt reads as his message', () => {
        expect(midTurnPrompt(typed)).toMatchObject({
            message: { content: 'herder codie needs a SW tell him.' },
            sessionId: typed.sessionId,
            type: 'user',
            uuid: typed.uuid,
        });
    });

    test('a mid-turn prompt with a shot keeps its blocks', () => {
        const blocks = [
            { text: 'chatter wisp', type: 'text' },
            { source: { data: 'x', type: 'base64' }, type: 'image' },
        ];
        const shot = {
            ...typed,
            attachment: { ...typed.attachment, prompt: blocks },
        };
        expect(midTurnPrompt(shot)?.message.content).toEqual(blocks);
    });

    test('a peer message or a task notice queued mid-turn is not his', () => {
        const peer = {
            ...typed,
            attachment: { ...typed.attachment, origin: { kind: 'peer' } },
            isMeta: true,
        };
        const task = {
            ...typed,
            attachment: {
                ...typed.attachment,
                commandMode: 'task-notification',
                origin: { kind: 'task-notification' },
            },
        };
        expect(midTurnPrompt(peer)).toBeNull();
        expect(midTurnPrompt(task)).toBeNull();
        expect(
            midTurnPrompt({ message: { content: 'hi' }, type: 'user' }),
        ).toBeNull();
    });
});
