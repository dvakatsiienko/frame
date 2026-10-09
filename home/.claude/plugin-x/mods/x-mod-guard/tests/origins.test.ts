import type { On } from 'claude-code';
import { expect, mock, test } from 'claude-code/testing';

import { answerPrompts } from './said.ts';

function world(on: On) {
    const store: Record<string, unknown> = {};
    mock.clock(on, { now: 1_000_000 });
    on('store.get', (_$, e) => ({ value: store[e.key] }));
    on('store.set', (_$, e) => {
        store[e.key] = e.value;
        return { value: undefined };
    });
    on('session.id', () => ({ value: 'o1o1o1o1-0000' }));
    answerPrompts(on);
    return store;
}

type Row = { text: string; origin: { kind: string } };

test("a prompt's origin is logged with its head cut on whole code points", async ($, on) => {
    const store = world(on);
    await $.prompt.submit({
        origin: { kind: 'peer' },
        text: `${'a'.repeat(79)}🦉 cclio`,
        wait: false,
    });
    const [row] = store.origins as Row[];
    expect([row?.origin.kind, [...(row?.text ?? '')].at(-1)]).toEqual([
        'peer',
        '🦉',
    ]);
});
