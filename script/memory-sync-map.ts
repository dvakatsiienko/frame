/**
 * memory-sync:map — prints what reaches cloud-chat from the cc masters: every `<!-- sync: cloud-chat -->` section,
 * grouped by master, with the chars it costs in dima's `account / profile / instructions` field and the room
 * left. read-only: renders in memory, writes nothing. `pnpm memory-sync:map`.
 */

/* Core */
import { homedir } from 'node:os';
import { join } from 'node:path';

/* Instruments */
import { render, target } from './lib/memory-sync-mirror.ts';
import { bold, dim, done, gb, step, title, yb } from './lib/print.ts';

const ROOT = join(homedir(), 'frame');
const num = (n: number) => n.toLocaleString('en-US').replaceAll(',', ' ');

const r = render(ROOT);
const share = r.chars / target.cap;
const BAR = 30;
const filled = Math.min(BAR, Math.round(share * BAR));
const bar = `${(share > 1 ? yb : gb)('█'.repeat(filled))}${dim('░'.repeat(BAR - filled))}`;

title(
    'memory-sync:map',
    'cc masters → cloud-chat · account / profile / instructions',
);

step('account / profile / instructions');
console.log(
    `  ${bar}  ${bold(`${num(r.chars)} / ${num(target.cap)}`)} chars  ${dim(`${Math.round(share * 100)}% · ${num(target.cap - r.chars)} free · stamp ${r.sha256.slice(0, 8)}`)}`,
);

const width = Math.max(...r.sections.map((s) => s.section.length), 0);
for (const file of [...new Set(r.sections.map((s) => s.file))]) {
    step(file.replace('home/.claude/', ''));
    for (const s of r.sections.filter((x) => x.file === file))
        console.log(
            `  ${gb('→')} ${s.section.padEnd(width)}  ${dim(num(s.chars).padStart(6))}`,
        );
}

done(
    `${r.sections.length} sections from ${new Set(r.sections.map((s) => s.file)).size} masters · route one with <!-- sync: cloud-chat --> under its heading`,
    { clean: r.chars <= target.cap },
);
