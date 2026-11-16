import { describe, expect, test } from 'vitest';

import { splitBlocks } from './blocks.js';

describe('a reply cut into blocks', () => {
    test('a closed fence is a code block holding exactly its text, no trailing newline', () => {
        const blocks = splitBlocks(
            'run this:\n\n```bash\nls -la\npwd\n```\n\ndone',
        );
        expect(blocks[1]).toEqual({
            isClosed: true,
            kind: 'code',
            lang: 'bash',
            text: 'ls -la\npwd',
        });
    });

    test('a fence still streaming is open, so no copy button draws', () => {
        const blocks = splitBlocks('run this:\n\n```bash\nls -la');
        expect(blocks[1]).toMatchObject({ isClosed: false, kind: 'code' });
    });

    test.each([
        'this thread',
        'this session',
        'This Thread',
        'terminal',
        'herdr terminal',
        'next session',
        'codie',
        'clio',
        'wing 1',
        'this thread later',
    ])('a fence under a «copy → %s» ribbon stays a copy block', (to) => {
        const blocks = splitBlocks(
            `📋 **copy → ${to}** 📋\n\n\`\`\`\nx lane push\n\`\`\`\n\n✂️ **end** ✂️`,
        );
        expect(blocks).toEqual([
            { isClosed: true, kind: 'code', lang: '', text: 'x lane push' },
        ]);
    });

    test('a ribbon with prose before its fence leaves the fence a code block', () => {
        const blocks = splitBlocks(
            '📋 **copy → codie** 📋\n\nsome words\n\n```\nhi\n```',
        );
        expect(blocks.at(-1)).toMatchObject({ kind: 'code', text: 'hi' });
    });
});
