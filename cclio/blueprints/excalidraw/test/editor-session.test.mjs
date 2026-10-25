// The real editor, real mouse: one tile dragged 40 px, one text edited, one 💬 added; then read-back prints those three.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { openChrome } from '../lib/chrome.mjs';
import { openEditor } from '../lib/editor-session.mjs';
import { diffBoards } from '../lib/read-back.mjs';

const BOARD = new URL('../crew-pm-flow/board.excalidraw', import.meta.url)
    .pathname;
const MOVED = 'tf-b3-free';
const EDITED = '3:281-t0';
const NOTE = '💬 does this need an owner?';
const json = readFileSync(BOARD, 'utf8');
const before = JSON.parse(json).elements;
let chrome;

beforeAll(async () => {
    chrome = await openChrome();
}, 60000);
afterAll(() => chrome.browser.close());

const session = async () => openEditor(await chrome.browser.newPage(), json);

test('open and save with no edit reads back as nothing', async () => {
    const editor = await session();
    const after = JSON.parse(await editor.save()).elements;
    expect(diffBoards(before, after)).toEqual([]);
}, 120000);

test('a drag, a text edit and a new note read back as exactly those three changes', async () => {
    const editor = await session();
    await editor.drag(MOVED, 40);
    await editor.editText(EDITED, '📋 7 · the brief file');
    await editor.addNote(-600, 400, NOTE);
    const saved = await editor.save();
    const lines = diffBoards(before, JSON.parse(saved).elements);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(new RegExp(`^moved ${MOVED} by 40, 0 \\(with `));
    expect(lines[1]).toBe(
        `text ${EDITED} (tile 3:281): "${collapsed(before, EDITED)}" → "📋 7 · the brief file"`,
    );
    expect(lines[2]).toBe(`note added: "${NOTE}"`);

    const beforeFile = join(tmpdir(), 'rb-before.excalidraw');
    const afterFile = join(tmpdir(), 'rb-after.excalidraw');
    writeFileSync(beforeFile, json);
    writeFileSync(afterFile, saved);
    const cli = execFileSync(
        'node',
        [
            new URL('../lib/read-back.mjs', import.meta.url).pathname,
            beforeFile,
            afterFile,
        ],
        { encoding: 'utf8' },
    );
    expect(cli.trim().split('\n')).toEqual(lines);
}, 180000);

const collapsed = (els, id) =>
    els
        .find((e) => e.id === id)
        .text.replace(/\s+/g, ' ')
        .trim();
