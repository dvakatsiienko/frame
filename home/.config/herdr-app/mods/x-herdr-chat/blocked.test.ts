import { expect, test } from 'vitest';

import { screenTail } from './blocked.js';

test("a blocked thread's screen keeps the part from the rule above the first option down, no blank rows", () => {
    const screen = [
        'earlier output',
        '─'.repeat(30),
        ' Bash command',
        '',
        '❯ 1. Yes',
        '  4. No',
        '',
    ].join('\n');
    expect(screenTail(screen)).toBe(' Bash command\n❯ 1. Yes\n  4. No');
});
