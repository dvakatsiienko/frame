import type { On } from 'claude-code';
import { expect, mock, test } from 'claude-code/testing';

import { answerPrompts } from './said.ts';
import { liveStore } from './store.ts';

const NOW = new Date(2026, 9, 6, 12).getTime();
const TICKED = 'git branch -D old';

// his tick on an ask quoting TICKED, read from x-mod-stash's own $.state
function world(on: On) {
    mock.clock(on, { now: NOW });
    const store = liveStore(on);
    answerPrompts(on);
    on('state.get', (_$, e, next) =>
        e.plugin === 'x-mod-stash' && e.key === 'ticks'
            ? {
                  value: {
                      value: [
                          {
                              at: NOW,
                              id: 'o1',
                              targets: [TICKED],
                              text: `⚠️ drop the branch: \`${TICKED}\``,
                          },
                      ],
                      version: 1,
                  },
              }
            : next(e),
    );
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: false }));
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', () => ({ result: {}, text: 'ran' }));
    return store;
}

test("a day's refusals and escapes are counted past the kept events", async ($, on) => {
    const store = world(on);
    for (const command of ['rm a', 'rm b', TICKED])
        await $.tool.call({ command, tool: 'Bash' });
    expect(store.get('day:2026-10-06:a1a1a1a1-0000')).toMatchObject({
        escaped: 1,
        refused: 2,
    });
});

test("a day's count names the rule behind each refusal and escape", async ($, on) => {
    const store = world(on);
    for (const command of ['rm a', 'git push -f origin x', TICKED, 'pkill x'])
        await $.tool.call({ command, tool: 'Bash' });
    expect(store.get('day:2026-10-06:a1a1a1a1-0000')).toMatchObject({
        rules: {
            'git-rewrite': { escaped: 1, refused: 1 },
            kill: { escaped: 0, refused: 1 },
            rm: { escaped: 0, refused: 1 },
        },
    });
});
