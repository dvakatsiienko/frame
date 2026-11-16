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

describe('Enter acts on what he typed, Shift+Enter keeps writing', () => {
    test('Enter is a click on send, with the text as it was before Enter’s line break', () => {
        expect(submitted('ship it\n', ['ship it'], {})).toEqual({
            act: 'click',
            caret: 7,
            text: 'ship it',
        });
    });

    test('cmd+Enter sends now', () => {
        expect(
            submitted('ship it\n', ['ship it'], { secondary: true }).act,
        ).toBe('push');
    });

    test('Enter with the caret inside the text sends the text unbroken', () => {
        expect(submitted('ship\n it', ['ship it'], {}).text).toBe('ship it');
    });

    test('the break is found whether or not its own change was seen before the submit', () => {
        expect(submitted('ship\n it', ['ship\n it', 'ship it'], {}).text).toBe(
            'ship it',
        );
        expect(submitted('ship\n it', ['ship it', 'ship i'], {}).text).toBe(
            'ship it',
        );
    });

    test('his caret stays where he pressed Enter', () => {
        expect(submitted('ship\n it', ['ship it'], {}).caret).toBe(4);
        expect(submitted('\nship it', ['ship it'], {}).caret).toBe(0);
        expect(submitted('  ship\n it', ['  ship it'], {}).caret).toBe(4);
    });

    test('a message of several lines goes whole', () => {
        expect(submitted('one\n\ntwo\n', ['one\n\ntwo'], {}).text).toBe(
            'one\n\ntwo',
        );
    });

    test('with no change seen before it, Enter still drops its own line break', () => {
        expect(submitted('pasted\n', [''], {}).text).toBe('pasted');
    });

    test('Shift+Enter does nothing and leaves the quill as typed', () => {
        expect(submitted('one\n', ['one'], { shift: true })).toEqual({
            act: null,
            caret: 0,
            text: null,
        });
    });

    test('Enter in an empty quill does nothing and leaves no blank line', () => {
        expect(submitted('\n', [''], {})).toMatchObject({
            act: null,
            text: '',
        });
        expect(submitted('  \n\n', ['  \n'], {})).toMatchObject({
            act: null,
            text: '',
        });
    });
});
