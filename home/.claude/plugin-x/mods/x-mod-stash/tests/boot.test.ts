import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// FRM-426 exit 9: while a cclio boot is open, start_session's result carries «the boot continues; the board ends the
// turn»; after the board printed, or in any other session, nothing lands
const SID = 'b0b0b0b0-boot';
const PID = 3131;
const NOW = new Date(2026, 9, 29, 13, 0).getTime();
const LINE = 'the boot continues; the board ends the turn';
const START = 'mcp__ccd_session__start_session';

function world(on: On, name = '🦉 cclio') {
    mock.clock(on, { now: NOW });
    const store = new Map<string, unknown>();
    on('store.get', (_$, e) => ({ value: store.get(e.key) }));
    on('store.set', (_$, e) => {
        store.set(e.key, e.value);
        return { value: undefined };
    });
    on('store.keys', () => ({ value: [...store.keys()] }));
    on('store.delete', (_$, e) => {
        store.delete(e.key);
        return { value: undefined };
    });
    on('session.id', () => ({ value: SID }));
    on('env.get', () => ({ value: '/home' }));
    on('process.run', () => ({
        value: {
            exitCode: 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: `${PID}\nThu Oct 29 13:00:00 2026\n`,
        },
    }));
    on('fs.read', (_$, e) =>
        e.path === `/home/.claude/sessions/${PID}.json`
            ? { value: JSON.stringify({ name, pid: PID }) }
            : { deny: 'no such file' },
    );
    on('fs.list', () => ({ value: [] }));
    on('ui.log', () => ({ value: undefined }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    on('tool.register', (_$, e) => ({
        value: { tool: `mcp__x-mod-stash__${e.name}` },
    }));
    on('classic.Stop', () => ({}));
    on('skill.prompt', (_$, e) => ({ text: e.text }));
    on('tool.call', () => ({ result: {}, text: 'done' }));
    return { store };
}

const boot = ($: Engine) =>
    $.skill.prompt({ skill: 'cclio:boot', text: '# boot' });
const spawn = async ($: Engine) =>
    ((await $.tool.call({ tool: START } as never)).context ?? []).join('\n');
const reply = ($: Engine, text: string) =>
    $.classic.Stop({
        last_assistant_message: text,
        session_id: SID,
        stop_hook_active: false,
    });
const start = ($: Engine) =>
    $.session.start({ cwd: '/tmp', isInteractive: true, surface: 'desktop' });

test('start_session inside an open cclio boot carries the boot-continues line', async ($, on) => {
    world(on);
    await start($);
    await boot($);
    expect(await spawn($)).toContain(LINE);
});

test('after the board printed, start_session carries nothing', async ($, on) => {
    world(on);
    await start($);
    await boot($);
    await reply($, `the board.\n${'- a line of it\n'.repeat(40)}`);
    expect(await spawn($)).not.toContain(LINE);
});

test('a short nudge answer does not close the boot', async ($, on) => {
    world(on);
    await start($);
    await boot($);
    await reply($, 'booting, board next');
    expect(await spawn($)).toContain(LINE);
});

test('a session that never loaded the boot gets nothing', async ($, on) => {
    world(on);
    await start($);
    expect(await spawn($)).not.toContain(LINE);
});

test('a member that loads a skill named boot gets nothing: only cclio boots', async ($, on) => {
    world(on, '☕️ 🔧 FRM-1 code: x');
    await start($);
    await boot($);
    expect(await spawn($)).not.toContain(LINE);
});

test('a boot older than three hours is not open', async ($, on) => {
    const { store } = world(on);
    await start($);
    await boot($);
    store.set(`boot:${SID}`, NOW - 4 * 60 * 60 * 1000);
    expect(await spawn($)).not.toContain(LINE);
});
