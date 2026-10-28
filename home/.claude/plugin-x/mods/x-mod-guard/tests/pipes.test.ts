import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

function world(on: On) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: true }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });
const lines = (context: readonly string[] | undefined, word: string) =>
    (context ?? []).filter((l) => l.includes(word));

// the && reads jq's exit, never the producer's: a failed gh api still reaches `echo ok`
const JQ_HIDES = [
    'gh api repos/x/y | jq .name && echo ok',
    'cd /repo && curl -sf https://e.com | jq -r .a && echo done',
] as const;
for (const typed of JQ_HIDES)
    test(`a pipe into jq before && runs with a pipestatus hint: ${typed}`, async ($, on) => {
        const w = world(on);
        const r = await bash($, typed);
        expect([w.ran, lines(r.context, 'pipestatus').length]).toEqual([
            [typed],
            1,
        ]);
    });

const JQ_FINE = [
    'gh api repos/x/y | jq .name',
    'jq .name a.json && echo ok',
    'set -o pipefail; gh api repos/x/y | jq .name && echo ok',
    'gh api repos/x/y | jq .name; echo done',
] as const;
for (const typed of JQ_FINE)
    test(`no pipestatus hint: ${typed}`, async ($, on) => {
        world(on);
        expect(lines((await bash($, typed)).context, 'pipestatus')).toEqual([]);
    });

// curl -s exits 0 on a 404 and hands its error page on as data
const CURL_SILENT = [
    'curl -s https://example.com | jq .',
    'curl -sSL https://example.com | head -5',
    'curl --silent https://example.com | jq .',
] as const;
for (const typed of CURL_SILENT)
    test(`a silent curl into a pipe runs with a curl -f hint: ${typed}`, async ($, on) => {
        const w = world(on);
        const r = await bash($, typed);
        expect([w.ran, lines(r.context, 'curl -f').length]).toEqual([
            [typed],
            1,
        ]);
    });

const CURL_FINE = [
    'curl -sf https://example.com | jq .',
    'curl -s --fail https://example.com | jq .',
    'curl -s --fail-with-body https://example.com | jq .',
    'curl -s https://example.com -o page.html',
    'curl https://example.com | jq .',
    "curl -s -w '%{http_code}' https://example.com | tail -1",
] as const;
for (const typed of CURL_FINE)
    test(`no curl -f hint: ${typed}`, async ($, on) => {
        world(on);
        expect(lines((await bash($, typed)).context, 'curl -f')).toEqual([]);
    });
