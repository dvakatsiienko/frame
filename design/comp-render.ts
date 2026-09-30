import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { parseArgs, promisify } from 'node:util';

import type { AddressInfo } from 'node:net';

const usage = `design:comp-render <project dir> <runtime.js> <out dir> — a Claude Design canvas's boards as pngs

  <project dir>  the canvas's project files: canvas.json + every *.dc.html (studio keeps them in
                 jobs/<app>/takes/project/)
  <runtime.js>   the canvas's own runtime, read fresh per canvas: Artifact read <canvas url>
                 with path artifact-type/dc-runtime.js — it is pinned per Design-type release
  <out dir>      one <board>.png per board, at the board's size from canvas.json

  --board <name>   render one board (file name without .dc.html)
  --props <json>   with --board: set the board's dials first, e.g. '{"edge":"lens"}' → <board>-edge-lens.png

  a board bug renders faithfully: the png is the comp, never a corrected comp. google fonts load
  from the network; offline, the faces fall back to system ones.`;

const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
        board: { type: 'string' },
        help: { short: 'h', type: 'boolean' },
        props: { type: 'string' },
    },
});
const [projectArg, runtimeArg, outArg] = positionals;
if (values.help || !projectArg || !runtimeArg || !outArg) {
    console.log(usage);
    process.exit(values.help ? 0 : 2);
}
const fail = (message: string): never => {
    console.error(`design:comp-render: ${message}`);
    process.exit(2);
};
if (values.props && !values.board) fail('--props needs --board');

const project = resolve(projectArg);
const runtime = readFileSync(resolve(runtimeArg));
const out = resolve(outArg);
const props: Record<string, unknown> = values.props
    ? JSON.parse(values.props)
    : {};

type Board = { h: number; w: number };
const canvas: { boards: Record<string, Board> } = JSON.parse(
    readFileSync(join(project, 'canvas.json'), 'utf8'),
);
const boards = Object.entries(canvas.boards)
    .map(([file, size]) => ({ name: file.replace(/\.dc\.html$/, ''), ...size }))
    .filter((board) => !values.board || board.name === values.board);
if (boards.length === 0) fail(`no board named ${values.board} in canvas.json`);

const types: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
};
const server = createServer((request, response) => {
    const path = decodeURIComponent(
        new URL(request.url ?? '/', 'http://x').pathname,
    );
    if (path === '/support.js') {
        response.writeHead(200, { 'content-type': types['.js'] }).end(runtime);
        return;
    }
    const file = join(project, path);
    if (!file.startsWith(project) || !existsSync(file)) {
        response.writeHead(404).end();
        return;
    }
    response.writeHead(200, {
        'content-type': types[extname(file)] ?? 'application/octet-stream',
    });
    response.end(readFileSync(file));
});
await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
const { port } = server.address() as AddressInfo;

const session = `comp-render-${process.pid}`;
const run = promisify(execFile);
const browser = (...args: string[]) =>
    run('agent-browser', ['--session', session, ...args]);
const settled =
    "document.fonts.status === 'loaded' && typeof window.__dcRootName === 'function' && !!window.__dcRootName()";
const suffix = Object.entries(props)
    .map(([key, value]) => `-${key}-${String(value)}`)
    .join('');

mkdirSync(out, { recursive: true });
try {
    for (const board of boards) {
        await browser('set', 'viewport', String(board.w), String(board.h));
        await browser('open', `http://127.0.0.1:${port}/${board.name}.dc.html`);
        await browser('wait', '--load', 'networkidle');
        await browser('wait', '--fn', settled);
        if (values.props) {
            await browser(
                'eval',
                `window.__dcSetProps(window.__dcRootName(), ${JSON.stringify(props)}); 'ok'`,
            );
            await browser('wait', '--fn', "document.fonts.status === 'loaded'");
        }
        await browser('wait', '600');
        const png = join(out, `${board.name}${suffix}.png`);
        await browser('screenshot', png);
        console.log(png);
    }
} finally {
    await browser('close');
    server.close();
}
