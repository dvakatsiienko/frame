import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { liveStore } from './store.ts';

function world(on: On, cwd: string, root = cwd) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: cwd }));
    on('session.root', () => ({ value: root }));
    on('env.get', () => ({ value: '/home' }));
    on('tool.call', () => ({ result: {}, text: 'ran' }));
}

const edit = ($: Engine, file: string) =>
    $.tool.call({
        file_path: file,
        new_string: 'b',
        old_string: 'a',
        tool: 'Edit',
    });

test('the 8th code edit in a clio session carries the delegate note, once', async ($, on) => {
    world(on, '/home/frame/_clio');
    const notes: number[] = [];
    for (let i = 1; i <= 10; i++) {
        const r = await edit($, '/home/frame/x/a.ts');
        if (r.deny === undefined && r.context?.length) notes.push(i);
    }
    expect(notes).toEqual([8]);
});

test('the 8th edit still runs, never blocked', async ($, on) => {
    world(on, '/home/frame/_clio');
    let r = await edit($, '/home/frame/x/a.ts');
    for (let i = 2; i <= 8; i++) r = await edit($, '/home/frame/x/a.ts');
    expect(r.deny).toBeUndefined();
    expect(r.context?.[0]).toContain('8 code edits in this clio session');
});

test('edits to non-code files do not count', async ($, on) => {
    world(on, '/home/frame/_clio');
    for (let i = 1; i <= 10; i++) {
        const r = await edit($, '/home/frame/_clio/notes.md');
        expect(r.context ?? []).toHaveLength(0);
    }
});

test("clio cd'd into ~/frame still gets the note at the 8th edit", async ($, on) => {
    world(on, '/home/frame', '/home/frame/_clio');
    const notes: number[] = [];
    for (let i = 1; i <= 10; i++) {
        const r = await edit($, '/home/frame/x/a.ts');
        if (r.context?.length) notes.push(i);
    }
    expect(notes).toEqual([8]);
});

test("a codie cd'd into clio's dir gets no note", async ($, on) => {
    world(on, '/home/frame/_clio', '/home/frame');
    for (let i = 1; i <= 10; i++) {
        const r = await edit($, '/home/frame/x/a.ts');
        expect(r.context ?? []).toHaveLength(0);
    }
});

test('a session outside clio gets no note', async ($, on) => {
    world(on, '/home/projects/bytes');
    for (let i = 1; i <= 10; i++) {
        const r = await edit($, '/home/projects/bytes/a.ts');
        expect(r.context ?? []).toHaveLength(0);
    }
});

test('the edit count leaves nothing in the shared store', async ($, on) => {
    const store = liveStore(on);
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/home/frame/_clio' }));
    on('env.get', () => ({ value: '/home' }));
    on('tool.call', () => ({ result: {}, text: 'ran' }));
    await edit($, '/home/frame/x/a.ts');
    expect([...store.keys()]).toEqual([]);
});
