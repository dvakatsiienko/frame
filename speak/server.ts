// the voice admin's server: the built page from dist/ and the api, on 127.0.0.1. no state of its own — config.json
// is the truth, the daemon's control socket is the only other door.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
    type IncomingMessage,
    type ServerResponse,
    createServer,
} from 'node:http';
import { createConnection } from 'node:net';
import { homedir } from 'node:os';
import { extname, join, normalize } from 'node:path';

import { speakPort } from './ports.ts';

const REPO = join(import.meta.dirname, '..');
const CONFIG = join(REPO, 'schedule/jobs/x-speak/config.json');
const DIST = join(import.meta.dirname, 'dist');
const SOCKET = join(homedir(), '.local/share/x-speak/control.sock');

// female only (dima's blind test). elevenlabs premades answered 200 on the restricted key; charlotte and aria are
// library voices (402). kokoro: every af_/bf_ voice answered on the warm server (2026-09-29)
const VOICES = {
    elevenlabs: [
        ['EXAVITQu4vr4xnSDxMaL', 'Sarah'],
        ['FGY2WhTYpPnrIDTdsKH5', 'Laura'],
        ['Xb7hH8MSUJpSbSDYk0k2', 'Alice'],
        ['XrExE9yKIg1WjnnlVkGX', 'Matilda'],
        ['cgSgspJ2msm6clMCkdW9', 'Jessica'],
        ['pFZP5JQG7iQjIQuC4Bku', 'Lily'],
    ],
    fish: [
        ['933563129e564b19a115bedd57b7406a', 'Sarah (en)'],
        ['fe8ba2d4555d457ba5fec0e86430c7fe', 'uk female'],
        ['2a1036d645634680b3cc69aeeb60375b', 'ru female'],
    ],
    gemini: [
        ['Kore', 'Kore'],
        ['Aoede', 'Aoede'],
        ['Leda', 'Leda'],
        ['Zephyr', 'Zephyr'],
    ],
    kokoro: [
        'af_heart',
        'af_bella',
        'af_nicole',
        'af_sarah',
        'af_sky',
        'af_nova',
        'af_river',
        'af_jessica',
        'af_alloy',
        'af_aoede',
        'af_kore',
        'bf_emma',
        'bf_isabella',
        'bf_alice',
        'bf_lily',
    ].map((id) => [id, id]),
} satisfies Record<string, string[][]>;

const TYPES: Record<string, string> = {
    '.css': 'text/css',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
};

function daemon(request: object) {
    return new Promise<Record<string, unknown>>((resolve) => {
        const socket = createConnection(SOCKET);
        let reply = '';
        socket.setTimeout(3000, () =>
            socket.destroy(new Error('the daemon did not answer in 3 s')),
        );
        socket.on('connect', () =>
            socket.write(`${JSON.stringify(request)}\n`),
        );
        socket.on('data', (chunk) => {
            reply += chunk;
        });
        socket.on('end', () => resolve(JSON.parse(reply || '{}')));
        socket.on('error', (error) =>
            resolve({ error: `x-speak is not reachable — ${error.message}` }),
        );
    });
}

async function body(request: IncomingMessage) {
    let text = '';
    for await (const chunk of request) text += chunk;
    return JSON.parse(text || '{}');
}

// the saved file is exactly what biome would write — formatted and its keys sorted — so a save never dirties the
// diff or trips the commit hook (a format-only save left favourites unsorted, and the hook refused dima's commit)
function biomeFormatted(value: unknown) {
    return execFileSync(
        join(REPO, 'node_modules/.bin/biome'),
        ['check', '--write', `--stdin-file-path=${CONFIG}`],
        {
            cwd: REPO,
            encoding: 'utf8',
            // indented in: biome keeps an object expanded when its input was, which is the committed shape
            input: JSON.stringify(value, null, 4),
        },
    );
}

function send(
    response: ServerResponse,
    status: number,
    payload: unknown,
    type = 'application/json',
) {
    response.writeHead(status, { 'content-type': type });
    response.end(
        type === 'application/json' ? JSON.stringify(payload) : payload,
    );
}

// dist/ only: a path that normalises outside it is a 404, never a read
function sendStatic(response: ServerResponse, url: string) {
    const file = normalize(
        join(
            DIST,
            url === '/'
                ? 'index.html'
                : decodeURIComponent(url.split('?')[0] ?? ''),
        ),
    );
    if (!(file.startsWith(`${DIST}/`) && existsSync(file)))
        return send(response, 404, { error: 'not found' });
    send(
        response,
        200,
        readFileSync(file),
        TYPES[extname(file)] ?? 'application/octet-stream',
    );
}

const routes: Record<string, (request: IncomingMessage) => Promise<unknown>> = {
    'GET /api/config': async () => JSON.parse(readFileSync(CONFIG, 'utf8')),
    'GET /api/status': async () => daemon({ op: 'status' }),
    'GET /api/voices': async () => ({
        ...VOICES,
        system: (await daemon({ op: 'voices' })).system ?? [],
    }),
    'POST /api/pause': async () => daemon({ op: 'pause' }),
    'POST /api/preview': async (request) =>
        daemon({ op: 'preview', ...(await body(request)) }),
    'POST /api/stop': async () => daemon({ op: 'stop' }),
    'PUT /api/config': async (request) => {
        writeFileSync(CONFIG, biomeFormatted(await body(request)));
        return daemon({ op: 'reload' });
    },
    // the daemon validates the saved file; a rejection comes back as its own log line
    // a ♥ lands at once and touches only that engine's favourites in the file on disk, so unsaved edits in the page
    // stay unsaved
    'PUT /api/favourites': async (request) => {
        const { engine, favourites } = await body(request);
        const config = JSON.parse(readFileSync(CONFIG, 'utf8'));
        config.engines[engine] = { ...config.engines[engine], favourites };
        writeFileSync(CONFIG, biomeFormatted(config));
        return daemon({ op: 'reload' });
    },
};

createServer(async (request, response) => {
    const route = routes[`${request.method} ${request.url}`];
    if (!route) {
        if (request.method === 'GET' && !request.url?.startsWith('/api/'))
            return sendStatic(response, request.url ?? '/');
        return send(response, 404, { error: 'not found' });
    }
    try {
        send(response, 200, await route(request));
    } catch (error) {
        send(response, 400, { error: (error as Error).message });
    }
}).listen(speakPort, '127.0.0.1', () =>
    console.log(`🔊 speak → http://127.0.0.1:${speakPort}`),
);
