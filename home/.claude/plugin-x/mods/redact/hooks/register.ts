import type { EngineInterface, Register } from 'claude-code';

import { type Vault, mapStrings, redactText, restoreText } from './mask.ts';

// the vault survives a hot reload and dies with the session; never `$.store`, which every session shares
const VAULT = { key: 'vault', plugin: 'redact' } as const;

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

// redact: every row a session keeps reads secrets as placeholders before it is stored and sent; a tool call's input gets the secrets back.
// fail-open: an error keeps the row or the call as it came, with a line in the log.
export const register: Register = (on) => {
    on('session.append', async ($, e, next) => {
        try {
            const content = await redactRow($, e.message.content);
            if (content === e.message.content) return next(e);
            return next({ ...e, message: { ...e.message, content } });
        } catch (err) {
            $.ui.log(
                `redact: ${err instanceof Error ? err.message : String(err)}; the row was kept unredacted`,
            );
            return next(e);
        }
    });

    on('tool.call', async ($, e, next) => {
        try {
            const { value: vault } = await $.state.get(VAULT);
            if (!vault) return next(e);
            return next(mapStrings(e, (text) => restoreText(text, vault)));
        } catch (err) {
            $.ui.log(
                `redact: ${err instanceof Error ? err.message : String(err)}; the call ran with its placeholders`,
            );
            return next(e);
        }
    });
};
