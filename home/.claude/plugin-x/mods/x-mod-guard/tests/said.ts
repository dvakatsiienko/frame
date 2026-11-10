import type { On } from 'claude-code';
import type { Engine } from 'claude-code/testing';

// the harness has nothing beneath prompt.submit: this answers it, as the engine would, with the prompt that entered
export function answerPrompts(on: On) {
    on('prompt.submit', (_$, e) => ({ origin: e.origin, text: e.text }));
}

// a prompt dima typed at the composer: the proof a # dima-ok marker needs. a session's first typed prompt approves
// nothing (it reads as a spawn prompt), so one plain prompt goes first
export async function dimaSays($: Engine, text: string) {
    await $.prompt.submit({
        origin: { kind: 'composer' },
        text: 'go on',
        wait: false,
    });
    return $.prompt.submit({ origin: { kind: 'composer' }, text, wait: false });
}
