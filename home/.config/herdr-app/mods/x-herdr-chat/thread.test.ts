import { describe, expect, test } from 'vitest';

import { transcriptPath } from './thread.js';

describe("a thread's transcript file", () => {
    test('sits under the project folder named after its working folder', () => {
        expect(
            transcriptPath(
                { cwd: '/Users/dima/frame', sessionId: 'abc-123' },
                '/Users/dima',
            ),
        ).toBe('/Users/dima/.claude/projects/-Users-dima-frame/abc-123.jsonl');
    });

    test('every character of the folder that is no letter or digit reads as a dash', () => {
        expect(
            transcriptPath(
                { cwd: '/Users/dima/my app_2/.x', sessionId: 's' },
                '/Users/dima',
            ),
        ).toBe('/Users/dima/.claude/projects/-Users-dima-my-app-2--x/s.jsonl');
    });

    test.each([
        ['no session file', null],
        ['a file with no session id', { cwd: '/Users/dima/frame' }],
        ['a file with no folder', { sessionId: 's' }],
        ['text that is no object', 'oops'],
    ])('%s gives no path', (_name, session) => {
        expect(transcriptPath(session, '/Users/dima')).toBeNull();
    });
});
