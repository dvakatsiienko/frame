import { statSync } from 'node:fs';
import { expect, test } from 'vitest';

test('model-cards stays a card file, not an evidence dump', () => {
    const file = new URL(
        '../../home/.claude/plugin-x/skills/crew-lead/references/model-cards.md',
        import.meta.url,
    );
    expect(statSync(file).size).toBeLessThanOrEqual(8000);
});
