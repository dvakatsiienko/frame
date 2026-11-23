import { describe, expect, it } from 'vitest';

import {
    parseCommand,
    watchFor,
    whatFor,
    whatOf,
    whyTitle,
} from './watch-add.ts';

describe('parseCommand', () => {
    it('refuses a missing --why', () => {
        expect(parseCommand(['https://example.com/a'])).toBeUndefined();
        expect(
            parseCommand(['https://example.com/a', 'because']),
        ).toBeUndefined();
    });

    it('refuses an empty or blank reason', () => {
        expect(
            parseCommand(['https://example.com/a', '--why', '']),
        ).toBeUndefined();
        expect(
            parseCommand(['https://example.com/a', '--why', '   ']),
        ).toBeUndefined();
        expect(
            parseCommand(['--why-set', 'https://example.com/a', ' ']),
        ).toBeUndefined();
    });

    it('trims the reason in both modes', () => {
        expect(
            parseCommand(['https://example.com/a', '--why', '  r  ']),
        ).toEqual({
            mode: 'add',
            reason: 'r',
            url: 'https://example.com/a',
        });
        expect(
            parseCommand(['--why-set', 'https://example.com/a', ' r ']),
        ).toEqual({
            mode: 'set',
            reason: 'r',
            url: 'https://example.com/a',
        });
    });
});

describe('the watch title', () => {
    it('is the issue what plus the why for a github issue', () => {
        const what = whatFor(
            'https://github.com/anthropics/claude-code/issues/85225',
            'Crash on start',
        );
        expect(whyTitle(what, 'blocks our hook')).toBe(
            'anthropics/claude-code#85225 Crash on start — why: blocks our hook',
        );
    });

    it('is the host plus path plus the why for a page', () => {
        expect(
            whyTitle(whatFor('https://example.com/pricing/plans'), 'new plan'),
        ).toBe('example.com/pricing/plans — why: new plan');
    });

    it('keeps the what and swaps the old why tail for --why-set', () => {
        expect(
            whyTitle(
                whatOf('example.com/pricing — why: old reason'),
                'new reason',
            ),
        ).toBe('example.com/pricing — why: new reason');
    });

    it('keeps a title without a tail whole', () => {
        expect(whatOf('anthropics/claude-code#1 Crash')).toBe(
            'anthropics/claude-code#1 Crash',
        );
    });
});

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
