import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cardLines } from './siesta-gate.ts';
import { fixtureHome } from './siesta-gate-world.ts';

describe('the card’s chore lines', () => {
    test('pocket writes by hand count clio’s own pocket writes today, never a read or helga’s', () => {
        const home = fixtureHome();
        const t = join(home, 'clio.jsonl');
        const use = (
            input: object,
            name: string,
            timestamp = new Date().toISOString(),
        ) =>
            JSON.stringify({
                message: { content: [{ input, name, type: 'tool_use' }] },
                timestamp,
                type: 'assistant',
            });
        writeFileSync(
            t,
            [
                use(
                    { command: 'node script/pocket-add.ts "a" --size s' },
                    'Bash',
                ),
                use(
                    {
                        file_path:
                            '/Users/dima/frame/_clio/pocket/tasks/pk-1.md',
                    },
                    'Edit',
                ),
                use(
                    { command: "backlog task edit 307 --append-notes 'x'" },
                    'Bash',
                ),
                use(
                    { command: 'backlog task list --plain --sort ordinal' },
                    'Bash',
                ),
                use(
                    {
                        file_path:
                            '/Users/dima/frame/_clio/pocket/tasks/pk-1.md',
                    },
                    'Read',
                ),
                use(
                    { message: 'pocket-write PK-9 fields …', to: '🎀 helga' },
                    'SendMessage',
                ),
                use(
                    { command: 'node script/pocket-add.ts "b"' },
                    'Bash',
                    '2026-01-01T10:00:00Z',
                ),
            ].join('\n'),
        );
        expect(cardLines(home, t)).toContain('pocket writes by hand: 3');
    });

    test('a re-appended row or a read of the pocket script counts nothing more', () => {
        const home = fixtureHome();
        const t = join(home, 'clio.jsonl');
        const now = new Date().toISOString();
        const row = (id: string, command: string) =>
            JSON.stringify({
                message: {
                    content: [
                        {
                            id,
                            input: { command },
                            name: 'Bash',
                            type: 'tool_use',
                        },
                    ],
                },
                timestamp: now,
                type: 'assistant',
                uuid: `u-${id}`,
            });
        writeFileSync(
            t,
            [
                row('t1', 'node script/pocket-add.ts "a"'),
                row('t1', 'node script/pocket-add.ts "a"'),
                row('t2', 'sed -n 40,110p script/pocket-add.ts | grep ordinal'),
                row('t3', 'rg -n backlog task edit _clio/memory'),
                row('t4', 'for p in 288 291; do backlog task archive $p; done'),
            ].join('\n'),
        );
        expect(cardLines(home, t)).toContain('pocket writes by hand: 2');
    });

    test('a re-appended helga message wakes once', () => {
        const home = fixtureHome();
        const t = join(home, 'clio.jsonl');
        const wake = JSON.stringify({
            message: {
                content:
                    'Another Claude session sent a message:\n<cross-session-message from="x" from-name="🎀 helga">Chore 6 receipt: green</cross-session-message>',
            },
            timestamp: new Date().toISOString(),
            type: 'user',
            uuid: 'u-w1',
        });
        writeFileSync(t, [wake, wake].join('\n'));
        expect(cardLines(home, t)).toContain(
            'receipt wakes since the last siesta: 1',
        );
    });

    test.each(['Receipt: 3 chores green', 'Chore 4 receipt: PK-1 written'])(
        'a capitalised receipt «%s» counts as a wake',
        (body) => {
            const home = fixtureHome();
            const t = join(home, 'clio.jsonl');
            writeFileSync(
                t,
                JSON.stringify({
                    message: {
                        content: `Another Claude session sent a message:\n<cross-session-message from="x" from-name="🎀 helga">${body}</cross-session-message>`,
                    },
                    timestamp: new Date().toISOString(),
                    type: 'user',
                }),
            );
            expect(cardLines(home, t)).toContain(
                'receipt wakes since the last siesta: 1',
            );
        },
    );

    test('the 11-03 replay: helga’s receipts woke no turn, a woken one is counted', () => {
        const home = fixtureHome();
        const t = join(home, 'clio.jsonl');
        const at = (m: number) =>
            new Date(Date.now() - m * 60_000).toISOString();
        const row = (timestamp: string, content: string) =>
            JSON.stringify({ message: { content }, timestamp, type: 'user' });
        writeFileSync(
            t,
            [
                row(
                    at(30),
                    '<cross-session-message from="x" from-name="⚡ 🔧 codie: y">[progress] step 1</cross-session-message>',
                ),
                row(at(20), 'dima: go on'),
            ].join('\n'),
        );
        appendFileSync(
            t,
            `\n${row(at(15), '<cross-session-message from="x" from-name="🎀 helga">[ask] consult 2: anchor matches twice</cross-session-message>')}`,
        );
        expect(cardLines(home, t)).toContain(
            'receipt wakes since the last siesta: 0',
        );
        appendFileSync(
            t,
            `\n${row(at(12), 'Another Claude session sent a message:\n<cross-session-message from="x" from-name="🎀 helga">[done] receipt boot\n1 inbox-prep · exit 0</cross-session-message>')}`,
        );
        expect(cardLines(home, t)).toContain(
            'receipt wakes since the last siesta: 0',
        );
        appendFileSync(
            t,
            `\n${row(at(10), 'Another Claude session sent a message:\n<cross-session-message from="x" from-name="🎀 helga">[progress] receipt b3\n1 prompt-groom · exit 0</cross-session-message>')}`,
        );
        expect(cardLines(home, t)).toContain(
            'receipt wakes since the last siesta: 1',
        );
    });
});
