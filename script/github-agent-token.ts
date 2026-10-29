// prints a fresh github installation token for our github app `x-codie-cc` (app id 4873606).
//   pnpm github:agent-token [app]                      → token for the one installation (dvakatsiienko); app = x-codie-cc (default) | x-clio-cc
//   GH_TOKEN=$(pnpm --silent github:agent-token) gh api …    → every write renders as x-codie-cc[bot]
// the app's private key (base64 of the pem) + id live in the macos keychain as github-x-codie-cc-key / github-x-codie-cc-id
// (account x-codie-cc); the token caches in ~/.cache/github/x-codie-cc-token.json, re-minted when <10 min remain.
// flow: RS256 jwt signed with the app key (10 min) → POST /app/installations/<id>/access_tokens (1 h).
import { execFileSync } from 'node:child_process';
import { createSign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const app = process.argv[2] ?? 'x-codie-cc';
const cacheDir = join(homedir(), '.cache', 'github');
const cacheFile = join(cacheDir, `${app}-token.json`);

if (existsSync(cacheFile)) {
    const cached = JSON.parse(readFileSync(cacheFile, 'utf8'));
    if (cached.expiresAt - Date.now() > 10 * 60 * 1000) {
        process.stdout.write(cached.token);
        process.exit(0);
    }
}

const keychain = (service: string) =>
    execFileSync(
        'security',
        ['find-generic-password', '-a', app, '-s', service, '-w'],
        {
            encoding: 'utf8',
        },
    ).trim();

const b64url = (input: string | Buffer) =>
    Buffer.from(input).toString('base64url');

const now = Math.floor(Date.now() / 1000);
const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
const payload = b64url(
    JSON.stringify({
        exp: now + 540,
        iat: now - 60,
        iss: keychain(`github-${app}-id`),
    }),
);
const signer = createSign('RSA-SHA256');
signer.update(`${header}.${payload}`);
// the pem is stored base64-encoded: `security … -w` hex-mangles multi-line secrets on read
const privateKey = Buffer.from(
    keychain(`github-${app}-key`),
    'base64',
).toString('utf8');
const jwt = `${header}.${payload}.${b64url(signer.sign(privateKey))}`;

const gh = async (path: string, init: RequestInit = {}) => {
    const res = await fetch(`https://api.github.com${path}`, {
        ...init,
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${jwt}`,
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });
    if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
    return res.json();
};

const installations = (await gh('/app/installations')) as Installation[];
const installation = installations[0];
if (!installation) throw new Error(`${app} is installed nowhere`);

const minted = (await gh(
    `/app/installations/${installation.id}/access_tokens`,
    { method: 'POST' },
)) as Minted;

mkdirSync(cacheDir, { recursive: true });
writeFileSync(
    cacheFile,
    JSON.stringify({
        expiresAt: Date.parse(minted.expires_at),
        token: minted.token,
    }),
    {
        mode: 0o600,
    },
);
process.stdout.write(minted.token);

/* Types */
interface Installation {
    id: number;
    account: { login: string };
}
interface Minted {
    token: string;
    expires_at: string;
}
