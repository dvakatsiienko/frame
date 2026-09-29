import { parseArgs } from 'node:util';
import type { Color } from 'culori';
import {
    differenceCiede2000,
    filterDeficiencyDeuter,
    filterDeficiencyProt,
    filterDeficiencyTrit,
    parse,
} from 'culori';

import { readRoles, tokensShape } from './lib/roles.ts';

const minNormal = 15;
const minCvd = 8;

const usage = `design:cvd <tokens.json> — can every fg and ui role still be told apart

  CIEDE2000 ΔE between every pair of fg + ui roles, in normal vision and under full
  protanopia, deuteranopia and tritanopia. flags a pair under ${minNormal} in normal vision
  or under ${minCvd} in any cvd view. exits 1 when any pair is flagged.

${tokensShape}`;

const views = [
    { min: minNormal, name: 'normal', see: (color: Color) => color },
    { min: minCvd, name: 'protan', see: filterDeficiencyProt(1) },
    { min: minCvd, name: 'deutan', see: filterDeficiencyDeuter(1) },
    { min: minCvd, name: 'tritan', see: filterDeficiencyTrit(1) },
] as const;

const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { help: { short: 'h', type: 'boolean' } },
});
const [file] = positionals;
if (values.help || !file) {
    console.log(usage);
    process.exit(values.help ? 0 : 2);
}

const roles = readRoles(file);
const colored = [...roles.fg, ...roles.ui].map((role) => {
    const color = parse(role.value);
    if (!color)
        throw new Error(`${role.name}: cannot parse colour ${role.value}`);
    return { color, name: role.name };
});
const deltaE = differenceCiede2000();
let flagCount = 0;

console.log(
    `${'pair'.padEnd(34)}${views.map((view) => view.name.padStart(8)).join('')}`,
);
for (const [index, a] of colored.entries()) {
    for (const b of colored.slice(index + 1)) {
        const cells = views.map((view) => {
            const distance = deltaE(view.see(a.color), view.see(b.color));
            return { distance, isLow: distance < view.min };
        });
        const isFlagged = cells.some((cell) => cell.isLow);
        if (isFlagged) flagCount++;
        const row = cells
            .map((cell) =>
                `${cell.isLow ? '!' : ' '}${cell.distance.toFixed(1)}`.padStart(
                    8,
                ),
            )
            .join('');
        console.log(
            `${isFlagged ? 'flag' : '    '}  ${`${a.name} / ${b.name}`.padEnd(28)}${row}`,
        );
    }
}

if (flagCount > 0) {
    console.log(
        `\n${flagCount} pair${flagCount === 1 ? '' : 's'} too close (! marks the view)`,
    );
    process.exit(1);
}
