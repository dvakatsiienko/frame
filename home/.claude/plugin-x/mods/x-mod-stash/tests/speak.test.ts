import type { On } from 'claude-code';
import { expect, test } from 'claude-code/testing';

import { assume, lastContext, mobile } from './orbit-helpers.ts';
import {
    type Board,
    add,
    board,
    orbit,
    say,
    start,
    world,
} from './orbit-world.ts';

test('⏸️ on an assumption pauses speak', async ($, on) => {
    const w = world(on);
    const sent = speakStub(on, { paused: false, speaking: true });
    await start($);
    const ui = await board($);
    await assume($, 'kept the old port');
    await w.clock.advance(5_000);
    await ui.press({ key: 'orbit:pause:a1' });
    expect(sent.filter((r) => r.op !== 'status')).toEqual([{ op: 'pause' }]);
});

test('⏹️ on an assumption stops speak', async ($, on) => {
    const w = world(on);
    const sent = speakStub(on, { paused: false, speaking: true });
    await start($);
    const ui = await board($);
    await assume($, 'kept the old port');
    await w.clock.advance(5_000);
    await ui.press({ key: 'orbit:stop:a1' });
    expect(sent.filter((r) => r.op !== 'status')).toEqual([{ op: 'stop' }]);
});

test("🔊 sends the ask's text to speak's control socket", async ($, on) => {
    world(on);
    const runs: string[][] = [];
    on('process.run', (_$, e) => {
        runs.push([...e.argv]);
        return {
            value: {
                exitCode: 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: '{"ok":true}',
            },
        };
    });
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.press({ key: 'orbit:read:o1' });
    const sent = runs.find((argv) =>
        argv.includes('/home/.local/share/x-speak/control.sock'),
    );
    expect(JSON.parse(sent?.[4] ?? '{}')).toEqual({
        op: 'read',
        text: 'name a bird. pelican',
    });
});

// speak's control socket as a stub: `status` answers the given state, every request is kept
function speakStub(on: On, state: { speaking: boolean; paused: boolean }) {
    const sent: Record<string, unknown>[] = [];
    on('process.run', (_$, e) => {
        const isSpeak = e.argv.some((a) => a.endsWith('x-speak/control.sock'));
        const request = (
            isSpeak ? JSON.parse(e.argv[4] ?? '{}') : {}
        ) as Record<string, unknown>;
        if (isSpeak) sent.push(request);
        return {
            value: {
                exitCode: 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout:
                    request.op === 'status'
                        ? JSON.stringify(state)
                        : '{"ok":true}',
            },
        };
    });
    return sent;
}

const playLabel = async (ui: Board, id: string) =>
    (await ui.find({ key: `orbit:pause:${id}` }))?.text;

test('the play button reads ⏸️ once speak says it reads, ▶️ while quiet', async ($, on) => {
    world(on);
    const state = { paused: false, speaking: false };
    speakStub(on, state);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    const quiet = await playLabel(ui, 'o1');
    state.speaking = true;
    await ui.press({ key: 'orbit:read:o1' });
    expect([quiet, await playLabel(ui, 'o1')]).toEqual(['▶️', '⏸️']);
});

test('▶️ with speak quiet reads the row', async ($, on) => {
    world(on);
    const sent = speakStub(on, { paused: false, speaking: false });
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.press({ key: 'orbit:pause:o1' });
    expect(sent.filter((r) => r.op !== 'status')).toEqual([
        { op: 'read', text: 'name a bird. pelican' },
    ]);
});

test('▶️ with speak paused resumes it, never reads anew', async ($, on) => {
    world(on);
    const sent = speakStub(on, { paused: true, speaking: true });
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.press({ key: 'orbit:pause:o1' });
    expect(sent.filter((r) => r.op !== 'status')).toEqual([{ op: 'pause' }]);
});

test('🔊 on an assumption reads its text aloud', async ($, on) => {
    world(on);
    const runs: string[][] = [];
    on('process.run', (_$, e) => {
        runs.push([...e.argv]);
        return {
            value: {
                exitCode: 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: '{"ok":true}',
            },
        };
    });
    await start($);
    const ui = await board($);
    await orbit($, { op: 'assume', texts: ['moons repeat past five'] });
    await ui.press({ key: 'orbit:read:a1' });
    const sent = runs.find((argv) =>
        argv.includes('/home/.local/share/x-speak/control.sock'),
    );
    expect(JSON.parse(sent?.[4] ?? '{}')).toEqual({
        op: 'read',
        text: 'moons repeat past five',
    });
});

test('a speak press keeps mobile mode on', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await mobile($);
    await ui.press({ key: 'orbit:stop:o1' });
    await say($, 'hi');
    expect(lastContext(w.contexts)).toContain('asks fence');
});
