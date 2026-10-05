import type { Register } from 'claude-code';

import { maskDeep } from './mask.ts';

// redact: every row a session keeps is masked before it is stored and sent, so no secret reaches a transcript.
// fail-open: a masking error keeps the row as it came, with a line in the log.
export const register: Register = (on) => {
    on('session.append', async ($, e, next) => {
        try {
            const content = maskDeep(e.message.content);
            if (content === e.message.content) return next(e);
            return next({ ...e, message: { ...e.message, content } });
        } catch (err) {
            $.ui.log(
                `redact: ${err instanceof Error ? err.message : String(err)}; the row was kept unmasked`,
            );
            return next(e);
        }
    });
};
