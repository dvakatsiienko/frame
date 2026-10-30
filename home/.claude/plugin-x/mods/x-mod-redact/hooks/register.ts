import type { Caught, EngineInterface, Register } from 'claude-code';

import {
    type Vault,
    mapStrings,
    maskText,
    redactText,
    restoreText,
} from './mask.ts';

// the vault survives a hot reload and dies with the session; never `$.store`, which every session shares
const VAULT = { key: 'vault', plugin: 'x-mod-redact' } as const;

const errorText = (err: unknown) =>
    err instanceof Error ? err.message : String(err);

// a secret swapped for its placeholder in a row; new placeholders join the vault, retried when a parallel row wrote first
async function redactRow<T>($: EngineInterface, content: T) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const read = await $.state.get(VAULT);
        const vault: Vault = { ...read.value };
        const before = Object.keys(vault).length;
        const next = mapStrings(content, (text) => redactText(text, vault));
        if (Object.keys(vault).length === before) return next;
        const r = await $.state.set(VAULT, vault, { ifVersion: read.version });
        if (r.isSet) return next;
    }
    throw new Error('the vault kept changing under three writes');
}

// a scan that may not finish inside the hook's budget: 300 ms of slack, and about 4,000 chars a millisecond
export const isTight = (remainingMs: number, chars: number) =>
    remainingMs < 300 + chars / 4000;

const charsOf = (value: unknown) =>
    typeof value === 'string'
        ? value.length
        : (JSON.stringify(value)?.length ?? 0);

// a vault error never lets a secret through: the value is masked one way instead, with a line in the log; with the budget
// too tight for the vault's reads and writes, it goes straight to the one-way mask
async function redactOrMask<T>(
    $: EngineInterface,
    value: T,
    remainingMs: number,
) {
    if (isTight(remainingMs, charsOf(value)))
        return mapStrings(value, maskText);
    try {
        return await redactRow($, value);
    } catch (err) {
        $.ui.log(`x-mod-redact: ${errorText(err)}; masked one way instead`);
        return mapStrings(value, maskText);
    }
}

// fail closed: a hook that throws or overruns is run again as its `.catch`, which never passes a row raw
type Handler<E, R> = ((e: E) => R) & Caught;

// the row hook failed: the row goes on masked one way (a row it already passed on replays, the engine ignoring the argument)
export function appendCaught<E extends { message: { content: unknown } }, R>(
    $: EngineInterface,
    e: E,
    next: Handler<E, R>,
) {
    $.ui.log(
        `x-mod-redact: the row hook failed (${next.error.kind}); masked one way`,
    );
    return next({
        ...e,
        message: {
            ...e.message,
            content: mapStrings(e.message.content, maskText),
        },
    });
}

// the tool hook failed: a tool that ran replays its result, one that had not runs with its placeholders as written; the
// result is masked one way either way
export async function toolCaught<
    E,
    R extends { deny?: unknown; result?: unknown; text?: unknown },
>($: EngineInterface, e: E, next: Handler<E, Promise<R>>) {
    $.ui.log(
        `x-mod-redact: the tool hook failed (${next.error.kind}); its result masked one way`,
    );
    const r = await next(e);
    if (r.deny !== undefined) return r;
    return {
        ...r,
        result: mapStrings(r.result, maskText),
        ...(r.text === undefined ? {} : { text: mapStrings(r.text, maskText) }),
    };
}

// x-mod-redact: every row a session keeps, and every tool result, reads secrets as placeholders before it is stored and sent;
// a Bash command gets the secrets back. Only Bash: a Write or an Edit quoting a placeholder would put the live key into a file.
export const register: Register = (on) => {
    // fail closed: a hook that throws or overruns is run again as its `.catch`, which masks the row one way, never passes it raw
    on('session.append', async ($, e, next) => {
        const content = await redactOrMask(
            $,
            e.message.content,
            next.budget.remainingMs,
        );
        if (content === e.message.content) return next(e);
        return next({ ...e, message: { ...e.message, content } });
    }).catch(appendCaught);

    // a prompt is masked as it is submitted, before the engine queues it: a prompt typed mid-turn is stored raw in its
    // queue-operation and queued_command records, which session.append never sees (todo 24, probed 10-13 18:35)
    on('prompt.submit', async ($, e, next) => {
        const text = await redactOrMask($, e.text, next.budget.remainingMs);
        return text === e.text ? next(e) : next({ ...e, text });
    }).catch(($, e, next) => {
        $.ui.log('x-mod-redact: the prompt hook failed; masked one way');
        return next({ ...e, text: maskText(e.text) });
    });

    // `/clear` and `/resume` leave the conversation: its placeholders stop meaning anything at once
    on('command.run', async ($, e, next) => {
        const r = await next(e);
        if (e.command === 'clear' || e.command === 'resume')
            await $.state
                .set(VAULT, {})
                .catch(() =>
                    $.ui.log(`x-mod-redact: the vault outlived /${e.command}`),
                );
        return r;
    });

    on('tool.call', async ($, e, next) => {
        let input = e;
        if (e.tool === 'Bash') {
            const { value: vault } = await $.state
                .get(VAULT)
                .catch(() => ({ value: undefined }));
            if (vault)
                input = mapStrings(e, (text) => restoreText(text, vault));
        }
        const r = await next(input);
        if (r.deny !== undefined) return r;
        // the engine keeps the tool's own result beside the row (`toolUseResult`), which `session.append` never sees
        const result = await redactOrMask($, r.result, next.budget.remainingMs);
        const text =
            r.text === undefined
                ? undefined
                : await redactOrMask($, r.text, next.budget.remainingMs);
        if (result === r.result && text === r.text) return r;
        return { ...r, result, ...(text === undefined ? {} : { text }) };
    }).catch(toolCaught);
};
