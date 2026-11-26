import type { On } from 'claude-code';

import type { Engine } from './shared-boot.ts';

// a turn run to its end and the reason its turn-log row names: rows from a world's own fs.write files, or kept by this
// hook where the world has none
export function turnRows(on: On, files?: Record<string, string>) {
    const kept = files ?? {};
    on('turn.start', (_$, e) => ({ turnId: e.turnId }));
    if (!files)
        on('fs.write', (_$, e) => {
            kept[e.path] = e.text;
            return { value: undefined };
        });
    return async ($: Engine, turnId = 'row', isStarted = false) => {
        if (!isStarted) await $.turn.start({ text: '', turnId });
        await $.turn.complete({
            answer: '',
            durationMs: 1,
            isAborted: false,
            reason: 'answer',
            turnId,
        });
        return Object.values(kept)
            .filter((t) => t.includes('"turnId"'))
            .map((t) => JSON.parse(t) as { reason: unknown; turnId: string })
            .find((r) => r.turnId === turnId && 'reason' in r)?.reason;
    };
}
