import { spawnSync } from 'node:child_process';
import {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';

import { addReceipt, logReceipt } from './helga-receipt.ts';

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

test('a receipt lands as one line in clio’s receipts log', () => {
    const home = mkdtempSync(join(tmpdir(), 'receipt-'));
    const at = new Date('2026-11-03T15:40:00');
    logReceipt(home, ['prompt-groom', '1', '0', 'W1-W3'], at);
    logReceipt(home, ['pocket-write', '1', '0', 'PK-1'], at);
    const lines = readFileSync(
        join(home, '.local/state/clio/grooms/receipts.log'),
        'utf8',
    )
        .trim()
        .split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(`${at.toISOString()}\tprompt-groom\t1\t0\tW1-W3`);
});

test('the cli writes both logs, the trial file beside the script and clio’s under HOME', () => {
    const root = mkdtempSync(join(tmpdir(), 'receipt-cli-'));
    mkdirSync(join(root, '_clio/script'), { recursive: true });
    mkdirSync(join(root, 'docs/test-drive'), { recursive: true });
    copyFileSync(
        join(import.meta.dirname, 'helga-receipt.ts'),
        join(root, '_clio/script/helga-receipt.ts'),
    );
    writeFileSync(join(root, 'docs/test-drive/helga.md'), log);
    const out = spawnSync(
        'node',
        [
            join(root, '_clio/script/helga-receipt.ts'),
            'pocket-write',
            '1',
            '0',
            'PK-1',
        ],
        { encoding: 'utf8', env: { ...process.env, HOME: root } },
    );
    expect(out.status).toBe(0);
    expect(
        readFileSync(
            join(root, '.local/state/clio/grooms/receipts.log'),
            'utf8',
        ),
    ).toContain('\tpocket-write\t1\t0\tPK-1');
});

test('a multi-line note stays one row in both logs', () => {
    const root = mkdtempSync(join(tmpdir(), 'receipt-note-'));
    mkdirSync(join(root, '_clio/script'), { recursive: true });
    mkdirSync(join(root, 'docs/test-drive'), { recursive: true });
    copyFileSync(
        join(import.meta.dirname, 'helga-receipt.ts'),
        join(root, '_clio/script/helga-receipt.ts'),
    );
    writeFileSync(join(root, 'docs/test-drive/helga.md'), log);
    spawnSync(
        'node',
        [
            join(root, '_clio/script/helga-receipt.ts'),
            'groom',
            '1',
            '0',
            'retro:\n1. first\tslip\n2. second',
        ],
        { encoding: 'utf8', env: { ...process.env, HOME: root } },
    );
    expect(
        readFileSync(
            join(root, '.local/state/clio/grooms/receipts.log'),
            'utf8',
        ),
    ).toMatch(/^\S+\tgroom\t1\t0\tretro: 1\. first slip 2\. second\n$/);
    expect(
        readFileSync(join(root, 'docs/test-drive/helga.md'), 'utf8'),
    ).toContain(' · groom · 1 · 0 · retro: 1. first slip 2. second\n');
});
