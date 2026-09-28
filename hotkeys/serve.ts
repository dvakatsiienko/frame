// The http side of the always-on hotkey daemon: it serves the chords build and the four
// endpoints that build needs. It lives in the daemon rather than beside the app because the
// daemon is the only thing already watching the press log and the config sources — a second
// process would duplicate both watchers to answer the same questions.
//
// Everything the old page could not do follows from being served instead of opened off disk:
// fetch works, so the seed scripts are gone; a note can be written to a file; and presses
// arrive as server-sent events, so the page holds no timer at all.
//
// 📌 Bound to every interface since daecf880, so a phone on the wi-fi opens the map — and so any
// machine on that network reaches these routes too. Reads stay open for the phone; every mutating
// route takes a write only from a loopback peer, which a machine on the network cannot fake the
// way it fakes an Origin. That still leaves the browser already running on this mac, which can
// POST to any localhost port from any page dima happens to have open. Since this server writes
// manual.ts and notes.json with no auth of any kind, every mutating route also demands
// `application/json` — a content type a cross-origin page cannot send without a preflight this
// server never answers — and refuses any Origin it does not serve. Anything running AS dima on
// this mac still has full access by design; that is the boundary.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, relative, resolve } from 'node:path';

import { warmAppNames } from './app-name.ts';
import { readLog } from './log.ts';
import type { Hotkey } from './manual.ts';
import {
    type ManualEdit,
    ManualEditError,
    type ManualMove,
    editManualText,
    moveManualText,
} from './manual-edit.ts';
import { type NoteInput, readNotes, saveNote } from './notes.ts';
import { chordsDevPort, chordsPort } from './ports.ts';
import { buildReport, isWindowName, windowDays } from './report.ts';
import { liveHotkeys } from './stats.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';

const DIST = join(import.meta.dirname, 'chords/dist');
const MANUAL = join(import.meta.dirname, 'manual.ts');
const SCAN_SNAPSHOT = join(import.meta.dirname, 'hotkeys.json');
const MAX_BODY = 64 * 1024;
// Both ports: vite proxies /api here without rewriting Origin, so the dev page's origin is the
// dev server's, not this one's.
const ALLOWED_ORIGINS = new Set(
    [chordsPort, chordsDevPort].flatMap((port) => [
        `http://localhost:${port}`,
        `http://127.0.0.1:${port}`,
    ]),
);

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

const MIME: Record<string, string> = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
};

export const startChordsServer = (options: ChordsServerOptions) => {
    const streams = new Set<ServerResponse>();
    let presses: PressPayload = { counts: {}, updatedAt: null };

    const emit = (event: string, data: unknown) => {
        const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

        for (const stream of streams) stream.write(frame);
    };

    const server = createServer((request, response) => {
        handle(request, response, {
            dataDir: options.dataDir,
            presses: () => presses,
            streams,
        }).catch((error: unknown) => {
            send(response, 500, { error: String(error) });
        });
    });

    // every interface, so a phone on the same wi-fi can open the map
    server.listen(chordsPort, '0.0.0.0', () => {
        console.log(`chords served on http://localhost:${chordsPort}`);
        // Off the request path: resolving a month of bundle ids is ~5s of synchronous mdfind,
        // and an always-on daemon should spend it once at boot rather than inside whichever
        // request happens to be first.
        void warmAppNames(
            readLog(options.dataDir).map((event) => event.app),
        ).then(() => console.log('app names resolved'));
    });

    return {
        pushBindings: () => emit('bindings', { at: new Date().toISOString() }),
        pushPresses: (next: PressPayload) => {
            presses = next;
            emit('presses', next);
        },
    };
};

/* Helpers */

const send = (response: ServerResponse, status: number, body: unknown) => {
    const text = JSON.stringify(body);

    response.writeHead(status, {
        'cache-control': 'no-store',
        'content-type': MIME['.json'] as string,
    });
    response.end(text);
};

const readBody = (request: IncomingMessage) =>
    new Promise<string>((done, fail) => {
        let text = '';

        request.on('data', (chunk: Buffer) => {
            text += chunk;
            // Nothing this api takes is large, and an unbounded body on a server that writes
            // files is a way to fill memory by accident.
            if (text.length > MAX_BODY) {
                fail(new Error('body too large'));
                request.destroy();
            }
        });
        request.on('end', () => done(text));
        request.on('error', fail);
    });

// A sentinel rather than a throw: a malformed body is an ordinary 400, and letting it reach the
// catch-all would answer it with a 500 carrying the parser's own message.
const BAD_JSON = Symbol('bad json');

const readJson = async (request: IncomingMessage): Promise<unknown> => {
    try {
        return JSON.parse(await readBody(request));
    } catch {
        return BAD_JSON;
    }
};

// The lock the header describes. A refusal names its reason, because a bare 403 is exactly the
// thing that costs an hour when the dev proxy's Origin turns out not to be the one you expected.
export const refuseMutation = (request: MutationRequest) => {
    // The peer address comes from the kernel, not from a header, so a machine on the wi-fi cannot
    // fake it the way it fakes an Origin. Reads stay open to the phone; writes are this mac's.
    if (!LOOPBACK.has(request.socket.remoteAddress ?? '')) {
        return 'writes are taken from this mac only';
    }

    // The media type alone. A real header carries `; charset=utf-8` after it, so the comparison
    // cannot be an equality against the whole string — but `startsWith` is the other mistake:
    // it accepts `application/jsonp` and anything else that opens with those sixteen characters.
    const mediaType = (request.headers['content-type'] ?? '')
        .split(';')[0]
        ?.trim()
        .toLowerCase();

    if (mediaType !== 'application/json') {
        return 'this endpoint takes application/json';
    }

    const origin = request.headers.origin;

    // No Origin at all is curl, or a same-origin request the browser did not label; both ours.
    if (origin !== undefined && !ALLOWED_ORIGINS.has(origin)) {
        return `origin ${origin} may not write here`;
    }

    return null;
};

// A control character ends a TypeScript string literal mid-line and takes the rest of manual.ts
// with it; no binding label has ever held one. Scanned by code point rather than by regex —
// biome bans a control character inside a pattern, including the pattern that looks for them.
const hasControlChar = (value: string) => {
    for (let at = 0; at < value.length; at += 1) {
        const code = value.charCodeAt(at);

        if (code < 0x20 || code === 0x7f) return true;
    }

    return false;
};

const isCleanString = (value: unknown): value is string =>
    typeof value === 'string' && !hasControlChar(value);

// Every one of these lands inside a literal in manual.ts, so every one is checked here rather
// than trusted three frames deeper, where the only answer left is a 500.
const manualEditError = (edit: unknown) => {
    const { from, to } = (edit ?? {}) as Partial<ManualEdit>;

    if (!(from && to)) return 'an edit needs a from and a to';
    if (![from.app, from.mods, from.key, from.action].every(isCleanString)) {
        return 'from needs app, mods, key and action, as strings with no control characters';
    }
    if (![to.mods, to.key, to.action].every(isCleanString)) {
        return 'to needs mods, key and action, as strings with no control characters';
    }

    return null;
};

// The rows manual.ts exports, freshly read: the ui's edit is checked against them before a
// single byte of that file moves. The mtime in the specifier is what gets past node's module
// cache — the file changes under this process on every edit and every hand edit.
const manualRows = async (): Promise<readonly Hotkey[]> => {
    const module = await import(`./manual.ts?at=${statSync(MANUAL).mtimeMs}`);

    return module.manualHotkeys as readonly Hotkey[];
};

// Two operations, one file. `edit` rewrites a row in place — a surface rename, or a chord that
// simply moved without the history mattering. `move` is the one dima asked for: the old meaning
// ends on today's date and a new one starts, so the presses already recorded stay with whatever
// earned them.
//
// The date is stamped here rather than taken from the body. A client's clock is not a fact this
// server should accept, and the whole point of the field is that it is trustworthy.
const applyManual = async (op: 'edit' | 'move', body: unknown) => {
    const text = readFileSync(MANUAL, 'utf8');
    const rows = await manualRows();
    const next =
        op === 'move'
            ? moveManualText(text, rows, {
                  ...(body as ManualMove),
                  on: new Date().toISOString().slice(0, 10),
              })
            : editManualText(text, rows, body as ManualEdit);

    writeFileSync(MANUAL, next);
};

const api = async (
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
    live: LiveState,
) => {
    if (url.pathname === '/api/hotkeys') {
        if (!existsSync(SCAN_SNAPSHOT)) {
            return send(response, 503, {
                error: 'no scan yet — run pnpm hotkeys:scan',
            });
        }

        const snapshot = JSON.parse(readFileSync(SCAN_SNAPSHOT, 'utf8'));

        // The board draws what is bound now. A row a move ended stays in the snapshot,
        // because /api/stats still needs it to explain the presses it earned — but drawn on
        // the keyboard it would read as a second live binding on a chord nobody holds.
        return send(response, 200, {
            ...snapshot,
            hotkeys: liveHotkeys(snapshot.hotkeys as Hotkey[]),
        });
    }

    if (url.pathname === '/api/notes') {
        if (request.method === 'GET') return send(response, 200, readNotes());

        if (request.method === 'PUT') {
            const refusal = refuseMutation(request);

            if (refusal) return send(response, 403, { error: refusal });

            const body = await readJson(request);

            if (body === BAD_JSON) {
                return send(response, 400, { error: 'body is not json' });
            }

            const note = (body ?? {}) as Partial<NoteInput>;

            // key and layer are structure — they build the id, so a control character in one
            // files the note where nothing will look for it. text is dima's prose in a
            // textarea: newlines are the point there, and json carries them fine.
            if (!isCleanString(note.key) || !isCleanString(note.layer)) {
                return send(response, 400, {
                    error: 'a note needs key and layer as plain strings',
                });
            }
            if (typeof note.text !== 'string') {
                return send(response, 400, { error: 'a note needs text' });
            }

            return send(response, 200, saveNote(note as NoteInput));
        }
    }

    if (url.pathname === '/api/manual' && request.method === 'POST') {
        const refusal = refuseMutation(request);

        if (refusal) return send(response, 403, { error: refusal });

        const body = await readJson(request);

        if (body === BAD_JSON) {
            return send(response, 400, { error: 'body is not json' });
        }

        const wrong = manualEditError(body);

        if (wrong) return send(response, 400, { error: wrong });

        const op = (body as { op?: unknown }).op ?? 'edit';

        if (op !== 'edit' && op !== 'move') {
            return send(response, 400, {
                error: "op must be 'edit' or 'move'",
            });
        }

        try {
            await applyManual(op, body);
        } catch (error) {
            if (error instanceof ManualEditError) {
                return send(response, 409, { error: error.message });
            }

            throw error;
        }

        // The daemon's own mtime watch reruns the scan and pushes `bindings` from there, so
        // nothing here tells the page what changed — one road in, one road out.
        return send(response, 200, { ok: true });
    }

    if (url.pathname === '/api/stats') {
        const asked = url.searchParams.get('window') ?? 'all';

        // An allowlist, not a parse: the value picks a branch and never reaches a file path.
        if (!isWindowName(asked)) {
            return send(response, 400, {
                error: `window must be one of ${Object.keys(windowDays).join(', ')}`,
            });
        }
        if (!existsSync(SCAN_SNAPSHOT)) {
            return send(response, 503, {
                error: 'no scan yet — run pnpm hotkeys:scan',
            });
        }

        const bindings = JSON.parse(readFileSync(SCAN_SNAPSHOT, 'utf8'))
            .hotkeys as Hotkey[];

        return send(
            response,
            200,
            buildReport(readLog(live.dataDir), bindings, asked),
        );
    }

    if (url.pathname === '/api/presses') {
        response.writeHead(200, {
            'cache-control': 'no-store',
            connection: 'keep-alive',
            'content-type': 'text/event-stream; charset=utf-8',
        });
        // Whatever the daemon knows right now, before any press lands: a page that opened
        // between two presses would otherwise draw an empty keyboard until dima typed.
        response.write(
            `event: presses\ndata: ${JSON.stringify(live.presses())}\n\n`,
        );
        live.streams.add(response);
        request.on('close', () => live.streams.delete(response));

        return;
    }

    return send(response, 404, { error: `no route for ${url.pathname}` });
};

const serveStatic = (response: ServerResponse, pathname: string) => {
    if (!existsSync(DIST)) {
        response.writeHead(503, { 'content-type': MIME['.html'] as string });

        return response.end(
            '<h1>chords is not built</h1><p>run <code>pnpm chords:build</code></p>',
        );
    }

    const wanted = resolve(DIST, `.${pathname}`);
    const inside = !relative(DIST, wanted).startsWith('..');
    // One page, so anything that is not a real file is the page — and anything outside dist
    // is someone walking up with ../, which gets the same answer as a typo.
    const file =
        inside && existsSync(wanted) && statSync(wanted).isFile()
            ? wanted
            : join(DIST, 'index.html');

    response.writeHead(200, {
        'cache-control': file.endsWith('index.html')
            ? 'no-store'
            : 'max-age=3600',
        'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    });
    response.end(readFileSync(file));
};

const handle = async (
    request: IncomingMessage,
    response: ServerResponse,
    live: LiveState,
) => {
    const url = new URL(request.url ?? '/', `http://localhost:${chordsPort}`);

    if (url.pathname.startsWith('/api/'))
        return api(request, response, url, live);

    return serveStatic(response, url.pathname);
};

/* Types */
export interface ChordsServerOptions {
    dataDir: string;
}
export interface PressPayload {
    counts: Record<string, number>;
    updatedAt: string | null;
}
type MutationRequest = Pick<IncomingMessage, 'headers'> & {
    socket: Pick<IncomingMessage['socket'], 'remoteAddress'>;
};
interface LiveState {
    dataDir: string;
    presses: () => PressPayload;
    streams: Set<ServerResponse>;
}
