import { type Context, type Refusal, commandsDeep } from './command.ts';
import { commandWrites, pythonWrites } from './overwrite.ts';

const isStore = (text: string) =>
    /(^|\/)\.claude\/shelf\/pr-verified\.json$/.test(text);
const isWatchPr = (text: string) => /(^|\/)watch-pr\.sh$/.test(text);
const SHELLS = new Set(['bash', 'sh', 'zsh']);
const DESTINED = new Set(['cp', 'mv', 'ln', 'install', 'rsync', 'ditto']);
// a script handed inline: the parser sees one word, so a write call beside the store's name counts
const INLINE_WRITE =
    /\b(writeFile\w*|appendFile\w*|write_text|renameSync|copyFile\w*)\s*\(/;

// `merge-auto` reads this store as sixth sense's clean, so only sixth sense and the coordinator write it; the caller checks
// who runs the line. a script run by path writes unseen: a Bash rule reads the line, never what the line goes on to run
export function cleanStampWrite(
    command: string,
    cwd: string,
    ctx: Context = {},
): Refusal | undefined {
    const parsed = commandsDeep(command, cwd);
    const stamps = parsed.some((c) => {
        const words = c.args.map((w) => w.text);
        const script = SHELLS.has(c.name)
            ? words.find((w) => !w.startsWith('-'))
            : c.name;
        return (
            script !== undefined &&
            isWatchPr(script) &&
            words.some((w) => w === '--verified' || w.startsWith('--verified='))
        );
    });
    const writes =
        pythonWrites(command, cwd, ctx).some(isStore) ||
        (isStore(command.match(/\S*pr-verified\.json/)?.[0] ?? '') &&
            INLINE_WRITE.test(command)) ||
        parsed.some((c) => {
            const words = c.args
                .map((w) => w.text)
                .filter((w) => !w.startsWith('-'));
            return [
                ...commandWrites(c, ctx),
                ...c.writes,
                ...c.appends,
                ...(c.name === 'tee' ? words : []),
                ...(DESTINED.has(c.name) ? words.slice(-1) : []),
            ].some(isStore);
        });
    if (!stamps && !writes) return undefined;
    return {
        door: "sixth sense's clean, or the coordinator's stamp, through watch-pr.sh --verified in that session; ask the lane's sixth sense or clio",
        rule: 'clean-stamp',
        targets: ['pr-verified.json'],
        why: 'x lane merge-auto reads ~/.claude/shelf/pr-verified.json as the clean on a pr, so only sixth sense and the coordinator write it',
    };
}
