// reads a raycast `.rayconfig` export and prints what it has bound inside.
//   node script/rayconfig-decrypt.ts <file.rayconfig> [--json]
// the passphrase comes from --password or $RAYCONFIG_PASSWORD, never from a literal here.
//
// the container, confirmed against this machine's own export (2026-09-18):
//   "RAYCFG3\n" · uint32le headerLength · gzip(header json) · ciphertext · 16-byte gcm tag
// the header is PLAINTEXT and carries the crypto parameters — iv and salt, 16 bytes each,
// hex — so the only secret is the passphrase. body = aes-256-gcm(gzip(payload json)) under
// scrypt(passphrase, salt, N=16384, r=8, p=1, 32). those scrypt parameters are node's own
// defaults, which is why the export is readable at all: raycast never picked its own.
//
// 📌 raycast writes a `.rayconfig` even when dima never set a passphrase — it generates one
// and files it in the login keychain, so an export is only as private as that keychain.
//
// ⚠️ the decrypted payload holds every extension's stored preferences in the clear, api keys
// among them. `--json` prints all of it; the default output prints chords and nothing else.

import { readFileSync, writeFileSync } from 'node:fs';

import { chordOf } from '../hotkeys/chord.ts';
import type { Hotkey } from '../hotkeys/manual.ts';
import { manualHotkeys } from '../hotkeys/manual.ts';
import { liveHotkeys } from '../hotkeys/stats.ts';
import {
    type ChordRow,
    type RayShortcut,
    boundTwice,
    commandNameOf,
    decryptExport,
    diffAgainstMap,
    dropHotkey,
    encryptExport,
    splitGhosts,
    toChord,
} from './lib/rayconfig.ts';

const [file] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const wantsJson = process.argv.includes('--json');
const dropName = flag('--drop-hotkey');
const password =
    flag('--password') ??
    process.env.RAYCONFIG_PASSWORD ??
    fail(
        'no passphrase. pass --password <p>, set RAYCONFIG_PASSWORD, or run this through\n' +
            '`script/op-run.sh`, which resolves it from op://dev/raycast-export/credential.\n' +
            '`pnpm rayconfig:decrypt` already does that.',
    );

if (!file)
    fail(
        'usage: node script/rayconfig-decrypt.ts <file.rayconfig> [--json] [--drop-hotkey <command>]',
    );

let opened: ReturnType<typeof decryptExport>;
try {
    opened = decryptExport(readFileSync(file), password);
} catch (error) {
    fail(`${file}: ${(error as Error).message}`);
}

const { header } = opened;
let payload = opened.payload;

// The one write this tool does. Everything the export carries is kept; the named command
// loses its binding and the result is sealed under a fresh iv and salt, beside the input.
if (dropName !== undefined) {
    const dropped = dropHotkey(payload, dropName);
    payload = dropped.payload;

    const clean = /\.rayconfig$/i.test(file)
        ? file.replace(/\.rayconfig$/i, '-clean.rayconfig')
        : `${file}-clean.rayconfig`;
    writeFileSync(clean, encryptExport({ header, password, payload }));

    console.log(
        `unbound ${dropped.removed.length}: ${dropped.removed.join(', ')}`,
    );
    console.log(`wrote ${clean}`);
    console.log('raycast does not read this on its own — import it by hand.');
    process.exit(0);
}

if (wantsJson) {
    process.stdout.write(payload);
    process.exit(0);
}

// Raycast's own ui refuses a chord that is already taken, so a duplicate is never something
// dima did: it is a settings row that outlived the command it configured.
const GHOST_NOTE = [
    '   raycast keeps one settings row per command id and prunes none when an extension stops',
    '   declaring that command. the export carries no manifest and no deletion marker — so a',
    '   row that outlived its command still reads as bound, and a chord claimed twice is the',
    '   only tell the file carries.',
].join('\n');

// Filled by toRow as it goes: a shortcut whose key this reader cannot name is said once at
// the end rather than rendered as a chord nobody can press.
const unnamed: string[] = [];

const data = JSON.parse(payload);

// A quicklink's command id ends in an opaque ulid, and the readable name lives in a different
// top-level section. Without this join the row prints as `01M2QTVQHX49S3WKZD88Y9E8BE`.
const quicklinkName = new Map<string, string>(
    (data.quicklinks?.quicklinks ?? []).map((link: RayQuicklink) => [
        link.id,
        link.name,
    ]),
);
const rowList = [
    ...toRow(data.settings?.general?.globalHotkey, 'raycast itself'),
    ...(data.settings?.commands ?? []).flatMap((command: RayCommand) =>
        toRow(command.macosHotkey, nameOf(command.id)),
    ),
];

// A named ghost is said once and then left out of every check below: it is a dead row, and
// counting it as a binding put a ⚠️ clash and a phantom «manual.ts lacks» row on every run.
const { ghosts, live } = splitGhosts(rowList);

// The first question — what does raycast bind that the map has never heard of — is asked against
// EVERY live row, because `app` in manual.ts names the app a binding DRIVES, not the store that
// holds it: the cleanshot rows are bound inside raycast's cleanshot extension, and filtering them
// out reported all eleven as missing from a map that has carried them all along.
const mapRowList = liveHotkeys(manualHotkeys).map(toMapRow);

// The second question is the reverse — what the map keeps and this export does not bind — and
// only a chord raycast could bind at all can answer it. macos's own shortcuts and 1password's
// live inside those apps, so an export not binding them is not a gap; they printed 18 rows of
// noise on every run.
const raycastStore = ['raycast', 'cleanshot'];
const storeRowList = liveHotkeys(manualHotkeys)
    .filter((hotkey) => raycastStore.includes(hotkey.app))
    .map(toMapRow);

console.log(
    `${header.exportedAt} · raycast ${header.appVersion} · schema ${header.schemaVersion}`,
);
console.log(`${live.length} bound:`);
for (const row of live) console.log(`  ${row.chord.padEnd(24)} ${row.action}`);

for (const ghost of ghosts)
    console.log(`\n👻 known ghost: ${ghost.chord} → ${ghost.action}`);
if (ghosts.length > 0) console.log(GHOST_NOTE);

for (const clash of boundTwice(live)) {
    console.log(
        `\n⚠️ bound twice: ${clash.chord} → ${clash.actions.join(', ')}`,
    );
    console.log(GHOST_NOTE);
}

report(
    'raycast binds, hotkeys/manual.ts lacks',
    diffAgainstMap(live, mapRowList).onlyInExport,
);
report(
    'hotkeys/manual.ts keeps, this export does not bind',
    diffAgainstMap(live, storeRowList).onlyInMap,
);

if (unnamed.length > 0)
    console.log(`\nkey shape this reader cannot name: ${unnamed.join(', ')}`);

/* Helpers */

function report(title: string, rows: readonly ChordRow[]) {
    if (rows.length === 0) {
        console.log(`\n${title}: none.`);
        return;
    }

    console.log(`\n${title} (${rows.length}):`);
    for (const row of rows)
        console.log(`  ${row.chord.padEnd(24)} ${row.action}`);
}
function toMapRow(hotkey: Hotkey) {
    return {
        action: `${hotkey.action} · ${hotkey.app}`,
        chord: chordOf(hotkey),
    };
}

function toRow(hotkey: RayHotkey | undefined, action: string) {
    const shortcut = hotkey?.kind?.shortcut;
    if (!shortcut) return [];

    const chord = toChord(shortcut);
    if (chord === null) {
        unnamed.push(action);
        return [];
    }

    return [{ action, chord }];
}

// A command id is a tagged path, and only its tail is readable: `::=::` fronts a target an
// app/quicklink/script row points at, `::-::` fronts the command name of an extension row.
// A target that is a file is worth only its basename — the rest is where it happens to live.
function nameOf(id: string) {
    const leaf = commandNameOf(id);

    return quicklinkName.get(leaf) ?? leaf;
}

function flag(name: string) {
    const at = process.argv.indexOf(name);
    return at === -1 ? undefined : process.argv[at + 1];
}

function fail(message: string): never {
    console.error(message);
    process.exit(1);
}

/* Types */
interface RayCommand {
    id: string;
    macosHotkey?: RayHotkey;
}
interface RayQuicklink {
    id: string;
    name: string;
}
interface RayHotkey {
    kind?: { shortcut?: RayShortcut };
}
