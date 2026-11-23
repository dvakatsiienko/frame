import { commandsDeep } from './nested.ts';

// the thread and the role of a line that is one `x thread rename <thread> --role <role>` and nothing else
export function seatMove(command: string, cwd: string) {
    const all = commandsDeep(command, cwd);
    const [c] = all;
    if (!c || all.length !== 1 || !/(^|\/)x$/.test(c.name)) return undefined;
    const words = c.args.map((w) => w.text);
    const at = words.indexOf('thread');
    if (
        at < 0 ||
        words[at + 1] !== 'rename' ||
        !words.slice(0, at).every((w) => w.startsWith('-'))
    )
        return undefined;
    const rest = words.slice(at + 2);
    const flag = rest.findIndex((w) => w === '--role');
    const glued = rest.find((w) => w.startsWith('--role='));
    const role =
        flag >= 0
            ? rest[flag + 1]
            : glued?.slice('--role='.length) || undefined;
    const [thread, more] = rest.filter(
        (w, i) => !w.startsWith('-') && !(flag >= 0 && i === flag + 1),
    );
    return thread && role && more === undefined ? { role, thread } : undefined;
}
