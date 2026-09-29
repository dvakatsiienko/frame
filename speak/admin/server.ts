// the voice admin: one page on 127.0.0.1:7386 that edits x-speak's config.json and previews through the running
// daemon. no state of its own — the file is the truth, the daemon's control socket is the only other door.
import { readFileSync, writeFileSync } from 'node:fs';
import {
    type IncomingMessage,
    type ServerResponse,
    createServer,
} from 'node:http';
import { createConnection } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PORT = 7386;
const CONFIG = join(
    import.meta.dirname,
    '../../schedule/jobs/x-speak/config.json',
);
const SOCKET = join(homedir(), '.local/share/x-speak/control.sock');
const PAGE = join(import.meta.dirname, 'index.html');

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

const routes: Record<string, (request: IncomingMessage) => Promise<unknown>> = {
    'GET /api/config': async () => JSON.parse(readFileSync(CONFIG, 'utf8')),
    'GET /api/status': async () => daemon({ op: 'status' }),
    'GET /api/voices': async () => ({
        ...VOICES,
        system: (await daemon({ op: 'voices' })).system ?? [],
    }),
    'POST /api/preview': async (request) =>
        daemon({ op: 'preview', ...(await body(request)) }),
    'POST /api/stop': async () => daemon({ op: 'stop' }),
    // written as the page built it; the daemon validates, and a rejection comes back as its own log line
    'PUT /api/config': async (request) => {
        writeFileSync(
            CONFIG,
            `${JSON.stringify(await body(request), null, 4)}\n`,
        );
        return daemon({ op: 'reload' });
    },
};

createServer(async (request, response) => {
    const route = routes[`${request.method} ${request.url}`];
    if (request.method === 'GET' && request.url === '/')
        return send(
            response,
            200,
            readFileSync(PAGE, 'utf8'),
            'text/html; charset=utf-8',
        );
    if (!route) return send(response, 404, { error: 'not found' });
    try {
        send(response, 200, await route(request));
    } catch (error) {
        send(response, 400, { error: (error as Error).message });
    }
}).listen(PORT, '127.0.0.1', () =>
    console.log(`🔊 x-speak admin → http://127.0.0.1:${PORT}`),
);
