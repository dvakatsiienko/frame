import { expect, test } from 'claude-code/testing';

import { maskText } from '../hooks/mask.ts';

// planted fakes, shaped like the real thing and valid for nothing
const FAKES: [string, string][] = [
    ['an anthropic key', 'sk-ant-api03-FAKEfakeFAKEfakeFAKEfake0000'],
    ['an openai key', 'sk-proj-FAKEfakeFAKEfakeFAKEfake1111'],
    ['a github token', 'ghp_FAKEfakeFAKEfakeFAKEfakeFAKEfake0000'],
    [
        'a github fine-grained token',
        'github_pat_FAKEfakeFAKEfakeFAKEfake_FAKEfakeFAKEfakeFAKE00',
    ],
    ['a slack token', 'xoxb-1111-2222-FAKEfakeFAKE'],
    ['an aws key id', 'AKIAFAKEFAKEFAKEFAKE'],
    ['a linear key', 'lin_api_FAKEfakeFAKEfakeFAKEfakeFAKEfake00'],
    [
        'a 1password service token',
        'ops_FAKEfakeFAKEfakeFAKEfakeFAKEfakeFAKEfakeFAKE',
    ],
];
for (const [kind, secret] of FAKES)
    test(`masks ${kind}`, () => {
        expect(maskText(`token=${secret} done`)).toBe(
            `token=${secret.slice(0, 6)}…‹redacted› done`,
        );
    });

test('masks a private key block whole', () => {
    expect(
        maskText(
            'a\n-----BEGIN OPENSSH PRIVATE KEY-----\nFAKE\nFAKE\n-----END OPENSSH PRIVATE KEY-----\nb',
        ),
    ).toBe('a\n[redacted private key]\nb');
});

test('keeps a 1password reference readable', () => {
    const text = 'OPENAI_API_KEY=op://dev/openai-golden/credential';
    expect(maskText(text)).toBe(text);
});

test('a kept tool result is stored masked', async ($, on) => {
    const stored: unknown[] = [];
    // the harness keeps no rows: this hook sees what would be stored, and the missing store's error is ignored
    on('session.append', (_$, e, next) => {
        stored.push(e.message.content);
        return next(e);
    });
    await $.session
        .append({
            door: 'tool-result',
            message: {
                content: [
                    {
                        content:
                            'key: sk-ant-api03-FAKEfakeFAKEfakeFAKEfake0000',
                        tool_use_id: 't1',
                        type: 'tool_result',
                    },
                ],
                role: 'user',
                type: 'user',
            },
            origin: { kind: 'model', model: 'claude-opus-5-5' },
            uuid: 'u1',
        })
        .catch(() => undefined);
    expect(JSON.stringify(stored)).toMatch(/key: ‹sk-ant…[0-9a-f]{8}›/);
});
