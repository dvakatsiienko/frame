import { describe, expect, it } from 'vitest';

import { infobox, isPlainText, plainWiki, wikiTitle } from './web-read.ts';

describe('wikiTitle', () => {
    it('reads a MediaWiki article title from its url', () => {
        expect(
            wikiTitle(
                new URL('https://nomanssky.miraheze.org/wiki/Atlas_Pass_v1'),
            ),
        ).toBe('Atlas Pass v1');
    });

    it('decodes an escaped title', () => {
        expect(
            wikiTitle(new URL('https://nomanssky.miraheze.org/wiki/Vy%27keen')),
        ).toBe("Vy'keen");
    });

    it('leaves a non-wiki url without a title', () => {
        expect(
            wikiTitle(
                new URL(
                    'https://psnprofiles.com/guide/15503-no-mans-sky-trophy-guide',
                ),
            ),
        ).toBe(undefined);
    });
});

describe('isPlainText', () => {
    it('takes an llms.txt or a .md page as text', () => {
        expect(isPlainText(new URL('https://docs.n8n.io/llms.txt'))).toBe(true);
        expect(
            isPlainText(
                new URL('https://code.claude.com/docs/en/sub-agents.md'),
            ),
        ).toBe(true);
    });

    it('sends an html page elsewhere', () => {
        expect(
            isPlainText(
                new URL(
                    'https://www.powerpyx.com/no-mans-sky-trophy-guide-roadmap/',
                ),
            ),
        ).toBe(false);
    });
});

describe('infobox', () => {
    const pugneum = `{{Version|update = Interceptor}}
{{Resource infobox
| image = SUBSTANCE.ROBOT.1.png
| category = Special
| rarity = Rare
| used = [[Building]], [[Crafting|crafting]]
| value = 138.0
| release =
}}
'''Pugneum''' is a resource.`;

    it('reads the infobox-named template, not the first one', () => {
        expect(infobox(pugneum)).toEqual([
            ['image', 'SUBSTANCE.ROBOT.1.png'],
            ['category', 'Special'],
            ['rarity', 'Rare'],
            ['used', 'Building, crafting'],
            ['value', '138.0'],
        ]);
    });

    it('falls back to the first template with named params', () => {
        expect(infobox('{{Stub}}\n{{Ship card|class = S|slots = 48}}')).toEqual(
            [
                ['class', 'S'],
                ['slots', '48'],
            ],
        );
    });

    it('returns nothing for a page without templates', () => {
        expect(infobox("'''Corvette''' is a starship.")).toEqual([]);
    });
});

describe('plainWiki', () => {
    it('strips links, quotes, refs, comments and line breaks', () => {
        expect(
            plainWiki(
                "'''[[Hello Games]]'''<br />[[Sony|SIE]]<ref>x</ref><!-- note -->",
            ),
        ).toBe('Hello Games, SIE');
    });
});
