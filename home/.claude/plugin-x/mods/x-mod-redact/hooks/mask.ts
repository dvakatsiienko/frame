// the shapes a live credential takes; a 1Password `op://` reference is not one
const SECRETS = [
    /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}/g,
    /\bgh[pousr]_[A-Za-z0-9]{30,}/g,
    /\bgithub_pat_[A-Za-z0-9_]{40,}/g,
    /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
    /\bAKIA[0-9A-Z]{16}\b/g,
    /\blin_api_[A-Za-z0-9]{30,}/g,
    /\bops_[A-Za-z0-9_-]{40,}/g,
];
const PRIVATE_KEY =
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
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
    let out = text.replace(PRIVATE_KEY, '[redacted private key]');
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
