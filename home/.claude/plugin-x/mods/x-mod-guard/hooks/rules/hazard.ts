import {
    ASK,
    type Command,
    type Context,
    type Refusal,
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
const LINEAR = 'linear closes, never deletes — cancel it (state Canceled)';
const DELETE = new Set(['delete', 'rm', 'remove']);
// op's global flags that take a value: `op --account a item delete` deletes
const OP_VALUED = new Set([
    '--account',
    '--cache',
    '--config',
    '--encoding',
    '--format',
    '--session',
]);
// railway's flags that take a value (`railway <cmd> --help`, 5.71.0, 2026-11-09): `railway -e prod environment delete x`
// deletes, and `railway -e delete logs` reads logs
const RAILWAY_VALUED = new Set([
    '--duplicate',
    '--environment',
    '--mount-path',
    '--name',
    '--project',
    '--service',
    '--volume',
    '-e',
    '-p',
    '-s',
]);
// the railway commands with a delete verb, aliases included (`railway <cmd> --help`, 2026-10-27); a sandbox's is `destroy`
const RAILWAY_DELETE = new Set([...DELETE, 'destroy']);
const RAILWAY_PARTS = new Set([
    'bucket',
    'buckets',
    'ca',
    'domain',
    'env',
    'environment',
    'flag',
    'flags',
    'fn',
    'fns',
    'func',
    'funcs',
    'function',
    'functions',
    'project',
    'projects',
    'sandbox',
    'sandboxes',
    'sbx',
    'service',
    'tcp-proxy',
    'var',
    'variable',
    'variables',
    'vars',
    'volume',
    'volumes',
]);
// the floor's remote half: system state past undoing, and a delete on a remote, past any trash
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
    const deviceWrite = c.writes.find((w) => w.startsWith('/dev/'));
    if (deviceWrite) return system('a redirect onto a device', [deviceWrite]);
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
    // `railway delete` takes the project, `railway down` the latest deploy, `railway <part> delete` one part;
    // `railway run rm` is a local command; a valued flag's value is never the slot
    const railOps =
        c.name === 'railway'
            ? operands(
                  c.args.filter(
                      (_, i) => !RAILWAY_VALUED.has(c.args[i - 1]?.text ?? ''),
                  ),
              )
            : [];
    const railwayAt =
        DELETE.has(railOps[0] ?? '') || railOps[0] === 'down'
            ? 0
            : RAILWAY_PARTS.has(railOps[0] ?? '') &&
                RAILWAY_DELETE.has(railOps[1] ?? '')
              ? 1
              : -1;
    if (c.name === 'railway' && railwayAt >= 0)
        return remote(
            `railway ${railOps.slice(0, railwayAt + 1).join(' ')}`,
            or(railOps.slice(railwayAt + 1), 'railway'),
        );
    const opOps =
        c.name === 'op'
            ? operands(
                  c.args.filter(
                      (_, i) => !OP_VALUED.has(c.args[i - 1]?.text ?? ''),
                  ),
              )
            : [];
    if (c.name === 'op' && DELETE.has(opOps[1] ?? ''))
        return remote(`op ${opOps[0]} ${opOps[1]}`, or(opOps.slice(2), 'op'));
    if (c.name === 'security' && /^delete-/.test(ops[0] ?? ''))
        return remote(`security ${ops[0]}`, [ops[0] ?? 'security']);
    if (c.name === 'linear' && ops[0] === 'issue' && DELETE.has(ops[1] ?? ''))
        return remote('linear issue delete', or(ops.slice(2), 'issue'), LINEAR);
    if (
        ['curl', 'linear', 'xh', 'http'].includes(c.name) &&
        c.args.some((w) => /\bissueDelete\b/.test(w.text))
    )
        return remote('an issueDelete mutation', ['issueDelete'], LINEAR);

    return undefined;
}
