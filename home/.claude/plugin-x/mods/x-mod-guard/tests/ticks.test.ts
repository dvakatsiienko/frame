import { expect, test } from 'claude-code/testing';

import { NOW, bash, tickOn, world } from './ticks-world.ts';

// FRM-580 and FRM-566 took two ticks or a raw api call for one sign: now the label and the body line run as written
for (const command of [
    'x linear set FRM-9 --add-label signed',
    'x linear body FRM-9 --set /tmp/b.md',
    'x lane merge-auto 104 --apply --dima-ok 104',
])
    test(`a sign or merge-auto call meets no guard: ${command}`, async ($, on) => {
        const { ran } = world(on);
        expect([(await bash($, command)).deny, ran]).toEqual([
            undefined,
            [command],
        ]);
    });

test('his tick quoting git branch -D foo runs it once; a second run is refused', async ($, on) => {
    const { ran } = world(on, [tickOn('git branch -D foo')]);
    expect((await bash($, 'git branch -D foo')).deny).toBeUndefined();
    expect((await bash($, 'git branch -D foo')).deny).toContain(
        'git branch -D',
    );
    expect(ran).toEqual(['git branch -D foo']);
});

test('a ticked command that fails keeps the tick for the retry', async ($, on) => {
    const { fail, ran } = world(on, [tickOn('git branch -D foo')]);
    fail.add('git branch -D foo');
    await bash($, 'git branch -D foo');
    fail.clear();
    expect((await bash($, 'git branch -D foo')).deny).toBeUndefined();
    expect(ran.length).toBe(2);
});

test('a tick quoting another command opens nothing', async ($, on) => {
    const { ran } = world(on, [tickOn('git branch -D foo')]);
    expect((await bash($, 'git branch -D bar')).deny).toBeDefined();
    expect(ran).toEqual([]);
});

test('a tick never opens plain rm', async ($, on) => {
    const { ran } = world(on, [tickOn('rm -rf build')]);
    expect((await bash($, 'rm -rf build')).deny).toContain('trash');
    expect(ran).toEqual([]);
});

test('a tick older than 2 h opens nothing', async ($, on) => {
    const { ran } = world(on, [
        { ...tickOn('git branch -D foo'), at: NOW - 2 * 60 * 60 * 1000 - 1 },
    ]);
    expect((await bash($, 'git branch -D foo')).deny).toBeDefined();
    expect(ran).toEqual([]);
});

test('his tick on a raw merge runs it while the brake is off', async ($, on) => {
    const { ran } = world(on, [tickOn('gh pr merge 5 --squash')]);
    on('process.run', () => ({
        value: {
            exitCode: 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: JSON.stringify({ data: { brake: '' } }),
        },
    }));
    expect((await bash($, 'gh pr merge 5 --squash')).deny).toBeUndefined();
    expect(ran).toEqual(['gh pr merge 5 --squash']);
});

test('his tick on a raw merge stops at a brake that reads on', async ($, on) => {
    const { ran } = world(on, [tickOn('gh pr merge 5 --squash')]);
    on('process.run', () => ({
        value: {
            exitCode: 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: JSON.stringify({ data: { brake: 'revert on main' } }),
        },
    }));
    expect((await bash($, 'gh pr merge 5 --squash')).deny).toContain('brake');
    expect(ran).toEqual([]);
});

test('his tick on a release of the brake takes it off', async ($, on) => {
    const command = 'x lane merge-auto 5 --release-brake --dima-ok 5';
    const { ran } = world(on, [tickOn(command)]);
    expect((await bash($, command)).deny).toBeUndefined();
    expect(ran).toEqual([command]);
});

// wisphunter on fc3197ae: a tick on one part of a line never carries a brake release or a stash sweep beside it
test('a tick on one command of a line never takes the brake off beside it', async ($, on) => {
    const { ran } = world(on, [tickOn('git branch -D foo')]);
    const line =
        'x lane merge-auto 5 --release-brake --dima-ok 5; git branch -D foo';
    expect([(await bash($, line)).deny !== undefined, ran]).toEqual([true, []]);
});

test("a brake release behind x's own flags is still read", async ($, on) => {
    const { ran } = world(on);
    const r = await bash(
        $,
        'x --json lane merge-auto 5 --release-brake --dima-ok 5',
    );
    expect([r.deny?.includes('brake'), ran]).toEqual([true, []]);
});
