import { describe, expect, test } from 'vitest';

import { normalize } from './normalize.ts';

const spoken = (text: string) =>
    normalize(text)
        .map((run) => run.text)
        .join(' | ');

describe('normalize', () => {
    test('the exit string reads with no «vee», no arrow, no backticks', () => {
        expect(spoken('FRM-266 shipped in v0.3.85 → see `speak/`')).toBe(
            'F R M 266 shipped in version 0 point 3 point 85, see speak',
        );
    });

    test('a url is read as its domain', () => {
        expect(
            spoken(
                'docs at https://github.com/smcantab/speak11/blob/main/x.md now',
            ),
        ).toBe('docs at github.com now');
    });

    test('a markdown link keeps only its label', () => {
        expect(
            spoken(
                'read [the ticket](https://linear.app/x-com/issue/FRM-269) first',
            ),
        ).toBe('read the ticket first');
    });

    test('identifiers split into words', () => {
        expect(spoken('call dangerouslySetInnerHTML and snake_case_name')).toBe(
            'call dangerously Set Inner H T M L and snake case name',
        );
    });

    test('a unit after a number is spelled out', () => {
        expect(spoken('first audio in 150ms at 24 kHz')).toBe(
            'first audio in 150 milliseconds at 24 kilohertz',
        );
    });

    test('an iso date is read as a date', () => {
        expect(spoken('measured 2026-09-29')).toBe(
            'measured September 29, 2026',
        );
    });

    test('letter acronyms are spelled, word acronyms are said', () => {
        expect(spoken('the cli prints json')).toBe('the C L I prints jason');
    });

    test('a file name reads its extension', () => {
        expect(spoken('edit manual.ts')).toBe('edit manual dot ts');
    });
});

describe('language runs', () => {
    test('ukrainian text goes to a uk run', () => {
        expect(normalize('Привіт, як справи?')).toEqual([
            { lang: 'uk', text: 'Привіт, як справи?' },
        ]);
    });

    test('russian text goes to a ru run', () => {
        expect(normalize('Это русский текст.')).toEqual([
            { lang: 'ru', text: 'Это русский текст.' },
        ]);
    });

    test('latin words inside cyrillic get their own en run', () => {
        expect(normalize('запусти pnpm typecheck у репо')).toEqual([
            { lang: 'uk', text: 'запусти' },
            { lang: 'en', text: 'P N P M typecheck' },
            { lang: 'uk', text: 'у репо' },
        ]);
    });
});
