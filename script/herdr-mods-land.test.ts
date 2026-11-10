import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    renameSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

const SCRIPT = join(import.meta.dirname, 'herdr-mods-land.ts');
const GOOD =
    'import { View, div } from "gpui-kit";\nexport default class P extends View { render() { return div().child("ok"); } }\n';

// a fixture frame source and a fixture herdr home, never dima's live folder; `herdr-app check` is stubbed, since the
// real one takes ~7 s through the window and no ci runner has it
function fixture() {
    const root = mkdtempSync(join(tmpdir(), 'herdr-mods-land-'));
    const source = join(root, 'source');
    const home = join(root, 'home');
    const bin = join(root, 'bin');
    mkdirSync(join(source, 'probe'), { recursive: true });
    mkdirSync(join(home, 'mods'), { recursive: true });
    mkdirSync(bin);
    writeFileSync(
        join(bin, 'herdr-app'),
        '#!/bin/sh\nif grep -q "not js" "$2/main.js"; then echo "syntax error"; exit 1; fi\n',
        { mode: 0o755 },
    );
    writeFileSync(join(source, 'probe/mod.json'), '{ "place": "none" }\n');
    writeFileSync(join(source, 'probe/main.js'), GOOD);
    writeFileSync(join(source, 'probe/main.test.ts'), 'test\n');
    const env = {
        ...process.env,
        HERDR_APP_HOME: home,
        HERDR_MODS_SOURCE: source,
        PATH: `${bin}:${process.env.PATH}`,
    };
    return { env, landed: join(home, 'mods/probe'), source };
}

const run = (env: NodeJS.ProcessEnv, ...args: string[]) =>
    spawnSync('node', [SCRIPT, ...args], {
        encoding: 'utf8',
        env,
        timeout: 10_000,
    });

describe('a land copies a mod into herdr', () => {
    test('a first land copies what herdr reads and leaves the tests in frame', () => {
        const { env, landed } = fixture();
        const out = run(env, 'probe');
        expect(out.status).toBe(0);
        expect(readFileSync(join(landed, 'main.js'), 'utf8')).toBe(GOOD);
        expect(existsSync(join(landed, 'main.test.ts'))).toBe(false);
    });

    test('a second land with nothing changed writes nothing', () => {
        const { env } = fixture();
        run(env, 'probe');
        expect(run(env, 'probe').stdout).toContain('nothing to write');
    });

    test('a dry land names the copy and writes nothing', () => {
        const { env, landed } = fixture();
        expect(run(env, 'probe', '--dry').stdout).toContain(
            'would copy main.js',
        );
        expect(existsSync(landed)).toBe(false);
    });
});

describe('the watcher lands a save only when herdr-app check passes', () => {
    let child: ChildProcess | undefined;
    afterEach(() => child?.kill());

    const watching = (env: NodeJS.ProcessEnv) => {
        child = spawn('node', [SCRIPT, '--watch', 'probe'], { env });
        let out = '';
        child.stdout?.on('data', (b) => {
            out += b;
        });
        const until = async (text: string, ms: number) => {
            for (let t = 0; t < ms && !out.includes(text); t += 50)
                await new Promise((r) => setTimeout(r, 50));
            return out;
        };
        return until;
    };

    test('a save that passes the check lands once', async () => {
        const { env, landed, source } = fixture();
        run(env, 'probe');
        const until = watching(env);
        await until('watching', 5000);
        const next = GOOD.replace('"ok"', '"saved"');
        writeFileSync(join(source, 'probe/main.js'), next);
        expect(await until('landed', 8000)).toContain(
            'probe landed, 1 file(s)',
        );
        expect(readFileSync(join(landed, 'main.js'), 'utf8')).toBe(next);
    });

    test('a save renamed over the file lands', async () => {
        const { env, landed, source } = fixture();
        run(env, 'probe');
        const until = watching(env);
        await until('watching', 5000);
        const next = GOOD.replace('"ok"', '"renamed"');
        writeFileSync(join(source, 'probe/.main.js.tmp'), next);
        renameSync(
            join(source, 'probe/.main.js.tmp'),
            join(source, 'probe/main.js'),
        );
        expect(await until('landed', 8000)).toContain(
            'probe landed, 1 file(s)',
        );
        expect(readFileSync(join(landed, 'main.js'), 'utf8')).toBe(next);
    });

    test('a broken save is held and never reaches herdr', async () => {
        const { env, landed, source } = fixture();
        const until = watching(env);
        await until('watching', 5000);
        writeFileSync(join(source, 'probe/main.js'), 'this is not js (\n');
        expect(await until('held', 8000)).toContain('probe held, check failed');
        expect(existsSync(join(landed, 'main.js'))).toBe(false);
    });
});
