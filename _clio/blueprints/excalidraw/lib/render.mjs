// node lib/render.mjs <board.excalidraw> : render.png beside it via the pinned @excalidraw/cli, then the wrap check.
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { openChrome } from './chrome.mjs';
import { resolveArg } from './geometry.mjs';
import { checkWraps } from './wrapcheck.mjs';

const CLI = new URL('../node_modules/.bin/excalidraw', import.meta.url)
    .pathname;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEADLINE_MS = 55000;

const renderPng = (board, png) =>
    new Promise((resolve, reject) => {
        const child = spawn(
            CLI,
            [
                'render',
                board,
                '--out',
                png,
                '--max-width',
                '16384',
                '--max-height',
                '16384',
                '--browser-path',
                CHROME,
                '--timeout',
                String(DEADLINE_MS),
            ],
            { stdio: ['ignore', 'pipe', 'pipe'] },
        );
        let log = '';
        child.stdout.on('data', (d) => {
            log += d;
        });
        child.stderr.on('data', (d) => {
            log += d;
        });
        child.on('close', (code) =>
            code === 0
                ? resolve(log)
                : reject(
                      new Error(
                          `excalidraw render exited ${code}: ${log.slice(-500)}`,
                      ),
                  ),
        );
    });

const main = async () => {
    const arg = process.argv[2];
    if (!arg)
        throw new Error('usage: pnpm --dir out render <board.excalidraw>');
    const board = resolveArg(arg);
    const png = join(dirname(board), 'render.png');
    const started = performance.now();
    await renderPng(board, png);
    const seconds = (performance.now() - started) / 1000;
    const { browser, page } = await openChrome();
    const { checked, past } = await checkWraps(
        JSON.parse(readFileSync(board, 'utf8')).elements,
        page,
    );
    await browser.close();
    console.log(`${png}: rendered in ${seconds.toFixed(1)} s`);
    console.log(
        `${past.length ? '🔴' : '✅'} ${past.length} of ${checked} bound texts past their container`,
    );
    for (const p of past.slice(0, 40)) console.log(`🔴 ${p}`);
    process.exit(past.length || seconds > 60 ? 1 : 0);
};

if (import.meta.url === `file://${process.argv[1]}`) await main();
