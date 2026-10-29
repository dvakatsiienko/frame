/**
 * skill:memory-sync-mirror — renders the `sync: cloud-chat` sections of the cc masters into the paste block
 * for dima's `account / profile / instructions` field, under `home/.claude/shelf/memory-sync-mirror/`, plus a
 * `manifest.json` carrying its stamp. cloud-chat's `x-cloud-chat:memory-update prettify` compares that stamp
 * with the field it sees. the routing table: `pnpm memory-sync:map`. logic lives in
 * `script/lib/memory-sync-mirror.ts`; routing lives in the masters as tags.
 */

/* Core */
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/* Instruments */
import { render, target, toManifest } from './lib/memory-sync-mirror.ts';
import { done, ok, step, title, warn } from './lib/print.ts';

const ROOT = join(homedir(), 'frame');
const OUT = join(ROOT, 'home/.claude/shelf/memory-sync-mirror');

title('skill:memory-sync-mirror', OUT.replace(homedir(), '~'));
mkdirSync(OUT, { recursive: true });

step('account / profile / instructions');
const r = render(ROOT);
writeFileSync(join(OUT, r.file), r.body);
writeFileSync(
    join(OUT, 'manifest.json'),
    `${JSON.stringify(toManifest(r), null, 4)}\n`,
);
const size = `${r.chars} / ${target.cap} chars · ${r.sections.length} sections · stamp ${r.sha256.slice(0, 8)}`;
const over = r.chars > target.cap;
if (over)
    warn(
        `${r.path}#${r.fragment}`,
        `${size} — ${r.chars - target.cap} over; the field refuses the paste`,
    );
else ok(`${r.path}#${r.fragment}`, size);

done(`${r.file} · manifest.json`, { clean: !over });
if (over) process.exit(1);
