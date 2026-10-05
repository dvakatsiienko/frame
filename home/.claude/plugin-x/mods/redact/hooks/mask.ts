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

// A text with every secret masked: its first six characters and `…‹redacted›` — no glob characters, since a masked
// prompt reaches the model and its shell (`[redacted]` broke a zsh echo in the live probe)
export function maskText(text: string): string {
    let out = text.replace(PRIVATE_KEY, '[redacted private key]');
    for (const re of SECRETS)
        out = out.replace(re, (m) => `${m.slice(0, 6)}…‹redacted›`);
    return out;
}

// Every string in a row's content masked; the same reference back when nothing changed.
export function maskDeep<T>(value: T): T {
    if (typeof value === 'string') {
        const masked = maskText(value);
        return (masked === value ? value : masked) as T;
    }
    if (Array.isArray(value)) {
        const next = value.map(maskDeep);
        return (next.some((v, i) => v !== value[i]) ? next : value) as T;
    }
    if (value && typeof value === 'object') {
        let changed = false;
        const next: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
            next[k] = maskDeep(v);
            if (next[k] !== v) changed = true;
        }
        return (changed ? next : value) as T;
    }
    return value;
}
