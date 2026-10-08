import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { boldFleetWords } from '../hooks/parse.ts';

test('a bare fleet word prints bold with its badge', () => {
    expect(boldFleetWords('that becomes a wisp.').text).toBe(
        'that becomes a **✨ wisp**.',
    );
});

test('a plural keeps its badge', () => {
    expect(boldFleetWords('two wisps, then a siesta').text).toBe(
        'two **✨ wisps**, then a **🌤️ siesta**',
    );
});

test('a freebie prints bold with its clover', () => {
    expect(boldFleetWords('do the freebies').text).toBe(
        'do the **🍀 freebies**',
    );
});

test('a wish is bolded as a noun, never as a verb', () => {
    expect(boldFleetWords('i wish it ran; the wish holds').text).toBe(
        'i wish it ran; the **🌠 wish** holds',
    );
});

test('a badged word only gains the bold', () => {
    expect(boldFleetWords('a ✨ wisp here').text).toBe('a **✨ wisp** here');
});

test('code, fences, bold text, quotes, links and names keep their words', () => {
    const text = [
        'see `wisp` here',
        '```',
        'a wisp',
        '```',
        'the **wisp list** holds',
        '> a wisp in his words',
        '[the stash](https://linear.app/wisp)',
        'x-mod-wisp and wisp.md',
        'stay in the lane',
    ].join('\n');
    expect(boldFleetWords(text).text).toBe(text);
});

test('each rewrite is counted by its word', () => {
    expect(boldFleetWords('a wisp, two wisps, a freebie').hits).toEqual({
        freebie: 1,
        wisp: 2,
    });
});

// the harness keeps no rows: this hook sees what would be stored
function world(on: On) {
    mock.clock(on, { now: new Date(2026, 9, 8, 13, 58).getTime() });
    const store = new Map<string, unknown>();
    on('store.get', (_$, e) => ({ value: store.get(e.key) }));
    on('store.set', (_$, e) => {
        store.set(e.key, e.value);
        return { value: undefined };
    });
    on('store.keys', () => ({ value: [...store.keys()] }));
    on('store.delete', (_$, e) => {
        store.delete(e.key);
        return { value: undefined };
    });
    on('session.id', () => ({ value: 's1s1s1s1-0000' }));
    const stored: string[] = [];
    on('session.append', (_$, e, next) => {
        stored.push(JSON.stringify(e.message.content));
        return next(e);
    });
    return { store, stored };
}

const reply = ($: Engine, text: string) =>
    $.session
        .append({
            door: 'response',
            message: {
                content: [{ text, type: 'text' }],
                role: 'assistant',
                type: 'assistant',
            },
            origin: { kind: 'model', model: 'claude-opus-5-5' },
            uuid: 'u1',
        })
        .catch(() => undefined);

test("a reply's bare fleet word is stored bold", async ($, on) => {
    const w = world(on);
    await reply($, 'that becomes a wisp');
    expect(w.stored.join()).toContain('that becomes a **✨ wisp**');
});

test("a reply's fleet-word rewrites are counted for the day", async ($, on) => {
    const w = world(on);
    await reply($, 'a wisp and a freebie');
    await reply($, 'one more wisp');
    expect(w.store.get('words:2026-10-08:s1s1s1s1-0000')).toEqual({
        freebie: 1,
        wisp: 2,
    });
});
