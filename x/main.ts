import { parseArgs } from 'node:util';

import { findVerb, globalFlags, usage, verbsUnder } from './registry.ts';
import type { Outcome, Verb } from './verb.ts';
import { Fail, exitCodes } from './verb.ts';

const bold = (text: string) => `\x1b[1m${text}\x1b[22m`;
const dim = (text: string) => `\x1b[2m${text}\x1b[22m`;

export function main(argv: string[]) {
    const isJson =
        argv.includes('--json') ||
        Boolean(process.env.CLAUDECODE || process.env.AI_AGENT) ||
        !process.stdout.isTTY;
    const firstFlag = argv.findIndex((arg) => arg.startsWith('-'));
    const words = firstFlag === -1 ? argv : argv.slice(0, firstFlag);
    const found = findVerb(words);
    const name = found?.verb.name ?? words.join(' ');
    const print = (envelope: Record<string, unknown>, human: string) => {
        const text = isJson
            ? JSON.stringify({
                  verb: name,
                  x: import.meta.dirname,
                  ...envelope,
              })
            : human;
        const stream = isJson || envelope.ok ? process.stdout : process.stderr;
        stream.write(`${text}\n`);
    };

    try {
        if (!found) return list(words, print);

        const outcome = dispatch(found.verb, argv.slice(found.depth), print);
        if (!outcome) return exitCodes.ok;
        if (outcome.status === 'ok') {
            print(
                { data: outcome.data, ok: true, status: 'ok' },
                lines(outcome.data),
            );
            return exitCodes.ok;
        }

        const next = confirmCommand(found.verb, argv.slice(found.depth));
        print(
            { next, ok: false, plan: outcome.plan, status: 'confirm' },
            `${lines(outcome.plan)}\n${bold('confirm:')} ${next}`,
        );
        return exitCodes.confirm;
    } catch (error) {
        const fail =
            error instanceof Fail
                ? error
                : new Fail(
                      String(error),
                      'report it to cclio with the stack below',
                  );
        if (!(error instanceof Fail))
            process.stderr.write(`${(error as Error).stack}\n`);
        const status = fail.isUsage ? 'usage' : 'failed';
        print(
            { error: fail.message, next: fail.next, ok: false, status },
            `x: ${fail.message}\n${bold('next:')} ${fail.next}`,
        );
        return exitCodes[status];
    }
}

function dispatch(
    verb: Verb,
    rest: string[],
    print: Print,
): Outcome | undefined {
    let parsed: ReturnType<typeof parseArgs>;
    try {
        parsed = parseArgs({
            allowPositionals: true,
            args: rest,
            options: globalFlags,
            strict: true,
        });
    } catch (error) {
        throw new Fail((error as Error).message, `x ${verb.name} --help`, true);
    }

    if (parsed.values.help) {
        print(
            {
                data: { purpose: verb.purpose, usage: usage(verb) },
                ok: true,
                status: 'ok',
            },
            [
                usage(verb),
                verb.purpose,
                '',
                ...verb.args.map(
                    (arg) => `  <${arg.name}>  ${dim(arg.description)}`,
                ),
                ...Object.entries(globalFlags).map(
                    ([flag, spec]) => `  --${flag}  ${dim(spec.description)}`,
                ),
            ].join('\n'),
        );
        return undefined;
    }

    const args = parsed.positionals;
    const required = verb.args.filter((arg) => !arg.isOptional);
    const isVariadic = verb.args.some((arg) => arg.isVariadic);
    if (
        args.length < required.length ||
        (!isVariadic && args.length > verb.args.length)
    )
        throw new Fail(
            `expected ${usage(verb)}`,
            `x ${verb.name} --help`,
            true,
        );

    return verb.run({ args, isApplied: parsed.values.apply === true });
}

function list(words: string[], print: Print) {
    const prefix = words.join(' ');
    const matched = verbsUnder(prefix);
    if (words.length > 0 && matched.length === 0)
        throw new Fail(`no verb or group named ${prefix}`, 'x --help', true);

    const groups = Object.groupBy(
        matched,
        (verb) => verb.name.split(' ')[0] ?? '',
    );
    const human = Object.entries(groups).map(([group, members = []]) =>
        [
            bold(group),
            ...members.map(
                (verb) => `  ${verb.name.padEnd(18)} ${dim(verb.purpose)}`,
            ),
        ].join('\n'),
    );
    print(
        {
            data: {
                groups: Object.fromEntries(
                    Object.entries(groups).map(([group, members = []]) => [
                        group,
                        members.map((verb) => ({
                            name: verb.name,
                            purpose: verb.purpose,
                        })),
                    ]),
                ),
            },
            ok: true,
            status: 'ok',
        },
        `${human.join('\n\n')}\n\n${dim('x <verb> --help · x schema <verb> for json')}`,
    );
    return exitCodes.ok;
}

function confirmCommand(verb: Verb, rest: string[]) {
    return ['x', verb.name, '--apply', ...rest.map(quote)].join(' ');
}

const quote = (arg: string) =>
    /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`;

const lines = (data: Record<string, unknown>) =>
    Object.entries(data)
        .map(
            ([key, value]) =>
                `${dim(key.padEnd(8))} ${typeof value === 'string' ? value : JSON.stringify(value)}`,
        )
        .join('\n');

if (import.meta.main) process.exitCode = main(process.argv.slice(2));

/* Types */
type Print = (envelope: Record<string, unknown>, human: string) => void;
