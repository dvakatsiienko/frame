import { expect, test } from 'claude-code/testing';

import { doorOf, isFleetName, parseAsks, parseWait } from '../hooks/parse.ts';

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

const reply = (fence: string) =>
    `report\n\n⏳ waiting on your word:\n\n\`\`\`\n${fence}\n\`\`\`\n\n📄 last report: **x**, 18:30`;

test('a reply without a ⏳ block yields null', () => {
    expect(parseAsks('just a quick answer')).toBe(null);
});

test('reads the numbered asks and stops at the wispr adds', () => {
    expect(
        parseAsks(
            reply(
                'lane\n1. ship it ➡️ yes\n2. rename ➡️ no\n\nwispr adds\n1. pg → bg ✓',
            ),
        ),
    ).toEqual(['ship it ➡️ yes', 'rename ➡️ no']);
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
