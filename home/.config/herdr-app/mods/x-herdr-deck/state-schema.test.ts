/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { activityShown } from '../x-herdr-antenna/details.js';
import { activityIn, threadFacts } from './orbit.js';

// FRM-618 slice D exit 4: a file written by the schema alone, by no x-mod-stash, draws in antenna as the stash's would;
// the door for another harness (W27) and one source for every surface (W42)
const schema = JSON.parse(
    readFileSync(
        join(
            import.meta.dirname,
            '../../../../../herdr/contracts/herdr-state.schema.json',
        ),
        'utf8',
    ),
);
const now = 1_000_000;

/** a file holding the schema's required fields and nothing else */
function bySchema(state: string, since: number) {
    const file: Record<string, unknown> = {
        at: now,
        pid: 7,
        sid: 's7',
        since,
        state,
        wait: 'waiting on **🙋‍♂️ dima**',
    };
    expect(Object.keys(file).sort()).toEqual([...schema.required].sort());
    return file;
}

describe('a state file by the schema alone', () => {
    test('every state the schema names reads back', () => {
        for (const state of schema.properties.state.enum)
            expect(activityIn(bySchema(state, now - 1))?.state).toBe(state);
    });

    test('antenna draws it as it draws the stash’s: waiting 3m with its wait', () => {
        const activity = activityIn(bySchema('waiting', now - 3 * 60_000));
        const facts = threadFacts(
            [
                {
                    activity,
                    context: null,
                    hot: null,
                    model: null,
                    pid: 7,
                    sid: 's7',
                    status: 'idle',
                    wait: 'waiting on **🙋‍♂️ dima**',
                },
            ],
            null,
        )['7'];
        expect(
            activityShown(
                'idle',
                facts?.state && facts.since !== null
                    ? { since: facts.since, state: facts.state }
                    : null,
                now,
            ),
        ).toEqual({ dot: 'waiting', time: 'waiting 3m' });
    });

    test('a state the schema does not name reads as none', () => {
        expect(activityIn({ ...bySchema('idle', now), state: 'busy' })).toBe(
            null,
        );
    });
});

// x-mod-stash's herdr-state.test.ts runs on an overlay that cannot read this file, so it pins the same two lists: a
// change here reds this test until both sides move together
test('the schema requires the fields the writer test pins', () => {
    expect(schema.required).toEqual([
        'at',
        'pid',
        'sid',
        'since',
        'state',
        'wait',
    ]);
    expect(schema.properties.state.enum).toEqual([
        'working',
        'waiting',
        'idle',
    ]);
});
