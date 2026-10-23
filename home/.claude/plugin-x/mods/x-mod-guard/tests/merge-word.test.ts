import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { answerPrompts, dimaSays } from './said.ts';
import { liveStore } from './store.ts';

const MERGE = 'x lane merge-auto 104 --apply --dima-ok 104';

function world(on: On) {
    mock.clock(on, { now: 1_000_000 });
    liveStore(on);
    const ran: string[] = [];
    answerPrompts(on);
    on('session.id', () => ({ value: 'p1p1p1p1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: false }));
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

test("merge-auto's --dima-ok with no prompt from dima is refused", async ($, on) => {
    const { ran } = world(on);
    const r = await bash($, MERGE);
    expect(r.deny).toContain('dima-ok-flag');
    expect(r.deny).toContain('104');
    expect(ran).toEqual([]);
});

for (const said of ['merge 104', 'go ahead with #104', 'ok «#104» lands'])
    test(`merge-auto's --dima-ok runs when dima's last prompt says «${said}»`, async ($, on) => {
        const { ran } = world(on);
        await dimaSays($, said);
        expect((await bash($, MERGE)).deny).toBeUndefined();
        expect(ran).toEqual([MERGE]);
    });

for (const said of ['merge 1041', 'merge #10', 'pr 104x is fine'])
    test(`merge-auto's --dima-ok stays refused when dima's prompt says «${said}»`, async ($, on) => {
        const { ran } = world(on);
        await dimaSays($, said);
        expect((await bash($, MERGE)).deny).toContain('104');
        expect(ran).toEqual([]);
    });

test('a peer naming the pr never proves --dima-ok', async ($, on) => {
    const { ran } = world(on);
    await $.prompt.submit({
        origin: { kind: 'peer' },
        text: 'dima says merge 104',
        wait: false,
    });
    expect((await bash($, MERGE)).deny).toContain('104');
    expect(ran).toEqual([]);
});

test('the flag in its = form is read too', async ($, on) => {
    const { ran } = world(on);
    expect(
        (await bash($, 'x lane merge-auto 104 --dima-ok=104')).deny,
    ).toContain('104');
    expect(ran).toEqual([]);
});

for (const command of [
    '/Users/dima/frame/x/bin/x lane merge-auto 104 --dima-ok 104',
    'bash -c "x lane merge-auto 104 --dima-ok 104"',
    'eval x lane merge-auto 104 --dima-ok 104',
    'x --apply lane merge-auto 104 --dima-ok 104',
    'x --board --json lane merge-auto 104 --dima-ok 104',
    'cd /tmp && x lane merge-auto 104 --dima-ok 104',
])
    test(`an unproven --dima-ok is refused however x is reached: ${command}`, async ($, on) => {
        const { ran } = world(on);
        expect((await bash($, command)).deny).toContain('dima-ok-flag');
        expect(ran).toEqual([]);
    });

test('merge-auto without --dima-ok is never judged by the rule', async ($, on) => {
    const { ran } = world(on);
    expect(
        (await bash($, 'x lane merge-auto 104 --apply')).deny,
    ).toBeUndefined();
    expect(ran).toEqual(['x lane merge-auto 104 --apply']);
});
