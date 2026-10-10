import { expect, test } from 'claude-code/testing';

import {
    backgroundWait,
    doorOf,
    isFleetName,
    parseWait,
} from '../hooks/parse.ts';

test('a reply without a 🔭 line waits on nothing', () => {
    expect(parseWait('done.\n\n➡️ next')).toBe(undefined);
});

test('several 🔭 lines read as one wait', () => {
    expect(
        parseWait(
            'x\n🔭 [🔎 ci](https://a) — the watcher\n🔭 **🦉 cclio** — a ping',
        ),
    ).toBe('🔎 ci — the watcher; 🦉 cclio — a ping');
});

test('a 🔭 line quoted before the end is not a wait', () => {
    expect(
        parseWait('the shape:\n```\n🔭 waiting on ci — a ping\n```\ndone.'),
    ).toBe(undefined);
});

test('a host id the desktop would refuse opens nothing', () => {
    expect(doorOf({ bg: false, hostSessionId: 'local_x&evil=1' })).toBe(
        undefined,
    );
});

for (const [name, fits] of [
    ['☕️ 🔧 FRM-303 code: stash keep-hot', true],
    ['🎯 🔎 BYT-12 verify: atelier', true],
    ['🔎 verify: FRM-268', false],
    ['reply message handler', false],
    ['🐦 ⬛ ccrow', true],
    ['ccrow probe', false],
    ['wisp', false],
] as const)
    test(`the fleet name check ${fits ? 'passes' : 'flags'} «${name}»`, () => {
        expect(isFleetName(name)).toBe(fits);
    });

test('no background work waits on nothing', () => {
    expect(backgroundWait([])).toBe(undefined);
});

test('one background task reads as waiting on it, three words at most', () => {
    expect(
        backgroundWait([{ description: 'critic reads the plan file' }]),
    ).toBe('waiting on critic reads the');
});

test('more background tasks add a count', () => {
    expect(
        backgroundWait([
            { description: 'critic', name: undefined },
            { description: 'tests' },
            { description: 'build' },
        ]),
    ).toBe('waiting on critic +2');
});
