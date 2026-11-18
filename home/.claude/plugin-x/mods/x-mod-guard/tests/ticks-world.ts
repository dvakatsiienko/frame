import type { On } from 'claude-code';
import { type Engine, mock } from 'claude-code/testing';

import { answerPrompts } from './said.ts';
import { liveStore } from './store.ts';

// the ticks test world (FRM-555 step 125, o147): ticks.test.ts runs on it, and a verifier's `--extra` rows import it
// instead of copying the mods tree
// his tick on an orbit ask quoting a floor command opens it once; a sign or a merge word is no guard's door any more
export const NOW = 1_000_000;
export type Tick = { at: number; id: string; targets: string[]; text: string };
export const tickOn = (command: string, id = 'o1'): Tick => ({
    at: NOW,
    id,
    targets: [command],
    text: `⚠️ go: \`${command}\``,
});

export function world(on: On, ticks: Tick[] = []) {
    mock.clock(on, { now: NOW });
    liveStore(on);
    answerPrompts(on);
    const ran: string[] = [];
    const fail = new Set<string>();
    on('state.get', (_$, e, next) =>
        e.plugin === 'x-mod-stash' && e.key === 'ticks'
            ? { value: { value: ticks, version: 1 } }
            : next(e),
    );
    on('session.id', () => ({ value: 't1t1t1t1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: false }));
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', (_$, e) => {
        const command = 'command' in e ? String(e.command) : '';
        ran.push(command);
        return fail.has(command)
            ? { isError: true, result: {}, text: 'failed' }
            : { result: {}, text: 'ran' };
    });
    return { fail, ran };
}
export const bash = ($: Engine, command: string) =>
    $.tool.call({ command, run_in_background: true, tool: 'Bash' });
