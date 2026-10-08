import { expect, test } from 'claude-code/testing';

import { bulletDots } from '../hooks/parse.ts';

test('a labelled ·-list becomes the label and one bullet per item', () => {
    expect(bulletDots('the crew: 🐜 chores · 🐝 researcher · 🦡 retro')).toBe(
        'the crew:\n- 🐜 chores\n- 🐝 researcher\n- 🦡 retro',
    );
});

test('a bare ·-list becomes one bullet per item', () => {
    expect(bulletDots('done.\n5h 24 % · resets 15:59\n')).toBe(
        'done.\n- 5h 24 %\n- resets 15:59\n',
    );
});

test('a ·-list inside a bullet nests under it', () => {
    expect(bulletDots('- **fixed**: a · b')).toBe('- **fixed**:\n  - a\n  - b');
});

test('a fence, inline code and the 📄 line keep their ·', () => {
    const text = [
        '```\n1. a · b ➡️ yes\n```',
        'the hook printed `a · b` as asked.',
        '📄 last report: **mods** · 15:09',
    ].join('\n');
    expect(bulletDots(text)).toBe(text);
});
