import { expect, test } from 'claude-code/testing';

import { dropWaitAside, linkTickets, numberCircled } from '../hooks/parse.ts';

const L = (id: string) => `[${id}](https://linear.app/x-com/issue/${id})`;

for (const [why, from, to] of [
    [
        'a run of circled digits',
        'next: ① build ② test ③ ship',
        'next:\n1. build\n2. test\n3. ship',
    ],
    ['a run that opens the line', '① a ② b', '1. a\n2. b'],
    ['a bullet keeps its indent', '  ① a ② b', '  1. a\n  2. b'],
    ['a run past ⑨', '⑨ a ⑩ b', '9. a\n10. b'],
] as const)
    test(`numberCircled: ${why} becomes numbered lines`, () => {
        expect(numberCircled(from)).toBe(to);
    });

for (const [why, text] of [
    ['a lone circled digit', 'step ② is the slow one'],
    ['a fence', '```\n① a ② b\n```'],
    ['inline code', 'the glyphs `① ②` are banned'],
    ['the 📄 stamp', '📄 last report: ① a ② b'],
] as const)
    test(`numberCircled: ${why} stays as written`, () => {
        expect(numberCircled(text)).toBe(text);
    });

for (const [why, from, to] of [
    ['a bare FRM id', 'see FRM-385 for it', `see ${L('FRM-385')} for it`],
    [
        'a bare BYT id and an FRM one',
        'BYT-12, FRM-3.',
        `${L('BYT-12')}, ${L('FRM-3')}.`,
    ],
] as const)
    test(`linkTickets: ${why} becomes its link`, () => {
        expect(linkTickets(from)).toBe(to);
    });

for (const [why, text] of [
    [
        'an id already linked',
        `[FRM-385](https://linear.app/x-com/issue/FRM-385): glide`,
    ],
    ['an id in a url', 'https://linear.app/x-com/issue/FRM-385'],
    ['an id in a url query', 'https://x.dev/search?q=FRM-385'],
    ['an id in inline code', 'the line `- ticket: FRM-385`'],
    ['an id in a fence', '```\n- ticket: FRM-385\n```'],
    ['an id inside a longer word', 'XFRM-385 and FRM-385a'],
    ['an id in a path', 'docs/FRM-385.md'],
] as const)
    test(`linkTickets: ${why} stays as written`, () => {
        expect(linkTickets(text)).toBe(text);
    });

for (const [why, from, to] of [
    ['an aside', '🔭 waiting on ci (a ping when it lands)', '🔭 waiting on ci'],
    [
        'an aside in a bullet',
        '- 🔭 waiting on **clio** (her halt)',
        '- 🔭 waiting on **clio**',
    ],
    [
        'an aside beside a link',
        '🔭 waiting on [🐙 pr](https://x.dev/pr/1) (review)',
        '🔭 waiting on [🐙 pr](https://x.dev/pr/1)',
    ],
] as const)
    test(`dropWaitAside: ${why} leaves the 🔭 line`, () => {
        expect(dropWaitAside(from)).toBe(to);
    });

for (const [why, text] of [
    ['a link url', '🔭 waiting on [ci](https://x.dev/runs/(1))'],
    ['a paren on a line that is no 🔭 line', 'done (mostly)'],
    ['a 🔭 in a fence', '```\n🔭 waiting on ci (aside)\n```'],
] as const)
    test(`dropWaitAside: ${why} stays as written`, () => {
        expect(dropWaitAside(text)).toBe(text);
    });
