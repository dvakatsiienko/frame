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

    test('a line only in the prepped copy is unhandled', () => {
        expect(unhandledLines(inbox('**add this**'), template)).toEqual([
            '**add this**',
        ]);
    });

    test('a numbered ✅ PK line is handled', () => {
        expect(
            unhandledLines(inbox('1. ✅ PK-277 finish pm module'), template),
        ).toEqual([]);
    });

    test('a line whose text is in a pocket raw-drop note is handled', () => {
        const pocket =
            'notes\nraw drop (2026-10-30 inbox, dima): **dark board**\n';
        expect(
            unhandledLines(inbox('**dark board**'), template, pocket),
        ).toEqual([]);
    });

    test('a listed line is matched by its text, not its list marker', () => {
        const pocket = 'raw drop (2026-10-30 inbox, dima): something new';
        expect(
            unhandledLines(inbox('- something new'), template, pocket),
        ).toEqual([]);
    });

    test('a line absent from every raw-drop note stays unhandled', () => {
        const pocket = 'raw drop (2026-10-30 inbox, dima): **dark board**';
        expect(
            unhandledLines(inbox('- something new'), template, pocket),
        ).toEqual(['- something new']);
    });

    test('text outside a raw-drop note does not count', () => {
        expect(
            unhandledLines(
                inbox('something new'),
                template,
                'ticket body: something new',
            ),
        ).toEqual(['something new']);
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
