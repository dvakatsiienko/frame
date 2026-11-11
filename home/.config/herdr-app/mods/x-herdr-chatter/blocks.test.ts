import { describe, expect, test } from 'vitest';

import { splitBlocks, withPrompt } from './blocks.js';

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

    test.each(['this thread', 'this session', 'This Thread'])(
        'a fence under a «copy → %s» ribbon is a prompt card for the box he reads',
        (to) => {
            const blocks = splitBlocks(
                `next:\n\n📋 **copy → ${to}** 📋\n\n\`\`\`\nhi\n\`\`\`\n\n✂️ **end** ✂️`,
            );
            expect(blocks).toEqual([
                { kind: 'text', text: 'next:' },
                { kind: 'prompt', text: 'hi', to },
            ]);
        },
    );

    test.each([
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

describe('a prompt card fills his box', () => {
    test('what he typed stays, a blank line, then the prompt', () => {
        expect(withPrompt('hello', 'ingest herdr-lane-7')).toBe(
            'hello\n\ningest herdr-lane-7',
        );
    });

    test('an empty box takes the prompt alone', () => {
        expect(withPrompt('  ', 'go')).toBe('go');
    });
});
