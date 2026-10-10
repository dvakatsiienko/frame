import type { ModelCompleteResult, On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const SID = 'e1e1e1e1-enhancer';

// the prompt box as one string behind read and fill; Haiku answers from a queue, each call counted
function world(
    on: On,
    box: {
        text: string;
        refusal?: 'dialog';
        isXDown?: boolean;
        painted?: string[];
    },
) {
    mock.clock(on);
    mock.store(on);
    const calls: { prompt: unknown; system: unknown }[] = [];
    // resolves at the next fill, for a test whose press settled while Haiku was still answering
    let onFill = () => {};
    const nextFill = () =>
        new Promise<void>((done) => {
            onFill = done;
        });
    const answers: (() => Promise<ModelCompleteResult>)[] = [];
    on('session.id', () => ({ value: SID }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.repo', () => ({ value: null }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('tool.register', (_$, e) => ({
        value: { tool: `mcp__x-mod-stash__${e.name}` },
    }));
    on('env.get', () => ({ value: '/home' }));
    on('ui.log', () => ({ value: undefined }));
    on('fs.read', () => ({ value: 'the rules' }));
    on('command.list', () => ({
        value: [
            {
                description: 'shape an idea',
                name: 'x:shape-idea',
                source: 'plugin',
            },
        ],
    }));
    // sqlite3 answers the dictionary; x answers ticket reads, FRM-381 known, FRM-999 not
    const runs: string[][] = [];
    on('process.run', (_$, e) => {
        runs.push([...e.argv]);
        const isX = e.argv[0]?.endsWith('/x') ?? false;
        return {
            value: {
                exitCode: box.isXDown && isX ? 1 : 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: isX
                    ? JSON.stringify({
                          data: {
                              tickets: [
                                  {
                                      id: 'FRM-381',
                                      url: 'https://linear.app/x-com/issue/FRM-381/stash-orbit',
                                  },
                              ],
                          },
                      })
                    : 'quards → chords\n',
            },
        };
    });
    on('prompt.read', () => ({
        value: { cursor: box.text.length, text: box.text },
    }));
    on('prompt.fill', (_$, e) => {
        if (box.refusal) return { isFilled: false, refusal: box.refusal };
        box.text = e.text;
        box.painted = (e.decorations ?? []).map((d) =>
            d.underline ? e.text.slice(d.start, d.end) : '',
        );
        onFill();
        return { isFilled: true };
    });
    on('model.complete', async (_$, e) => {
        calls.push({ prompt: e.prompt, system: e.system });
        const next = answers.shift();
        return {
            value: next ? await next() : answered('enhanced'),
        };
    });
    return { answers, calls, nextFill, runs };
}

const usage = {
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    input_tokens: 1,
    output_tokens: 1,
};
const answered = (text: string): ModelCompleteResult => ({
    isAnswered: true,
    text,
    usage,
});

async function band($: Engine) {
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'desktop',
    });
    return $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 140,
            hasSurvey: false,
            isWorking: false,
            maxRows: 12,
            scroll: { bodyRows: 40, offset: 0 },
            view: {},
        },
        surface: 'desktop',
    });
}

test('enhance calls Haiku once with the typed text and the box takes the answer', async ($, on) => {
    const box = { text: 'use the shape idea skill on frm 381' };
    const w = world(on, box);
    const ui = await band($);
    await ui.press({ key: 'enh:enhance' });
    expect([w.calls.length, w.calls[0]?.prompt, box.text]).toEqual([
        1,
        'use the shape idea skill on frm 381',
        'enhanced',
    ]);
});

test('Haiku reads the rules, the slash commands and the wispr dictionary', async ($, on) => {
    const box = { text: 'quards please' };
    const w = world(on, box);
    const ui = await band($);
    await ui.press({ key: 'enh:enhance' });
    expect(JSON.stringify(w.calls[0]?.system)).toMatch(
        /the rules.*\/x:shape-idea.*quards → chords/s,
    );
});

test('prev brings back the press-time text byte for byte', async ($, on) => {
    const typed = 'one\ntwo 🪐  trailing ';
    const box = { text: typed };
    world(on, box);
    const ui = await band($);
    await ui.press({ key: 'enh:enhance' });
    await ui.press({ key: 'enh:prev' });
    expect(box.text).toBe(typed);
});

test('new brings the enhanced text back with his edits and no second call', async ($, on) => {
    const box = { text: 'draft' };
    const w = world(on, box);
    const ui = await band($);
    await ui.press({ key: 'enh:enhance' });
    box.text = 'enhanced, edited';
    await ui.press({ key: 'enh:prev' });
    await ui.press({ key: 'enh:new' });
    expect([box.text, w.calls.length]).toEqual(['enhanced, edited', 1]);
});

test('enhance again makes exactly one more call', async ($, on) => {
    const box = { text: 'draft' };
    const w = world(on, box);
    const ui = await band($);
    await ui.press({ key: 'enh:enhance' });
    await ui.press({ key: 'enh:enhance' });
    expect(w.calls.length).toBe(2);
});

test('a press while the call runs makes no second call', async ($, on) => {
    const box = { text: 'draft' };
    const w = world(on, box);
    let release = () => {};
    w.answers.push(
        () =>
            new Promise((done) => {
                release = () => done(answered('enhanced'));
            }),
    );
    const ui = await band($);
    await ui.press({ key: 'enh:enhance' });
    await ui.press({ key: 'enh:enhance' });
    const filled = w.nextFill();
    release();
    await filled;
    expect(w.calls.length).toBe(1);
});

test('typing while the call runs keeps his text', async ($, on) => {
    const box = { text: 'draft' };
    const w = world(on, box);
    w.answers.push(async () => {
        box.text = 'draft, typed on';
        return answered('enhanced');
    });
    const ui = await band($);
    await ui.press({ key: 'enh:enhance' });
    expect(box.text).toBe('draft, typed on');
});

test('a Haiku error leaves his text and the band names the reason', async ($, on) => {
    const box = { text: 'draft' };
    const w = world(on, box);
    w.answers.push(async () => ({
        error: 'overloaded',
        isAnswered: false,
        reason: 'api-error',
        status: 529,
        usage,
    }));
    const ui = await band($);
    await ui.press({ key: 'enh:enhance' });
    expect([
        box.text,
        (await ui.find({ text: /^enhance:/, type: 'Text' }))?.text,
    ]).toEqual(['draft', expect.stringMatching(/api-error.*untouched/)]);
});

test('a box that refuses the answer says so in the band', async ($, on) => {
    const box = { refusal: 'dialog' as const, text: 'draft' };
    world(on, box);
    const ui = await band($);
    await ui.press({ key: 'enh:enhance' });
    expect([
        box.text,
        (await ui.find({ text: /^enhance:/, type: 'Text' }))?.text,
    ]).toEqual([
        'draft',
        expect.stringMatching(/did not take the answer.*press new to retry/),
    ]);
});

test('an answer equal to his text says there was nothing to change', async ($, on) => {
    const box = { text: 'already clean' };
    const w = world(on, box);
    w.answers.push(async () => answered('already clean'));
    const ui = await band($);
    await ui.press({ key: 'enh:enhance' });
    expect((await ui.find({ text: /^enhance:/, type: 'Text' }))?.text).toBe(
        'enhance: Haiku found nothing to change',
    );
});

test('a ticket id linear knows stays plain text, painted as a link', async ($, on) => {
    const box: Parameters<typeof world>[1] = {
        text: 'use the shape idea skill on frm 381',
    };
    const w = world(on, box);
    w.answers.push(async () => answered('/x:shape-idea on FRM-381'));
    const ui = await band($);
    await ui.press({ key: 'enh:enhance' });
    expect([box.text, box.painted]).toEqual([
        '/x:shape-idea on FRM-381',
        ['FRM-381'],
    ]);
});

test('an id linear does not know is left unpainted', async ($, on) => {
    const box: Parameters<typeof world>[1] = { text: 'see frm 999' };
    const w = world(on, box);
    w.answers.push(async () => answered('see FRM-999'));
    const ui = await band($);
    await ui.press({ key: 'enh:enhance' });
    expect([box.text, box.painted]).toEqual(['see FRM-999', []]);
});

test('with x down the answer lands unpainted', async ($, on) => {
    const box: Parameters<typeof world>[1] = {
        isXDown: true,
        text: 'on frm 381',
    };
    const w = world(on, box);
    w.answers.push(async () => answered('on FRM-381'));
    const ui = await band($);
    await ui.press({ key: 'enh:enhance' });
    expect([box.text, box.painted]).toEqual(['on FRM-381', []]);
});
