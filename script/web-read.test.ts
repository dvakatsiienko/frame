import { describe, expect, it } from 'vitest';

import { isPlainText, wikiTitle } from './web-read.ts';

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
