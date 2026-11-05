// the shapes a live credential takes; a 1Password `op://` reference is not one
// a key starts where no letter or digit sits before it: `\b` misses one glued after `_` (`KEY_sk-ant-…`)
const SECRETS = [
    /(?<![A-Za-z0-9])sk-(?:ant-)?[A-Za-z0-9_-]{20,}/g,
    /(?<![A-Za-z0-9])[sr]k_live_[A-Za-z0-9]{20,}/g,
    /(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{30,}/g,
    /(?<![A-Za-z0-9])github_pat_[A-Za-z0-9_]{40,}/g,
    /(?<![A-Za-z0-9])xox[abprs]-[A-Za-z0-9-]{10,}/g,
    /(?<![A-Za-z0-9])xapp-\d-[A-Za-z0-9-]{10,}/g,
    /(?<![A-Za-z0-9])(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    /(?<=aws_secret_access_key["']?\s*[=:]\s*["']?)[A-Za-z0-9/+]{40}(?![A-Za-z0-9/+])/gi,
    /(?<![A-Za-z0-9])lin_api_[A-Za-z0-9]{30,}/g,
    /(?<![A-Za-z0-9])ops_[A-Za-z0-9_-]{40,}/g,
    /(?<![A-Za-z0-9])npm_[A-Za-z0-9]{36}(?![A-Za-z0-9])/g,
    /(?<![A-Za-z0-9])AIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])/g,
];
// an ssh, pem or pgp private key, armour to armour
const PRIVATE_KEY =
    /-----BEGIN [A-Z ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY(?: BLOCK)?-----/g;
const PLACEHOLDER = /‹[^‹›\n]{1,6}…[0-9a-f]{8}›/g;

// placeholder → secret, for one session
export type Vault = Record<string, string>;

function fnv1a(text: string) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
}

// no glob characters: the model writes a placeholder into shell commands (`[redacted]` broke a zsh echo in the live probe)
export const placeholderOf = (secret: string) =>
    `‹${secret.slice(0, 6)}…${fnv1a(secret)}›`;

// A text with every secret masked one way: its first six characters and `…‹redacted›`.
export function maskText(text: string): string {
    let out = text.replace(PRIVATE_KEY, '‹redacted private key›');
    for (const re of SECRETS)
        out = out.replace(re, (m) => `${m.slice(0, 6)}…‹redacted›`);
    return out;
}

// A text with every secret swapped for its placeholder, each new one added to `vault`; a placeholder taken by another value masks one way.
export function redactText(text: string, vault: Vault): string {
    const swap = (secret: string) => {
        const tag = placeholderOf(secret);
        const held = vault[tag];
        if (held !== undefined && held !== secret)
            return `${secret.slice(0, 6)}…‹redacted›`;
        vault[tag] = secret;
        return tag;
    };
    let out = text.replace(PRIVATE_KEY, swap);
    for (const re of SECRETS) out = out.replace(re, swap);
    return out;
}

// A text with every placeholder the vault holds swapped back for its secret; one it does not hold stays as written.
export const restoreText = (text: string, vault: Vault) =>
    text.replace(PLACEHOLDER, (tag) => vault[tag] ?? tag);

// Every string in a value passed through `fn`; the same reference back when nothing changed.
export function mapStrings<T>(value: T, fn: (text: string) => string): T {
    if (typeof value === 'string') {
        const next = fn(value);
        return (next === value ? value : next) as T;
    }
    if (Array.isArray(value)) {
        const next = value.map((v) => mapStrings(v, fn));
        return (next.some((v, i) => v !== value[i]) ? next : value) as T;
    }
    if (value && typeof value === 'object') {
        let changed = false;
        const next: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
            next[k] = mapStrings(v, fn);
            if (next[k] !== v) changed = true;
        }
        return (changed ? next : value) as T;
    }
    return value;
}
