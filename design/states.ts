import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const usage = `design:states <job> --ftr <FTR.md> [--takes <dir>] — which board shows which ftr state

  reads every board under ~/projects/studio/jobs/<job>/takes (or --takes <dir>), each board
  root's data-states="a, b", and the ftr's \`> states:\` lines. prints per state the boards that
  show it, then the states no board shows. a state matches without its (gloss), any case:
  data-states="narrow" shows \`narrow (<1100 px, the ring unrolled)\`.
  exits 0 every state drawn, 1 on a gap, 2 on an error.`;

const fail = (message: string): never => {
    console.error(`design:states: ${message}`);
    process.exit(2);
};

const { positionals, values } = (() => {
    try {
        return parseArgs({
            allowPositionals: true,
            options: {
                ftr: { type: 'string' },
                help: { short: 'h', type: 'boolean' },
                takes: { type: 'string' },
            },
        });
    } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
    }
})();
const [job] = positionals;
const takes =
    values.takes ??
    (job && join(homedir(), 'projects/studio/jobs', job, 'takes'));
if (values.help || !values.ftr || !takes) {
    console.log(usage);
    process.exit(values.help ? 0 : 2);
}
if (!existsSync(values.ftr)) fail(`no ftr at ${values.ftr}`);
if (!existsSync(takes)) fail(`no takes dir at ${takes}`);

const keyOf = (state: string) =>
    state
        .replace(/\s*\(.*\)$/, '')
        .trim()
        .toLowerCase();

const labels = readFileSync(values.ftr, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('> states:'))
    .flatMap((line) => line.slice('> states:'.length).split('·'))
    .map((state) => state.trim())
    .filter(Boolean);
if (labels.length === 0) fail(`no \`> states:\` line in ${values.ftr}`);
const states = Object.entries(Object.groupBy(labels, keyOf));

const boards = readdirSync(takes, { encoding: 'utf8', recursive: true })
    .filter((path) => path.endsWith('.html'))
    .sort()
    .map((path) => ({
        name: path.replace(/(\.dc)?\.html$/, ''),
        states: readFileSync(join(takes, path), 'utf8')
            .match(/data-states\s*=\s*(["'])(.*?)\1/)?.[2]
            ?.split(',')
            .map(keyOf),
    }));
if (boards.length === 0) fail(`no .html board under ${takes}`);

const missing: string[] = [];
for (const [key, [label] = []] of states) {
    const showing = boards
        .filter((board) => board.states?.includes(key))
        .map((board) => board.name);
    if (showing.length === 0) missing.push(label ?? key);
    console.log(`${label} — ${showing.join(', ') || 'no board'}`);
}

const unmarked = boards.filter((board) => !board.states);
if (unmarked.length > 0)
    console.log(
        `\nno data-states: ${unmarked.map((board) => board.name).join(', ')}`,
    );
if (missing.length > 0) {
    console.log(`\nmissing: ${missing.join(' · ')}`);
    process.exit(1);
}
console.log('\nevery state is on a board');
