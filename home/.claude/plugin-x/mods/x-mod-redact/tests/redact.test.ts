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
    ).toBe('a\n‹redacted private key›\nb');
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

// built at run time, so no literal key sits in the file: a live redactor would mask the source too (engine.md)
const FAKE_KEY = ['sk', 'ant', 'api03', 'FAKEFAKEFAKEFAKEFAKE0000'].join('-');

test('a submitted prompt reaches the engine masked, before it is queued', async ($, on) => {
    const seen: string[] = [];
    on('prompt.submit', (_$, e) => {
        seen.push(e.text);
        return { text: e.text };
    });
    await $.prompt.submit({
        origin: { kind: 'composer' },
        text: `use ${FAKE_KEY} for the probe`,
        wait: false,
    });
    expect([
        seen.some((t) => t.includes(FAKE_KEY)),
        seen.some((t) => /‹sk-ant…[0-9a-f]{8}›/.test(t)),
    ]).toEqual([false, true]);
});

// R1 H4 and H6: shapes the first list missed, built by concatenation so no scanner reads a key in the repo
const F = 'FAKE0fake1FAKE2fake3FAKE4fake5FAKE6fake7FAKE8fake9';
const MORE: [string, string][] = [
    ['a stripe live key', `sk${'_live_'}${F.slice(0, 24)}`],
    ['a stripe restricted key', `rk${'_live_'}${F.slice(0, 24)}`],
    ['a slack app token', `xa${'pp-1-'}A0B1C2-1234-${F.slice(0, 20)}`],
    ['an npm token', `np${'m_'}${F.slice(0, 36)}`],
    ['a google api key', `AI${'za'}${F.slice(0, 35)}`],
    ['an aws session key id', `AS${'IA'}${'FAKE0FAKE1FAKE23'}`],
];
for (const [kind, secret] of MORE)
    test(`masks ${kind}`, () => {
        expect(maskText(`token=${secret} done`)).toBe(
            `token=${secret.slice(0, 6)}…‹redacted› done`,
        );
    });

test('masks a key glued after an underscore, the prefix kept', () => {
    const key = `sk${'-ant-'}${F.slice(0, 30)}`;
    expect(maskText(`KEY_${key}`)).toBe(`KEY_${key.slice(0, 6)}…‹redacted›`);
});

test('masks an aws secret by its key name', () => {
    const secret = `${F.slice(0, 20)}/+${F.slice(0, 18)}`;
    expect(maskText(`aws_secret_access_key = ${secret}`)).toBe(
        `aws_secret_access_key = ${secret.slice(0, 6)}…‹redacted›`,
    );
});

test('masks a pgp private key block whole, with no glob characters', () => {
    const block = `-----BEGIN PGP ${'PRIVATE'} KEY BLOCK-----\nxyz\n-----END PGP ${'PRIVATE'} KEY BLOCK-----`;
    expect(maskText(`a\n${block}\nb`)).toBe('a\n‹redacted private key›\nb');
});
