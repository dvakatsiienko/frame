import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';

import { bashCommands, commandHead, rawHeads } from './cli-census.ts';

const cover = {
    rawDoors: ['x linear api'],
    replaces: ['script/old-door.ts', 'old:door'],
};

function plantProjects(calls: { command: string; daysAgo: number }[]) {
    const projects = mkdtempSync(path.join(tmpdir(), 'cli-census-'));
    mkdirSync(path.join(projects, '-Users-dima-frame'));
    const lines = calls.map(({ command, daysAgo }) =>
        JSON.stringify({
            message: {
                content: [
                    { text: 'running', type: 'text' },
                    { input: { command }, name: 'Bash', type: 'tool_use' },
                ],
            },
            timestamp: new Date(
                Date.now() - daysAgo * 86_400_000,
            ).toISOString(),
            type: 'assistant',
        }),
    );
    lines.push(JSON.stringify({ message: { content: 'hi' }, type: 'user' }));
    writeFileSync(
        path.join(projects, '-Users-dima-frame', 's.jsonl'),
        lines.join('\n'),
    );
    return projects;
}

function times(count: number, command: string, daysAgo = 1) {
    return Array.from({ length: count }, () => ({ command, daysAgo }));
}

test('the census counts only the raw heads no verb covers', () => {
    const projects = plantProjects([
        ...times(6, 'gh pr view 12'),
        ...times(5, 'FOO=1 timeout 5 gh api repos/x/y'),
        ...times(5, "cd ~/frame && linear api '{ viewer { id } }'"),
        ...times(5, 'x lane commit msg.txt -- a.ts'),
        ...times(5, 'node ~/frame/script/old-door.ts FRM-1'),
        ...times(5, 'pnpm --silent old:door FRM-1'),
    ]);

    expect(rawHeads(bashCommands(projects, 14), cover)).toEqual([
        { head: 'gh pr', runs: 6 },
        { head: 'gh api', runs: 5 },
    ]);
});

test('the census drops a head under five runs', () => {
    const projects = plantProjects([
        ...times(5, 'gh pr view'),
        ...times(4, 'jq -r .a'),
    ]);

    expect(rawHeads(bashCommands(projects, 14), cover)).toEqual([
        { head: 'gh pr', runs: 5 },
    ]);
});

test('the census leaves shell basics out', () => {
    const projects = plantProjects([
        ...times(5, 'gh pr view'),
        ...times(9, 'grep -rn a .'),
    ]);

    expect(rawHeads(bashCommands(projects, 14), cover)).toEqual([
        { head: 'gh pr', runs: 5 },
    ]);
});

test('the census reads only the window', () => {
    const projects = plantProjects([
        ...times(5, 'gh pr view'),
        ...times(5, 'gh api', 20),
    ]);

    expect(bashCommands(projects, 14)).toHaveLength(5);
});

test.each([
    ['git status', 'git status'],
    ['git -C /tmp/repo log --oneline', 'git log'],
    ['cd ~/frame && pnpm test', 'pnpm test'],
    ['S=/private/tmp/x; cat "$S/a"', 'cat'],
    ['export A=1\nenv B=2 timeout 30 gh api x', 'gh api'],
    ['# note\nls -la', 'ls'],
    ['/Users/dima/frame/x/bin/x lane push', 'x lane'],
    ['node ~/frame/script/fixture-store.ts list', 'node fixture-store.ts'],
    ['node --no-warnings ./script/toolchain-sync.ts', 'node toolchain-sync.ts'],
    ['python3 -c "import json"', 'python3'],
    ['grep -rn "a && b" .', 'grep'],
    ['cd ~/frame', undefined],
    ['', undefined],
])('the head of %j is %j', (command, head) => {
    expect(commandHead(command)).toBe(head);
});
