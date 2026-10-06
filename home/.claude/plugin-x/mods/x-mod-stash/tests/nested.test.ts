import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const reply = (fence: string) =>
    `report\n\n⏳ waiting on your word:\n\n\`\`\`\n${fence}\n\`\`\`\n\n📄 last report: **x**, 18:30`;

// a reply ends in one session; the answer is what the Stop hands back to the model, and the lines it logged
async function stop($: Engine, on: On, text: string) {
    mock.clock(on);
    mock.store(on);
    on('session.id', () => ({ value: 'n1n1n1n1-here' }));
    on('session.repo', () => ({ value: null }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('classic.Stop', () => ({}));
    const logs: string[] = [];
    on('ui.log', (_$, e) => {
        logs.push(e.text);
        return { value: undefined };
    });
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'terminal',
    });
    // the start's own lines are not the Stop's
    logs.length = 0;
    const r = await $.classic.Stop({
        last_assistant_message: text,
        session_id: 'n1n1n1n1-here',
        stop_hook_active: false,
    });
    return { logs, r };
}

test('a ⏳ item with a nested line gets a warning that names it', async ($, on) => {
    const { r } = await stop(
        $,
        on,
        reply(
            'lane\n1. ship it ➡️ yes\n2. rename the band ➡️ no\n   - the band reads «stash» today\n3. merge ➡️ yes',
        ),
    );
    expect(r.additionalContext).toContainEqual(
        expect.stringContaining('item 2'),
    );
});

test('a ⏳ fence of one-line items draws no warning', async ($, on) => {
    const { logs, r } = await stop(
        $,
        on,
        reply(
            'lane\n1. ship it ➡️ yes\n2. rename ➡️ no\n\nwispr adds\n1. pg → bg ✓',
        ),
    );
    expect(r.additionalContext ?? []).toEqual([]);
    expect(logs).toEqual([]);
});
