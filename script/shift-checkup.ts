// Every guard a shift leans on, checked red and green where a fixture can prove it, each with the
// reason it exists. Any red → no shift. Run by cclio:shift's preflight.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const home = homedir();
const frame = join(home, 'frame');
const crewHook = join(home, '.claude/shelf/hooks/crew-recompact.sh');
const shiftHook = join(frame, 'cclio/.claude/hooks/shift-recompact.sh');

type Check = { name: string; why: string; run: () => string | true };

const hookOut = (
    hook: string,
    stdin: string,
    env: Record<string, string> = {},
) =>
    spawnSync('bash', [hook], {
        encoding: 'utf8',
        env: { ...process.env, ...env },
        input: stdin,
    }).stdout;

const wired = (settingsPath: string, hook: string) => {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    const entries: { matcher?: string; hooks: { command: string }[] }[] =
        settings.hooks?.SessionStart ?? [];
    return entries.some(
        (e) =>
            e.matcher === 'compact' &&
            e.hooks.some((h) =>
                h.command.includes(hook.split('/').pop() ?? ''),
            ),
    );
};

const scratch = mkdtempSync(join(tmpdir(), 'shift-checkup-'));

const checks: Check[] = [
    {
        name: 'crew recompact',
        run: () => {
            if (!wired(join(home, '.claude/settings.json'), crewHook))
                return 'not wired as SessionStart:compact in ~/.claude/settings.json';
            const transcript = (cmd: string) => {
                const p = join(scratch, `t-${cmd.replace(/\W/g, '')}.jsonl`);
                writeFileSync(
                    p,
                    `${JSON.stringify({ message: `<command-name>${cmd}</command-name>`, type: 'user' })}\n`,
                );
                return JSON.stringify({ transcript_path: p });
            };
            if (
                !hookOut(crewHook, transcript('/x:crew-coder')).includes('STOP')
            )
                return 'silent for a coder (green case)';
            if (hookOut(crewHook, transcript('/cclio:init')).trim())
                return 'fires for a non-crew session (red case)';
            return true;
        },
        why: 'a compaction re-attaches skills cut at ~20k chars, none on a resumed process — a coder, verifier or designer would lose its contract mid-shift',
    },
    {
        name: 'shift recompact',
        run: () => {
            if (!wired(join(frame, 'cclio/.claude/settings.json'), shiftHook))
                return 'not wired as SessionStart:compact in cclio/.claude/settings.json';
            const plan = (status: string) => {
                const dir = mkdtempSync(join(scratch, 'plan-'));
                writeFileSync(
                    join(dir, 'p.md'),
                    `# probe\n\nstatus: ${status}\n\n## log\n\n- 10:00 · cclio · step 1\n`,
                );
                return dir;
            };
            if (
                !hookOut(shiftHook, '{}', {
                    SHIFTS_DIR: plan('running'),
                }).includes('step 1')
            )
                return 'silent on a running plan (green case)';
            if (hookOut(shiftHook, '{}', { SHIFTS_DIR: plan('done') }).trim())
                return 'fires on a finished plan (red case)';
            return true;
        },
        why: 'nobody types /compact during a shift — autocompact fires instead, and without this cclio forgets the plan, the step and the decisions',
    },
    {
        name: 'one running plan at most',
        run: () => {
            const out = spawnSync(
                'grep',
                ['-l', '^status: running', '-r', join(frame, 'cclio/shifts')],
                { encoding: 'utf8' },
            ).stdout.trim();
            const running = out ? out.split('\n') : [];
            return (
                running.length <= 1 ||
                `${running.length} plans say running: ${running.join(', ')}`
            );
        },
        why: 'a plan left at status: running sends a compacted cclio back into a dead shift',
    },
    {
        name: 'bg-spare age',
        run: () => {
            const ps = execFileSync('ps', ['-axo', 'etime=,command='], {
                encoding: 'utf8',
            });
            const old = ps
                .split('\n')
                .filter(
                    (l) =>
                        l.includes('bg-spare') &&
                        l.trim().split(/\s+/)[0]?.includes('-'),
                );
            return (
                old.length === 0 ||
                `${old.length} spare(s) older than a day — claude daemon stop --keep-workers`
            );
        },
        why: 'a day-old pre-warmed spare booted a coder without the repo root AGENTS.md (#95589)',
    },
    {
        name: '📡 pr-watch live',
        run: () => {
            const ps = execFileSync('ps', ['-axo', 'command='], {
                encoding: 'utf8',
            });
            return (
                ps.split('\n').some((l) => l.includes('pr-watch.sh --watch')) ||
                'no pr-watch.sh --watch process — start it from the cclio plugin monitor'
            );
        },
        why: 'a member pings only when done or blocked — the watch is what wakes cclio on a new commit or a green pr',
    },
    {
        name: 'fast-jev-compaction',
        run: () => {
            const settings = JSON.parse(
                readFileSync(
                    join(frame, 'cclio/.claude/settings.json'),
                    'utf8',
                ),
            );
            return (
                settings.enabledPlugins?.[
                    'fast-jev-compaction@fast-jev-compaction'
                ] === true || 'not enabled at cclio scope'
            );
        },
        why: 'on test drive at cclio scope: compacts at 95 % keeping the last 10 messages; whether it fires SessionStart:compact is unmeasured',
    },
];

let red = 0;
for (const c of checks) {
    let verdict: string | true;
    try {
        verdict = c.run();
    } catch (err) {
        verdict = `could not run: ${(err as Error).message.split('\n')[0]}`;
    }
    if (verdict !== true) red++;
    console.log(
        `${verdict === true ? '🟢' : '🔴'} ${c.name}${verdict === true ? '' : ` — ${verdict}`}\n   why: ${c.why}`,
    );
}
spawnSync('trash', [scratch]);
console.log(
    red
        ? `\n🔴 ${red} red — no shift`
        : '\n🟢 all guards green — the shift may start',
);
process.exit(red ? 1 : 0);
