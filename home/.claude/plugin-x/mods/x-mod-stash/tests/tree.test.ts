import { expect, test } from 'claude-code/testing';

import { cleanTree, drawn } from '../hooks/tree.ts';

const text = (...children: unknown[]) => ({ children, type: 'Text' });
const box = (...children: unknown[]) => ({ children, type: 'Box' });
const marker = (words: string) => ({
    children: [words],
    props: { dimColor: true },
    type: 'Text',
});

test('a non-node child blanks to a marker and its siblings stay', () => {
    const out = cleanTree(box(text('a'), () => 1, text('b'), { oops: true }));
    expect(out).toEqual(
        box(
            text('a'),
            marker('⚠ a node could not draw'),
            text('b'),
            marker('⚠ a node could not draw'),
        ),
    );
});

test('text, numbers, nothing and nested lists are sound children', () => {
    const tree = box('x', 3, null, undefined, false, [text('y')]);
    expect(cleanTree(tree)).toEqual(tree);
});

test('control characters still leave every string', () => {
    expect(cleanTree(box(text('a\u0007b\tc')))).toEqual(box(text('ab c')));
});

test('a section that throws draws its marker box', () => {
    const bad = drawn('lane l1', () => {
        throw new Error('bad data');
    });
    expect(bad).toEqual({
        children: [marker('⚠ lane l1 could not draw')],
        props: { key: 'broken:lane l1' },
        type: 'Box',
    });
});

test('a section that builds is returned as built', () => {
    expect(drawn('orbit', () => text('fine'))).toEqual(text('fine'));
});
