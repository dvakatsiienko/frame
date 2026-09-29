import { format as formatPath, parse as parsePath } from 'node:path';
import { parseArgs } from 'node:util';
import { compare } from 'odiff-bin';

const usage = `design:diff <comp.png> <shot.png> — how far a build shot sits from its comp

  prints the share of differing pixels and writes <shot>.diff.png beside the shot, the
  differing pixels painted over it. both images must share one size (shoot at the comp's
  viewport). exits like diff(1): 0 identical, 1 different, 2 on an error.`;

const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { help: { short: 'h', type: 'boolean' } },
});
const [comp, shot] = positionals;
if (values.help || !comp || !shot) {
    console.log(usage);
    process.exit(values.help ? 0 : 2);
}

const { dir, name } = parsePath(shot);
const diffPath = formatPath({ dir, ext: '.png', name: `${name}.diff` });
const result = await compare(comp, shot, diffPath, {
    diffOverlay: true,
    noFailOnFsErrors: true,
}).catch((error: unknown) => {
    console.error(
        `cannot compare: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(2);
});

if (result.match) {
    console.log('diff 0% — identical');
    process.exit(0);
}
if (result.reason === 'pixel-diff') {
    console.log(
        `diff ${result.diffPercentage.toFixed(2)}% (${result.diffCount} px) → ${diffPath}`,
    );
    process.exit(1);
}
console.error(
    result.reason === 'layout-diff'
        ? 'the two images differ in size — shoot the build at the comp viewport'
        : `cannot read ${result.file} — missing, or not a png`,
);
process.exit(2);
