import { describe, expect, test } from 'vitest';

import { retiredHits } from './retired-names.ts';

const at = (text: string) => [{ line: 3, text }];

describe('retiredHits', () => {
    test.each([
        ['a bare retired name', 'ask ccrow first', 'ccrow'],
        ['a retired skill id', 'load `x:cclio-mode` now', 'cclio'],
        ['a retired plugin key', '"x-cw@x-com": true', 'x-cw'],
        ['the long form before its short twin', 'build mcp-x-cw', 'mcp-x-cw'],
        ['a retired app slug', 'x-coder-cc posts it', 'x-coder-cc'],
        ['the old sync tag', '<!-- sync: cw -->', 'sync: cw'],
        ['any casing', 'CCLIO said so', 'CCLIO'],
        [
            'a form glued to an underscore',
            'allow mcp__x-cw__handoff_save',
            'x-cw',
        ],
        ['an old tool name', 'call cclio_mode first', 'cclio'],
        ['the old helga skill id', 'load `x:crew-composer`', 'crew-composer'],
    ])('reds %s', (_, text, form) => {
        expect(
            retiredHits('docs/knowledge/x.md', at(text)).map((hit) => hit.form),
        ).toEqual([form]);
    });

    test.each([
        ['the new names', 'clio asks crow, codie builds, x-cloud-chat syncs'],
        [
            'a word that only contains a form',
            'the ccliotron and xx-cw2 are not names',
        ],
        ['a bare job word', 'a coder and a verifier and an EffectComposer'],
        [
            'a line marked read-both',
            "if (dir === 'cclio') // read-both: cwds before the rename",
        ],
        [
            'cc’s own project dir',
            'ls ~/.claude/projects/-Users-dima-frame-cclio',
        ],
    ])('passes %s', (_, text) => {
        expect(retiredHits('docs/knowledge/x.md', at(text))).toEqual([]);
    });

    test.each([
        '_clio/gazette/2026-10-07-the-pocket.md',
        'docs/research/old.md',
        'docs/test-drive/review-rounds.md',
        'apps/atelier/src/scene.ts',
        'script/lib/retired-names.ts',
    ])('passes history and its own files: %s', (path) => {
        expect(retiredHits(path, at('ccrow was here'))).toEqual([]);
    });

    test('passes a markdown line under a dated heading, reds one under a plain heading', () => {
        const file = [
            '## stress list',
            'ccrow line',
            '### round 1 · 2026-10-10 11:31',
            'ccrow note',
        ];
        const lines = [
            { line: 2, text: 'ccrow line' },
            { line: 4, text: 'ccrow note' },
        ];
        expect(
            retiredHits('docs/test-drive/crow.md', lines, file).map(
                (hit) => hit.line,
            ),
        ).toEqual([2]);
    });

    test('passes a «quote» and a > quote line, reds the text around them', () => {
        const lines = [
            { line: 1, text: '> we underutilize ccrow' },
            { line: 2, text: 'he said «ask ccrow» to cclio' },
        ];
        expect(
            retiredHits('docs/knowledge/x.md', lines).map((hit) => hit.form),
        ).toEqual(['cclio']);
    });

    test('reds a test-drive card the sweep kept live', () => {
        expect(
            retiredHits('docs/test-drive/crow.md', at('ccrow wakes')),
        ).toHaveLength(1);
    });
});
