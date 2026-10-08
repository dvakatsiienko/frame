import type { On } from 'claude-code';
import type { Engine } from 'claude-code/testing';

// the harness has nothing beneath prompt.submit: this answers it, as the engine would, with the prompt that entered
export function answerPrompts(on: On) {
    on('prompt.submit', (_$, e) => ({ origin: e.origin, text: e.text }));
}

// a prompt dima typed at the composer: the proof a # dima-ok marker needs
export const dimaSays = ($: Engine, text: string) =>
    $.prompt.submit({ origin: { kind: 'composer' }, text, wait: false });
