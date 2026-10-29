import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { answerPrompts } from './said.ts';
import { liveStore } from './store.ts';

// a coder's job of 3+ numbered items goes through a spec (clio:shape-lane-dispatch § 2), refused unsent since FRM-425's verifier clean

const CODER = '☕️ 🔧 coder: mods';
const NOTE = 'a lane job goes through a spec (clio:shape-lane-dispatch § 2)';
const JOB = 'round 5:\n1. the meter\n2. the card\n3. the glide step';

function world(on: On) {
    mock.clock(on, { now: 1_000_000 });
    const store = liveStore(on);
    const sent: string[] = [];
    answerPrompts(on);
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('fs.exists', () => ({ value: false }));
    on('env.get', () => ({ value: '/home' }));
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', (_$, e) => {
        sent.push(String((e as { message?: unknown }).message));
        return { result: {}, text: 'sent' };
    });
    return { sent, store };
}

const send = ($: Engine, message: string, to = CODER) =>
    $.tool.call({ message, to, tool: 'SendMessage' } as never);

const warned = (r: { context?: readonly string[]; deny?: string }) =>
    [r.deny ?? '', ...(r.context ?? [])].some((c) => c.includes(NOTE));

test('a 3-item job to a coder is refused unsent', async ($, on) => {
    const w = world(on);
    const r = await send($, JOB);
    expect([w.sent, warned(r)]).toEqual([[], true]);
});

test('a one-line message to a coder is sent unwarned', async ($, on) => {
    world(on);
    expect(warned(await send($, 'round 5:\n1. fix the meter'))).toBe(false);
});

test('items numbered «1)» count as a list', async ($, on) => {
    world(on);
    expect(
        warned(await send($, '1) the meter\n2) the card\n3) the step')),
    ).toBe(true);
});

test('a numbered list inside a «>» quote is not a job', async ($, on) => {
    world(on);
    const quoted = 'dima wrote:\n> 1. the meter\n> 2. the card\n> 3. the step';
    expect(warned(await send($, quoted))).toBe(false);
});

test('a numbered list inside a code fence is not a job', async ($, on) => {
    world(on);
    const fenced = 'the output:\n```\n1. a\n2. b\n3. c\n```';
    expect(warned(await send($, fenced))).toBe(false);
});

test('a 3-item job naming its spec path is sent unwarned', async ($, on) => {
    world(on);
    const r = await send($, `${JOB}\nspec: ~/frame/.scratch/mods-l13/spec.md`);
    expect(warned(r)).toBe(false);
});

test('a 3-item message to a session that is not a coder is sent unwarned', async ($, on) => {
    world(on);
    expect(warned(await send($, JOB, '🦉 clio'))).toBe(false);
});

test('the refusal is kept as a guard event', async ($, on) => {
    const { store } = world(on);
    await send($, JOB);
    expect(
        [...store.entries()]
            .filter(([k]) => k.startsWith('event:'))
            .map(([, v]) => (v as { kind: string; rule: string }).rule),
    ).toEqual(['spec']);
});

test('«enforce» in the store refuses the job unsent', async ($, on) => {
    const w = world(on);
    w.store.set('rule-mode:spec', 'enforce');
    const r = await send($, JOB);
    expect([w.sent, r.deny]).toEqual([[], expect.stringContaining(NOTE)]);
});
