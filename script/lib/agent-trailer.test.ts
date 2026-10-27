import { describe, expect, test } from 'vitest';

import { modelFor, roleFor, trailerAdd } from './agent-trailer.ts';

describe('roleFor', () => {
    test.each([
        ['🦉 cclio', 'cclio'],
        ['🦉 cclio (fork)', 'cclio-fork'],
        ['☕️ 🔧 BYT-100 code: review gate', 'coder'],
        ['☕️ 🔎 BYT-100 verify: #125', 'verifier'],
        ['🎼 composer', 'composer'],
        ['frame-df', 'frame-df'],
    ])('reads the role of %s', (name, role) => {
        expect(roleFor(name)).toBe(role);
    });
});

describe('modelFor', () => {
    test.each([
        ['claude-opus-5-5', 'Claude Opus 5.5'],
        ['claude-fable-5-1', 'Claude Fable 5.1'],
        ['claude-haiku-5-5-20261001', 'Claude Haiku 5.5'],
    ])('names %s as its product', (id, name) => {
        expect(modelFor(id)).toBe(name);
    });
});

describe('trailerAdd', () => {
    test('appends the trailer after a blank line', () => {
        expect(
            trailerAdd(
                '🔧 x: a change\n\n- a: b\n',
                'cclio',
                'Claude Opus 5.5',
            ),
        ).toBe('🔧 x: a change\n\n- a: b\n\nAgent: cclio · Claude Opus 5.5\n');
    });

    test('leaves a message that already carries one', () => {
        const message = '🔧 x: a change\n\nAgent: coder · Claude Sonnet 5.5\n';
        expect(trailerAdd(message, 'cclio', 'Claude Opus 5.5')).toBe(message);
    });
});
