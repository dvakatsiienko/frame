// pnpm mods:live <mod> — a dev server for a mod: a real cc session in a pty with the mod loaded, a text frame of its
// screen after every save, and a reload verdict; it prints one `mods:live ready:` line once the first frame draws.
// pnpm mods:live <mod> hover <label> moves the pointer onto a label in the running session and saves the frame with
// its hover card; click <label> presses it; type <text> types the text and Enter into the prompt (a prompt, or a slash
// command such as /board); fill <text> types it with no Enter; status names the pid and session holding the slot.
import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    existsSync,
    mkdirSync,
    readFileSync,
    renameSync,
    rmSync,
    statSync,
    watch,
    writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import xterm from '@xterm/headless';
import pty from 'node-pty';

import { type LiveVerb, parseLive } from './live-args.ts';
import { plantedCopy } from './live-plant.ts';
import { reloadVerdict, sourceHash } from './live-verdict.ts';
import { liveDirs, manifestName, swapDir } from './probe.ts';

const COLS = 140;
const ROWS = 40;
const QUIET_MS = 600;
const RELOAD_MS = 8000;
// a typed prompt answers only once its turn quiets down
const ACT_MS = 60_000;

const args = parseLive(process.argv.slice(2));
if (args.kind === 'usage') {
    console.error(
        'usage: pnpm mods:live <mod dir>, or … hover|click <label>, … type|fill <text>, … status, or --plant <file> <anchor> <replacement>',
    );
    process.exit(2);
}
// the scratch dir a --plant made; the serve removes it when the session ends
let plantRoot: string | undefined;
const modArg = args.kind === 'plant' ? planted(args) : args.mod;
const mod = resolve(modArg);
const manifest = join(mod, '.claude-plugin/plugin.json');
if (!existsSync(manifest)) {
    console.error(`mods:live: ${mod} has no .claude-plugin/plugin.json`);
    process.exit(2);
}
const name = (JSON.parse(readFileSync(manifest, 'utf8')) as { name: string })
    .name;
const dir = join(tmpdir(), 'mods-live', name);
const pidFile = join(dir, 'server.pid');
// who holds the slot: the server's pid, the cc session's pid and name, since when
const slotFile = join(dir, 'slot.json');
const request = join(dir, 'hover.request');
const response = join(dir, 'hover.response');

const isServing = () => {
    if (!existsSync(pidFile)) return false;
    try {
        process.kill(Number(readFileSync(pidFile, 'utf8')), 0);
        return true;
    } catch {
        return false;
    }
};

if (args.kind === 'act') await act(args.verb, args.text);
else if (args.kind === 'status') status();
else await serve();

// the scratch copy a --plant serves; a refused anchor ends the run before any session starts
function planted(a: { file: string; anchor: string; replacement: string }) {
    try {
        const p = plantedCopy(a.file, a.anchor, a.replacement);
        console.log(
            `mods:live: planted a change in ${p.file}; the tree is untouched`,
        );
        plantRoot = p.root;
        return p.mod;
    } catch (e) {
        console.error(`mods:live: ${(e as Error).message}`);
        process.exit(2);
    }
}

function status() {
    if (!isServing()) {
        console.log(`mods:live: ${name}'s slot is free`);
        process.exit(1);
    }
    const slot = existsSync(slotFile)
        ? (JSON.parse(readFileSync(slotFile, 'utf8')) as Record<
              string,
              unknown
          >)
        : {};
    console.log(
        `mods:live: ${name} is held by pid ${readFileSync(pidFile, 'utf8')}, session «${slot.session ?? '?'}» (cc pid ${slot.ccPid ?? '?'}) since ${slot.since ?? '?'}`,
    );
    process.exit(0);
}

async function act(what: LiveVerb, label: string) {
    if (!isServing()) {
        console.error(
            `mods:live: no session serves ${name}; start pnpm mods:live ${modArg}`,
        );
        process.exit(2);
    }
    rmSync(response, { force: true });
    writeFileSync(request, JSON.stringify({ label, what }));
    const until = Date.now() + ACT_MS;
    while (Date.now() < until) {
        if (existsSync(response)) {
            const r = JSON.parse(readFileSync(response, 'utf8')) as {
                found: boolean;
                frame: string;
            };
            console.log(
                r.found
                    ? `${what} «${label}»: ${r.frame}`
                    : `«${label}» is not on screen: ${r.frame}`,
            );
            console.log(readFileSync(r.frame, 'utf8'));
            process.exit(r.found ? 0 : 1);
        }
        await sleep(100);
    }
    console.error(`mods:live: no answer from the ${name} session in 60 s`);
    process.exit(1);
}

async function serve() {
    if (isServing()) {
        console.error(
            `mods:live: ${name} is served already (pid ${readFileSync(pidFile, 'utf8')})`,
        );
        if (plantRoot) rmSync(plantRoot, { force: true, recursive: true });
        process.exit(2);
    }
    mkdirSync(dir, { recursive: true });
    writeFileSync(pidFile, String(process.pid));
    // the engine logs each module load here; the screen cannot count them, the session draws on the alternate screen with no scrollback
    const debugLog = join(dir, 'debug.log');
    writeFileSync(debugLog, '');
    // the tarball drops the prebuilt helper's exec bit, and node-pty cannot spawn without it
    const helper = join(
        dirname(createRequire(import.meta.url).resolve('node-pty')),
        `../prebuilds/${process.platform}-${process.arch}/spawn-helper`,
    );
    if (existsSync(helper) && !(statSync(helper).mode & 0o100))
        chmodSync(helper, 0o755);

    const term = new xterm.Terminal({
        allowProposedApi: true,
        cols: COLS,
        rows: ROWS,
    });
    // the dev copy takes the live mod's place in the child's own plugin dirs, as mods:probe does: a second copy on
    // --plugin-dir lost the name clash to the live one (PK-65); a mod not live yet joins last
    const home = process.env.HOME ?? '';
    const dirs = swapDir(liveDirs(home), mod, name, (d) =>
        manifestName(d, home),
    );
    // named, so the fleet board reads what it is
    const session = pty.spawn(
        'claude',
        [
            '-n',
            `mods-live: ${name}`,
            '--debug-file',
            debugLog,
            // a cli-entrypoint cc (a --bg session's) lets settings.json's env beat the swapped plugin dirs, so the child loads the
            // live mod; without the user settings the swap alone names the dirs
            '--setting-sources',
            'project,local',
            // the user's default mode came with the user settings: a frame session must not stop at a permission dialog
            '--permission-mode',
            'bypassPermissions',
        ],
        {
            cols: COLS,
            cwd: process.cwd(),
            // the watch var also came from the user settings' env
            env: {
                ...process.env,
                CLAUDE_CODE_PLUGIN_DIRS: dirs.join(':'),
                CLAUDE_CODE_PLUGIN_DIR_WATCH: '1',
            },
            name: 'xterm-256color',
            rows: ROWS,
        },
    );
    writeFileSync(
        slotFile,
        JSON.stringify({
            ccPid: session.pid,
            session: `mods-live: ${name}`,
            since: new Date().toISOString(),
        }),
    );
    let lastData = Date.now();
    session.onData((d) => {
        lastData = Date.now();
        term.write(d);
    });
    let frames = 0;
    const stop = (code: number) => {
        session.kill();
        rmSync(pidFile, { force: true });
        rmSync(slotFile, { force: true });
        if (plantRoot) rmSync(plantRoot, { force: true, recursive: true });
        process.exit(code);
    };
    session.onExit(() => {
        console.error('mods:live: the session ended');
        rmSync(pidFile, { force: true });
        rmSync(slotFile, { force: true });
        if (plantRoot) rmSync(plantRoot, { force: true, recursive: true });
        process.exit(1);
    });
    process.on('SIGINT', () => stop(0));
    process.on('SIGTERM', () => stop(0));

    const settle = async () => {
        const until = Date.now() + RELOAD_MS;
        while (Date.now() - lastData < QUIET_MS && Date.now() < until)
            await sleep(100);
    };
    const lines = (all: boolean) => {
        const b = term.buffer.active;
        const from = all ? 0 : b.viewportY;
        const to = all ? b.length : b.viewportY + ROWS;
        const out: string[] = [];
        for (let i = from; i < to; i++)
            out.push(b.getLine(i)?.translateToString(true) ?? '');
        return out;
    };
    const frame = (tag: string) => {
        const file = join(
            dir,
            `${String(++frames).padStart(3, '0')}-${tag}.txt`,
        );
        const text = lines(false).join('\n');
        writeFileSync(file, text);
        writeFileSync(join(dir, 'latest.txt'), text);
        return file;
    };
    // `hooks module <name>@<source> loaded …` and `… not loaded: <why>`, as the engine logs them
    const loadLines = () =>
        readFileSync(debugLog, 'utf8')
            .split('\n')
            .filter((l) => l.includes(`hooks module ${name}@`))
            .map((l) => l.replace(/^\S+ \[\w+\] /, ''));
    const reloads = () =>
        loadLines().filter((l) => /^hooks module \S+ (re)?loaded\b/.test(l))
            .length;

    await sleep(3000);
    await settle();
    console.log(`mods:live: ${name} runs in a pty, frames in ${dir}`);
    console.log(`frame: ${frame('start')}`);
    // the one line a caller waits on before its first keystroke (FRM-389: a 90 s blind wait, an early key at 21:29)
    console.log(`mods:live ready: ${name}`);

    let timer: NodeJS.Timeout | undefined;
    let busy = false;
    let loadedHash = sourceHash(mod);
    // a save that lands mid-check runs once the check ends, so no save goes unframed
    let isPending = false;
    const onSave = async () => {
        if (busy) {
            isPending = true;
            return;
        }
        busy = true;
        const before = reloads();
        const check = spawnSync('claude', ['plugin', 'validate', mod], {
            encoding: 'utf8',
        });
        if (check.status !== 0)
            console.log(
                `reload error: claude plugin validate refused it\n${(check.stdout + check.stderr).trim()}`,
            );
        const until = Date.now() + RELOAD_MS;
        while (reloads() === before && Date.now() < until) await sleep(200);
        await settle();
        const hash = sourceHash(mod);
        if (check.status === 0)
            console.log(
                reloadVerdict({
                    isReloaded: reloads() > before,
                    isSame: hash === loadedHash,
                    // the last load verdict, never a render or timing line about the module
                    line: loadLines()
                        .filter((l) => / (re|not )?loaded\b/.test(l))
                        .at(-1),
                    name,
                }),
            );
        loadedHash = hash;
        console.log(`frame: ${frame('save')}`);
        busy = false;
        if (isPending) {
            isPending = false;
            void onSave();
        }
    };
    watch(mod, { recursive: true }, (_event, file) => {
        if (!file || file.startsWith('.claude-plugin/types')) return;
        clearTimeout(timer);
        timer = setTimeout(() => void onSave(), 300);
    });

    // a request from a client verb: hover moves the pointer onto the label's first cell (an SGR motion), click presses
    // and releases there, type writes the text, then Enter once the prompt has drawn it
    watch(dir, async (_event, file) => {
        if (file !== 'hover.request' || !existsSync(request)) return;
        const { label, what } = JSON.parse(readFileSync(request, 'utf8')) as {
            label: string;
            what: LiveVerb;
        };
        rmSync(request, { force: true });
        const isTyped = what === 'type' || what === 'fill';
        const at = isTyped ? undefined : cellOf(term, label);
        const cell = at && `${at.x + 1};${at.y + 1}`;
        if (what === 'hover' && cell) session.write(`\x1b[<35;${cell}M`);
        if (what === 'click' && cell)
            session.write(`\x1b[<0;${cell}M\x1b[<0;${cell}m`);
        if (isTyped) session.write(label);
        if (what === 'type') {
            await sleep(300);
            session.write('\r');
        }
        lastData = Date.now();
        await settle();
        // written whole, then renamed in, so the client never reads half an answer
        writeFileSync(
            `${response}.tmp`,
            JSON.stringify({
                found: isTyped || !!at,
                frame: frame(what),
            }),
        );
        renameSync(`${response}.tmp`, response);
    });
}

// the viewport cell where a label starts, counting a wide character as one cell of two
function cellOf(term: xterm.Terminal, label: string) {
    const b = term.buffer.active;
    for (let y = 0; y < ROWS; y++) {
        const line = b.getLine(b.viewportY + y);
        if (!line) continue;
        const cells: { ch: string; x: number }[] = [];
        for (let x = 0; x < COLS; x++) {
            const c = line.getCell(x);
            if (c && c.getWidth() > 0)
                cells.push({ ch: c.getChars() || ' ', x });
        }
        const at = cells
            .map((c) => c.ch)
            .join('')
            .indexOf(label);
        if (at < 0) continue;
        let seen = 0;
        const hit = cells.find((c) => {
            const isHere = seen >= at;
            seen += c.ch.length;
            return isHere;
        });
        if (hit) return { x: hit.x, y };
    }
    return undefined;
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}
