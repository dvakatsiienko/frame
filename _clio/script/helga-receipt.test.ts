import { expect, test } from 'vitest';

import { addReceipt } from './helga-receipt.ts';

const log = '## receipt log\n\n- old line\n\n## rounds\n\n- round 1\n';

test('adds the line under the last receipt, above the rounds', () => {
    expect(
        addReceipt(log, ['bulk-replace', 'green', 'none', 'b12'], '2026-10-14'),
    ).toBe(
        '## receipt log\n\n- old line\n- 2026-10-14 · bulk-replace · green · none · b12\n\n## rounds\n\n- round 1\n',
    );
});

test('refuses a file with no rounds heading', () => {
    expect(() => addReceipt('- old line\n', ['a', 'b', 'c', 'd'], 'x')).toThrow(
        'no «## rounds» heading',
    );
});
