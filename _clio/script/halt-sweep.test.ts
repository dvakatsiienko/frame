import { describe, expect, test } from 'vitest';

import type { Notification } from './halt-sweep.ts';
import { UNTIL_NOTE, isSettled, unhandledLines } from './halt-sweep.ts';

const template = [
    '## 🌠 wishes',
    '> what i want. try resolve gradually.',
    '---',
    '',
].join('\n');

function inbox(drop: string) {
    return `${template}\n${drop}\n\n`;
}

function note(
    subject: Notification['subject'],
    repo = 'dima/frame',
): Notification {
    return { id: '1', repository: { full_name: repo }, subject };
}

describe('unhandledLines', () => {
    test('a line without a ✅ is reported, so the reset refuses', () => {
        expect(
            unhandledLines(inbox('new idea from the phone'), template),
        ).toEqual(['new idea from the phone']);
    });

    test('a ✅ entry and its continuation lines pass', () => {
        const handled = inbox('✅ **done**\n  the body\n\tmore body');
        expect(unhandledLines(handled, template)).toEqual([]);
    });

    test('an unindented line straight under a ✅ entry is unhandled', () => {
        const dropped = inbox('✅ **done**\n  the body\na new drop');
        expect(unhandledLines(dropped, template)).toEqual(['a new drop']);
    });

    test('a new line after a blank line below a ✅ entry is unhandled', () => {
        const dropped = inbox('✅ **done**\n  the body\n\na new drop');
        expect(unhandledLines(dropped, template)).toEqual(['a new drop']);
    });

    test('lines in the prepped inbox pass, a line typed after the prep is refused', () => {
        const prepped = inbox(
            '> [!quote]- original\n> **add this**\n> topic to review: x',
        );
        const drop = inbox('**add this**\ntopic to review: x\ntyped later');
        expect(unhandledLines(drop, template, prepped)).toEqual([
            'typed later',
        ]);
        expect(unhandledLines(drop, template)).toHaveLength(3);
    });

    test('a numbered ✅ PK line is handled', () => {
        const prepped = inbox('> [!quote]- original\n> 1. finish pm module');
        const drop = inbox('1. ✅ PK-277 finish pm module');
        expect(unhandledLines(drop, template, prepped)).toEqual([]);
    });

    test('an unmarked bold line and a plain line in the prep are handled', () => {
        const prepped = inbox(
            '> [!quote]- original\n> **dark board**\n> make it dark please',
        );
        const drop = inbox('**dark board**\nmake it dark please');
        expect(unhandledLines(drop, template, prepped)).toEqual([]);
    });

    test('a listed line in neither the prep nor a ✅ is refused', () => {
        const prepped = inbox('> [!quote]- original\n> **dark board**');
        const drop = inbox('- something new');
        expect(unhandledLines(drop, template, prepped)).toEqual([
            '- something new',
        ]);
    });

    test('a pristine template passes', () => {
        expect(unhandledLines(template, template)).toEqual([]);
    });
});

describe('isSettled', () => {
    test('a merged pr is settled, an open pr is not', () => {
        const pr = (state: string) =>
            note({ title: 't', type: 'PullRequest', url: `u/${state}` });
        const call = (args: string[]) => ({
            state: args[0]?.endsWith('open') ? 'open' : 'closed',
        });
        expect(isSettled(pr('closed'), call)).toBe(true);
        expect(isSettled(pr('open'), call)).toBe(false);
    });

    test('a ci run of a branch is settled only when that branch has no open pr', () => {
        const run = note({
            title: 'CI run failed for main branch',
            type: 'CheckSuite',
        });
        expect(isSettled(run, () => [])).toBe(true);
        expect(isSettled(run, () => [{ number: 1 }])).toBe(false);
    });

    test('a ci run whose title names no branch is never settled', () => {
        expect(
            isSettled(note({ title: 'odd', type: 'CheckSuite' }), () => []),
        ).toBe(false);
    });
});

describe('UNTIL_NOTE', () => {
    test.each(['FRM-12', 'BYT-3', 'PK-160'])('matches until: %s', (id) => {
        expect(UNTIL_NOTE.test(`rule text until: ${id}`)).toBe(true);
    });

    test('a ticket id of another family does not match', () => {
        expect(UNTIL_NOTE.test('until: XYZ-1')).toBe(false);
    });
});
