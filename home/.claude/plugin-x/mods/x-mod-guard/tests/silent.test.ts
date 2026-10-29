import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// stash's 🎛️ «guard verdicts» knob (FRM-391 slice 06, dima's o11): silent drops guard's notes, never a refusal
const STASH = '/home/.claude/plugins/store/x-mod-stash_inline-0000.json';

function world(on: On, isSilent: boolean) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: true }));
    on('fs.list', (_$, e) => ({
        value: e.path.endsWith('/plugins/store')
            ? [
                  {
                      isLink: false,
                      kind: 'file' as const,
                      mtimeMs: 0,
                      name: 'x-mod-stash_inline-0000.json',
                      size: 1,
                  },
              ]
            : [],
    }));
    on('fs.read', (_$, e) =>
        e.path === STASH
            ? { value: JSON.stringify({ 'guard-silent': isSilent }) }
            : { deny: 'no such file' },
    );
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

test('with guard notes shown, a rewrite and a hint reach the model', async ($, on) => {
    world(on, false);
    const r = await bash($, 'pnpm -s a && gh pr view 12');
    expect(
        (r.context ?? []).some((l) => l.includes('rewrote this call')) &&
            (r.context ?? []).some((l) => l.includes('hint:')),
    ).toBe(true);
});

test('with guard notes silent, the rewrite still runs and no note reaches the model', async ($, on) => {
    const w = world(on, true);
    const r = await bash($, 'pnpm -s a && gh pr view 12');
    expect([w.ran, r.context ?? []]).toEqual([
        ['pnpm --silent a && gh pr view 12'],
        [],
    ]);
});

test('with guard notes silent, a warn-only rule still says it would refuse', async ($, on) => {
    const w = world(on, true);
    const r = await bash($, 'claude plugin update x@x');
    expect([
        w.ran,
        (r.context ?? []).filter((l) => l.includes('would refuse')),
    ]).toMatchObject([['claude plugin update x@x'], [expect.any(String)]]);
});

test('with guard notes silent, a floor refusal still refuses', async ($, on) => {
    const w = world(on, true);
    const r = await bash($, 'git reset --hard');
    expect([typeof r.deny, w.ran]).toEqual(['string', []]);
});
