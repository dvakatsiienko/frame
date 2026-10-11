import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// the harness keeps no rows: this hook sees what would be stored, and the missing store's error is ignored
function world(on: On, store: Record<string, unknown> = {}) {
    mock.clock(on, { now: new Date(2026, 9, 8, 13, 58).getTime() });
    mock.store(on, store);
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

// the 🎛️ reply switches gate the stored rewrite, not only its look (FRM-391 batch 3)
test("with ·-lists switched off, a reply's ·-list is stored as written", async ($, on) => {
    const w = world(on, { shown: { 'stash.bullets': false } });
    await reply($, 'crew: a · b · c');
    expect(w.stored.join()).toContain('crew: a · b · c');
});

test("with fleet words switched off, a reply's fleet word is stored as written", async ($, on) => {
    const w = world(on, { shown: { 'stash.boldwords': false } });
    await reply($, 'that becomes a wisp');
    expect(w.stored.join()).toContain('that becomes a wisp');
});

test("with ·-lists switched off, a reply's ·-list is drawn as written", async ($, on) => {
    world(on, { shown: { 'stash.bullets': false } });
    on('session.id', () => ({ value: 's1s1s1s1-dots' }));
    on('session.repo', () => ({ value: null }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    const drawn: string[] = [];
    on('ui.render', ($, e) => {
        if (e.component === 'AssistantMessage') drawn.push(e.props.text);
        return $.ui.resolve(e).Box({});
    });
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'desktop',
    });
    await $.ui.mount({
        component: 'AssistantMessage',
        plugin: 'x-mod-stash',
        props: { isFirstOfReply: true, text: 'crew: a · b' },
        surface: 'desktop',
    });
    expect(drawn).toContain('crew: a · b');
});

test("with fleet words switched off, a reply's fleet word is drawn as written", async ($, on) => {
    world(on, { shown: { 'stash.boldwords': false } });
    on('session.id', () => ({ value: 's1s1s1s1-dots' }));
    on('session.repo', () => ({ value: null }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    const drawn: string[] = [];
    on('ui.render', ($, e) => {
        if (e.component === 'AssistantMessage') drawn.push(e.props.text);
        return $.ui.resolve(e).Box({});
    });
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'desktop',
    });
    await $.ui.mount({
        component: 'AssistantMessage',
        plugin: 'x-mod-stash',
        props: { isFirstOfReply: true, text: 'that becomes a wisp' },
        surface: 'desktop',
    });
    expect(drawn).toContain('that becomes a wisp');
});
