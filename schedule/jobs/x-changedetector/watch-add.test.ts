import { describe, expect, it } from 'vitest';

import { watchFor } from './watch-add.ts';

describe('watchFor', () => {
    it('turns a github issue into an api watch that opens the issue page', () => {
        expect(
            watchFor('https://github.com/anthropics/claude-code/issues/85225'),
        ).toEqual({
            include_filters: [
                'jq:{state, state_reason, labels: [.labels[].name], comments, closed_at}',
            ],
            link_to_open:
                'https://github.com/anthropics/claude-code/issues/85225',
            title: 'anthropics/claude-code#85225',
            url: 'https://api.github.com/repos/anthropics/claude-code/issues/85225',
        });
    });

    it('reads a pull request through the issues endpoint', () => {
        expect(
            watchFor(
                'https://github.com/MrLesk/Backlog.md/pull/1071#discussion',
            ).url,
        ).toBe('https://api.github.com/repos/MrLesk/Backlog.md/issues/1071');
    });

    it('keeps any other url as a plain page watch', () => {
        expect(
            watchFor('https://github.com/anthropics/claude-code/releases.atom'),
        ).toEqual({
            url: 'https://github.com/anthropics/claude-code/releases.atom',
        });
    });
});
