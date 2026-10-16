import { appendFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PORT = 4318;
const DATA_DIR = join(homedir(), '.local/share/x-cc-otel');
const SIGNALS = {
    '/v1/logs': 'logs',
    '/v1/metrics': 'metrics',
    '/v1/traces': 'traces',
} as const;

mkdirSync(DATA_DIR, { recursive: true });

function sessionOf(body: unknown): string | undefined {
    const match = JSON.stringify(body).match(
        /"key":"session\.id","value":\{"stringValue":"([^"]+)"/,
    );
    return match?.[1]?.slice(0, 8);
}

createServer((req, res) => {
    const signal = SIGNALS[req.url as keyof typeof SIGNALS];
    if (req.method !== 'POST' || !signal) {
        res.writeHead(404).end();
        return;
    }
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
        const received = new Date();
        let body: unknown;
        try {
            body = JSON.parse(Buffer.concat(chunks).toString());
        } catch {
            console.error(
                `${received.toISOString()} ${signal}: a body that is not json, dropped`,
            );
            res.writeHead(400).end();
            return;
        }
        const line = JSON.stringify({
            body,
            received: received.toISOString(),
            signal,
        });
        appendFileSync(
            join(DATA_DIR, `${received.toISOString().slice(0, 10)}.jsonl`),
            `${line}\n`,
        );
        console.log(`${signal} ← ${sessionOf(body) ?? 'no session'}`);
        res.writeHead(200, { 'content-type': 'application/json' }).end('{}');
    });
}).listen(PORT, '127.0.0.1');
