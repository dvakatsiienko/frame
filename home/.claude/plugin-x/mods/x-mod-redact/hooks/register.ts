import type { EngineInterface, Register } from 'claude-code';

import {
    type Vault,
    mapStrings,
    maskText,
    redactText,
    restoreText,
} from './mask.ts';

// the vault survives a hot reload and dies with the session; never `$.store`, which every session shares
const VAULT = { key: 'vault', plugin: 'x-mod-redact' } as const;

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

// a vault error never lets a secret through: the value is masked one way instead, with a line in the log
async function redactOrMask<T>($: EngineInterface, value: T) {
    try {
        return await redactRow($, value);
    } catch (err) {
        $.ui.log(
            `x-mod-redact: ${err instanceof Error ? err.message : String(err)}; masked one way instead`,
        );
        return mapStrings(value, maskText);
    }
}

// x-mod-redact: every row a session keeps, and every tool result, reads secrets as placeholders before it is stored and sent;
// a Bash command gets the secrets back. Only Bash: a Write or an Edit quoting a placeholder would put the live key into a file.
export const register: Register = (on) => {
    on('session.append', async ($, e, next) => {
        const content = await redactOrMask($, e.message.content);
        if (content === e.message.content) return next(e);
        return next({ ...e, message: { ...e.message, content } });
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
        const result = await redactOrMask($, r.result);
        const text =
            r.text === undefined ? undefined : await redactOrMask($, r.text);
        if (result === r.result && text === r.text) return r;
        return { ...r, result, ...(text === undefined ? {} : { text }) };
    });
};
