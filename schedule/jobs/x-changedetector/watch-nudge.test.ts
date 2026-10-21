import { describe, expect, test } from 'vitest';

import { unwatched, upstreamLinks } from './watch-nudge.ts';

describe('watch-nudge', () => {
    test('finds an upstream issue and pr, skips our own repos', () => {
        expect(
            upstreamLinks(
                'see https://github.com/anthropics/claude-code/issues/95589 and https://github.com/n8n-io/n8n/pull/12 but not https://github.com/dvakatsiienko/frame/pull/94',
            ),
        ).toEqual([
            'https://github.com/anthropics/claude-code/issues/95589',
            'https://github.com/n8n-io/n8n/pull/12',
        ]);
    });

    test('drops a link whose api url is already watched', () => {
        expect(
            unwatched(
                [
                    'https://github.com/a/b/issues/1',
                    'https://github.com/a/b/pull/2',
                ],
                ['https://api.github.com/repos/a/b/issues/1'],
            ),
        ).toEqual(['https://github.com/a/b/pull/2']);
    });
});
