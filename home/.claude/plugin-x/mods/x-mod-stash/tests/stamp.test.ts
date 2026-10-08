import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// the harness keeps no rows: this hook sees what would be stored, and the missing store's error is ignored
function world(on: On) {
    mock.clock(on, { now: new Date(2026, 9, 8, 13, 58).getTime() });
    mock.store(on);
    const stored: string[] = [];
    on('session.append', (_$, e, next) => {
        stored.push(JSON.stringify(e.message.content));
        return next(e);
    });
    return { stored };
}

const reply = (
    $: Engine,
    text: string,
    door: 'response' | 'prompt' = 'response',
) =>
    $.session
        .append({
            door,
            message: {
                content: [{ text, type: 'text' }],
                role: door === 'response' ? 'assistant' : 'user',
                type: door === 'response' ? 'assistant' : 'user',
            },
            origin: { kind: 'model', model: 'claude-opus-5-5' },
            uuid: 'u1',
        })
        .catch(() => undefined);

test("a reply's 📄 stamp is stored with the real clock", async ($, on) => {
    const w = world(on);
    await reply($, 'done.\n\n📄 last report: **mods**, 14:20\n');
    expect(w.stored.join()).toContain('📄 last report: **mods**, 13:58');
});

test("a reply's ·-list is stored as bullets", async ($, on) => {
    const w = world(on);
    await reply($, 'crew: a · b · c');
    expect(w.stored.join()).toContain('crew:\\n- a\\n- b\\n- c');
});

test("a reply's ·-list is drawn as bullets", async ($, on) => {
    world(on);
    const drawn: string[] = [];
    on('ui.render', ($, e) => {
        if (e.component === 'AssistantMessage') drawn.push(e.props.text);
        return $.ui.resolve(e).Box({});
    });
    await $.ui.mount({
        component: 'AssistantMessage',
        plugin: 'x-mod-stash',
        props: { isFirstOfReply: true, text: 'crew: a · b' },
        surface: 'desktop',
    });
    expect(drawn).toContain('crew:\n- a\n- b');
});

test('a time outside a 📄 line is kept', async ($, on) => {
    const w = world(on);
    await reply($, 'the run started at 14:20');
    expect(w.stored.join()).toContain('at 14:20');
});

test("dima's prompt is kept as typed", async ($, on) => {
    const w = world(on);
    await reply($, '📄 last report: **x**, 14:20', 'prompt');
    expect(w.stored.join()).toContain('14:20');
});
