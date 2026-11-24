import { describe, expect, test } from 'vitest';

import { CREW_DNA, contractRefusals, isContractFile } from './crew-contract.ts';

const TAGS = ['ask', 'done', 'escalate'];
const SKILL = 'home/.claude/plugin-x/skills/crew-codie/SKILL.md';
const read = (line: string, path = SKILL) =>
    contractRefusals(path, `# a skill\n\n${line}\n`, TAGS).map(
        ({ line: n, reason }) => [n, reason],
    );
const RECEIPT = 'it asks for a receipt or a status line';
const STEP = 'it asks for a per-step line';

describe('a planted line is red, naming its line', () => {
    test.each([
        ['send me a receipt when you are done', RECEIPT],
        ['- send clio a one-line receipt per batch', RECEIPT],
        ['ping the coordinator with a status line', RECEIPT],
        ['Send progress to clio', RECEIPT],
        ['reply with an ack', RECEIPT],
        ['message clio «sw done» after a wind', RECEIPT],
        ['ping clio after each step', STEP],
        ['one line per step, sent as a message to clio', STEP],
        ['at every commit send the sha to clio', STEP],
        ['after each step, you send clio a line', STEP],
        ['a helga brief asks: reply with a receipt', RECEIPT],
        ['open it with `[progress]`', '[progress] is no tag of the contract'],
        ['a landed step is [progress]', '[progress] is no tag of the contract'],
        ['send `[blocked]` when stuck', '[blocked] is no tag of the contract'],
        ['send clio [final] then', '[final] is no tag of the contract'],
        ['send `[🪜 climb] x`', '[climb] is no tag of the contract'],
        ['it goes to clio as [blocked]', '[blocked] is no tag of the contract'],
        ['a message leads with [final]', '[final] is no tag of the contract'],
        ['a non-blocking brief: send me a receipt', RECEIPT],
        ['fix the blocking bug, then send clio progress', RECEIPT],
        ['report back after each step', STEP],
    ])('%s', (line, reason) => {
        expect(read(line)).toEqual([[3, reason]]);
    });
});

describe('what the skills say today is green', () => {
    test.each([
        'what goes to clio: `x:crew-dna`, no line per step',
        'never sent: an ack, «resumed», «sw done», a tick count',
        'never send a receipt',
        "don't ping clio after each step",
        'a batch sends no message; the receipt is a log line',
        'every commit message names the ticket',
        'the report lists every commit',
        'the answer to each step is in the plan',
        'the final report carries its receipts',
        'reply in the thread with the receipt attached',
        'a pr title opens with [wip]',
        'send a [link][ref]',
        'send his question on while the work is in progress',
        'a route dir is `[slug]/page.tsx`, a table `[profile]`',
        'send only `[ask]`, `[done]` or `[escalate]`, `[🪜 escalate]` too',
        '- [ ] 03 · a step',
        'tick `[x]` at each commit',
        'see [the table](quiet.ts) and **[bench]**',
        '`/fork [prompt]` copies the conversation',
        'clio’s replies, each block headed, then `## receipts`',
    ])('%s', (line) => {
        expect(read(line)).toEqual([]);
    });
});

const dna = (tags: string) =>
    contractRefusals(
        CREW_DNA,
        `# dna\n\n**messages to clio**, the home\n- send ${tags}\n\n**heavy runs**\n- \`[escalate]\` elsewhere\n`,
        TAGS,
    ).map(({ line, reason }) => [line, reason]);

test('crew-dna’s section holds every pushing tag', () => {
    expect(dna('`[ask]`, `[done]`, `[escalate]`')).toEqual([]);
});

test('crew-dna’s section without a pushing tag is red', () => {
    expect(dna('`[ask]`, `[done]`')).toEqual([
        [3, 'the section names no [escalate], a pushing tag'],
    ]);
});

test('crew-dna’s section naming a tag the table lacks is red', () => {
    expect(dna('`[ask]`, `[done]`, `[escalate]`, [wish]')).toEqual([
        [3, 'the section names [wish], no tag of the contract'],
    ]);
});

test('crew-dna with no section is red', () => {
    expect(contractRefusals(CREW_DNA, '# dna\n', TAGS)[0]?.reason).toBe(
        'it has no «messages to clio» section',
    );
});

test.each([
    [SKILL, true],
    ['home/.claude/plugin-x/skills/crew-cloud/references/brief.md', true],
    ['home/.claude/rules/fleet-flow.md', true],
    ['home/.claude/rules-lazy/linear-flow.md', true],
    ['home/.claude/plugin-x/skills/crew-helga/scripts/a.ts', false],
    ['home/.claude/plugin-x/skills/crew-adviser/scripts/fixtures/a.md', false],
    ['home/.claude/plugin-x/skills/cmt/SKILL.md', false],
])('%s is read: %s', (path, is) => {
    expect(isContractFile(path)).toBe(is);
});
