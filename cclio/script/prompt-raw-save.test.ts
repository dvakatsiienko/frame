import { describe, expect, test } from 'vitest';

import { dimasText } from './prompt-raw-save.ts';

const notice =
    '<system-reminder>\nThe user\'s fork "🦉 cclio (fork)" finished a turn.\n</system-reminder>\n';

describe('dimasText', () => {
    test('a prompt behind an app notice keeps his words, without the notice', () => {
        expect(dimasText(`${notice}${notice}proceed with slice b`)).toBe(
            'proceed with slice b',
        );
    });

    test('a notice alone is not his', () => {
        expect(dimasText(notice)).toBe(undefined);
    });

    test('a peer message is not his', () => {
        expect(
            dimasText(
                '<cross-session-message from="x">hi</cross-session-message>',
            ),
        ).toBe(undefined);
    });
});
