import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { readTrace, scan, seatOf } from './ctx-init-trace.ts';

const AT = '2026-10-20T10:00:00.000Z';

const assistant = (
    sessionId: string,
    over: Record<string, unknown> = {},
    usage = {
        cache_creation_input_tokens: 40,
        cache_read_input_tokens: 50,
        input_tokens: 10,
    },
) =>
    JSON.stringify({
        isSidechain: false,
        message: { model: 'claude-opus-5-5', usage },
        sessionId,
        timestamp: AT,
        type: 'assistant',
        version: '2.1.309',
        ...over,
    });

const user = (text: string) =>
    JSON.stringify({
        isSidechain: false,
        message: { content: text },
        timestamp: AT,
        type: 'user',
    });

function fixture() {
    const root = mkdtempSync(path.join(tmpdir(), 'ctx-init-'));
    const projects = path.join(root, 'projects');
    const put = (dir: string, sid: string, lines: string[]) => {
        mkdirSync(path.join(projects, dir), { recursive: true });
        writeFileSync(
            path.join(projects, dir, `${sid}.jsonl`),
            lines.join('\n'),
        );
    };
    return { file: path.join(root, 'trace.jsonl'), projects, put };
}

describe('the init-context scan', () => {
    it('writes one row per session with its seat, model and init number', async () => {
        const f = fixture();
        f.put('-Users-dima-frame-cclio', 's1', [user('hi'), assistant('s1')]);
        await scan(f.file, f.projects);
        expect(readTrace(f.file)).toEqual([
            {
                at: AT,
                chars: 2,
                date: '2026-10-20',
                init: 100,
                model: 'claude-opus-5-5',
                seat: 'cclio',
                sid: 's1',
                version: '2.1.309',
            },
        ]);
    });

    it('adds nothing on a second run', async () => {
        const f = fixture();
        f.put('-Users-dima-frame', 's1', [user('hi'), assistant('s1')]);
        await scan(f.file, f.projects);
        await scan(f.file, f.projects);
        expect(readTrace(f.file).map((r) => r.sid)).toEqual(['s1']);
    });

    it('skips a fork, whose first entries carry another session id', async () => {
        const f = fixture();
        f.put('-Users-dima-frame', 'fork1', [user('hi'), assistant('parent')]);
        await scan(f.file, f.projects);
        expect(readTrace(f.file)).toEqual([]);
    });

    it('skips a sidechain entry and a synthetic model, and takes the next main entry', async () => {
        const f = fixture();
        f.put('-Users-dima-frame', 's1', [
            user('hi'),
            assistant('s1', { isSidechain: true }),
            assistant('s1', { message: { model: '<synthetic>', usage: {} } }),
            assistant(
                's1',
                {},
                {
                    cache_creation_input_tokens: 0,
                    cache_read_input_tokens: 0,
                    input_tokens: 7,
                },
            ),
        ]);
        await scan(f.file, f.projects);
        expect(readTrace(f.file).map((r) => r.init)).toEqual([7]);
    });

    it('keeps the length of the first message, which rides in the number', async () => {
        const f = fixture();
        f.put('-Users-dima-frame', 's1', [
            user('x'.repeat(800)),
            assistant('s1'),
        ]);
        await scan(f.file, f.projects);
        expect(readTrace(f.file)[0]?.chars).toBe(800);
    });
});

describe('a session names its seat', () => {
    it.each([
        ['-Users-dima-frame-cclio', 'hi', 'cclio'],
        ['-Users-dima--local-state-ccrow-plans-2026', 'hi', 'ccrow'],
        ['-Users-dima--local-state-composer', 'hi', 'composer'],
        ['-Users-dima-frame', 'hi', 'cc'],
        ['-Users-dima-frame', 'use the crew-coder skill', 'coder'],
        ['-Users-dima-bytes', '/x:crew-verifier FRM-1', 'verifier'],
        ['-Users-dima-bytes', 'hi', 'other'],
    ])('%s with «%s» is %s', (dir, first, seat) => {
        expect(seatOf(dir, first)).toBe(seat);
    });
});
