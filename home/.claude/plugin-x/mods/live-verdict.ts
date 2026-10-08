// mods:live's reload verdict, apart from the pty so a test can read it
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// what the engine loads: the hooks and the manifest; a save elsewhere (FTR.md, a test) reloads nothing
export function sourceHash(mod: string) {
    const hash = createHash('sha1');
    const manifest = join(mod, '.claude-plugin/plugin.json');
    if (existsSync(manifest)) hash.update(readFileSync(manifest));
    const hooks = join(mod, 'hooks');
    if (existsSync(hooks))
        for (const f of readdirSync(hooks, { recursive: true })
            .map(String)
            .sort())
            try {
                hash.update(f).update(readFileSync(join(hooks, f)));
            } catch {}
    return hash.digest('hex');
}

// the engine skips a module it already loaded unchanged, so «no new load» on a same-hash save is health, not a red
export function reloadVerdict(v: {
    isReloaded: boolean;
    isSame: boolean;
    line: string | undefined;
    name: string;
}) {
    if (v.isReloaded) return `reload ok: ${v.line}`;
    if (
        v.isSame &&
        v.line &&
        / loaded\b/.test(v.line) &&
        !/not loaded/.test(v.line)
    )
        return `reload ok: no hook changed, still loaded: ${v.line}`;
    return `reload error: the engine logged no load of ${v.name} in 8 s${v.line ? `; last: ${v.line}` : ''}`;
}
