import { describe, expect, test } from 'vitest';

import { checkPocket } from './pocket-check.ts';

const config = [
    'statuses: ["open", "claimed", "waiting", "done"]',
    'labels: ["xs", "s", "m", "l"]',
    'priorities: ["now", "next", "later"]',
    'types: ["task", "idea"]',
].join('\n');

const redsOf = (line: string) =>
    checkPocket(
        config,
        [
            {
                name: 'pk-1 - flyway-wing-1.md',
                text: `---\nid: PK-1\ntitle: 'flyway: wing 1'\nstatus: open\nlabels:\n  - m\n  - clio-wing-1\npriority: now\nordinal: 1001\ntype: task\nupdated_date: '2026-10-09 10:00'\n---\n\n- [ ] #1 ${line}\n`,
            },
        ],
        '2026-10-09',
        '',
    ).join('\n');

describe('a parked tail', () => {
    test('with no parked day is red', () => {
        expect(redsOf('fix a')).toContain('no parked day');
    });
    test('parked before today is red, parked today is not', () => {
        expect(redsOf('fix a — parked: 2026-10-08')).toContain(
            'a tail parked since 2026-10-08',
        );
        expect(redsOf('fix a — parked: 2026-10-09')).not.toContain('tail');
    });
    test('a line marked as his is no tail', () => {
        expect(redsOf('the grill — with: dima')).not.toContain('tail');
    });
});
