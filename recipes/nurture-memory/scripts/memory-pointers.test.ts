import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { deadPointers } from './memory-pointers.ts';

const root = path.resolve(import.meta.dirname, '../../..');
const at = (text: string, file = 'cclio/memory/craft-pm.md') => [
    { file, line: 1, text },
];

describe('deadPointers', () => {
    it('passes a section pointer that lands on a real heading', () => {
        expect(
            deadPointers(
                root,
                at('see `habit-shared-files` § the pocket for the rule'),
            ),
        ).toEqual([]);
    });

    it('reds a section pointer to a heading the file does not have', () => {
        expect(
            deadPointers(
                root,
                at('see `habit-shared-files` § the vanished part, then go'),
            ),
        ).toMatchObject([
            {
                target: 'habit-shared-files § the vanished part',
                why: 'no such section',
            },
        ]);
    });

    it('reds a one-word section no heading carries', () => {
        expect(
            deadPointers(root, at('the words: `fleet-vibe` § zeppelins')),
        ).toMatchObject([{ why: 'no such section' }]);
    });

    it('reds a section pointer whose file does not exist', () => {
        expect(
            deadPointers(root, at('see `no-such-leaf` § anything here')),
        ).toMatchObject([{ why: 'no file by that name' }]);
    });

    it('resolves a references path against the skill the line names', () => {
        expect(
            deadPointers(
                root,
                at("`cclio:pm`'s `references/body.md` holds it"),
            ),
        ).toEqual([]);
    });

    it('reds a references path no named skill holds', () => {
        expect(
            deadPointers(root, at('`cclio:pm` keeps `references/no-such.md`')),
        ).toMatchObject([{ why: 'no such path' }]);
    });
});
