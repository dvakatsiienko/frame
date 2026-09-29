import { parseArgs } from 'node:util';
import Color from 'colorjs.io';

import { readRoles, tokensShape } from './lib/roles.ts';

const usage = `design:contrast <tokens.json> — every fg and ui role on every bg

  WCAG 2 ratio decides pass/fail: fg (text) needs 4.5:1, ui needs 3:1.
  APCA Lc is advisory, printed beside it (text on bg; ~60 body, ~45 large, ~30 ui).
  exits 1 when any pair fails.

${tokensShape}`;

const minRatio = { fg: 4.5, ui: 3 } as const;

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
let failCount = 0;

for (const bg of roles.bg) {
    const background = new Color(bg.value);
    for (const group of ['fg', 'ui'] as const) {
        for (const role of roles[group]) {
            const text = new Color(role.value);
            const ratio =
                Math.floor(background.contrast(text, 'WCAG21') * 100) / 100;
            const lc = background.contrast(text, 'APCA');
            const isPass = ratio >= minRatio[group];
            if (!isPass) failCount++;
            const note =
                !isPass && group === 'fg' && ratio >= 3
                    ? '  large text only'
                    : '';
            console.log(
                `${isPass ? 'pass' : 'fail'}  ${`${role.name} on ${bg.name}`.padEnd(28)}` +
                    `${ratio.toFixed(2).padStart(5)}:1 (min ${minRatio[group]})  APCA Lc ${lc.toFixed(1).padStart(6)}${note}`,
            );
        }
    }
}

if (failCount > 0) {
    console.log(
        `\n${failCount} pair${failCount === 1 ? '' : 's'} under the WCAG minimum`,
    );
    process.exit(1);
}
