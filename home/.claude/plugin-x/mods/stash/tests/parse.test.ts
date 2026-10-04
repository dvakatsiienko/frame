import { expect, test } from 'claude-code/testing';

import { parseAsks } from '../hooks/parse.ts';

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
