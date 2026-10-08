import {
    ASK,
    type Command,
    type Context,
    type Refusal,
    VAULT,
    hasFlag,
    operands,
    or,
    resolve,
} from './command.ts';

// frame and bytes: the two repos `x lane push` serves
export function isOwnRepo(dir: string, ctx: Context) {
    if (!ctx.home) return false;
    return [`${ctx.home}/frame`, `${ctx.home}/projects/bytes`].some(
        (r) => dir === r || dir.startsWith(`${r}/`),
    );
}
const ROOT_STEP = 'hand dima the step — these are his, in System Settings';
const PRUNE = 'leave the prune to dima — name it in your report';
const LINEAR = 'linear closes, never deletes — cancel it (state Canceled)';
const DELETE = new Set(['delete', 'rm', 'remove']);
// `~`, a dir above it, a dir right under it, or the obsidian vault root and above
function isTopDir(path: string, ctx: Context) {
    const home = ctx.home;
    if (path === '/' || !home) return path === '/';
    if (path === home || home.startsWith(`${path}/`)) return true;
    if (path.slice(0, path.lastIndexOf('/')) === home) return true;
    const parts = path.split('/');
    const at = parts.indexOf(VAULT);
    return at >= 0 && parts.length - at <= 3;
}
// past the floor: system state, prunes, remote deletes, a top dir or a whole defaults domain, and sudo
export function hazard(c: Command, ctx: Context): Refusal | undefined {
    const ops = operands(c.args);
    const dir = resolve(c.dir, '/', ctx);
    const system = (what: string, targets: string[], door = ASK): Refusal => ({
        door,
        rule: 'system',
        targets,
        why: `${what} changes the machine past undoing`,
    });
    if (c.name === 'diskutil' && /^erase/i.test(ops[0] ?? ''))
        return system(`diskutil ${ops[0]}`, or(ops.slice(1), 'diskutil'));
    const device = c.args.find(
        (w) =>
            w.text.startsWith('of=/dev/') &&
            !/^of=\/dev\/(null|std)/.test(w.text),
    );
    if (c.name === 'dd' && device)
        return system('dd onto a device', [device.text.slice(3)]);
    if (/^(mkfs|newfs)/.test(c.name)) return system(c.name, or(ops, c.name));
    if (
        (c.name === 'chmod' || c.name === 'chown') &&
        hasFlag(c.args, ['--recursive'], 'R')
    ) {
        const home = ops.filter((o) => {
            const p = resolve(o, dir, ctx);
            return (
                p === '/' || p === ctx.home || !!ctx.home?.startsWith(`${p}/`)
            );
        });
        if (home.length)
            return system(
                `${c.name} -R over home`,
                home,
                `${c.name} the one path you mean, never -R over ~`,
            );
    }
    if (c.name === 'csrutil' && ops[0] && ops[0] !== 'status')
        return system(`csrutil ${ops[0]}`, [ops[0]], ROOT_STEP);
    const gatekeeper = c.args.find(
        (w) => w.text === '--master-disable' || w.text === '--global-disable',
    );
    if (c.name === 'spctl' && gatekeeper)
        return system('spctl', [gatekeeper.text], ROOT_STEP);
    if (c.name === 'tccutil' && ops[0] === 'reset')
        return system('tccutil reset', or(ops.slice(1), 'reset'), ROOT_STEP);

    const prune = (what: string, target: string): Refusal => ({
        door: PRUNE,
        rule: 'prune',
        targets: [target],
        why: `${what} drops what dima may still want`,
    });
    if (c.name === 'brew' && ops[0] === 'cleanup')
        return prune('brew cleanup', 'cleanup');
    if (c.name === 'pnpm' && ops[0] === 'store' && ops[1] === 'prune')
        return prune('pnpm store prune', 'prune');
    if (c.name === 'docker' && ops[0] === 'system' && ops[1] === 'prune')
        return prune('docker system prune', 'prune');
    if (c.name === 'crontab' && hasFlag(c.args, [], 'r'))
        return prune('crontab -r', '-r');

    const remote = (what: string, targets: string[], door = ASK): Refusal => ({
        door,
        rule: 'remote-delete',
        targets,
        why: `${what} deletes on the remote, past any trash`,
    });
    if (
        c.name === 'gh' &&
        (ops[0] === 'repo' || ops[0] === 'release') &&
        /^delete/.test(ops[1] ?? '')
    )
        return remote(`gh ${ops[0]} ${ops[1]}`, or(ops.slice(2), ops[0]));
    const vercelAt = ops.slice(0, 2).findIndex((o) => DELETE.has(o));
    if (c.name === 'vercel' && vercelAt >= 0)
        return remote(
            `vercel ${ops.slice(0, vercelAt + 1).join(' ')}`,
            or(ops.slice(vercelAt + 1), 'vercel'),
        );
    if (c.name === 'op' && DELETE.has(ops[1] ?? ''))
        return remote(`op ${ops[0]} ${ops[1]}`, or(ops.slice(2), 'op'));
    if (c.name === 'security' && /^delete-/.test(ops[0] ?? ''))
        return remote(`security ${ops[0]}`, [ops[0] ?? 'security']);
    if (c.name === 'linear' && ops[0] === 'issue' && DELETE.has(ops[1] ?? ''))
        return remote('linear issue delete', or(ops.slice(2), 'issue'), LINEAR);
    if (
        ['curl', 'linear', 'xh', 'http'].includes(c.name) &&
        c.args.some((w) => /\bissueDelete\b/.test(w.text))
    )
        return remote('an issueDelete mutation', ['issueDelete'], LINEAR);

    const top =
        c.name === 'trash'
            ? ops.filter(
                  (o) =>
                      !o.includes('$') && isTopDir(resolve(o, dir, ctx), ctx),
              )
            : [];
    if (top.length)
        return {
            door: 'trash the files inside it, by name',
            rule: 'top-dir',
            targets: top,
            why: 'trash of a top dir takes everything under it at once',
        };
    const isGlobal = hasFlag(c.args, ['-g', '-globalDomain']);
    if (
        c.name === 'defaults' &&
        ops[0] === 'delete' &&
        ops.length - 1 < (isGlobal ? 1 : 2)
    )
        return {
            door: 'defaults delete <domain> <key> — one key, never the whole domain',
            rule: 'top-dir',
            targets: or(ops.slice(1), isGlobal ? '-g' : 'delete'),
            why: 'defaults delete of a domain drops every preference the app has',
        };
    const root = c.wrappers.find((w) => w === 'sudo' || w === 'doas');
    if (root)
        return {
            door: 'run it without sudo, or hand dima the command in a copy fence',
            rule: 'sudo',
            targets: [root],
            why: `${root} changes system state as root`,
        };
    return undefined;
}
