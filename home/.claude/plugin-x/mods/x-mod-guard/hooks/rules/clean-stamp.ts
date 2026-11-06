import { type Context, type Refusal, commandsDeep } from './command.ts';
import { commandWrites, pythonWrites } from './overwrite.ts';

const isStore = (text: string) =>
    /(^|\/)(\.claude|cc)\/shelf\/pr-verified\.json$/.test(text);
const isWatchPr = (text: string) => /(^|\/)watch-pr\.sh$/.test(text);
const RUNNERS = new Set(['bash', 'dash', 'ksh', 'sh', 'zsh', 'source', '.']);
const DESTINED = new Set(['cp', 'mv', 'ln', 'install', 'rsync', 'ditto']);
// a script handed inline: the parser sees one word, so a write call beside the store's name counts
const INLINE_WRITE =
    /\b(writeFile\w*|appendFile\w*|write_text|write_bytes|renameSync|copyFile\w*|dump)\s*\(|\bopen\([^)]*,\s*['"][wax]/;

// `merge-auto` reads this store as sixth sense's clean, so only sixth sense and the coordinator write it; the caller checks
// who runs the line. a script run by path writes unseen: a Bash rule reads the line, never what the line goes on to run
export function cleanStampWrite(
    command: string,
    cwd: string,
    ctx: Context = {},
): Refusal | undefined {
    const parsed = commandsDeep(command, cwd);
    const isStamp = parsed.some((c) => {
        const words = c.args.map((w) => w.text);
        const runsIt =
            isWatchPr(c.name) || (RUNNERS.has(c.name) && words.some(isWatchPr));
        return (
            runsIt &&
            words.some((w) => w === '--verified' || w.startsWith('--verified='))
        );
    });
    const isWrite =
        pythonWrites(command, cwd, ctx).some(isStore) ||
        (command.includes('.claude/shelf/pr-verified.json') &&
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
    if (!isStamp && !isWrite) return undefined;
    return {
        door: "sixth sense's clean, or the coordinator's stamp, through watch-pr.sh --verified in that session; ask the lane's sixth sense or clio",
        rule: 'clean-stamp',
        targets: ['pr-verified.json'],
        why: 'x lane merge-auto reads ~/.claude/shelf/pr-verified.json as the clean on a pr, so only sixth sense and the coordinator write it',
    };
}
