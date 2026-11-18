import { describe, expect, test } from 'vitest';

import { createAskWatch, screenTail, where } from './question-read.js';

const asked = (id: string) =>
    JSON.stringify({
        message: {
            content: [
                {
                    id,
                    input: {
                        questions: [
                            {
                                options: [{ label: 'Yes' }, { label: 'No' }],
                                question: 'Ship it?',
                            },
                        ],
                    },
                    name: 'AskUserQuestion',
                    type: 'tool_use',
                },
            ],
        },
        type: 'assistant',
    });
const answered = (id: string) =>
    JSON.stringify({
        message: {
            content: [{ content: 'Yes', tool_use_id: id, type: 'tool_result' }],
        },
        type: 'user',
    });

describe('the question Claude waits on', () => {
    test('an AskUserQuestion call opens it', () => {
        const watch = createAskWatch();
        watch.add([asked('q1')]);
        expect(watch.items().map((i) => i.id)).toEqual(['q1']);
    });

    test('its tool result closes it', () => {
        const watch = createAskWatch();
        watch.add([asked('q1'), answered('q1')]);
        expect(watch.items()).toEqual([]);
    });

    test("another call's result leaves it open", () => {
        const watch = createAskWatch();
        watch.add([asked('q1'), answered('other')]);
        expect(watch.items()).toHaveLength(1);
    });

    test('a half line is skipped', () => {
        const watch = createAskWatch();
        watch.add(['{"type":"assis', asked('q2')]);
        expect(watch.items().map((i) => i.id)).toEqual(['q2']);
    });

    test('a switch to another thread forgets it', () => {
        const watch = createAskWatch();
        watch.add([asked('q1')]);
        watch.reset();
        expect(watch.items()).toEqual([]);
    });
});

describe("a blocked thread's screen", () => {
    test('keeps the part from the rule above the first option down, no blank rows', () => {
        const screen = [
            'earlier output',
            '─'.repeat(30),
            ' Ship it?',
            '',
            '❯ 1. Yes',
            '  2. No',
            '',
        ].join('\n');
        expect(screenTail(screen)).toBe(' Ship it?\n❯ 1. Yes\n  2. No');
    });
});

describe("where Claude's question screen is", () => {
    const questions = [
        {
            options: [{ label: 'Yes' }, { label: 'No' }],
            question: 'Ship it?',
        },
    ];

    test('reads the cursor off the ❯ row', () => {
        expect(where(' Ship it?\n  1. Yes\n❯ 2. No', questions)?.cursor).toBe(
            2,
        );
    });

    test('is none when the screen holds another question', () => {
        expect(where(' Lunch?\n❯ 1. Yes', questions)).toBeNull();
    });
});
