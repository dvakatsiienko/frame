// Finds lost note text in Obsidian's File Recovery store (an IndexedDB leveldb).
// Reads a copy of the store, never the live one.
import {
    cpSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const storeDir = join(
    homedir(),
    'Library/Application Support/obsidian/IndexedDB/app_obsidian.md_0.indexeddb.leveldb',
);
const vaultDir = join(
    homedir(),
    "Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Dima's Vault",
);

const usage = `usage: pnpm notes-obsidian-recover <query> [--note <path inside the vault>]

Prints every distinct Obsidian File Recovery snapshot containing <query> (case-insensitive).
With --note, lists under each snapshot the lines absent from the live note file.`;

export function readVarint(
    buf: Uint8Array,
    start: number,
): [value: number, next: number] {
    let value = 0;
    let shift = 0;
    let i = start;
    while (true) {
        const byte = buf[i++] ?? 0;
        value += (byte & 0x7f) * 2 ** shift;
        shift += 7;
        if (byte < 0x80) return [value, i];
    }
}

function readLittleEndian(buf: Uint8Array, start: number, size: number) {
    let value = 0;
    for (let k = 0; k < size; k++)
        value += (buf[start + k] ?? 0) * 2 ** (8 * k);
    return value;
}

export function snappyDecompress(src: Uint8Array) {
    const [length, start] = readVarint(src, 0);
    const out = Buffer.alloc(length);
    let i = start;
    let o = 0;
    while (i < src.length) {
        const tag = src[i++] ?? 0;
        const kind = tag & 3;
        if (kind === 0) {
            const code = tag >> 2;
            let len = code + 1;
            if (code >= 60) {
                const extra = code - 59;
                len = readLittleEndian(src, i, extra) + 1;
                i += extra;
            }
            out.set(src.subarray(i, i + len), o);
            i += len;
            o += len;
            continue;
        }
        let len: number;
        let offset: number;
        if (kind === 1) {
            len = ((tag >> 2) & 7) + 4;
            offset = ((tag >> 5) << 8) | (src[i++] ?? 0);
        } else if (kind === 2) {
            len = (tag >> 2) + 1;
            offset = readLittleEndian(src, i, 2);
            i += 2;
        } else {
            len = (tag >> 2) + 1;
            offset = readLittleEndian(src, i, 4);
            i += 4;
        }
        for (let k = 0; k < len; k++, o++) out[o] = out[o - offset] ?? 0;
    }
    return out;
}

function readBlock(file: Buffer, offset: number, size: number) {
    const raw = file.subarray(offset, offset + size);
    return file[offset + size] === 1 ? snappyDecompress(raw) : raw;
}

function blockValues(block: Buffer) {
    const restartCount = block.readUInt32LE(block.length - 4);
    const end = block.length - 4 - 4 * restartCount;
    const values: Buffer[] = [];
    let i = 0;
    while (i < end) {
        let skip: number;
        let valueLength: number;
        [, i] = readVarint(block, i);
        [skip, i] = readVarint(block, i);
        [valueLength, i] = readVarint(block, i);
        i += skip;
        values.push(block.subarray(i, i + valueLength));
        i += valueLength;
    }
    return values;
}

// every decompressed data block of an sstable
function tableBlocks(file: Buffer) {
    const footer = file.subarray(file.length - 48);
    const [, afterMetaOffset] = readVarint(footer, 0);
    const [, afterMetaSize] = readVarint(footer, afterMetaOffset);
    const [indexOffset, afterIndexOffset] = readVarint(footer, afterMetaSize);
    const [indexSize] = readVarint(footer, afterIndexOffset);
    return blockValues(readBlock(file, indexOffset, indexSize)).map(
        (handle) => {
            const [offset, next] = readVarint(handle, 0);
            const [size] = readVarint(handle, next);
            return readBlock(file, offset, size);
        },
    );
}

const utf16Run = /(?:(?!�)(?:[\p{L}\p{N}\p{P}\p{S}\p{M} \n\t]|‍))+/gu;
const utf8Run = /[\t\n\r\x20-\x7e\x80-\xff]{40,}/g;

export function extractRuns(buf: Buffer) {
    const runs: string[] = [];
    for (const align of [0, 1]) {
        const evenLength = buf.length - ((buf.length - align) % 2);
        const text = buf.subarray(align, evenLength).toString('utf16le');
        for (const [run] of text.matchAll(utf16Run)) {
            if (run.length >= 24 && /[a-z]{4}/.test(run)) runs.push(run);
        }
    }
    for (const [run] of buf.toString('latin1').matchAll(utf8Run)) {
        const text = Buffer.from(run, 'latin1').toString('utf8');
        if (/[a-z]{4}/.test(text)) runs.push(text);
    }
    return runs;
}

function normalize(text: string) {
    return text.replace(/\s+/g, ' ').trim();
}

export function missingLines(snapshot: string, live: string) {
    const liveText = normalize(live);
    return snapshot
        .split('\n')
        .map((line) => line.trim())
        .filter(
            (line) => line.length > 12 && !liveText.includes(normalize(line)),
        );
}

function readSnapshots(query: string) {
    const copyDir = mkdtempSync(join(tmpdir(), 'obsidian-recover-'));
    try {
        cpSync(storeDir, copyDir, { recursive: true });
        const needle = query.toLowerCase();
        const found = new Set<string>();
        for (const name of readdirSync(copyDir)) {
            if (!name.endsWith('.ldb') && !name.endsWith('.log')) continue;
            const file = readFileSync(join(copyDir, name));
            const chunks = name.endsWith('.ldb') ? tableBlocks(file) : [file];
            for (const chunk of chunks) {
                for (const run of extractRuns(chunk)) {
                    if (run.toLowerCase().includes(needle)) found.add(run);
                }
            }
        }
        return [...found];
    } finally {
        rmSync(copyDir, { force: true, recursive: true });
    }
}

function parse(argv: string[]) {
    try {
        return parseArgs({
            allowPositionals: true,
            args: argv,
            options: {
                help: { type: 'boolean' },
                note: { type: 'string' },
            },
        });
    } catch (error) {
        console.error(
            `${error instanceof Error ? error.message : error}\n${usage}`,
        );
        return null;
    }
}

function run(argv: string[]) {
    const parsed = parse(argv);
    if (!parsed) return 2;
    if (parsed.values.help) {
        console.log(usage);
        return 0;
    }
    const [query, ...rest] = parsed.positionals;
    if (!query || rest.length > 0) {
        console.error(usage);
        return 2;
    }
    const live = parsed.values.note
        ? readFileSync(join(vaultDir, parsed.values.note), 'utf8')
        : null;
    const snapshots = readSnapshots(query);
    if (snapshots.length === 0) console.log(`no snapshot contains «${query}»`);
    snapshots.forEach((snapshot, index) => {
        console.log(
            `── snapshot ${index + 1} · ${snapshot.length} chars\n${snapshot}`,
        );
        if (live !== null) {
            const missing = missingLines(snapshot, live);
            if (missing.length === 0) console.log('  nothing missing');
            for (const line of missing) console.log(`  missing: ${line}`);
        }
        console.log();
    });
    return 0;
}

if (import.meta.main) process.exit(run(process.argv.slice(2)));
