import { expect, test, vi } from 'vitest';

const exec = vi.fn();
vi.mock('herdr', () => ({ exec }));
const { linesWith } = await import('./join-io.js');

test.each([
    [
        'the lines that hold the words',
        { code: 0, stdout: 'a\nb\n' },
        ['a', 'b'],
    ],
    ['none: no line', { code: 1, stdout: '' }, []],
    ['a search error: could not be made', { code: 2, stdout: '' }, null],
])('a transcript search, %s', async (_what, out, lines) => {
    exec.mockResolvedValueOnce(out);
    expect(await linesWith('/t/a.jsonl', 'words')).toEqual(lines);
});

test('a search that never ran could not be made', async () => {
    exec.mockRejectedValueOnce(new Error('no grep'));
    expect(await linesWith('/t/a.jsonl', 'words')).toBeNull();
});
