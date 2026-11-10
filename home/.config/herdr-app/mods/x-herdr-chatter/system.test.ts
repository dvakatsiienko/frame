import { describe, expect, test } from 'vitest';

import { cleanTyped, dropImageMarks, systemLine } from './system.js';

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
