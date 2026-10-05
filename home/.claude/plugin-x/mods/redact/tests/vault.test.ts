import { expect, test } from 'claude-code/testing';

import {
    type Vault,
    placeholderOf,
    redactText,
    restoreText,
} from '../hooks/mask.ts';

// planted fakes built at run time, so no source line reads as a secret to a live redactor
const FAKE = ['sk-ant-api03-', 'FAKE'.repeat(6)].join('');
const OTHER = ['ghp_', 'OTHER'.repeat(7)].join('');

test('one value reads as one placeholder', () => {
    const vault: Vault = {};
    const once = redactText(`a ${FAKE}`, vault);
    const twice = redactText(`b ${FAKE}`, vault);
    expect([once, twice, Object.keys(vault).length]).toEqual([
        `a ${placeholderOf(FAKE)}`,
        `b ${placeholderOf(FAKE)}`,
        1,
    ]);
});

test('a placeholder carries no glob characters', () => {
    expect(placeholderOf(FAKE)).not.toMatch(/[[\]*?{}]/);
});

test('a placeholder taken by another value masks one way', () => {
    const vault: Vault = { [placeholderOf(FAKE)]: OTHER };
    expect(redactText(FAKE, vault)).toBe(`${FAKE.slice(0, 6)}…‹redacted›`);
});

test('a placeholder the vault holds is restored', () => {
    const vault: Vault = {};
    const command = redactText(`echo ${FAKE}`, vault);
    expect(restoreText(command, vault)).toBe(`echo ${FAKE}`);
});

test('a placeholder the vault lacks stays as written', () => {
    const tag = placeholderOf(FAKE);
    expect(restoreText(`echo ${tag}`, {})).toBe(`echo ${tag}`);
});

test('a 1password reference stays readable', () => {
    const text = 'OPENAI_API_KEY=op://dev/openai-golden/credential';
    expect(redactText(text, {})).toBe(text);
});

// a prompt row carrying the fake, as the engine keeps it
const prompt = (text: string) => ({
    door: 'prompt' as const,
    message: {
        content: [{ text, type: 'text' as const }],
        role: 'user' as const,
        type: 'user' as const,
    },
    origin: { kind: 'composer' as const },
    uuid: 'u1',
});

test('a pasted key reaches the transcript as its placeholder', async ($, on) => {
    const stored: unknown[] = [];
    on('ui.log', () => ({ value: undefined }));
    on('session.append', (_$, e, next) => {
        stored.push(e.message.content);
        return next(e);
    });
    await $.session.append(prompt(`use ${FAKE}`)).catch(() => undefined);
    expect(stored).toEqual([
        [{ text: `use ${placeholderOf(FAKE)}`, type: 'text' }],
    ]);
});

test('a tool call naming the placeholder runs with the real value', async ($, on) => {
    const ran: unknown[] = [];
    on('ui.log', () => ({ value: undefined }));
    on('session.append', (_$, e, next) => next(e));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? e.command : undefined);
        return { result: {}, text: 'ok' };
    });
    await $.session.append(prompt(`use ${FAKE}`)).catch(() => undefined);
    await $.tool.call({ command: `echo ${placeholderOf(FAKE)}`, tool: 'Bash' });
    expect(ran).toEqual([`echo ${FAKE}`]);
});
