import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { planKeysChange } from '../../../../.claude/plugin-x/skills/herdr/scripts/keys-change.ts';

// FRM-673 exit 3: a hotkey a mod binds with `cx.bind_keys` fires only while its action has a handler in that mod, and
// it lives on after a keys.json save only if the keys door reloads the mod. this reads every mod's source: each bound
// action is handled, and every mod that binds keys is one the door reloads
const MODS = join(import.meta.dirname, '..');

/** the text of one call starting at `at`, its parens balanced */
function callAt(text: string, at: number) {
    let depth = 0;
    for (let i = text.indexOf('(', at); i < text.length; i++) {
        if (text[i] === '(') depth++;
        if (text[i] === ')' && --depth === 0) return text.slice(at, i + 1);
    }
    return text.slice(at);
}

function keysOf(mod: string) {
    const text = readdirSync(join(MODS, mod))
        .filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'))
        .map((f) => readFileSync(join(MODS, mod, f), 'utf8'))
        .join('\n');
    const consts = new Map(
        [...text.matchAll(/const ([A-Z_]+) = '(x_herdr_[a-z0-9_]+)'/g)].map(
            ([, name, value]) => [name, value],
        ),
    );
    const named = (token: string) =>
        token.startsWith("'")
            ? token.slice(1, -1)
            : (consts.get(token) ?? token);
    // a bound action is a name (a literal or a const), a pair's name (`action: String(action)`), or one a helper
    // computes from a shared list (`action: viewerAction(step)`), handled when the handler calls the same helper
    const bound = new Set<string>();
    // a call this reader cannot parse fails the test, never drops its mod from the check
    const unread: string[] = [];
    for (const call of [...text.matchAll(/cx\.bind_keys\(/g)].map((m) =>
        callAt(text, m.index),
    )) {
        const had = bound.size;
        for (const [, token] of call.matchAll(
            /action: ('x_herdr_[a-z0-9_]+'|[A-Z_]+)(?=[\s,)])/g,
        ))
            bound.add(named(token));
        if (call.includes('action: String(action)'))
            for (const [, name] of call.matchAll(/\['[^']+', '([^']+)'\]/g))
                bound.add(name);
        for (const [, helper] of call.matchAll(/action: ([a-z]\w*)\(/g))
            if (helper !== 'String') bound.add(`${helper}()`);
        if (bound.size === had) unread.push(call.slice(0, 80));
    }
    const handled = new Set([
        ...[
            ...text.matchAll(
                /\.on_action\(\s*('x_herdr_[a-z0-9_]+'|[A-Z_]+)(?=[\s,)])/g,
            ),
        ].map(([, token]) => named(token)),
        ...[...text.matchAll(/\.on_action\(\s*([a-z]\w*)\(/g)].map(
            ([, helper]) => `${helper}()`,
        ),
    ]);
    const isHandled = (action: string) => handled.has(action);
    return { bound: [...bound], isHandled, unread };
}

const binders = readdirSync(MODS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '_shared')
    .map((d) => d.name)
    .filter((mod) => {
        const { bound, unread } = keysOf(mod);
        return bound.length + unread.length > 0;
    });

describe('the hotkeys our mods bind', () => {
    test('the chat and the deck bind keys', () => {
        expect(binders).toEqual(
            expect.arrayContaining(['x-herdr-chat', 'x-herdr-deck']),
        );
    });

    test.each(binders)(
        'every bind_keys call in %s reads as its actions',
        (mod) => {
            expect(keysOf(mod).unread).toEqual([]);
        },
    );

    test.each(binders)('every key %s binds has its handler', (mod) => {
        const { bound, isHandled } = keysOf(mod);
        expect(bound.filter((action) => !isHandled(action))).toEqual([]);
    });

    test('the keys door reloads every mod that binds keys', () => {
        const reloaded = planKeysChange('{}', null, binders).steps.map((s) =>
            s.kind === 'reload' ? s.mod : null,
        );
        expect(reloaded).toEqual(expect.arrayContaining(binders));
        // the door reloads a mod by touching its main.js
        expect(
            binders.filter((mod) => !existsSync(join(MODS, mod, 'main.js'))),
        ).toEqual([]);
    });
});
