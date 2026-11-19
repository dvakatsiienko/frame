import { describe, expect, test } from 'vitest';

import { addressIn, inTurn, sendBlocked, sentNote, submitted } from './send.js';

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

    test.each([
        [{ secondary: true }, 'push'],
        [{}, 'click'],
    ])('an empty quill with files waiting still acts: %j', (keys, act) => {
        expect(submitted('\n', [''], keys, true).act).toBe(act);
        expect(submitted('\n', [''], keys).act).toBeNull();
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

// the review's W72: a send during a model pick typed into Claude Code's picker, and the effort changed for every model
describe('a send waits while a pick types into the same thread (FRM-628)', () => {
    test('a model, effort or permission pick typing there: the words stay, and he is told why', () => {
        expect(sendBlocked('t1', new Set(['t1']))).toBe(
            'A switch is typing into this thread: send again in a moment',
        );
    });

    test('a pick typing into another thread holds nothing here', () => {
        expect(sendBlocked('t1', new Set(['t2']))).toBeNull();
    });
});

describe('a / command sent while the thread works says it waits (dima, 18 Nov 23:31)', () => {
    test('while the thread works, the note under the quill says the command runs after this turn', () => {
        expect(sentNote('/clio:halt wire+', null, true)).toBe(
            'a / command runs after this turn',
        );
    });

    test('an idle thread runs it now, and plain words keep their own note', () => {
        expect([
            sentNote('/clio:halt', null, false),
            sentNote('ship it', 'pushed: no turn to join', true),
        ]).toEqual([null, 'pushed: no turn to join']);
    });
});

test('a thread working or blocked on an ask is in a turn; idle or done is not (FRM-659 round 3)', () => {
    expect(
        ['working', 'blocked', 'idle', 'done', undefined].map(inTurn),
    ).toEqual([true, true, false, false, false]);
});
