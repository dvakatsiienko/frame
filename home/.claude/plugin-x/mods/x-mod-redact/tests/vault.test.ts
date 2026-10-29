import { expect, test } from 'claude-code/testing';

import {
    type Vault,
    placeholderOf,
    redactText,
    restoreText,
} from '../hooks/mask.ts';
import { appendCaught, isTight, toolCaught } from '../hooks/register.ts';

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

test("a tool's own result keeps the placeholder, not the value", async ($, on) => {
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', () => ({
        result: { stdout: `x ${FAKE}` },
        text: `x ${FAKE}`,
    }));
    const r = await $.tool.call({ command: 'cat .env', tool: 'Bash' });
    expect(JSON.stringify(r)).not.toContain(FAKE);
});

test('a Write quoting a placeholder writes the placeholder', async ($, on) => {
    const written: unknown[] = [];
    on('ui.log', () => ({ value: undefined }));
    on('session.append', (_$, e, next) => next(e));
    on('tool.call', (_$, e) => {
        written.push('content' in e ? e.content : undefined);
        return { result: {}, text: 'ok' };
    });
    await $.session.append(prompt(`use ${FAKE}`)).catch(() => undefined);
    await $.tool.call({
        content: `key: ${placeholderOf(FAKE)}`,
        file_path: '/tmp/x',
        tool: 'Write',
    });
    expect(written).toEqual([`key: ${placeholderOf(FAKE)}`]);
});

test('a vault error masks the row one way and logs it', async ($, on) => {
    const stored: unknown[] = [];
    const logs: string[] = [];
    on('ui.log', (_$, e) => {
        logs.push(e.text);
        return { value: undefined };
    });
    // every write loses its version check, as under a storm of parallel rows
    on('state.get', () => ({ value: { value: undefined, version: 0 } }));
    on('state.set', () => ({ value: { isSet: false, version: 1 } }));
    on('session.append', (_$, e, next) => {
        stored.push(e.message.content);
        return next(e);
    });
    await $.session.append(prompt(`use ${FAKE}`)).catch(() => undefined);
    expect([JSON.stringify(stored).includes(FAKE), logs.length]).toEqual([
        false,
        1,
    ]);
});

for (const command of ['clear', 'resume'] as const)
    test(`after /${command} an old placeholder reaches the tool as written`, async ($, on) => {
        const ran: unknown[] = [];
        on('ui.log', () => ({ value: undefined }));
        on('session.append', (_$, e, next) => next(e));
        on('command.run', () => ({ text: '' }));
        on('tool.call', (_$, e) => {
            ran.push('command' in e ? e.command : undefined);
            return { result: {}, text: 'ok' };
        });
        await $.session.append(prompt(`use ${FAKE}`)).catch(() => undefined);
        await $.command.run({
            args: '',
            command,
            origin: { kind: 'composer' },
            presentation: { columns: 80, isFullscreen: false },
        });
        await $.tool.call({
            command: `echo ${placeholderOf(FAKE)}`,
            tool: 'Bash',
        });
        expect(ran).toEqual([`echo ${placeholderOf(FAKE)}`]);
    });

// the harness clones an event before any hook, so no row can make a hook throw: the catch handlers are called directly
const caught = <E, R>(answer: (e: E) => R, called: boolean) => {
    const seen: E[] = [];
    const next = Object.assign(
        (e: E) => {
            seen.push(e);
            return answer(e);
        },
        { called, error: { kind: 'throw' } },
    );
    return { next, seen };
};
const quiet$ = { ui: { log: () => undefined } } as never;

test('a row hook that failed before passing the row on sends it masked one way', () => {
    const { next, seen } = caught((e: unknown) => e, false);
    appendCaught(
        quiet$,
        { message: { content: [{ text: `use ${FAKE}`, type: 'text' }] } },
        next,
    );
    expect([seen.length, JSON.stringify(seen).includes(FAKE)]).toEqual([
        1,
        false,
    ]);
});

test('a tool hook that failed masks the replayed result one way', async () => {
    const { next } = caught(
        async () => ({ result: { stdout: `x ${FAKE}` }, text: `x ${FAKE}` }),
        true,
    );
    const r = await toolCaught(quiet$, { command: 'cat .env' }, next);
    expect(JSON.stringify(r)).not.toContain(FAKE);
});

test('a tool hook that failed before the tool ran runs it with its placeholders as written', async () => {
    const command = `echo ${placeholderOf(FAKE)}`;
    const { next, seen } = caught(
        async () => ({ result: {}, text: 'ok' }),
        false,
    );
    await toolCaught(quiet$, { command }, next);
    expect(seen).toEqual([{ command }]);
});

test('a tool hook that failed keeps a refusal as it was', async () => {
    const { next } = caught(async () => ({ deny: 'no' }), false);
    expect(await toolCaught(quiet$, { command: 'x' }, next)).toEqual({
        deny: 'no',
    });
});

test('a scan is tight under 300 ms plus a millisecond per 4,000 chars', () => {
    expect([
        isTight(299, 0),
        isTight(300, 0),
        isTight(1299, 4_000_000),
        isTight(1300, 4_000_000),
    ]).toEqual([true, false, true, false]);
});
