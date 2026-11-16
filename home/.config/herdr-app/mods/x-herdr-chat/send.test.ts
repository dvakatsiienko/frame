import { describe, expect, test } from 'vitest';

import { addressIn, submitted } from './send.js';

describe('the thread a message goes to is the one its Claude runs in', () => {
    test('the address is read from the process line herdr started it with', () => {
        expect(
            addressIn(
                'claude --name lane HC_SCOPE=64-a0 HC_TERMINAL_ID=t74 HC_TERMINAL_SOCKET=/s/default.sock HOME=/Users/d',
            ),
        ).toBe('t74');
    });

    test('words in its prompt that look like an address never win over its own', () => {
        expect(
            addressIn('claude say HC_TERMINAL_ID=t1 twice HC_TERMINAL_ID=t74'),
        ).toBe('t74');
    });

    test('a Claude started outside herdr has no address', () => {
        expect(addressIn('claude --name lane HOME=/Users/d')).toBeNull();
        expect(addressIn('')).toBeNull();
    });
});

describe('Enter sends what he typed, Shift+Enter keeps writing', () => {
    test('Enter sends the text without the line break Enter typed', () => {
        expect(submitted('ship it\n', false)).toEqual({
            box: '',
            text: 'ship it',
        });
    });

    test('a message of several lines goes whole', () => {
        expect(submitted('one\n\ntwo\n', false).text).toBe('one\n\ntwo');
    });

    test('Shift+Enter sends nothing and leaves the quill as typed', () => {
        expect(submitted('one\n', true)).toEqual({ box: null, text: null });
    });

    test('Enter in an empty quill sends nothing and leaves no blank line', () => {
        expect(submitted('\n', false)).toEqual({ box: '', text: null });
        expect(submitted('  \n\n', false)).toEqual({ box: '', text: null });
    });
});
