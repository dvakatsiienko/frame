// FRM-418: a prompt of dima's is groomed before it is folded, and a fold with no groom reds
// usage: node prompt-groom.ts <HH:MM> [--date YYYY-MM-DD]   cut the raw prompt, start composer if down, print the chore brief
//        node prompt-groom.ts --check <file…>               red each W-line stamped today with no groom (the halt: today's linear bodies)
import { execFileSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    readFileSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';

const home = process.env.HOME ?? '';
const promptDir =
    process.env.PROMPT_RAW_DIR ?? path.join(home, '.local/state/cclio/prompts');
const groomDir =
    process.env.PROMPT_GROOM_DIR ??
    path.join(home, '.local/state/cclio/grooms');
// the check binds folds made after it landed (dima's o61–o63, 2026-10-25)
const RULES_FROM = '2026-10-25 14:50';
const STAMP =
    /^\s*(?:[*-]\s+)?W\d+ \((\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}), dima\b/gm;

export type Groomed = (day: string, hhmm: string) => boolean;

export const groomFile = (day: string, hhmm: string, kind: 'raw' | 'groomed') =>
    path.join(groomDir, `${day}-${hhmm.replace(':', '')}.${kind}.md`);

export const groomedOnDisk: Groomed = (day, hhmm) => {
    const file = groomFile(day, hhmm, 'groomed');
    return existsSync(file) && statSync(file).size > 0;
};

export function ungroomedStamps(
    text: string,
    day: string,
    isGroomed: Groomed = groomedOnDisk,
) {
    const times = new Set<string>();
    for (const [, date, hhmm] of text.matchAll(STAMP))
        if (
            date === day &&
            hhmm &&
            `${date} ${hhmm}` >= RULES_FROM &&
            !isGroomed(day, hhmm)
        )
            times.add(hhmm);
    return [...times];
}

export function rawPromptAt(dayFile: string, hhmm: string) {
    const blocks = dayFile.split(/^## /m);
    const block = blocks.find((b) => b.startsWith(`${hhmm}\n`));
    return block?.slice(hhmm.length).trim() || undefined;
}

function composerUp() {
    const agents = JSON.parse(
        execFileSync('claude', ['agents', '--json'], { encoding: 'utf8' }),
    ) as {
        name?: string;
        status?: string;
    }[];
    return agents.some(
        (a) => a.name?.includes('composer') && a.status !== 'exited',
    );
}

function startComposer() {
    const skill = readFileSync(
        path.join(
            home,
            'frame/home/.claude/plugin-x/skills/crew-composer/SKILL.md',
        ),
        'utf8',
    ).replace(/^---\n[\s\S]*?\n---\n/, '');
    const cwd = path.join(home, '.local/state/composer');
    mkdirSync(cwd, { recursive: true });
    const settings = JSON.stringify({
        autoCompactWindow: 130000,
        env: { CLAUDE_CODE_DISABLE_CLAUDE_MDS: '1' },
        worktree: { bgIsolation: 'none' },
    });
    execFileSync(
        'claude',
        [
            '--bg',
            '-n',
            '🎼 composer',
            '--model',
            'haiku',
            '--effort',
            'medium',
            '--settings',
            settings,
            skill,
            '--remote-control',
        ],
        { cwd, stdio: 'inherit' },
    );
}

if (import.meta.main) {
    const args = process.argv.slice(2);
    if (args[0] === '--check') {
        const day = new Date().toLocaleDateString('sv');
        let red = 0;
        for (const file of args.slice(1)) {
            for (const hhmm of ungroomedStamps(
                readFileSync(file, 'utf8'),
                day,
            )) {
                red++;
                console.log(
                    `🔴 ${file}: W-lines of the ${hhmm} prompt folded with no groom — node script/prompt-groom.ts ${hhmm}, then refold from the groomed file`,
                );
            }
        }
        if (red === 0)
            console.log(
                `🟢 ${args.length - 1} file(s): every W-line stamped today was groomed`,
            );
        process.exitCode = red ? 1 : 0;
    } else {
        const hhmm = args[0] ?? '';
        const dateAt = args.indexOf('--date');
        const day =
            dateAt >= 0
                ? (args[dateAt + 1] ?? '')
                : new Date().toLocaleDateString('sv');
        const dayFile = path.join(promptDir, `${day}.md`);
        const raw = existsSync(dayFile)
            ? rawPromptAt(readFileSync(dayFile, 'utf8'), hhmm)
            : undefined;
        if (!/^\d{2}:\d{2}$/.test(hhmm) || !raw) {
            console.error(
                `no prompt of dima's at ${hhmm || '?'} in ${dayFile}`,
            );
            process.exit(1);
        }
        mkdirSync(groomDir, { recursive: true });
        const rawFile = groomFile(day, hhmm, 'raw');
        writeFileSync(rawFile, `${raw}\n`);
        if (!composerUp()) startComposer();
        console.log(
            `prompt-groom: dima's ${day} ${hhmm} prompt, raw text in ${rawFile}; groom it into numbered W-lines stamped «(${day} ${hhmm}, dima)», first number <N>, written to ${groomFile(day, hhmm, 'groomed')}`,
        );
    }
}
