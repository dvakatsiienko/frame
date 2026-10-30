import { expect, test } from 'claude-code/testing';

import {
    backgroundWait,
    isFleetName,
    parseWait,
    waitSpans,
} from '../hooks/parse.ts';

test('a reply without a 🔭 line waits on nothing', () => {
    expect(parseWait('done.\n\n➡️ next')).toBe(undefined);
});

test('several 🔭 lines read as one wait', () => {
    expect(
        parseWait(
            'x\n🔭 [🔎 ci](https://a) — the watcher\n🔭 **🦉 clio** — a ping',
        ),
    ).toBe('🔎 ci — the watcher; **🦉 clio** — a ping');
});

test('a 🔭 line quoted before the end is not a wait', () => {
    expect(
        parseWait('the shape:\n```\n🔭 waiting on ci — a ping\n```\ndone.'),
    ).toBe(undefined);
});

for (const [name, fits] of [
    ['☕️ 🔧 FRM-303 code: stash keep-hot', true],
    ['🎯 🔎 BYT-12 verify: atelier', true],
    ['⚡ 🔧 codie: mods lane 3 | FRM-467', true],
    ['⚡ 🔎 sixth sense: mods lane 3 | main', true],
    ['🌗 🔧 codie: cli lane | FRM-383', true],
    ['⚡ 🔧 mods lane 3 codie: FRM-431', true],
    ['⚡️ 🔎 mods lane 3 sixth sense: main', true],
    ['🌗 🔧 cli lane codie: FRM-383', true],
    ['🌘 🔧 sys codie: wisps', true],
    ['🌗 🎨 designer: atelier', true],
    ['⚡ lane notes', false],
    ['🔎 sixth sense: FRM-268', false],
    ['reply message handler', false],
    ['🐦 ⬛ crow', true],
    ['crow probe', false],
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

test('a fleet subagent reads as its badge and type, never its description', () => {
    expect(
        backgroundWait([
            {
                agent_type: 'wishkeeper',
                description: 'wishkeeper siesta on batch 3',
            },
        ]),
    ).toBe('waiting on 🐬 wishkeeper');
});

test('a scout reads as 🦅 scout', () => {
    expect(
        backgroundWait([
            { agent_type: 'scout', description: 'find the band code' },
        ]),
    ).toBe('waiting on 🦅 scout');
});

test('a subagent type with no badge keeps the three-word description', () => {
    expect(
        backgroundWait([
            { agent_type: 'general-purpose', description: 'scan the logs now' },
        ]),
    ).toBe('waiting on scan the logs');
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

// FRM-426 (PK-160, PK-164): one «waiting on», holders split by commas, the names a reply marked kept bold
const HOLDERS = 'waiting on **🐬 wishkeeper**, **🐝 researcher**, **🙋‍♂️ dima**';

test('one 🔭 line of bold holders reads as it was written', () => {
    expect(parseWait(`done.\n\n🔭 ${HOLDERS}`)).toBe(HOLDERS);
});

test('the same holders on separate waiting-on lines merge into one, comma-joined', () => {
    expect(
        parseWait(
            'done.\n🔭 waiting on **🐬 wishkeeper**\n🔭 waiting on **🐝 researcher**\n🔭 waiting on **🙋‍♂️ dima**',
        ),
    ).toBe(HOLDERS);
});

test('a waiting-on line with a how tail stays its own part', () => {
    expect(
        parseWait(
            'x\n🔭 waiting on **ci** — the watcher\n🔭 waiting on **dima**',
        ),
    ).toBe('waiting on **ci** — the watcher; waiting on **dima**');
});

test('an unpaired bold mark is dropped, never shown as asterisks', () => {
    expect(parseWait('x\n🔭 waiting on **ci')).toBe('waiting on ci');
});

test('the marked names are the bold spans, the head and the commas plain', () => {
    expect(waitSpans(HOLDERS)).toEqual([
        { isBold: false, text: 'waiting on ' },
        { isBold: true, text: '🐬 wishkeeper' },
        { isBold: false, text: ', ' },
        { isBold: true, text: '🐝 researcher' },
        { isBold: false, text: ', ' },
        { isBold: true, text: '🙋‍♂️ dima' },
    ]);
});

test('an unmarked waiting-on keeps its whole <who> bold, as a background task reads', () => {
    expect(waitSpans('waiting on 🦅 scout +1')).toEqual([
        { isBold: false, text: 'waiting on ' },
        { isBold: true, text: '🦅 scout +1' },
    ]);
});
