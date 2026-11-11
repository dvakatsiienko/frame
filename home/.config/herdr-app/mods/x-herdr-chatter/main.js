// x-herdr-chatter: ours since FRM-556, copied from zoo's claude-chat (11-10) and evolved in frame, landed by herdr-mods:land.
// Claude Code as a chat. Shows one Claude agent's conversation, read from Claude's own transcript
// (~/.claude/projects/<folder>/<session>.jsonl), and types what you write into its terminal.
// The terminal stays the real Claude: when it asks something (a permission), the bottom of its
// screen shows here with buttons that press its keys. props: { terminal } (else the shown tab's
// Claude agent). A dev container's Claude (docker exec ... claude) is read through docker.

import { Buffer } from 'buffer';
import { exists, readFile, readdir, writeFile } from 'fs/promises';
import os from 'os';
import {
    Button,
    Input,
    InputState,
    Popover,
    Scrollbar,
    TextView,
    Textarea,
    TextareaState,
    VirtualListScrollHandle,
    h_flex,
    v_flex,
    v_virtual_list,
} from 'gpui-base';
import { View, div, svg } from 'gpui-kit';
import {
    appHome,
    exec,
    focused,
    hc,
    home,
    layout,
    notify,
    openOverlay,
    props,
    readTextFile,
    run,
    setShared,
    settings,
    shared,
    theme,
    watchFolder,
    writeTextFile,
} from 'herdr';

import {
    DECK_BLOCK,
    OVERRIDE_STORE,
    PENDING_MS,
    PRESS_DIR,
    PRESS_FILE,
    SEATS_KEY,
    STATE_DIR,
    bandButtons,
    bandOf,
    overrideOf,
    pendingOf,
    pressLine,
    withPress,
} from './band.js';
import { splitBlocks, withPrompt } from './blocks.js';
import { applyChips, codeSpans } from './chips.js';
import COMMANDS from './commands.js';
import { importOldDrafts } from './drafts.js';
import { listLines, withMarkers } from './lists.js';
import { agents, inRender, panes, terminals } from './live.js';
import * as ask from './question.js';
import { QUEUED_IDLE_MS, queuedAfterIdle, queuedAfterRow } from './queued.js';
import { relayIn, relayLine } from './relay.js';
import {
    SETTLED_READS,
    fileLinks,
    followAfterWheel,
    measureOrder,
    prevMineIndex,
    rowSizes,
} from './rows.js';
import { loadableSkills, menuMatches } from './skills.js';
import { wholeLines } from './slice.js';
import {
    SYSTEM_MODES,
    cleanTyped,
    dropImageMarks,
    midTurnPrompt,
    systemLine,
} from './system.js';
import { RADIUS, TEXT, button } from './ui.js';

const CLAUDE = `${home()}/.claude`;
// The chat's look, shared by every copy and kept across restarts; the ⚙ popup changes it.
// size: the message text in px (the rest scales with it); font: "ui" or "mono" (the terminals');
// width: "full" or "narrow" (a readable column); tools: "show" or "hide" the tool-call rows;
// accent: a key of ACCENTS; mine (your messages): "bubble", "box", "tint" or "bar"; bg: the theme color
// behind the messages, or a "#rrggbb"; fg: the text color, "theme" or a "#rrggbb";
// space: "tight", "normal" or "roomy" between them.
const LOOK = 'chat.look';
// replies: Claude's messages in earlier turns stay "open" (only the work between them folds) or "folded".
const LOOK_DEFAULT = {
    accent: 'theme',
    bg: 'background',
    fg: 'theme',
    font: 'ui',
    mine: 'bubble',
    replies: 'open',
    size: 13,
    space: 'normal',
    system: 'fold',
    tools: 'show',
    width: 'full',
};
const HEX = /^#[0-9a-f]{6}$/i;
/**
 * a row of the chat's list (rowsOf): its key is the list's and its press's
 * @typedef {{ key: string, kind: 'earlier' | 'turn' | 'item' | 'detail' | 'part' | 'file', id?: string | number,
 *   item?: any, x?: any, mine?: boolean, part?: 'text' | 'codehead' | 'code' | 'prompt', b?: any, isFirst?: boolean,
 *   label?: string, path?: string }} Row
 */
// Ready-made picks beside the hex boxes: dark and light backgrounds, and text for either.
// Maps, never objects: the swatches draw in this order, and a formatter sorts an object's keys.
const BGS = new Map([
    ['#0d1117', 'Night'],
    ['#1e1e1e', 'Charcoal'],
    ['#22201c', 'Coffee'],
    ['#f6f1e7', 'Paper'],
    ['#ffffff', 'White'],
]);
const FGS = new Map([
    ['#e6edf3', 'Soft white'],
    ['#c9d1d9', 'Gray'],
    ['#f0dfbf', 'Cream'],
    ['#24292f', 'Ink'],
    ['#000000', 'Black'],
]);
const chatLook = () => ({ ...LOOK_DEFAULT, ...(shared(LOOK) ?? {}) });
const setLook = (change) => {
    setShared(LOOK, { ...chatLook(), ...change });
    if ('fg' in change) syncForeground();
};
// Message text is Herdr's TextView, which only ever takes the theme's foreground, so a chosen
// text color goes into settings.json's colors.foreground: the whole app's text (the user's choice,
// 2026-10-31). "theme" removes it. writeTextFile refuses if the file changed since it was read.
async function syncForeground() {
    const fg = chatLook().fg;
    const path = `${appHome()}/settings.json`;
    for (let tries = 0; tries < 2; tries++) {
        const text = await readTextFile(path);
        const s = JSON.parse(text ?? '{}');
        const now = s.colors?.foreground;
        if (HEX.test(fg) ? now === fg : now === undefined) return;
        const colors = { ...(s.colors ?? {}) };
        if (HEX.test(fg)) colors.foreground = fg;
        else delete colors.foreground;
        if (Object.keys(colors).length) s.colors = colors;
        else delete s.colors;
        try {
            await writeTextFile(path, JSON.stringify(s, null, 2) + '\n', text);
            return;
        } catch {}
    }
}
syncForeground();
// "Claude (dev container)" in the + menu (`my-new-menu`), switched in the ⚙ popup: on = this
// computer's programs.json has the entry, so that file is the setting. On by default (the user's
// choice 2026-11-02; the space's folder must hold the .devcontainer, the standard VS Code layout): the first run
// on Windows (the command is cmd.exe) adds it, once; shared `chat.devContainer` remembers that a
// choice was made, so Off sticks. Turning it on leaves an entry edited by hand alone; off removes
// it. Herdr reloads programs.json live.
const DEV_KEY = 'claude-dev-container';
const DEV_ENTRY = {
    icon: 'icons/claude.svg',
    name: 'Claude (dev container)',
    run: [
        'cmd.exe',
        '/c',
        'devcontainer up --workspace-folder . && devcontainer exec --workspace-folder . claude',
    ],
    tint: false,
};
// The entry as it was until 2026-11-07 (a harness-agent checkout beside the space's folder,
// which only worked because the space's folder was itself named harness-agent): an entry
// still exactly like it is moved to the new one, once; an edited one is left alone.
const OLD_RUN = [
    'cmd.exe',
    '/c',
    'devcontainer up --workspace-folder ..\\harness-agent && devcontainer exec --workspace-folder ..\\harness-agent claude',
];
const programsPath = () => `${appHome()}/programs.json`;
async function devContainerOn() {
    return Boolean(
        JSON.parse((await readTextFile(programsPath())) ?? '{}').programs?.[
            DEV_KEY
        ],
    );
}
async function setDevContainer(on) {
    for (let tries = 0; tries < 2; tries++) {
        const text = await readTextFile(programsPath());
        const p = JSON.parse(text ?? '{}');
        const programs = { ...(p.programs ?? {}) };
        const stale =
            on &&
            JSON.stringify(programs[DEV_KEY]?.run) === JSON.stringify(OLD_RUN);
        if (Boolean(programs[DEV_KEY]) === on && !stale) return;
        if (on) programs[DEV_KEY] = DEV_ENTRY;
        else delete programs[DEV_KEY];
        if (Object.keys(programs).length) p.programs = programs;
        else delete p.programs;
        try {
            await writeTextFile(
                programsPath(),
                JSON.stringify(p, null, 2) + '\n',
                text,
            );
            return;
        } catch (e) {
            if (tries) throw e;
        }
    }
}
const DEV_CHOICE = 'chat.devContainer';
if (shared(DEV_CHOICE) == null && /^win/.test(os.platform())) {
    setShared(DEV_CHOICE, true);
    setDevContainer(true).catch(() => {});
} else if (shared(DEV_CHOICE) === true) {
    setDevContainer(true).catch(() => {}); // moves an OLD_RUN entry to the new one
}
// null = the theme's own accent; a Map, so the swatches keep this order (theme first).
const ACCENTS = new Map([
    ['theme', null],
    ['claude', '#d97757'],
    ['blue', '#4f8cff'],
    ['green', '#3fb950'],
    ['purple', '#a371f7'],
    ['pink', '#f778ba'],
]);
const GAPS = { normal: 10, roomy: 16, tight: 6 };
// Sans is the system font: herdr's own UI font (Geist) ships one face, so **bold** and *italic* drew flat in it.
const SANS = '.AppleSystemUIFont';
// The theme with the chat's accent and background swapped in.
function chatTheme() {
    const t = theme();
    const look = chatLook();
    const out = {
        ...t,
        accent: ACCENTS.get(look.accent) ?? t.accent,
        background: HEX.test(look.bg) ? look.bg : (t[look.bg] ?? t.background),
    };
    // A chosen text color also makes the secondary text: the same color, fainter.
    if (HEX.test(look.fg))
        Object.assign(out, {
            dim: look.fg + '99',
            foreground: look.fg,
            muted: look.fg + 'd9',
        });
    return out;
}
// A color at some opacity ("26" = 15%), for 6-digit hex colors.
const fade = (color, alpha) =>
    /^#[0-9a-f]{6}/i.test(color) ? color.slice(0, 7) + alpha : color;
// A text size from the 13 px design, scaled to the chosen size.
const px = (n) => Math.round(((n * chatLook().size) / 13) * 2) / 2;
const NARROW = 820;
// a fling keeps the measurer still: no hold on a row and no measuring pass this soon after a wheel step
const WHEEL_QUIET_MS = 400;
// a row whose height changed this often is held at its tallest: a flip between two heights never redraws for good
const FLIP_LIMIT = 4;
// the measurer's heights land as one render
const MEASURE_BATCH_MS = 32;
// his message's last px, where its fork icon sits: a press there forks (rows take no handlers, clickRow)
const FORK_W = 28;
/** a message between threads: one another thread sent, or this one's SendMessage @param {any} item */
const isRelay = (item) =>
    item?.kind === 'relay' || item?.name === 'SendMessage';
/** the transcript line a row stands for, its uuid: a turn's fold by its first work item @param {any} row */
const uuidOf = (row) =>
    row ? ((row.item ?? row.x?.work?.[0]?.[0])?.uuid ?? null) : null;
/** a row's height before the measurer has drawn it, so the list places it near where it will be @param {any} row */
const guessHeight = (row) =>
    row.kind === 'turn' ||
    row.kind === 'earlier' ||
    row.kind === 'file' ||
    row.part === 'codehead'
        ? 28
        : row.mine
          ? 44
          : row.item?.kind === 'tool'
            ? 24
            : 60;
// How much of a local transcript is decoded and read at a time (see readAfter).
const LOAD_SLICE = 4 * 1024 * 1024;
const MAX_DETAIL = 4000;
// Bytes of a container's transcript per read (exec's output stops at 8 MiB).
const CHUNK = 4000000;
// Commands that, run bare, open a menu or a screen in Claude's terminal (the chat flips to it).
const OPENS = new Set([
    'add-dir',
    'agents',
    'artifacts',
    'color',
    'config',
    'context',
    'diff',
    'effort',
    'export',
    'help',
    'hooks',
    'ide',
    'keybindings',
    'list-agents',
    'login',
    'logout',
    'mcp',
    'memory',
    'mobile',
    'model',
    'output-style',
    'permissions',
    'plugin',
    'powerup',
    'radio',
    'rate-limit-options',
    'release-notes',
    'remote-control',
    'resume',
    'rewind',
    'skills',
    'status',
    'statusline',
    'tasks',
    'theme',
    'tui',
    'usage',
    'workflows',
]);

// The header's model / effort bar (see pick), as Claude's /model list names them; the alias is
// how settings.json's "model" names the default. Read off Claude 2.1.318, 2026-11-05.
const MODELS = [
    ['opus', 'Opus 5.5'],
    ['sonnet', 'Sonnet 5.5'],
    ['haiku', 'Haiku 5.5'],
    ['fable', 'Fable 5.2'],
];
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
// "claude-opus-5-5" → "Opus 5.5"; a display name stays as it is.
const modelLabel = (m) => {
    const id = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{6,})?$/.exec(
        m ?? '',
    );
    return id
        ? `${id[1][0].toUpperCase()}${id[1].slice(1)} ${id[2]}${id[3] ? `.${id[3]}` : ''}`
        : m || null;
};
const modelId = (label) =>
    label ? `claude-${label.toLowerCase().replace(/[ .]/g, '-')}` : null;

// The box can't say where its caret is, so it's taken from the edit: the end of what changed
// between the two values (where typing or a paste left it).
function caretAfter(was, now) {
    let a = 0;
    while (a < was.length && a < now.length && was[a] === now[a]) a++;
    let b = 0;
    while (
        b < was.length - a &&
        b < now.length - a &&
        was[was.length - 1 - b] === now[now.length - 1 - b]
    )
        b++;
    return now.length - b;
}

// The "/word" the caret is in, if the "/" starts the box or follows a space or line break:
// { text, start (the "/"), end, q (what's after the "/") }, else null.
function slashAt(text, caret) {
    let start = caret;
    while (start > 0 && /[\w:-]/.test(text[start - 1])) start--;
    if (text[start - 1] !== '/') return null;
    start--;
    if (start > 0 && !/\s/.test(text[start - 1])) return null;
    let end = caret;
    while (end < text.length && /[\w:-]/.test(text[end])) end++;
    return { end, q: text.slice(start + 1, end), start, text };
}

const sameSlash = (a, b) =>
    Boolean(a && b) && a.start === b.start && a.q === b.q;
// The tool that starts a sub-agent ("Task" in older Claude Codes). Its rows are cards that open
// the sub-agent's own conversation, read from <session>/subagents/agent-<id>.jsonl.
const AGENT_TOOLS = new Set(['Agent', 'Task']);
// Shared: how many sub-agents each Claude agent has at work, { "<address>": n }, for my-status.
const SUBS = 'chat.subs';
const CONTAINERS = 'chat.containers'; // { "<address>": "<container>" }, for my-status
// A sub-agent still at work: its meta doesn't say finished, and a foreground one's call isn't
// answered yet (an interrupted one's meta may never say finished).
const subRunning = (sub, tool) =>
    !sub.finished &&
    (tool?.result === undefined || /^Async agent launched/.test(tool.result));

// Every process by parent: its pid, when it started (ms) and its command line. To find the
// Claude under a terminal's shell.
async function children() {
    const win = /^win/.test(os.platform());
    const r = win
        ? await exec('powershell', [
              '-NoProfile',
              '-Command',
              "Get-CimInstance Win32_Process | ForEach-Object { '{0}|{1}|{2}|{3}' -f $_.ProcessId, $_.ParentProcessId, $(if ($_.CreationDate) { [DateTimeOffset]::new($_.CreationDate).ToUnixTimeMilliseconds() } else { 0 }), $_.CommandLine }",
          ])
        : await exec('ps', ['-A', '-o', 'pid=,ppid=,etime=,args=']);
    const seconds = (etime) => {
        const [days, clock] = etime.includes('-')
            ? etime.split('-')
            : ['0', etime];
        return (
            clock
                .split(':')
                .reduce((total, part) => total * 60 + Number(part), 0) +
            Number(days) * 86400
        );
    };
    const map = new Map();
    for (const line of r.stdout.split('\n')) {
        const m = win
            ? /^(\d+)\|(\d+)\|(\d+)\|(.*)/.exec(line.trim())
            : /^(\d+)\s+(\d+)\s+((?:\d+-)?(?:\d+:)?\d+:\d+)\s+(.*)/.exec(
                  line.trim(),
              );
        if (!m) continue;
        const p = {
            cmd: m[4],
            pid: Number(m[1]),
            start: win ? Number(m[3]) : Date.now() - seconds(m[3]) * 1000,
        };
        map.set(Number(m[2]), [...(map.get(Number(m[2])) ?? []), p]);
    }
    return map;
}

// `docker exec [-u user] [-e CLAUDE_CONFIG_DIR=dir] ... <container> claude`: a dev container's
// Claude, the way the devcontainer CLI starts it. Never show this line: it carries its env.
function dockerExec(cmd) {
    if (!/docker(\.exe)?"?\s+exec\s/i.test(cmd)) return null;
    const m = /\s(\S+)\s+claude(\s|$)/.exec(cmd);
    if (!m) return null;
    return {
        container: m[1],
        dir: /\sCLAUDE_CONFIG_DIR=(\S+)/.exec(cmd)?.[1] ?? '',
        user: /\s-u\s+(\S+)/.exec(cmd)?.[1] ?? null,
    };
}

// Runs a shell script in the container, as its Claude's user. $1 is Claude's folder there.
function inDocker(where, script, ...args) {
    return exec('docker', [
        'exec',
        ...(where.user ? ['-u', where.user] : []),
        where.container,
        'sh',
        '-c',
        `d=\${1:-$HOME/.claude}; ${script}`,
        'sh',
        where.dir,
        ...args,
    ]);
}

// The claude args of a `docker exec … claude …` line, for telling execs apart.
const claudeArgs = (cmd) =>
    (/\sclaude(\s.*)?$/.exec(cmd)?.[1] ?? '')
        .replace(/["']/g, '')
        .replace(/\s+/g, ' ')
        .trim();

// A container Claude's sessions/<pid>.json, if it is really this process's. The folder can be
// a volume shared by several containers, each running Claudes with the same low pids, so the
// file can be another container's (its `pidDomain` names the writer's pid namespace) or a dead
// process's with the same pid (its `procStart` is the writer's /proc/<pid>/stat start ticks).
// A good one is current: Claude rewrites it on /clear, unlike the tasks file it opened at start.
function ownSession(file, ns, ticks) {
    if (!file?.sessionId) return null;
    if (file.pidDomain && ns && !file.pidDomain.endsWith(ns)) return null;
    if (file.procStart && ticks && String(file.procStart) !== String(ticks))
        return null;
    return file;
}

// The container's Claude: among the container's own `claude` processes started by an exec
// (parent pid 0) with the same args as this agent's `docker exec … claude …` (`p`), the one
// that started nearest to when the exec did (normally a second apart). The start is the
// session file's wall-clock `startedAt` when the file is the process's (`ownSession`), else
// from `ps`'s elapsed time, which drifts by hours after the computer slept (the VM's monotonic
// clock stops): on 2026-11-07 that picked a Claude 36 min off over the right one, 3 h off.
async function inContainer(where, p) {
    const args = claudeArgs(p.cmd);
    const r = await inDocker(
        where,
        'now=$(date +%s); ps -eo pid=,ppid=,etimes=,args= | while read pid ppid et cmd; do [ "$ppid" = 0 ] && case "$cmd" in claude|"claude "*) echo "P $pid $((now-et)) $(awk "{print \\$22}" /proc/$pid/stat 2>/dev/null) $(readlink /proc/$pid/ns/pid 2>/dev/null) $cmd"; echo "F $(cat "$d/sessions/$pid.json" 2>/dev/null | tr -d "\\n")";; esac; done; true',
    );
    const lines = r.stdout.split('\n');
    const claudes = [];
    for (let i = 0; i < lines.length; i++) {
        const m = /^P (\d+) (\d+) (\d*) (\S*) claude(.*)$/.exec(
            lines[i].trim(),
        );
        if (!m) continue;
        let file = null;
        try {
            file = lines[i + 1]?.startsWith('F ')
                ? ownSession(JSON.parse(lines[i + 1].slice(2)), m[4], m[3])
                : null;
        } catch {}
        claudes.push({
            args: claudeArgs(` claude${m[5]}`),
            pid: Number(m[1]),
            start: file?.startedAt ?? Number(m[2]) * 1000,
        });
    }
    const best = claudes
        .filter((c) => c.args === args)
        .sort(
            (a, b) =>
                Math.abs(a.start - p.start) - Math.abs(b.start - p.start) ||
                b.pid - a.pid,
        )[0];
    return best ? { ...where, pid: best.pid } : null;
}

// Where the Claude running in `address` keeps its session: here (~/.claude/sessions/<pid>.json),
// or { container, user, dir, pid } in a dev container.
// `tree` (from children()) can be shared by several lookups: it takes ~2 s on Windows.
async function locate(address, tree = null) {
    const shell = JSON.parse((await hc(['get', address, '--json'])).stdout).pid;
    const known = new Set(
        (await readdir(`${CLAUDE}/sessions`))
            .filter((f) => f.endsWith('.json'))
            .map((f) => Number(f.slice(0, -5))),
    );
    if (known.has(shell)) return { pid: shell };
    tree ??= await children();
    const queue = [shell];
    while (queue.length) {
        for (const p of tree.get(queue.shift()) ?? []) {
            if (known.has(p.pid)) return { pid: p.pid };
            const docker = dockerExec(p.cmd);
            if (docker) return inContainer(docker, p);
            queue.push(p.pid);
        }
    }
    return null;
}

const folderName = (cwd) => cwd.replace(/[^A-Za-z0-9]/g, '-');

// UTF-8 bytes as a string (this runtime's Buffer can't decode, and there's no TextDecoder).
function utf8(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000)
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return decodeURIComponent(escape(bin));
}

/**
 * the thread's state file, found by its pid (the newest `at` wins after a /clear), and fleet.json
 * @param {number | null | undefined} pid
 */
async function bandStates(pid) {
    const dir = `${home()}/${STATE_DIR}`;
    /** @param {string} path */
    const read = async (path) => {
        try {
            return JSON.parse((await readTextFile(path)) ?? 'null');
        } catch {
            return null;
        }
    };
    const names = (
        await readdir(dir).catch(() => /** @type {string[]} */ ([]))
    ).filter(
        (/** @type {string} */ f) => f.endsWith('.json') && f !== 'fleet.json',
    );
    let thread = null;
    if (pid != null)
        for (const state of await Promise.all(
            names.map((f) => read(`${dir}/${f}`)),
        ))
            if (state?.pid === pid && (!thread || state.at > thread.at))
                thread = state;
    const presses = await readTextFile(`${home()}/${PRESS_FILE}`).catch(
        () => /** @type {string | null} */ (null),
    );
    return {
        fleet: await read(`${dir}/fleet.json`),
        presses: pendingOf(presses, thread?.sid, Date.now()),
        thread: thread
            ? {
                  hot: thread.hot ?? null,
                  sid: thread.sid,
                  wind: thread.wind ?? null,
              }
            : null,
    };
}

/**
 * one press appended to the band press file with herdr's compare-and-swap write: a file changed since the read is read
 * again, so no other press is lost
 * @param {import('./band.js').PressLine} line
 */
async function appendPress(line) {
    const made = await exec('mkdir', ['-p', `${home()}/${PRESS_DIR}`]);
    if (made.code !== 0) throw new Error(made.stderr.trim() || 'mkdir failed');
    const path = `${home()}/${PRESS_FILE}`;
    for (let tries = 2; ; tries--) {
        const text = await readTextFile(path).catch(
            () => /** @type {string | null} */ (null),
        );
        try {
            return await writeTextFile(
                path,
                withPress(text, line, line.at),
                text,
            );
        } catch (err) {
            if (tries <= 1) throw err;
        }
    }
}

/** @param {string} file */
async function sizeOf(file) {
    const stat = await exec('stat', ['-f', '%z', file]);
    if (stat.code !== 0) throw new Error(stat.stderr.trim() || `no ${file}`);
    return Number(stat.stdout.trim());
}

// A local file's whole lines after byte `pos`, and the byte they end at; text null if the file
// shrank. Read as bytes, decoding only the new part: decoding all of a 10 MB transcript on every
// change took Herdr's UI thread 60–150 ms (the bytes alone take ~25 ms).
// At most `max` bytes at a time (more: there's more after `end`): a 25 MB transcript decoded and
// read in one go ran past Herdr's time limit and the chat stayed empty (2026-10-31).
/** @param {string} file @param {number} pos @param {number} [max] */
async function readAfter(file, pos, max = Infinity) {
    const size = await sizeOf(file);
    if (size < pos) return { end: 0, text: null };
    if (size === pos) return { end: pos, text: '' };
    // only the slice is read (slice.js): herdr's readFile takes the whole file and refuses one past 64 MB
    /** @param {number} n @returns {Promise<string>} */
    const bytesFrom = async (n) => {
        const out = await exec('sh', [
            '-c',
            'tail -c +"$1" "$2" | head -c "$3"',
            'sh',
            String(pos + 1),
            file,
            String(n),
        ]);
        if (out.code !== 0) throw new Error(out.stderr.trim());
        return out.stdout;
    };
    const want = Math.min(max, size - pos);
    let got = wholeLines(await bytesFrom(want), pos);
    // one line longer than the slice: read on to the end of the file
    if (!got.text && want < size - pos)
        got = wholeLines(await bytesFrom(size - pos), pos);
    return { ...got, more: got.end < size && want < size - pos };
}

// The byte the first whole line at or after byte `at` starts at: a big transcript opens on its tail and reads earlier
// parts on his ask, each cut on a line start.
/** @param {string} file @param {number} at */
async function lineStartAt(file, at) {
    if (at <= 0) return 0;
    const out = await exec('sh', [
        '-c',
        'tail -c +"$1" "$2" | head -n 1 | wc -c',
        'sh',
        String(at),
        file,
    ]);
    if (out.code !== 0) throw new Error(out.stderr.trim());
    return at - 1 + Number(out.stdout.trim());
}

// The whole lines in bytes [from, to) of a local file.
/** @param {string} file @param {number} from @param {number} to */
async function readRange(file, from, to) {
    const out = await exec('sh', [
        '-c',
        'tail -c +"$1" "$2" | head -c "$3"',
        'sh',
        String(from + 1),
        file,
        String(to - from),
    ]);
    if (out.code !== 0) throw new Error(out.stderr.trim());
    return out.stdout;
}

// his message escaped for markdown, once per message: the text never changes after it is read
/** @param {{ text: string, typed?: string }} item */
function typedOf(item) {
    if (item.typed === undefined) item.typed = plainMarkdown(item.text);
    return item.typed;
}

async function transcriptOf(session) {
    const guess = `${CLAUDE}/projects/${folderName(session.cwd)}/${session.sessionId}.jsonl`;
    if (await exists(guess)) return guess;
    for (const dir of await readdir(`${CLAUDE}/projects`)) {
        const file = `${CLAUDE}/projects/${dir}/${session.sessionId}.jsonl`;
        if (await exists(file)) return file;
    }
    return null;
}

// A /resume typed into Claude's own prompt changes its session, but sessions/<pid>.json keeps
// the one from the last /clear (Claude 2.1.306; seen 2026-11-09: a dev-container agent /clear'd,
// then /resume'd its old chat and worked there for a day, while the chat showed the "/clear"-only
// transcript). The file does say when its status last changed (`statusUpdatedAt`): the moment
// a prompt was taken (working) or a turn ended (idle). The session the agent is on has a line
// at that moment: for a prompt, in history.jsonl (each prompt with its session id; cheap), and
// in any case in its transcript (`scan`: the transcripts in that cwd written since, their tails
// searched for a timestamp within 2 s; one shell call, dev containers only). The pick is kept
// on `where` (per agent) until the file's session changes, i.e. the next /clear, and each status
// change is looked at once.
const HISTORY_TAIL = 65536;
async function followResume(where, file, history, scan = null) {
    if (where.fileId !== file.sessionId)
        Object.assign(where, { fileId: file.sessionId, resumed: null });
    const at = file.statusUpdatedAt;
    if (at && at !== where.matchedAt) {
        where.matchedAt = at;
        const same = (a, b) =>
            String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
        let ids = new Set();
        if (file.status === 'working') {
            for (const line of ((await history().catch(() => '')) ?? '').split(
                '\n',
            )) {
                let e;
                try {
                    e = JSON.parse(line);
                } catch {
                    continue;
                }
                // A /clear is logged under the session it ended.
                if (
                    e?.sessionId &&
                    e.display !== '/clear' &&
                    same(e.project, file.cwd) &&
                    Math.abs(e.timestamp - at) <= 3000
                )
                    ids.add(e.sessionId);
            }
        }
        if (ids.size !== 1 && scan)
            ids = new Set(await scan(at).catch(() => []));
        // Nothing at that moment, or two Claudes in this cwd at once: keep what we had.
        if (ids.size === 1) {
            const [id] = ids;
            where.resumed = id === file.sessionId ? null : id;
        }
    }
    return where.resumed ? { ...file, sessionId: where.resumed } : file;
}

// The sessions in `folder` (a projects/ folder name) with a transcript line stamped within 2 s
// of `at`, among transcripts written since then (`find -mmin`, so a minute's slack), by their tails.
async function scanTranscripts(where, folder, at) {
    const seconds = [-2, -1, 0, 1, 2]
        .map((s) => new Date(at + s * 1000).toISOString().slice(0, 19))
        .join('|');
    const mins = String(Math.max(1, Math.ceil((Date.now() - at) / 60000) + 1));
    const r = await inDocker(
        where,
        'for f in $(find "$d/projects/$2" -maxdepth 1 -name "*.jsonl" -mmin -$3 2>/dev/null); do tail -c 200000 "$f" | grep -qE "\\"timestamp\\":\\"($4)" && basename "$f" .jsonl; done; true',
        folder,
        mins,
        seconds,
    );
    return r.stdout
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => /^[0-9a-f-]{36}$/.test(s));
}

// The session a Claude is on now ({ sessionId, cwd, … }): here from its sessions/<pid>.json;
// in a container from that file when it is the process's own (`ownSession`; it is current:
// Claude rewrites it on /clear), else from the process itself: the session id is in the path
// of its open <tmp>/claude-<uid>/<folder>/<session id>/tasks file, the cwd is /proc/<pid>/cwd.
// That file is the one opened at start, so after a /clear it names the old session (seen
// 2026-11-07: the chat showed the old transcript and no question card), hence the file first.
// Neither follows a /resume typed into Claude's own prompt (`followResume`).
async function sessionOf(where) {
    if (!where.container) {
        const text = await readFile(
            `${CLAUDE}/sessions/${where.pid}.json`,
            'utf8',
        ).catch(() => null);
        let file = null;
        try {
            file = text ? JSON.parse(text) : null;
        } catch {
            return null;
        }
        return (
            file &&
            followResume(where, file, async () => {
                const bytes = await readFile(`${CLAUDE}/history.jsonl`).catch(
                    () => null,
                );
                return bytes
                    ? utf8(
                          bytes.subarray(
                              Math.max(0, bytes.length - HISTORY_TAIL),
                          ),
                      )
                    : '';
            })
        );
    }
    const r = await inDocker(
        where,
        'p=$2; n=$(readlink /proc/$p/ns/pid 2>/dev/null); k=$(awk \'{print $22}\' /proc/$p/stat 2>/dev/null); s=$(for f in /proc/$p/fd/*; do readlink "$f"; done 2>/dev/null | sed -n "s#^/tmp/claude-[0-9]*/[^/]*/\\([0-9a-f-]\\{36\\}\\)/.*#\\1#p" | head -n 1); c=$(readlink /proc/$p/cwd 2>/dev/null); printf \'{"ns":"%s","ticks":"%s","fd":"%s","cwd":"%s","file":\' "$n" "$k" "$s" "$c"; cat "$d/sessions/$p.json" 2>/dev/null || echo null; echo "}"; echo --history--; tail -c $3 "$d/history.jsonl" 2>/dev/null',
        String(where.pid),
        String(HISTORY_TAIL),
    );
    const [head, history = ''] = r.stdout.split('--history--\n');
    let j;
    try {
        j = JSON.parse(head);
    } catch {
        return null;
    }
    const own = ownSession(j?.file, j?.ns, j?.ticks);
    if (own)
        return followResume(
            where,
            own,
            async () => history,
            (at) => scanTranscripts(where, folderName(own.cwd), at),
        );
    // No file of its own: the session the process started on, if it has the tasks file (a
    // --resume'd one on 2.1.306 had none), else nothing rather than another container's.
    return j?.fd && j?.cwd
        ? { cwd: j.cwd, pid: where.pid, sessionId: j.fd }
        : null;
}

// Its transcript; in a container, relative to its Claude folder (read through docker).
const fileOf = (where, session) =>
    where.container
        ? `projects/${folderName(session.cwd)}/${session.sessionId}.jsonl`
        : transcriptOf(session);

// Plain text as markdown that shows it as typed: punctuation escaped, every line break kept.
const plainEscape = (s) => s.replace(/[\\`*_{}[\]()<>#+\-.!|~&]/g, '\\$&');
const plainMarkdown = (s) =>
    s
        .replace(/\r/g, '')
        .split(/\n\s*\n/)
        .map((p) => plainEscape(p).replace(/\n/g, '\\\n'))
        .join('\n\n');
// A random v4 UUID, for a forked session's id.
const newUuid = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) =>
        (c === 'x'
            ? (Math.random() * 16) | 0
            : ((Math.random() * 4) | 0) + 8
        ).toString(16),
    );
const clip = (s, n = MAX_DETAIL) =>
    s.length > n ? `${s.slice(0, n)}\n… (${s.length - n} more characters)` : s;
const tag = (s, name) =>
    s.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.trim();

// What Claude Code's own prompt box holds, read off its screen: the last `❯` line right under a rule, down to the next
// rule. Its dim suggestion text reads the same, so a caller trusts it only when it matches a prompt already sent.
function boxText(screen) {
    const lines = screen.replace(/\r/g, '').split('\n');
    let open = lines.length - 1;
    while (
        open > 0 &&
        !(lines[open].startsWith('❯') && lines[open - 1].startsWith('─'))
    )
        open--;
    if (open <= 0) return '';
    const box = [lines[open].slice(1)];
    for (const l of lines.slice(open + 1)) {
        if (l.startsWith('─')) break;
        box.push(l);
    }
    return box.join(' ').replace(/\s+/g, ' ').trim();
}
const flat = (s) => s.replace(/\s+/g, ' ').trim();
// The chat box's draft per seat, kept across a reload of this mod (localStorage outlives a copy).
const draftKey = (address) => `draft:${address}`;
function keptDraft(address) {
    try {
        return (address && localStorage.getItem(draftKey(address))) || '';
    } catch {
        return '';
    }
}
function keepDraft(address, text) {
    try {
        if (address)
            text
                ? localStorage.setItem(draftKey(address), text)
                : localStorage.removeItem(draftKey(address));
    } catch {}
}
/** @type {import('./skills.js').SkillFs} */
const skillFs = {
    list: (dir) => readdir(dir).catch(() => []),
    read: (path) => readFile(path, 'utf8').catch(() => null),
};

// where he was reading each seat, kept across a reload of this mod, written only by his own scroll or click
/** @param {string} address */
const scrollKey = (address) => `scroll:${address}`;
/** @typedef {{ anchor: string | null, follow: boolean, uuid?: string | null }} Place */
/** @param {string} address @returns {Place | null} */
function keptScroll(address) {
    try {
        const kept = JSON.parse(
            localStorage.getItem(scrollKey(address)) ?? 'null',
        );
        return typeof kept?.follow === 'boolean' ? kept : null;
    } catch {
        return null;
    }
}
/** @param {string | null} address @param {Place} scroll */
function keepScroll(address, scroll) {
    try {
        if (address)
            localStorage.setItem(scrollKey(address), JSON.stringify(scroll));
    } catch {}
}
// biome-ignore lint/suspicious/noControlCharactersInRegex: it strips the terminal's colour codes, which start with ESC
const plain = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

function resultText(content) {
    if (typeof content === 'string') return content;
    return (content ?? [])
        .map((b) =>
            b.type === 'text' ? b.text : b.type === 'image' ? '[image]' : '',
        )
        .join('\n');
}

// One line about a tool call, like Claude's own "● Bash(...)".
function toolLine(name, input = {}) {
    const base = (p) => p?.split(/[\\/]/).pop();
    const said =
        input.description ??
        base(input.file_path ?? input.notebook_path) ??
        input.pattern ??
        input.url ??
        input.query ??
        input.command ??
        input.prompt;
    if (typeof said === 'string') return said.split('\n')[0];
    const first = Object.values(input).find((v) => typeof v === 'string');
    return first?.split('\n')[0] ?? '';
}

// Diffs of Edit / Write calls, drawn like Claude's own: line numbers, red and green rows.
// Once the call is answered, its result carries Claude Code's structuredPatch (hunks with
// context lines and real line numbers); until then the call's own old/new text is shown.
const MAX_DIFF = 400;
const diffText = (s) => s.replace(/\r/g, '').replace(/\t/g, '    ');
const diffLines = (s) => (s ? diffText(s).replace(/\n$/, '').split('\n') : []);
function patchRows(hunks) {
    const rows = [];
    hunks.forEach((h, k) => {
        if (k) rows.push({ kind: 'gap' });
        let old = h.oldStart,
            next = h.newStart;
        for (const line of h.lines) {
            const sign = line[0],
                text = diffText(line.slice(1));
            if (sign === '-') rows.push({ kind: '-', num: old++, text });
            else if (sign === '+') rows.push({ kind: '+', num: next++, text });
            else if (sign === ' ') {
                old++;
                rows.push({ kind: ' ', num: next++, text });
            }
        }
    });
    return rows;
}
const swapRows = (before, after) => [
    ...diffLines(before).map((text) => ({ kind: '-', text })),
    ...diffLines(after).map((text) => ({ kind: '+', text })),
];
// The patch, kept to MAX_DIFF lines (the heap note in ingest), with the whole change's counts.
function keepPatch(hunks) {
    let add = 0,
        del = 0,
        room = MAX_DIFF,
        more = 0;
    const kept = [];
    for (const h of hunks) {
        for (const l of h.lines) {
            if (l[0] === '+') add++;
            else if (l[0] === '-') del++;
        }
        if (room <= 0) {
            more += h.lines.length;
            continue;
        }
        kept.push({
            lines: h.lines.slice(0, room),
            newStart: h.newStart,
            oldStart: h.oldStart,
        });
        more += Math.max(0, h.lines.length - room);
        room -= h.lines.length;
    }
    return { add, del, hunks: kept, more };
}
function diffOf(item) {
    if (item.diff !== undefined) return item.diff;
    const input = item.input ?? {};
    let rows;
    if (item.patch?.hunks.length) rows = patchRows(item.patch.hunks);
    else if (typeof input.content === 'string' && input.file_path)
        rows = diffLines(input.content).map((text, i) => ({
            kind: '+',
            num: i + 1,
            text,
        }));
    else if (typeof input.old_string === 'string')
        rows = swapRows(input.old_string, input.new_string);
    else if (Array.isArray(input.edits))
        rows = input.edits.flatMap((e, k) => [
            ...(k ? [{ kind: 'gap' }] : []),
            ...swapRows(e.old_string, e.new_string),
        ]);
    if (!rows) {
        item.diff = null;
        return null;
    }
    const count = (kind) => rows.filter((r) => r.kind === kind).length;
    const more = (item.patch?.more ?? 0) + Math.max(0, rows.length - MAX_DIFF);
    item.diff = {
        add: item.patch?.hunks.length ? item.patch.add : count('+'),
        del: item.patch?.hunks.length ? item.patch.del : count('-'),
        more,
        path: input.file_path,
        rows: rows.slice(0, MAX_DIFF),
    };
    return item.diff;
}

function toolDetail(input = {}) {
    if (typeof input.command === 'string') return `$ ${input.command}`;
    if (typeof input.old_string === 'string')
        return `${input.file_path}\n- ${input.old_string}\n+ ${input.new_string}`;
    if (typeof input.content === 'string')
        return `${input.file_path}\n${input.content}`;
    return JSON.stringify(input, null, 2);
}

// What the search looks through in an item: its text, and for a tool call its input and output
// too (a hit there opens the row).
function searchText(item) {
    if (item.kind !== 'tool') return item.text ?? '';
    const input = item.input ?? {};
    const head = AGENT_TOOLS.has(item.name)
        ? `${input.subagent_type ?? ''}\n${input.description ?? ''}\n${input.prompt ?? ''}`
        : item.name === 'AskUserQuestion'
          ? JSON.stringify(input)
          : `${item.name}\n${toolLine(item.name, input)}\n${toolDetail(input)}`;
    return `${head}\n${item.result ?? ''}`;
}
// The query as typed, any case.
const findRe = (q, flags = 'i') =>
    new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

// Search hits marked in the text: <mark style="background-color: …"> put into the markdown
// itself (a bare <mark> is a fixed pale yellow the light text can't be read on). Written just
// so: without the space after "background-color:", or with other HTML (<code>, <a>) beside it,
// TextView read the whole message as HTML and its markdown showed as typed (tested 2026-11-02).
// So nothing else changes: marks go into plain text and link text, around a whole code span,
// never into a code block, a table (HTML breaks it) or a link's address.
const MARK = { current: '#f59e0b99', hit: '#f59e0b59' };
// Text with every hit of `re` (global) marked; `esc` escapes the text around and in them.
const marker =
    (re, color, esc = (s) => s) =>
    (s) => {
        let out = '',
            last = 0;
        for (const m of s.matchAll(re)) {
            if (!m[0]) break;
            out += `${esc(s.slice(last, m.index))}<mark style="background-color: ${color}">${esc(m[0])}</mark>`;
            last = m.index + m[0].length;
        }
        return out + esc(s.slice(last));
    };
// Escapes, code spans, **strong** / *em* / ~~strike~~, [links](…) and images, <autolinks>.
const INLINE =
    /\[!-\/:-@[-`{-~]|(`+).+?\1(?!`)|(\*\*|__|\*|~~)(\S(?:.*?\S)?)\2|(!?\[)([^\]]*)(\]\([^)]*\))|<https?:\/\/[^>\s]+>/g;
function markInline(s, mark, test, color) {
    let out = '',
        last = 0;
    for (const m of s.matchAll(INLINE)) {
        out += mark(s.slice(last, m.index));
        last = m.index + m[0].length;
        if (m[1] !== undefined)
            out += test.test(m[0])
                ? `<mark style="background-color: ${color}">${m[0]}</mark>`
                : m[0];
        else if (m[2] !== undefined)
            out += m[2] + markInline(m[3], mark, test, color) + m[2];
        else if (m[4] !== undefined)
            out +=
                m[4] +
                (m[4] === '[' ? markInline(m[5], mark, test, color) : m[5]) +
                m[6];
        else out += m[0];
    }
    return out + mark(s.slice(last));
}
// Claude's markdown with the hits of `re` (global) marked, line by line after any list, quote
// or heading marker.
function markMarkdown(md, re, color) {
    const test = new RegExp(re.source, 'i');
    const mark = marker(re, color);
    let fence = null;
    return md
        .split('\n')
        .map((l) => {
            const f = /^\s*(`{3,}|~{3,})/.exec(l);
            if (fence) {
                if (f && f[1][0] === fence[0] && f[1].length >= fence.length)
                    fence = null;
                return l;
            }
            if (f) {
                fence = f[1];
                return l;
            }
            if (/^\s*\|/.test(l) || !test.test(l)) return l;
            const [, head, rest] =
                /^(\s*(?:>\s*)*(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+|#{1,6}\s+)?)(.*)$/.exec(
                    l,
                );
            return head + markInline(rest, mark, test, color);
        })
        .join('\n');
}
// Your message (see plainMarkdown) with the hits marked.
const plainMarked = (s, re, color) =>
    s
        .replace(/\r/g, '')
        .split(/\n\s*\n/)
        .map((p) =>
            p
                .split('\n')
                .map(marker(re, color, plainEscape))
                .join('\\\n'),
        )
        .join('\n\n');

// The Chat / Terminal switch, the same in my-pane's header (a mod can't import another's).
function viewSwitch(t, here, flip) {
    const seg = (id, label) =>
        div()
            .id(`view-${id}`)
            .px(8)
            .h(20)
            .flex()
            .items_center()
            .rounded(5)
            .text_size(11.5)
            .font_medium()
            .when(id === here, (el) =>
                el.bg(t.selected).text_color(t.foreground),
            )
            .when(id !== here, (el) =>
                el
                    .text_color(t.dim)
                    .cursor_pointer()
                    .hover((s) => s.text_color(t.foreground))
                    .on_click((_e, cx) => {
                        cx.stop_propagation();
                        flip();
                    }),
            )
            .child(label);
    return h_flex()
        .flex_none()
        .p(2)
        .gap(2)
        .rounded(7)
        .bg(t.surface)
        .border(1)
        .border_color(t.border)
        .child(seg('chat', 'Chat'))
        .child(seg('terminal', 'Terminal'));
}

// A tab running Claude before Herdr sees an agent there (its first seconds): it opens on the
// chat, not the terminal. `panes()` knows the program at once (key "claude"); `terminals()`
// doesn't list a new terminal yet (seen 2026-11-01).
function starting(tab) {
    return (
        tab != null &&
        panes().some(
            (p) =>
                p.tab === tab &&
                p.terminal &&
                /^claude/.test(p.program?.key ?? ''),
        )
    );
}

export default class ClaudeChat extends View {
    init(_props, cx) {
        if (props()?.settings) {
            // Hex boxes for any background or text color; a full #rrggbb takes effect as it's typed.
            const look = chatLook();
            this.hex = {};
            for (const key of ['bg', 'fg']) {
                const s = InputState.new({
                    placeholder: '#hex',
                    value: HEX.test(look[key]) ? look[key] : '',
                });
                s.on('change', () => {
                    const v = s.value().trim().replace(/^#?/, '#');
                    if (
                        HEX.test(v) &&
                        v.toLowerCase() !==
                            String(chatLook()[key]).toLowerCase()
                    )
                        setLook({ [key]: v });
                });
                this.hex[key] = s;
            }
            // null while programs.json is read; "error" if it isn't valid JSON (left alone then).
            this.dev = null;
            cx.spawn(async (cx) => {
                try {
                    this.dev = await devContainerOn();
                } catch {
                    this.dev = 'error';
                }
                cx.notify();
            });
            return;
        }
        this.cache = new Map();
        this.scroll = VirtualListScrollHandle.new();
        this.measureGen = 0;
        this.reset(null);
        this.open = new Set();
        // Earlier turns whose work was clicked open, as "<address>:<index of its first item>".
        this.unfolded = new Set();
        // Images pasted for a dev container's Claude: their paths in the container, by agent address,
        // sent with the next message (see pasteIntoContainer).
        this.pasted = new Map();
        // what he sent while the seat worked, by agent address, until its row reaches the transcript (see queued.js)
        this.queued = new Map();
        this.idleSince = new Map();
        this.box = TextareaState.new({});
        this.box.set_auto_grow(1, 8);
        cx.spawn(async (/** @type {import('gpui-kit').Context} */ cx) => {
            const old = `${appHome()}/data/claude-chat`;
            if (
                !(await importOldDrafts(old)) ||
                !this.address ||
                this.box.value()
            )
                return;
            this.typed = keptDraft(this.address);
            this.box.set_value(this.typed);
            this.box.set_selected_range({
                end: this.typed.length,
                start: this.typed.length,
            });
            cx.notify();
        });
        this.keyboard = cx.focus_handle();
        this.typed = '';
        this.menuAt = 0;
        this.menuOff = false;
        // The "/word" being typed, anywhere in the box (see slashAt), or null.
        this.slash = null;
        // The right-click menu over the log: { x, y (in the log), text (the message under the pointer) }.
        this.ctx = null;
        // A redraw rebuilds every message, so typing redraws only for the / menu, the one thing
        // that depends on what's typed (the box draws its own text).
        this.box.on('change', (_e, cx) => {
            const was = this.typed,
                had = this.slash;
            const now = this.box.value();
            // a paste of several lines (more than Enter's one character): its list lines get their markers back
            if (now.length > was.length + 1 && now.includes('\n')) {
                const fixed = withMarkers(
                    was,
                    now,
                    listLines(
                        this.items
                            .filter(
                                (/** @type {any} */ i) =>
                                    i.kind !== 'tool' &&
                                    typeof i.text === 'string',
                            )
                            .map((/** @type {any} */ i) => i.text),
                    ),
                );
                if (fixed !== now) return this.box.set_value(fixed);
            }
            // a closed `code` span becomes one chip (chips.js); the replace fires this handler again with the same text
            const spans = codeSpans(
                now,
                this.box.tokens().map((s) => s.range),
            );
            if (spans.length) {
                applyChips(this.box, now, spans, caretAfter(was, now));
                return;
            }
            const hadText = Boolean(this.typed?.trim());
            this.typed = now;
            keepDraft(this.address, this.typed);
            // the send button lights up with the first character and dims when the box empties
            if (hadText !== Boolean(now.trim())) cx.notify();
            // Enter's newline, typed at the word (it arrives before submit): keep the menu as it was
            // for submit to use; complete() drops the newline.
            if (
                had &&
                this.typed === was.slice(0, had.end) + '\n' + was.slice(had.end)
            )
                return;
            this.slash = slashAt(this.typed, caretAfter(was, this.typed));
            if (!sameSlash(had, this.slash)) {
                this.menuAt = 0;
                this.menuOff = false;
            }
            if (had || this.slash) cx.notify();
        });
        // Enter has already put its newline in; Shift+Enter keeps it. With the / menu open,
        // Enter runs the highlighted command, as in Claude's own menu, when the command starts the
        // message; further in (a skill named mid-sentence), it only fills the name in.
        this.box.on('submit', (e, cx) => {
            if (e.shift) return;
            const pick = this.matches()[this.menuAt];
            if (pick && this.slash.start > 0) {
                this.complete(pick[0]);
                return cx.notify();
            }
            if (pick)
                this.box.set_value(
                    `/${pick[0]}${this.slash.text.slice(this.slash.end)}`,
                );
            this.send(cx);
        });
        this.box.on('paste_other', (_e, cx) => this.pasteImage(cx));
        // The / menu's keys. The box binds ↑ ↓ Tab Esc ← → Home End itself (input::MoveUp,
        // IndentInline, …): those actions run before any key handler around it and stop the key,
        // so an on_key_down on the composer never saw them. Bindings of our own under a deeper
        // context come first (the win98 mod's trick for Escape): the composer is "ChatSlash" while
        // the menu is open, and the box inside it is gpui-component's "Input".
        try {
            cx.bind_keys(
                ['Input', 'Textarea', 'TextArea'].flatMap((box) =>
                    [
                        ['down', 'x_herdr_chatter_menu_down'],
                        ['up', 'x_herdr_chatter_menu_up'],
                        ['tab', 'x_herdr_chatter_menu_fill'],
                        ['escape', 'x_herdr_chatter_menu_close'],
                        ['left', 'x_herdr_chatter_menu_leave'],
                        ['right', 'x_herdr_chatter_menu_leave'],
                        ['home', 'x_herdr_chatter_menu_leave'],
                        ['end', 'x_herdr_chatter_menu_leave'],
                    ].map(([keystroke, action]) => ({
                        action,
                        context: `ChatSlash > ${box}`,
                        keystroke,
                    })),
                ),
            );
            // Esc while Claude works = Stop (the composer is "ChatStop" then, with the menu closed).
            cx.bind_keys(
                ['Input', 'Textarea', 'TextArea'].map((box) => ({
                    action: 'x_herdr_chatter_stop',
                    context: `ChatStop > ${box}`,
                    keystroke: 'escape',
                })),
            );
        } catch {}
        // Search (Ctrl+F, or the header's magnifier): findQ is the query in use (typing settles for
        // 150 ms first, since a redraw rebuilds every message), findList its hits oldest first
        // ({ item, id }: id = the row's), findAt the current one. seek: the row to scroll to.
        this.findOpen = false;
        this.findQ = '';
        this.findList = [];
        this.findAt = null;
        this.findKey = null;
        this.findWhat = null;
        this.findBox = InputState.new({ placeholder: 'Search this chat' });
        this.findKeys = cx.focus_handle();
        this.rootKeys = cx.focus_handle();
        this.findBox.on('change', (_e, cx) => {
            this.findGen = (this.findGen ?? 0) + 1;
            const gen = this.findGen;
            cx.timer.after(150, (cx) => {
                if (gen !== this.findGen) return;
                this.findQ = this.findBox.value().trim();
                cx.notify();
            });
        });
        // From the newest hit up: Enter goes to the older one, Shift+Enter the newer.
        this.findBox.on('submit', (e, cx) =>
            this.findStep(e.shift ? 1 : -1, cx),
        );
        cx.timer.every(2000, (cx) => this.tick(cx));
        this.tick(cx);
    }

    // Each agent's chat is kept, so going back to one shows it at once; the tick then catches up.
    // The draft is written only where it changes (typing, a quote, a completion, a send), under the seat the box shows:
    // a switch never writes, since the box it leaves may not hold that seat's draft, and an empty one would erase it.
    reset(address) {
        if (this.box) {
            this.box.set_value(keptDraft(address));
            this.typed = this.box.value();
            // a restored draft puts the caret after it, so what he types next goes on its end
            this.box.set_selected_range({
                end: this.typed.length,
                start: this.typed.length,
            });
        }
        this.leftInBox = null;
        if (this.address) keepScroll(this.address, this.place());
        if (this.address)
            this.cache.set(this.address, {
                anchor: this.follow ? null : this.firstKey,
                base: this.base,
                effort: this.effort,
                file: this.file,
                follow: this.follow,
                head: this.head,
                items: this.items,
                lastReply: this.lastReply,
                looked: this.looked,
                model: this.model,
                pos: this.pos,
                relayIds: this.relayIds,
                session: this.session,
                skills: this.skills,
                subs: this.subs,
                tools: this.tools,
                where: this.where,
            });
        this.address = address;
        const kept = this.cache.get(address) ?? {};
        this.where = kept.where ?? null;
        this.session = kept.session ?? null;
        this.file = kept.file ?? null;
        this.pos = kept.pos ?? 0;
        // head: the byte the loaded part of the transcript starts at (null: not opened yet); base: how many items
        // were read in above the first loaded ones, so a row keeps its id when earlier ones arrive
        this.head = kept.head ?? null;
        this.base = kept.base ?? 0;
        this.items = kept.items ?? [];
        this.tools = kept.tools ?? new Map();
        this.skills = kept.skills ?? new Map();
        // subs: each sub-agent by the id of the tool call that started it; trail: the ones opened.
        this.subs = kept.subs ?? new Map();
        this.trail = [];
        this.looked = kept.looked ?? 0;
        this.stale = Boolean(kept.file);
        this.lastReply = kept.lastReply ?? null;
        // The model as the transcript last named it (a reply's, or /model's output), and the effort
        // /effort last set: { level, model } (the model it was set on).
        this.model = kept.model ?? null;
        this.effort = kept.effort ?? null;
        this.drop = null;
        this.pickNote = null;
        // where he was reading this seat: kept in the cache across a tab switch, in localStorage across a reload
        const stored = kept.items ? null : keptScroll(address);
        /** @type {boolean} */
        this.follow = kept.follow ?? stored?.follow ?? true;
        const anchor = this.follow
            ? null
            : (kept.anchor ?? stored?.anchor ?? null);
        const uuid = kept.items ? null : (stored?.uuid ?? null);
        /** @type {{ how: 'top' | 'center', key: string, uuid?: string | null, until: number } | null} */
        this.anchor =
            anchor || uuid
                ? { how: 'top', key: anchor, until: Date.now() + 8000, uuid }
                : null;
        if (!this.anchor) this.follow = true;
        this.reanchor = Boolean(this.anchor);
        this.firstKey = anchor;
        this.firstUuid = uuid;
        this.stick = this.follow;
        this.range = null;
        this.problem = null;
        this.screen = null;
        this.rowH = new Map();
        this.measuredAt = new Map();
        this.flips = new Map();
        /** @type {string} */
        this.rowFit = '';
        this.seek = null;
        this.relayIds = kept.relayIds ?? new Set();
        this.leftUuid = undefined;
    }

    // The other Claude agents' sessions, found ahead of time (one process walk for all), so
    // switching to one doesn't wait for it.
    async warm() {
        const live = new Set(agents().map((a) => a.address));
        for (const address of [...this.cache.keys()])
            if (!live.has(address)) this.cache.delete(address);
        const todo = agents().filter(
            (a) =>
                a.app === 'claude-code' &&
                a.address !== this.address &&
                !this.cache.get(a.address)?.where &&
                Date.now() - (this.cache.get(a.address)?.looked ?? 0) > 30000,
        );
        if (!todo.length) return;
        const tree = await children();
        for (const { address } of todo) {
            const where = await locate(address, tree).catch(() => null);
            if (address !== this.address)
                this.cache.set(address, {
                    ...this.cache.get(address),
                    looked: Date.now(),
                    where,
                });
        }
    }

    // The other Claude agents' sub-agents (their meta files only), every 6 s, so the count covers
    // every agent. A changed session (/clear) starts what's kept of that agent over.
    async scanOthers() {
        if (Date.now() - (this.scanned ?? 0) < 6000) return;
        this.scanned = Date.now();
        for (const { address } of agents().filter(
            (a) => a.app === 'claude-code' && a.address !== this.address,
        )) {
            const kept = this.cache.get(address);
            if (!kept?.where) continue;
            const session = await sessionOf(kept.where).catch(() => null);
            if (
                !session ||
                address === this.address ||
                this.cache.get(address) !== kept
            )
                continue;
            if (session.sessionId !== kept.session?.sessionId || !kept.file) {
                const file = await fileOf(kept.where, session);
                Object.assign(kept, {
                    file,
                    items: [],
                    pos: 0,
                    session,
                    skills: new Map(),
                    subs: new Map(),
                    tools: new Map(),
                });
            }
            if (kept.file)
                await this.readSubs(
                    kept.where,
                    kept.subs,
                    kept.file.replace(/\.jsonl$/, '/subagents'),
                    true,
                ).catch(() => {});
        }
    }

    // Shares how many sub-agents each agent has at work (SUBS), when that changed.
    publish() {
        const counts = {};
        const count = (address, subs, tools) => {
            const n = [...(subs ?? [])].filter(([id, s]) =>
                subRunning(s, tools?.get(id)),
            ).length;
            if (address && n) counts[address] = n;
        };
        for (const [address, kept] of this.cache)
            if (address !== this.address) count(address, kept.subs, kept.tools);
        count(this.address, this.subs, this.tools);
        const key = (o) => JSON.stringify(Object.entries(o ?? {}).sort());
        if (key(counts) !== key(shared(SUBS))) setShared(SUBS, counts);
        // Which dev container each Claude runs in (its id or name, as `docker exec` got it), for
        // my-status: the container's /workspace holds the repos that agent works on.
        const boxes = {};
        for (const [address, kept] of this.cache)
            if (address !== this.address && kept.where?.container)
                boxes[address] = kept.where.container;
        if (this.address && this.where?.container)
            boxes[this.address] = this.where.container;
        if (key(boxes) !== key(shared(CONTAINERS)))
            setShared(CONTAINERS, boxes);
    }

    // props.terminal, else the shown tab's Claude (the focused one when it has several).
    target() {
        const claude = agents().filter((a) => a.app === 'claude-code');
        if (props()?.terminal)
            return claude.find((a) => a.address === props().terminal) ?? null;
        const f = focused();
        const mine = claude.filter((a) => a.tab === f?.tab);
        return (
            mine.find((a) => a.address === (f?.agent ?? f?.terminal)) ??
            mine.find((a) => a.address === this.address) ??
            mine[0] ??
            null
        );
    }

    // In a layout stack (props { stack, self, other }): the chat and the tab's terminals take
    // turns. Whether the chat shows now, from the layout with its clicks.
    showing() {
        const { stack, self } = props() ?? {};
        if (!stack) return true;
        const find = (node) =>
            node?.id === stack
                ? node
                : (node?.children ?? []).map(find).find(Boolean);
        const node = find(layout());
        return (node?.active ?? node?.children?.[0]?.id) === self;
    }

    // A tab with no Claude in it (and none starting) always shows the Terminal: the chat has
    // nothing to show there. The stack is shared by every tab, so it flips back to the chat as
    // soon as a Claude runs there (or on going to a tab with one): the first message can be typed
    // in the chat, it goes by `hc send` like any other. Only a flip made here goes back: Terminal
    // picked by hand stays.
    autoView(agent) {
        const { stack, self, other } = props() ?? {};
        const tab = focused()?.tab;
        if (!stack || props()?.terminal || tab == null) return;
        const empty = !agent && !starting(tab);
        const showing = this.showing();
        if (showing) this.flipped = false;
        if (empty && showing) {
            this.flipped = true;
            run('layout.select', { child: other, stack });
        } else if (this.flipped && !empty) {
            this.flipped = false;
            run('layout.select', { child: self, stack });
        }
    }

    // Claude's settings for the shown agent: this computer's ~/.claude/settings.json, or the
    // container's own (read in tick). Unknown (null) until the agent is found.
    settingsNow() {
        if (!this.where) return null;
        return this.where.container
            ? (this.containerSettings?.[this.where.container]?.s ?? null)
            : this.claudeSettings;
    }

    // The effort the shown session runs at: what /effort set on this model, else the default
    // Claude's settings keep for the model.
    effortNow() {
        const model = this.modelNow();
        if (!model) return null;
        if (this.effort?.model === model) return this.effort.level;
        const s = this.settingsNow();
        return (
            s?.modelSettings?.[modelId(model)]?.effortLevel ??
            s?.effortLevel ??
            null
        );
    }

    // The model: as the transcript last named it, else (a new session, no transcript yet) the
    // default in Claude's settings.
    modelNow() {
        if (this.model) return this.model;
        const m = this.settingsNow()?.model;
        return (
            MODELS.find(([alias]) => alias === m)?.[1] ??
            (/^claude-/.test(m ?? '') ? modelLabel(m) : null)
        );
    }

    // A pick from the model / effort bar, made in Claude's own /model or /effort picker with its
    // "s" key (this session only): `/model opus`, `/effort high` and a digit in the picker all
    // also save it as the default for new sessions (Claude 2.1.318, 2026-11-05). The header says
    // "Switching…" until the transcript shows the change (`pending`), or after 12 s that it didn't.
    pick(kind, value, address, cx) {
        this.drop = null;
        this.pending = { address, kind, until: Date.now() + 12000, value };
        this.pickNote = null;
        cx.notify();
        cx.spawn(async (cx) => {
            const screen = async () =>
                (await hc(['read', address])).stdout.replace(/\r/g, '');
            // Types the command, waits for its picker (`ready` tests the screen), then `keys`.
            const inPicker = async (command, ready, what) => {
                await hc(['keys', address, ...command.split('')]);
                await hc(['keys', address, 'enter']);
                for (let i = 0; i < 20; i++) {
                    await cx.sleep(150);
                    if (ready(await screen())) return;
                }
                await hc(['keys', address, 'esc']);
                throw new Error(`Claude's ${what} picker didn't open`);
            };
            try {
                if (kind === 'model') {
                    // Rows "N.  Opus 5.5   …" (row 1 is "Default (recommended)"); Home goes to row 1.
                    const row = new RegExp(
                        `^\\s*(?:❯\\s*)?(\\d+)\\.\\s+${value.replace(/\./g, '\\.')}\\s`,
                        'm',
                    );
                    await inPicker(
                        '/model',
                        (s) => /Select model/.test(s) && row.test(s),
                        'model',
                    );
                    const n = Number(row.exec(await screen())?.[1] ?? 0);
                    if (!n)
                        throw new Error(
                            `${value} isn't in Claude's /model list`,
                        );
                    await hc([
                        'keys',
                        address,
                        'home',
                        ...Array(n - 1).fill('down'),
                    ]);
                    await cx.sleep(100);
                    // Only on the right row (the list could have moved): else leave it untouched.
                    const at = /^\s*❯\s*\d+\.\s+(.*?)\s{2,}/m.exec(
                        await screen(),
                    )?.[1];
                    if (at?.replace(/\s*✔$/, '') !== value) {
                        await hc(['keys', address, 'esc']);
                        throw new Error(`Couldn't select ${value}`);
                    }
                    await hc(['keys', address, 's']);
                } else {
                    // The effort slider starts at the current level; ← five times is low.
                    await inPicker(
                        '/effort',
                        (s) => /Faster[\s\S]*Smarter/.test(s),
                        'effort',
                    );
                    await hc([
                        'keys',
                        address,
                        ...Array(5).fill('left'),
                        ...Array(EFFORTS.indexOf(value)).fill('right'),
                        's',
                    ]);
                }
                // Mid-conversation Claude asks first ("Change effort level? … the full history gets
                // re-read on your next message", "❯ 1. Yes, switch to low"): the pick was the answer.
                for (let i = 0; i < 8; i++) {
                    await cx.sleep(200);
                    if (/^\s*❯\s*1\.\s+Yes, switch/m.test(await screen())) {
                        await hc(['keys', address, 'enter']);
                        break;
                    }
                }
            } catch (e) {
                this.pending = null;
                this.pickNote = String(e?.message ?? e);
            }
            cx.notify();
        });
    }

    // Whether the pick in flight has landed (the transcript names it) or timed out.
    settlePick() {
        const p = this.pending;
        if (!p || p.address !== this.address) return;
        const now = p.kind === 'model' ? this.model : this.effortNow();
        if (now === p.value) this.pending = null;
        else if (Date.now() > p.until) {
            this.pending = null;
            this.pickNote = 'No change seen: look at the Terminal';
        }
    }

    // The model and effort dropdowns at the right of the box: the trigger shows the current one
    // (or "Opus 5.5…" while a pick lands), the list opens upward with the current one ticked.
    // Picks only while Claude waits for you: a pick while it works would queue behind the turn,
    // and keys typed into the effort picker would land in its prompt instead.
    dropdown(t, agent, kind) {
        const ready = agent.status !== 'working' && agent.status !== 'blocked';
        const now = kind === 'model' ? this.modelNow() : this.effortNow();
        const p =
            this.pending?.address === this.address && this.pending.kind === kind
                ? this.pending
                : null;
        const open = this.drop === kind;
        const options =
            kind === 'model' ? MODELS.map(([, label]) => label) : EFFORTS;
        const trigger = h_flex()
            .id(`drop-${kind}-trigger`)
            .flex_none()
            .gap(4)
            .px(6)
            .h(24)
            .items_center()
            .rounded(6)
            .when(open, (el) => el.bg(t.hover))
            .cursor_pointer()
            .text_size(px(12))
            .text_color(p ? t.accent : t.muted)
            .hover((s) => s.bg(t.hover).text_color(t.foreground))
            .tooltip(
                kind === 'model'
                    ? 'Model (this session only)'
                    : 'Effort (this session only)',
            )
            .child(
                p
                    ? `${p.value}…`
                    : (now ?? (kind === 'model' ? 'Model' : 'Effort')),
            )
            .child(
                svg('mods/workspace-chrome/chevron-down.svg')
                    .size(12)
                    .text_color(t.dim),
            );
        const row = (value) =>
            h_flex()
                .id(`drop-${kind}-${value}`)
                .gap(8)
                .px(8)
                .h(26)
                .items_center()
                .rounded(5)
                .text_size(px(12.5))
                .when(value === now, (el) =>
                    el.text_color(t.foreground).bg(t.selected),
                )
                .when(value !== now && ready, (el) =>
                    el
                        .cursor_pointer()
                        .text_color(t.muted)
                        .hover((s) => s.bg(t.hover).text_color(t.foreground))
                        .on_click((_e, cx) => {
                            this.drop = null;
                            this.pick(kind, value, agent.address, cx);
                            this.box.focus();
                        }),
                )
                .when(value !== now && !ready, (el) => el.text_color(t.dim))
                .child(
                    div()
                        .w(12)
                        .flex_none()
                        .text_color(t.accent)
                        .child(value === now ? '✓' : ''),
                )
                .child(value);
        return Popover.new(`drop-${kind}`)
            .anchor('bottom_right')
            .open(open)
            .on_open_change((o, cx) => {
                this.drop = o ? kind : null;
                this.pickNote = null;
                cx.notify();
            })
            .trigger(trigger)
            .content(
                v_flex()
                    .w(kind === 'model' ? 190 : 230)
                    .p(4)
                    .gap(1)
                    .mb(6)
                    .rounded(8)
                    .bg(t.popover)
                    .border(1)
                    .border_color(t.border)
                    .children(options.map(row))
                    .child(
                        div()
                            .px(8)
                            .pt(6)
                            .pb(2)
                            .text_size(px(10.5))
                            .text_color(t.dim)
                            .child(
                                !ready
                                    ? 'Can change once Claude stops'
                                    : kind === 'effort'
                                      ? 'This session only. Mid-chat, the next reply re-reads the history.'
                                      : 'This session only',
                            ),
                    ),
            );
    }

    toTerminal(address) {
        const { stack, other } = props() ?? {};
        if (stack) run('layout.select', { child: other, stack });
        if (address) run('pane.focus', { terminal: address });
    }

    // Every 2 s: which session the agent is on now (/clear and /resume change it), and while
    // it's asking something, the bottom of its screen.
    tick(cx) {
        // the band's facts age without a redraw: a deck that stopped publishing changes nothing, so the flip is drawn here
        const isStale = bandOf(
            shared(SEATS_KEY),
            this.where?.container ? null : this.where?.pid,
            Date.now(),
        ).isStale;
        if (isStale !== this.bandStale) {
            this.bandStale = isStale;
            cx.notify();
        }
        if (!this.warming) {
            this.warming = true;
            cx.spawn(async () => {
                try {
                    await this.warm();
                    await this.scanOthers();
                    this.publish();
                } finally {
                    this.warming = false;
                }
            });
        }
        // Claude's own settings, for the effort a session starts on (see effortNow), every 30 s.
        // the operator override the band's 🔓 shows, read every 5 s from the store x-mod-guard and `x` read
        if (Date.now() - (this.overrideAt ?? 0) > 5000) {
            this.overrideAt = Date.now();
            cx.spawn(async (/** @type {import('gpui-kit').Context} */ cx) => {
                const text = await readFile(
                    `${home()}/${OVERRIDE_STORE}`,
                    'utf8',
                ).catch(() => null);
                let store = null;
                try {
                    store = text ? JSON.parse(text) : null;
                } catch {}
                const next = overrideOf(store, Date.now());
                if (JSON.stringify(next) !== JSON.stringify(this.override)) {
                    this.override = next;
                    cx.notify();
                }
            });
        }
        this.readStates(cx);
        // a press on the deck or another band shows here at once, not at the next tick
        if (!this.isPressWatched) {
            this.isPressWatched = true;
            cx.spawn(async (/** @type {import('gpui-kit').Context} */ cx) => {
                try {
                    for (;;) {
                        await watchFolder(`${home()}/${PRESS_DIR}`);
                        this.readStates(cx);
                    }
                } catch {
                    this.isPressWatched = false;
                }
            });
        }
        if (Date.now() - (this.claudeSettingsAt ?? 0) > 30000) {
            this.claudeSettingsAt = Date.now();
            cx.spawn(async (cx) => {
                const text = await readFile(
                    `${CLAUDE}/settings.json`,
                    'utf8',
                ).catch(() => null);
                let s = null;
                try {
                    s = text ? JSON.parse(text) : null;
                } catch {}
                if (JSON.stringify(s) !== JSON.stringify(this.claudeSettings)) {
                    this.claudeSettings = s;
                    cx.notify();
                }
            });
        }
        // A dev container's Claude has its own settings (its CLAUDE_CONFIG_DIR): read them there,
        // every 30 s per container (the effort dropdown showed nothing for container agents).
        const container = this.where?.container;
        if (container) {
            this.containerSettings ??= {};
            const kept = this.containerSettings[container];
            if (Date.now() - (kept?.at ?? 0) > 30000) {
                this.containerSettings[container] = { ...kept, at: Date.now() };
                const where = this.where;
                cx.spawn(async (cx) => {
                    const r = await inDocker(
                        where,
                        'cat "$d/settings.json" 2>/dev/null',
                    ).catch(() => null);
                    let s = null;
                    try {
                        s = r?.stdout?.trim() ? JSON.parse(r.stdout) : null;
                    } catch {}
                    const now = this.containerSettings[container];
                    if (JSON.stringify(s) !== JSON.stringify(now?.s)) {
                        this.containerSettings[container] = { ...now, s };
                        cx.notify();
                    }
                });
            }
        }
        const agent = this.target();
        if ((agent?.address ?? null) !== this.address) {
            this.reset(agent?.address ?? null);
            cx.notify();
        }
        this.autoView(agent);
        // One tick at a time per agent; a slow one for the agent left behind doesn't hold this one up.
        if (!agent || this.busy === agent.address) return;
        const address = agent.address;
        this.busy = address;
        // Redraw only when something changed: a redraw rebuilds the markdown, which drops a
        // text selection in progress.
        const before = this.drawn();
        cx.spawn(async (cx) => {
            try {
                if (!this.where && Date.now() - this.looked > 10000) {
                    this.looked = Date.now();
                    const where = await locate(address);
                    if (this.address !== address) return;
                    this.where = where;
                    if (!where)
                        this.problem =
                            "Can't find this agent's Claude session.";
                }
                const where = this.where;
                if (where && this.address === address) {
                    const session = await sessionOf(where);
                    if (this.address !== address) return;
                    if (!session) {
                        this.where = null;
                        this.looked = 0;
                    } else if (
                        session.sessionId !== this.session?.sessionId ||
                        !this.file
                    ) {
                        // In a container the file is read through docker, relative to its Claude folder.
                        const file = where.container
                            ? `projects/${folderName(session.cwd)}/${session.sessionId}.jsonl`
                            : await transcriptOf(session);
                        if (this.address !== address) return;
                        this.items = [];
                        this.tools = new Map();
                        this.skills = new Map();
                        this.subs = new Map();
                        this.trail = [];
                        this.pos = 0;
                        this.head = null;
                        this.base = 0;
                        this.relayIds = new Set();
                        // another conversation in this seat (a /clear, a resume): it starts at its newest
                        this.follow = true;
                        this.stick = true;
                        this.anchor = null;
                        this.session = session;
                        this.file = file;
                        this.ensurePluginSkills();
                        this.problem = file
                            ? null
                            : 'No transcript yet: say something.';
                        if (file) {
                            await this.load(cx);
                            if (!where.container) this.watch(file, cx);
                        }
                    } else if (where.container || this.stale) {
                        // Back to a kept chat: read what was added while away, and watch its folder again.
                        this.stale = false;
                        await this.load(cx);
                        if (!where.container && this.address === address)
                            this.watch(this.file, cx);
                    }
                    if (this.file && this.address === address)
                        await this.loadSubs();
                }
                const screen =
                    agent.status === 'blocked'
                        ? await this.tail(address)
                        : null;
                if (this.address === address) this.screen = screen;
                if (this.address === address) await this.checkBox(agent);
            } catch (e) {
                this.problem = String(e?.message ?? e);
            } finally {
                if (this.busy === address) this.busy = null;
                this.publish();
                if (this.drawn() !== before) cx.notify();
            }
        });
    }

    // What tick and watch can change on screen.
    drawn() {
        // A model / effort pick in flight: its timeout redraws too (see settlePick).
        return `${this.address}|${this.version}|${this.problem}|${this.screen}|${this.pending ? Date.now() > this.pending.until : ''}`;
    }

    async tail(address) {
        const r = await hc(['read', address]);
        const lines = r.stdout.replace(/\r/g, '').split('\n');
        // From the rule above the prompt's first option ("1.") down, without the blank rows. Not the
        // last rule: questions have another one lower down, above "Chat about this".
        // 80 rows: a long question (paragraphs of context, four options with descriptions) is taller than 40.
        let start = Math.max(0, lines.length - 80);
        let first = lines.length - 1;
        while (first > start && !/^\s*(❯\s*)?1\.\s/.test(lines[first])) first--;
        if (first === start) first = lines.length - 3;
        for (let i = first; i > start; i--)
            if (/^\s*[─━]{20,}/.test(lines[i])) {
                start = i + 1;
                break;
            }
        return lines
            .slice(start)
            .filter((l) => l.trim())
            .join('\n');
    }

    watch(file, cx) {
        const dir = file.replace(/[\\/][^\\/]+$/, '');
        if (this.watched === dir) return;
        this.watched = dir;
        cx.spawn(async (cx) => {
            try {
                while (this.watched === dir) {
                    const changed = (await watchFolder(dir)).map((p) =>
                        p.replace(/\\/g, '/'),
                    );
                    if (this.watched !== dir || !this.file) continue;
                    const before = this.drawn();
                    if (
                        changed.some((p) =>
                            p.endsWith(this.file.split('/').pop()),
                        )
                    )
                        await this.load(cx);
                    if (changed.some((p) => p.includes('/subagents/')))
                        await this.loadSubs();
                    if (this.drawn() !== before) cx.notify();
                }
            } catch {
                this.watched = null;
            }
        });
    }

    // The part of the transcript above what is loaded, one slice per ask, read in above the first rows. The chat's
    // own state (the last reply, the model, the effort) stays as the newer lines set it.
    async loadEarlier() {
        const file = this.file;
        const head = this.head;
        if (!file || !head || this.earlierLoading) return;
        this.earlierLoading = true;
        try {
            const from = await lineStartAt(
                file,
                Math.max(0, head - LOAD_SLICE),
            );
            const text = await readRange(file, from, head);
            if (file !== this.file || head !== this.head) return;
            /** @type {any[]} */
            const later = this.items;
            const kept = {
                effort: this.effort,
                lastReply: this.lastReply,
                model: this.model,
            };
            this.items = /** @type {any[]} */ ([]);
            this.ingest(text);
            /** @type {any[]} */
            const earlier = this.items;
            Object.assign(this, kept);
            this.items = earlier.concat(later);
            this.base += earlier.length;
            this.head = from;
        } finally {
            this.earlierLoading = false;
        }
    }

    // Reads what was added since last time. The file only grows; a half-written last line waits.
    async load(_cx) {
        const file = this.file;
        if (this.loading === file) {
            this.again = true;
            return;
        }
        this.loading = file;
        try {
            do {
                this.again = false;
                if (this.where?.container) {
                    await this.loadDocker(this.where);
                    continue;
                }
                if (this.head === null && this.pos === 0) {
                    const size = await sizeOf(file);
                    const at =
                        size > LOAD_SLICE
                            ? await lineStartAt(file, size - LOAD_SLICE)
                            : 0;
                    if (file !== this.file) return;
                    this.head = at;
                    this.pos = at;
                }
                const { text, end, more } = await readAfter(
                    file,
                    this.pos,
                    LOAD_SLICE,
                );
                if (file !== this.file) return;
                if (text === null) {
                    this.items = [];
                    this.tools = new Map();
                    this.skills = new Map();
                    this.subs = new Map();
                    this.trail = [];
                    this.pos = 0;
                    this.head = null;
                    this.base = 0;
                    this.relayIds = new Set();
                    this.again = true;
                } else if (text) {
                    this.ingest(text);
                    this.pos = end;
                    if (more) this.again = true;
                }
            } while (this.again && file === this.file);
        } finally {
            if (this.loading === file) this.loading = null;
        }
    }

    // A container's transcript, polled (no folder watch in there): the bytes after `pos`, at most
    // CHUNK at a time (exec's output is capped), up to the last whole line. `into` is this chat or
    // one of its sub-agents (both have file, pos, items, tools).
    async loadDocker(where, into = this) {
        for (;;) {
            const file = into.file;
            const r = await inDocker(
                where,
                'tail -c +"$3" "$d/$2" 2>/dev/null | head -c "$4"',
                file,
                String(into.pos + 1),
                String(CHUNK),
            );
            if (file !== into.file || where !== this.where) return;
            const text = r.stdout;
            const end = text.lastIndexOf('\n') + 1;
            const full = Buffer.from(text, 'utf8').length >= CHUNK - 16;
            if (end === 0) {
                // One line longer than a chunk: skip it.
                if (full)
                    into.pos +=
                        Number(
                            (
                                await inDocker(
                                    where,
                                    'tail -c +"$3" "$d/$2" | head -n 1 | wc -c',
                                    file,
                                    String(into.pos + 1),
                                )
                            ).stdout.trim(),
                        ) || 0;
                if (!full) return;
                continue;
            }
            const part = text.slice(0, end);
            this.ingest(part, into);
            into.pos += Buffer.from(part, 'utf8').length;
            if (!full) return;
        }
    }

    // The sub-agents' transcripts, each with a .meta.json naming the tool call that started it,
    // read like the main one: only what was added. A finished one is read once more, then left.
    async loadSubs() {
        if (!this.file) return;
        if (this.subsBusy) {
            this.subsAgain = true;
            return;
        }
        this.subsBusy = true;
        try {
            do {
                this.subsAgain = false;
                await this.readSubs(
                    this.where,
                    this.subs,
                    this.file.replace(/\.jsonl$/, '/subagents'),
                );
            } while (this.subsAgain);
        } finally {
            this.subsBusy = false;
        }
    }

    // metasOnly: just the meta files (for the count), not the transcripts.
    async readSubs(where, subs, dir, metasOnly = false) {
        const metas = [];
        if (where?.container) {
            const r = await inDocker(
                where,
                'cd "$d/$2" 2>/dev/null || exit 0; for f in *.meta.json; do [ -f "$f" ] && printf "%s %s\\n" "${f%.meta.json}" "$(tr -d "\\n" < "$f")"; done',
                dir,
            );
            for (const line of r.stdout.split('\n')) {
                const m = /^(\S+) (\{.*\})$/.exec(line.trim());
                if (m) metas.push([m[1], m[2]]);
            }
        } else {
            const finished = new Set(
                [...subs.values()].filter((s) => s.finished).map((s) => s.name),
            );
            for (const f of await readdir(dir).catch(() => [])) {
                const name = f.endsWith('.meta.json')
                    ? f.slice(0, -'.meta.json'.length)
                    : null;
                if (name && !finished.has(name))
                    metas.push([
                        name,
                        await readFile(`${dir}/${f}`, 'utf8').catch(() => null),
                    ]);
            }
        }
        for (const [name, text] of metas) {
            let meta;
            try {
                meta = JSON.parse(text);
            } catch {
                continue;
            }
            const key = meta.toolUseId ?? name;
            const sub = subs.get(key) ?? {
                file: `${dir}/${name}.jsonl`,
                items: [],
                name,
                pos: 0,
                skills: new Map(),
                tools: new Map(),
            };
            if (Boolean(meta.finished) !== Boolean(sub.finished))
                this.version = (this.version ?? 0) + 1;
            Object.assign(sub, {
                about: meta.description,
                finished: Boolean(meta.finished),
                model: meta.model,
                type: meta.agentType,
            });
            subs.set(key, sub);
        }
        if (metasOnly) return;
        for (const sub of subs.values()) {
            if (sub.read) continue;
            const finished = sub.finished;
            if (where?.container) await this.loadDocker(where, sub);
            else {
                const { text, end } = await readAfter(sub.file, sub.pos).catch(
                    () => ({ text: '' }),
                );
                if (text) {
                    this.ingest(text, sub);
                    sub.pos = end;
                }
            }
            if (finished) sub.read = true;
        }
    }

    // `into`: this chat, or a sub-agent (whose lines are all "sidechain" ones).
    ingest(chunk, into = this) {
        // each item gets its line's uuid and its place among that line's items: where he reads, kept across a reload
        let stampFrom = into.items.length;
        /** @type {string | null} */
        let stampUuid = null;
        const stamp = () => {
            for (let k = stampFrom; k < into.items.length; k++)
                into.items[k].uuid ??= `${stampUuid}:${k - stampFrom}`;
            stampFrom = into.items.length;
        };
        for (const line of chunk.split('\n')) {
            stamp();
            // The conversation's lines; the rest (api requests, snapshots, modes) start with "type".
            if (!line.startsWith('{"parentUuid"')) continue;
            this.version = (this.version ?? 0) + 1;
            let d;
            try {
                d = JSON.parse(line);
            } catch {
                continue;
            }
            stampUuid = d.uuid ?? null;
            if (d.isSidechain && into === this) continue;
            if (d.type === 'system' && d.subtype === 'compact_boundary')
                into.items.push({
                    kind: 'note',
                    text: 'Conversation compacted',
                });
            if (
                d.type === 'attachment' &&
                d.attachment?.type === 'skill_listing' &&
                into === this
            )
                this.learnSkills(d.attachment.content);
            // a message from another thread: one folded line, once, though it lands both queued and at a turn start
            const relay = relayIn(d);
            if (relay) {
                into.relayIds ??= new Set();
                if (!relay.msgId || !into.relayIds.has(relay.msgId)) {
                    if (relay.msgId) into.relayIds.add(relay.msgId);
                    into.items.push({ id: d.uuid, ...relay });
                }
                continue;
            }
            d = midTurnPrompt(d) ?? d;
            if (into === this && d.type === 'user') this.joinQueued(d);
            if (d.isMeta || d.isCompactSummary) continue;
            // a plugin's message, a task notice, a synthetic reply: drawn as the settings' «System lines» say
            const system = systemLine(d);
            if (system) {
                into.items.push({ id: d.uuid, kind: 'system', ...system });
                continue;
            }
            const content = d.message?.content;
            if (d.type === 'user') {
                // The reply before this message: a fork "before this message" resumes up to it.
                const before =
                    into === this && this.lastReply?.session === d.sessionId
                        ? this.lastReply.uuid
                        : undefined;
                if (typeof content === 'string')
                    this.said(content, into, before);
                else
                    for (const b of dropImageMarks(content ?? [])) {
                        if (b.type === 'tool_result') {
                            const tool = into.tools.get(b.tool_use_id);
                            // Kept clipped to what's shown: whole file reads add up, and a big heap makes the
                            // garbage collector slow enough to run a render past Herdr's time limit.
                            if (tool) {
                                tool.result = clip(resultText(b.content));
                                tool.error = Boolean(b.is_error);
                                // An Edit's or Write's patch (its originalFile, the whole file, is not kept).
                                const done = d.toolUseResult;
                                if (
                                    Array.isArray(done?.structuredPatch) &&
                                    done.filePath === tool.input?.file_path
                                ) {
                                    tool.patch = keepPatch(
                                        done.structuredPatch,
                                    );
                                    tool.diff = undefined;
                                }
                            }
                        } else if (b.type === 'text')
                            this.said(b.text, into, before);
                        else if (b.type === 'image')
                            into.items.push({ kind: 'user', text: '🖼 image' });
                    }
            } else if (d.type === 'assistant') {
                // Where a fork made at the next message of yours starts from (see fork).
                if (into === this)
                    this.lastReply = { session: d.sessionId, uuid: d.uuid };
                if (into === this && /^claude-/.test(d.message?.model ?? ''))
                    this.model = modelLabel(d.message.model);
                // the effort the reply ran at, as Claude Code stamps it on the row: the seat's live value, past any default
                if (into === this && EFFORTS.includes(d.effort))
                    this.effort = { level: d.effort, model: this.modelNow() };
                for (const b of content ?? []) {
                    if (b.type === 'text' && b.text.trim())
                        into.items.push({
                            kind: 'claude',
                            text: b.text.trim(),
                        });
                    else if (b.type === 'tool_use') {
                        const tool = {
                            at: d.timestamp ?? null,
                            id: b.id,
                            input: b.input,
                            kind: 'tool',
                            name: b.name,
                        };
                        into.tools.set(b.id, tool);
                        into.items.push(tool);
                    }
                }
            }
        }
        stamp();
    }

    // What the person typed, or what Claude Code put in their turn (slash commands, ! commands).
    said(raw, into = this, before = undefined) {
        const text = cleanTyped(raw);
        if (!text || text.startsWith('<local-command-caveat>')) return;
        const command = tag(text, 'command-name');
        if (command)
            return into.items.push({
                kind: 'user',
                text: `${command} ${tag(text, 'command-args') ?? ''}`.trim(),
            });
        const bash = tag(text, 'bash-input');
        if (bash) return into.items.push({ kind: 'user', text: `! ${bash}` });
        const out =
            tag(text, 'local-command-stdout') ?? tag(text, 'bash-stdout');
        if (out !== undefined && into === this) {
            const model = /^(?:Set model to|Kept model as) `([^`]+)`/.exec(out);
            if (model) this.model = modelLabel(model[1]);
            const effort = /^Set effort level to (\w+)/.exec(out);
            if (effort)
                this.effort = { level: effort[1], model: this.modelNow() };
        }
        if (out !== undefined)
            return (
                out &&
                into.items.push({ kind: 'note', mono: true, text: plain(out) })
            );
        if (text.startsWith('[Request interrupted'))
            return into.items.push({ kind: 'note', text: 'Interrupted' });
        // a message another terminal typed in with `hc send`: its words, under who sent it
        const sent = /^<hc from="(?:\S+ )?([^"]*)">([\s\S]*)<\/hc>$/.exec(text);
        if (sent)
            return into.items.push({
                before,
                kind: 'user',
                text: `↪ ${sent[1] || 'another terminal'}: ${sent[2].trim()}`,
            });
        if (/^<[\w-]+>/.test(text)) return;
        into.items.push({ before, kind: 'user', text });
    }

    // The session's skills ("- name: what it does" lines), for the / menu.
    learnSkills(content) {
        for (const line of String(content ?? '').split('\n')) {
            const m = /^- ([\w:-]+): (.*)/.exec(line);
            if (m) this.skills.set(m[1], m[2]);
        }
    }

    // The plugin skills enabled for the seat's folder join the / menu (skills.js), read once per session; a mod reload
    // restores the session without adopting it again, so the menu asks for them itself
    ensurePluginSkills() {
        const session = this.session;
        if (!session?.cwd || this.where?.container) return;
        if (this.pluginSkillsOf === session.sessionId) return;
        this.pluginSkillsOf = session.sessionId;
        this.pluginSkills = new Map();
        loadableSkills(skillFs, { cwd: session.cwd, home: home() })
            .then((found) => {
                if (this.session === session) this.pluginSkills = found;
            })
            .catch(() => {});
    }

    // The / menu: Claude's commands and this session's skills matching what's typed after "/",
    // names that start with it first.
    matches() {
        if (!this.slash || this.menuOff) return [];
        this.ensurePluginSkills();
        const q = this.slash.q.toLowerCase();
        const known = new Set(COMMANDS.map(([name]) => name));
        const all = [
            ...COMMANDS,
            ...[...this.skills].filter(([name]) => !known.has(name)),
            ...[...(this.pluginSkills ?? [])].filter(
                ([name]) => !known.has(name) && !this.skills.has(name),
            ),
        ];
        return menuMatches(all, q);
    }

    // Puts the picked name in place of the "/word" being typed (Enter's newline dropped), with
    // a space after it, and the caret after that.
    complete(name) {
        const { text, start, end } = this.slash;
        const rest = text.slice(end);
        const head = `${text.slice(0, start)}/${name}${rest.startsWith(' ') ? '' : ' '}`;
        this.slash = null;
        this.box.set_value(head + rest);
        this.box.set_selected_range({ end: head.length, start: head.length });
        this.typed = this.box.value();
        keepDraft(this.address, this.typed);
        this.box.focus();
    }

    // A / menu key (see the bindings in init).
    menuKey(key, cx) {
        const list = this.matches();
        if (!list.length) return;
        if (key === 'down') this.menuAt = (this.menuAt + 1) % list.length;
        else if (key === 'up')
            this.menuAt = (this.menuAt + list.length - 1) % list.length;
        else if (key === 'fill') this.complete(list[this.menuAt][0]);
        else if (key === 'close') this.menuOff = true;
        else this.slash = null;
        cx.notify();
    }

    // Claude's terminal can be left in one of its own boxes by a stray key (Ctrl+R = "Filter
    // history", seen 2026-11-07: Herdr still says idle, and a send just types into the box, so the
    // chat looked dead). Its footer says "Esc to cancel": press Esc (twice at most) before sending.
    async leaveMenu(address, cx) {
        for (let i = 0; i < 2; i++) {
            const r = await hc(['read', address]).catch(() => null);
            const tail = (r?.stdout ?? '')
                .replace(/\r/g, '')
                .trim()
                .split('\n')
                .slice(-4)
                .join('\n');
            if (!/\bEsc to (cancel|exit|close|go back)\b/i.test(tail)) return;
            await hc(['keys', address, 'esc']);
            await cx.sleep(250);
        }
    }

    send(cx) {
        const text = this.box.value().trim();
        if (!this.address || (!text && !this.imageCount(this.address))) return;
        const address = this.address;
        this.box.set_value('');
        this.typed = '';
        keepDraft(address, '');
        this.leftInBox = null;
        this.slash = null;
        // While Claude asks, what's typed is the "Type something" answer.
        if (text && ask.typeAnswer(this, text, cx)) {
            cx.timer.after(600, (cx) => this.tick(cx));
            return cx.notify();
        }
        this.images = 0;
        // A dev container's pasted images go as their paths in the container, after the text.
        const files = this.where?.container
            ? (this.pasted.get(address) ?? [])
            : [];
        this.pasted.delete(address);
        const message = [text, ...files.map((f) => `[Image: ${f}]`)]
            .filter(Boolean)
            .join('\n');
        // Pasted images are already in Claude's prompt: Enter alone sends them.
        const idle = this.target()?.status === 'idle';
        if (!idle && text)
            this.queued.set(address, [
                ...(this.queued.get(address) ?? []),
                { at: Date.now(), text },
            ]);
        // the send button spins until hc hands the message over
        this.sendingTo = address;
        cx.spawn(async (cx) => {
            try {
                if (idle) await this.leaveMenu(address, cx);
                await hc(
                    message
                        ? ['send', address, message]
                        : ['keys', address, 'enter'],
                );
            } finally {
                if (this.sendingTo === address) this.sendingTo = null;
                cx.notify();
            }
        });
        // These open a menu or a screen in Claude's terminal: show it there.
        if (OPENS.has(text.slice(1))) this.toTerminal(address);
        cx.notify();
    }

    // a row of his reached the transcript: a queued message it carries is no longer waiting
    /** @param {{ message?: { content?: string | { type?: string, text?: string }[] }, timestamp?: string }} d */
    joinQueued(d) {
        const list = this.queued.get(this.address);
        if (!list?.length) return;
        const content = d.message?.content;
        const text =
            typeof content === 'string'
                ? content
                : (content ?? [])
                      .filter((b) => b?.type === 'text')
                      .map((b) => b.text)
                      .join('\n');
        this.queued.set(
            this.address,
            queuedAfterRow(list, text, Date.parse(d.timestamp ?? '') || 0),
        );
    }

    // a seat that sat idle past the grace with a message never taken drops it; a redraw comes when the grace ends
    /** @param {string} status @param {import('gpui-kit').Context} cx */
    settleQueued(status, cx) {
        const address = this.address;
        const list = this.queued.get(address);
        if (status === 'working' || status === 'blocked') {
            this.idleSince.delete(address);
            return;
        }
        if (!this.idleSince.has(address)) {
            this.idleSince.set(address, Date.now());
            if (list?.length)
                cx.timer.after(QUEUED_IDLE_MS + 100, (cx) => cx.notify());
        }
        if (list?.length)
            this.queued.set(
                address,
                queuedAfterIdle(list, this.idleSince.get(address), Date.now()),
            );
    }

    menu(t) {
        const list = this.matches();
        if (!list.length) return null;
        const opens = (name) => OPENS.has(name);
        return v_flex()
            .p(4)
            .rounded(8)
            .bg(t.popover)
            .border(1)
            .border_color(t.border)
            .children(
                list.map(([name, about], i) =>
                    h_flex()
                        .id(`cmd-${name}`)
                        .gap(10)
                        .px(8)
                        .py(4)
                        .rounded(6)
                        .items_center()
                        .cursor_pointer()
                        .when(i === this.menuAt, (el) => el.bg(t.selected))
                        .hover((s) => s.bg(t.hover))
                        .on_click((_e, cx) => {
                            this.complete(name);
                            cx.notify();
                        })
                        .child(
                            div()
                                .w(170)
                                .flex_none()
                                .truncate()
                                .text_color(t.foreground)
                                .child(`/${name}`),
                        )
                        .child(
                            div()
                                .flex_1()
                                .min_w(0)
                                .truncate()
                                .text_size(px(12))
                                .text_color(t.dim)
                                .child(about),
                        )
                        .when(opens(name), (el) =>
                            el.child(
                                div()
                                    .flex_none()
                                    .text_size(px(10))
                                    .text_color(t.dim)
                                    .child('opens in Terminal'),
                            ),
                        ),
                ),
            )
            .child(
                div()
                    .px(8)
                    .pt(4)
                    .text_size(px(10))
                    .text_color(t.dim)
                    .child(
                        this.slash.start > 0
                            ? 'Enter, Tab or click fills in · ↑↓ · Esc'
                            : 'Enter runs · Tab or click fills in · ↑↓ · Esc',
                    ),
            );
    }

    // A paste with no text (an image): Claude reads the clipboard itself on its paste-image key
    // (Alt+V on Windows, Ctrl+V elsewhere) and puts "[Image #n]" in its prompt, ahead of what
    // we send. Typing "[Image #n]" ourselves would only send the words.
    pasteImage(cx) {
        if (!this.address) return;
        const address = this.address;
        if (this.where?.container)
            return this.pasteIntoContainer(address, this.where, cx);
        this.images = (this.images ?? 0) + 1;
        cx.spawn(async () => {
            await hc([
                'keys',
                address,
                /^win/.test(os.platform()) ? 'alt+v' : 'ctrl+v',
            ]);
        });
        cx.notify();
    }

    // A dev container's Claude runs on Linux with no clipboard (no X or Wayland, no xclip), so its
    // paste key finds nothing. Instead the clipboard image is saved here as a PNG, copied into the
    // container with `docker cp`, and its path goes with the next message (the way Herdr pastes an
    // image into a terminal on another machine). That Claude runs with bypassPermissions, so it
    // reads /tmp without asking. Windows only (the clipboard is read with .NET).
    pasteIntoContainer(address, where, cx) {
        if (!/^win/.test(os.platform())) {
            this.pasteNote =
                'Pasting images into a dev container needs Windows';
            return cx.notify();
        }
        const name = `herdr-paste-${newUuid()}.png`;
        this.pasteNote = 'Copying the image into the container…';
        cx.notify();
        cx.spawn(async (cx) => {
            // The clipboard's image, else the first image file copied in Explorer. Exit 3 = no image.
            const r = await exec('powershell', [
                '-NoProfile',
                '-STA',
                '-Command',
                "$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.Windows.Forms, System.Drawing; " +
                    `$p = Join-Path $env:TEMP '${name}'; $img = [Windows.Forms.Clipboard]::GetImage(); ` +
                    "if (-not $img) { $f = [Windows.Forms.Clipboard]::GetFileDropList() | Where-Object { $_ -match '\\.(png|jpe?g|gif|webp|bmp)$' } | Select-Object -First 1; " +
                    'if (-not $f) { exit 3 }; $img = [Drawing.Image]::FromFile($f) }; ' +
                    '$img.Save($p, [Drawing.Imaging.ImageFormat]::Png); $img.Dispose(); ' +
                    `docker cp $p '${where.container}:/tmp/${name}'; $c = $LASTEXITCODE; Remove-Item $p; exit $c`,
            ]).catch((e) => ({ code: -1, stderr: String(e) }));
            if (r.code === 0) {
                this.pasted.set(address, [
                    ...(this.pasted.get(address) ?? []),
                    `/tmp/${name}`,
                ]);
                this.pasteNote = null;
            } else {
                this.pasteNote =
                    r.code === 3
                        ? 'No image on the clipboard'
                        : `Couldn't copy the image: ${(r.stderr || `exit ${r.code}`).trim().slice(0, 200)}`;
                cx.timer.after(6000, (cx) => {
                    this.pasteNote = null;
                    cx.notify();
                });
            }
            cx.notify();
        });
    }

    // How many images wait to go with the next message: in Claude's prompt, or (dev container)
    // as files we hold.
    imageCount(address) {
        return this.where?.container
            ? (this.pasted.get(address)?.length ?? 0)
            : (this.images ?? 0);
    }

    // A prompt Claude Code put back into its own box (a Stop on a sent message does it) is hidden from this view, and the
    // next send would glue onto it: show it, every 5 s at most, only while Claude is not working, and only when it is the
    // last prompt sent, never its dim suggestion text.
    async checkBox(agent) {
        if (agent.status === 'working' || Date.now() - (this.boxAt ?? 0) < 5000)
            return;
        this.boxAt = Date.now();
        const r = await hc(['read', agent.address]).catch(() => null);
        if (this.address !== agent.address) return;
        const text = r?.code === 0 ? boxText(r.stdout) : '';
        const last =
            [...this.items].reverse().find((i) => i.kind === 'user')?.text ??
            '';
        this.leftInBox = text && last && flat(last) === text ? text : null;
        this.leftNormal = r?.stdout?.includes('-- NORMAL --') ?? false;
    }

    // [take it]: the text into the chat box, Claude's box emptied with ctrl+u, one per line, a key that neither exits nor
    // stops Claude (proven on a throwaway seat: full, empty and mid-turn). [send as is]: Enter on Claude's own box.
    takeLeft(cx) {
        const text = this.leftInBox,
            address = this.address;
        if (!text || !address) return;
        const had = this.box.value().trim();
        this.box.set_value(had ? `${text}\n\n${had}` : text);
        this.typed = this.box.value();
        keepDraft(address, this.typed);
        this.leftInBox = null;
        const lines = Math.ceil(text.length / 40) + 2;
        const keys = [
            ...(this.leftNormal ? ['i'] : []),
            ...Array(lines * 2).fill('ctrl+u'),
        ];
        cx.spawn(async () => {
            await hc(['keys', address, ...keys]);
        });
        this.box.focus();
        cx.notify();
    }

    sendLeft(cx) {
        const address = this.address;
        if (!address || !this.leftInBox) return;
        this.leftInBox = null;
        cx.spawn(async () => {
            await hc(['keys', address, 'enter']);
        });
        cx.notify();
    }

    // Esc twice empties Claude's prompt, images and all (not while it's working: Esc stops it).
    // A dev container's images were never in its prompt: just forget them.
    dropImages(cx) {
        const address = this.address;
        if (this.where?.container) {
            this.pasted.delete(address);
            return cx.notify();
        }
        this.images = 0;
        cx.spawn(async () => {
            await hc(['keys', address, 'esc', 'esc']);
        });
        cx.notify();
    }

    // A copy of this conversation in a new tab of the same space: `claude --resume <id> --fork-session`
    // gives the copy its own session id, so the two go on separately. With `at` (the uuid of a reply)
    // the copy ends at that reply: its lines up to there go to a new session file (`cutCopy`),
    // which is resumed. Not --resume-session-at: print mode honors it, the interactive TUI ignores it
    // (tested 2026-10-31). A dev-container agent's copy starts in the dev container (its sessions
    // are on the shared volume) like the "Claude (dev container)" program does.
    // `forkNote` in the header says it's under way, or why it failed (a cut copy takes a few seconds).
    async fork(agent, at, cx) {
        const session = this.session;
        // The last fork's steps in ~/.config/herdr-app/fork.log, to see where a click got to.
        const log = [
            `${new Date().toISOString()} fork ${agent?.address} at=${at ?? 'end'} session=${session?.sessionId}`,
        ];
        const note = (text) => {
            this.forkNote = text;
            cx.notify();
            log.push(text ?? 'opened');
            writeFile(
                `${home()}/.config/herdr-app/fork.log`,
                log.join('\n') + '\n',
            ).catch(() => {});
        };
        if (!session?.sessionId) return note('Fork: no session yet');
        note('Forking…');
        try {
            const where = this.where;
            const args = at
                ? [
                      '--resume',
                      await this.cutCopy(where, session, this.file, at),
                  ]
                : ['--resume', session.sessionId, '--fork-session'];
            if (!args[1])
                return note(
                    `Fork failed: couldn't copy the conversation${this.forkErr ? ` (${this.forkErr})` : ''}`,
                );
            const name = `${agent.title || 'Claude'} (fork)`;
            if (where?.container) {
                run('tab.new', {
                    argv: [
                        'cmd.exe',
                        '/c',
                        `devcontainer exec --workspace-folder . claude ${args.join(' ')}`,
                    ],
                    name,
                    space: agent.space,
                });
            } else {
                run('tab.new', {
                    argv: ['claude', ...args],
                    folder: session.cwd,
                    name,
                    space: agent.space,
                });
            }
            note(null);
        } catch (e) {
            note(`Fork failed: ${e?.message ?? e}`);
        } finally {
            if (this.forkNote)
                cx.timer.after(6000, (cx) => {
                    this.forkNote = null;
                    cx.notify();
                });
        }
    }

    // A new session file beside the transcript: its lines up to and including the one with uuid
    // `at`, under a new session id. Returns that id, or null if `at` isn't in the file.
    async cutCopy(where, session, file, at) {
        const id = newUuid();
        const mark = `"uuid":"${at}"`;
        if (where?.container) {
            // $2 transcript, $3 mark, $4 old id, $5 new id, $6 new file (all relative to the Claude folder).
            const out = file.replace(/[^/]+\.jsonl$/, `${id}.jsonl`);
            const r = await inDocker(
                where,
                'n=$(grep -n -m1 -F "$3" "$d/$2" | cut -d: -f1) && [ -n "$n" ] && head -n "$n" "$d/$2" | sed "s/\\"sessionId\\":\\"$4\\"/\\"sessionId\\":\\"$5\\"/g" > "$d/$6" && echo ok',
                file,
                mark,
                session.sessionId,
                id,
                out,
            );
            return r.stdout.trim() === 'ok' ? id : null;
        }
        // Cut in a separate process: doing it here (decode, split, write 16 MB) on Herdr's UI thread
        // got cut off by its time limit and the click did nothing (2026-11-01).
        const dest = file.replace(/[^/\\]+\.jsonl$/, `${id}.jsonl`);
        const old = session.sessionId;
        const r = /^win/.test(os.platform()) // "windows" here, not node's "win32"
            ? await exec('powershell', [
                  '-NoProfile',
                  '-Command',
                  `$t = [IO.File]::ReadAllText('${file}'); $i = $t.IndexOf('${mark}'); if ($i -lt 0) { exit 3 }; ` +
                      `$e = $t.IndexOf([char]10, $i); if ($e -lt 0) { $e = $t.Length - 1 }; ` +
                      `$c = $t.Substring(0, $e + 1).Replace('"sessionId":"${old}"', '"sessionId":"${id}"'); ` +
                      `[IO.File]::WriteAllText('${dest}', $c, (New-Object Text.UTF8Encoding $false))`,
              ]).catch((e) => ({ code: -1, stderr: String(e) }))
            : await exec('sh', [
                  '-c',
                  'n=$(grep -n -m1 -F "$2" "$1" | cut -d: -f1) && [ -n "$n" ] && head -n "$n" "$1" | sed "s/\\"sessionId\\":\\"$3\\"/\\"sessionId\\":\\"$4\\"/g" > "$5"',
                  'sh',
                  file,
                  mark,
                  old,
                  id,
                  dest,
              ]).catch((e) => ({ code: -1, stderr: String(e) }));
        this.forkErr =
            r.code === 0
                ? null
                : r.code === 3
                  ? 'message not found in the transcript'
                  : (r.stderr || `exit ${r.code}`).slice(0, 300);
        return r.code === 0 && (await exists(dest)) ? id : null;
    }

    keys(...keys) {
        const address = this.address;
        return (_e, cx) => {
            cx.spawn(async (cx) => {
                await hc(['keys', address, ...keys]);
                this.screen = null;
                this.tick(cx);
            });
        };
    }

    // ---- drawing

    bubble(t, item, i) {
        if (isRelay(item)) return this.relayRow(t, item);
        const mine = chatLook().mine;
        if (item.kind === 'user') {
            // his words: a bubble on the right in an accent tint (after shepherdr's chat), or full width on the left
            // as a box like the VS Code extension's, tinted with the accent, or a bar
            const words = TextView.markdown(
                `${this.pre}me-${i}`,
                this.markIn(i)
                    ? plainMarked(item.text, this.marks.re, this.markIn(i))
                    : typedOf(item),
            ).selectable(true);
            const fork = Boolean(item.before && this.agentNow);
            // the fork's press lands by where it was (clickRow): its column is the row's last FORK_W px
            const forkJSX = h_flex()
                .w(FORK_W)
                .flex_none()
                .justify_end()
                .when(fork, (el) =>
                    el.child(
                        div()
                            .id(`fork-${i}`)
                            .p(2)
                            .rounded(4)
                            .text_color(t.dim)
                            .cursor_pointer()
                            .hover((s) =>
                                s.bg(t.hover).text_color(t.foreground),
                            )
                            .tooltip(
                                'Fork from here: a copy of the conversation up to just before this message, in a new tab',
                            )
                            .child(
                                svg(
                                    'mods/workspace-chrome/git-branch.svg',
                                ).size(13),
                            ),
                    ),
                );
            if (mine === 'bubble')
                return h_flex()
                    .w_full()
                    .items_center()
                    .child(
                        h_flex()
                            .flex_1()
                            .min_w(0)
                            .justify_end()
                            .child(
                                div()
                                    .max_w(this.bubbleW)
                                    .px(12)
                                    .py(8)
                                    .rounded(12)
                                    .bg(fade(t.accent, '33'))
                                    .border(1)
                                    .border_color(fade(t.accent, '4d'))
                                    .text_color(t.foreground)
                                    .child(words),
                            ),
                    )
                    .child(forkJSX);
            return div()
                .w_full()
                .px(12)
                .py(8)
                .text_color(t.foreground)
                .when(mine === 'box', (el) =>
                    el
                        .rounded(8)
                        .bg(t.surface)
                        .border(1)
                        .border_color(t.border),
                )
                .when(mine === 'tint', (el) =>
                    el
                        .rounded(8)
                        .bg(fade(t.accent, '1f'))
                        .border(1)
                        .border_color(fade(t.accent, '59')),
                )
                .when(mine === 'bar', (el) =>
                    el.border_l(3).border_color(t.accent),
                )
                .child(
                    h_flex()
                        .w_full()
                        .gap(8)
                        .items_center()
                        .child(div().flex_1().min_w(0).child(words))
                        .child(forkJSX),
                );
        }
        if (item.kind === 'claude')
            return this.claudeLook(t, this.replyBody(t, item, i), true);
        if (item.kind === 'system') return this.systemRow(t, item, i);
        if (item.kind === 'note') {
            return div()
                .w_full()
                .px(10)
                .py(4)
                .text_size(px(12))
                .text_color(t.dim)
                .when(Boolean(item.mono), (el) =>
                    el
                        .font_family(this.mono())
                        .rounded(6)
                        .bg(t.surface)
                        .child(clip(item.text, 1500)),
                )
                .when(!item.mono, (el) =>
                    el.flex().justify_center().child(`— ${item.text} —`),
                );
        }
        if (AGENT_TOOLS.has(item.name)) return this.subCard(t, item, i);
        if (item.name === 'AskUserQuestion') return ask.asked(t, px, item);
        return this.tool(t, item, i);
    }

    // Claude's words: on the left in a quiet bubble, or after an accent dot; a reply cut into rows dots only its first
    /** @param {any} t @param {any} body @param {boolean} isFirst */
    claudeLook(t, body, isFirst) {
        if (chatLook().mine === 'bubble')
            return h_flex()
                .w_full()
                .child(
                    div()
                        .max_w(this.bubbleW)
                        .px(12)
                        .py(8)
                        .rounded(12)
                        .bg(t.raised)
                        .text_color(t.foreground)
                        .child(body),
                );
        return h_flex()
            .w_full()
            .gap(8)
            .items_start()
            .child(
                div()
                    .mt(4)
                    .size(8)
                    .flex_none()
                    .rounded(4)
                    .when(isFirst, (el) => el.bg(t.accent)),
            )
            .child(
                div().flex_1().min_w(0).text_color(t.foreground).child(body),
            );
    }

    // A line he never typed: folded to one dim line that opens to its whole text on a click, or shown whole
    /** @param {any} t @param {{ id: string, label: string, text: string }} item @param {number | string} i */
    systemRow(t, item, i) {
        const open = chatLook().system === 'show' || this.open.has(item.id);
        return v_flex()
            .w_full()
            .px(10)
            .py(2)
            .child(
                div()
                    .id(`system-${i}`)
                    .w_full()
                    .px(6)
                    .py(2)
                    .rounded(6)
                    .text_size(px(12))
                    .text_color(t.muted)
                    .truncate()
                    .cursor_pointer()
                    .hover((s) => s.bg(t.hover))
                    .tooltip(open ? 'fold it' : 'show the whole line')
                    .child(`${open ? '▾' : '▸'} ${item.label}`),
            )
            .when(open && item.text !== item.label, (el) =>
                el.child(
                    div()
                        .mx(6)
                        .px(8)
                        .py(6)
                        .rounded(6)
                        .bg(t.surface)
                        .text_size(px(12))
                        .text_color(t.muted)
                        .font_family(/** @type {string} */ (this.mono()))
                        .child(clip(item.text, 4000)),
                ),
            );
    }

    // A sub-agent: its type, task and model, and how far it got. Click opens its conversation.
    subCard(t, item, i) {
        const sub = this.subs.get(item.id);
        const input = item.input ?? {};
        // A background one's call returns at once ("Async agent launched…"); only its meta says when it's done.
        const background = /^Async agent launched/.test(item.result ?? '');
        const state = item.error
            ? 'failed'
            : (sub ? sub.finished : item.result !== undefined && !background)
              ? 'done'
              : 'working';
        const steps = sub ? sub.items.filter((x) => x.kind === 'tool') : [];
        const last = steps[steps.length - 1];
        const count = `${steps.length} ${steps.length === 1 ? 'tool' : 'tools'}`;
        const line =
            state === 'failed'
                ? (item.result ?? '').split('\n')[0]
                : state === 'done'
                  ? sub
                      ? `Done · ${count}`
                      : 'Done'
                  : last
                    ? `${count} · ${last.name} ${toolLine(last.name, last.input)}`
                    : 'Starting…';
        const mark =
            state === 'working'
                ? svg('mods/workspace-chrome/spinner.svg')
                      .size(11)
                      .text_color(t.working)
                      .spin(900)
                : div()
                      .size(7)
                      .rounded(4)
                      .bg(state === 'failed' ? t.blocked : t.done);
        const model = sub?.model ?? input.model;
        return v_flex()
            .w_full()
            .pl(16)
            .child(
                v_flex()
                    .id(`agent-${i}`)
                    .gap(4)
                    .px(10)
                    .py(8)
                    .rounded(8)
                    .bg(t.surface)
                    .border(1)
                    .border_color(state === 'failed' ? t.blocked : t.border)
                    .when(Boolean(sub), (el) =>
                        el
                            .cursor_pointer()
                            .hover((s) => s.border_color(t.accent)),
                    )
                    .child(
                        h_flex()
                            .gap(8)
                            .items_center()
                            .child(
                                div()
                                    .flex_none()
                                    .font_semibold()
                                    .text_size(px(12))
                                    .text_color(t.foreground)
                                    .child(
                                        sub?.type ??
                                            input.subagent_type ??
                                            'Agent',
                                    ),
                            )
                            .child(
                                div()
                                    .flex_1()
                                    .min_w(0)
                                    .truncate()
                                    .text_size(px(12))
                                    .text_color(t.muted)
                                    .child(input.description ?? ''),
                            )
                            .when(Boolean(model), (el) =>
                                el.child(
                                    div()
                                        .flex_none()
                                        .text_size(px(10.5))
                                        .text_color(t.dim)
                                        .child(model),
                                ),
                            ),
                    )
                    .child(
                        h_flex()
                            .gap(8)
                            .items_center()
                            .child(
                                h_flex()
                                    .w(12)
                                    .flex_none()
                                    .justify_center()
                                    .child(mark),
                            )
                            .child(
                                div()
                                    .flex_1()
                                    .min_w(0)
                                    .truncate()
                                    .text_size(px(11.5))
                                    .text_color(t.dim)
                                    .child(line),
                            )
                            .when(Boolean(sub), (el) =>
                                el.child(
                                    div()
                                        .flex_none()
                                        .text_size(px(11.5))
                                        .text_color(t.accent)
                                        .child('Open ›'),
                                ),
                            ),
                    ),
            );
    }

    // The chat cut at each of your messages. The last turn is all open; in each earlier one your
    // message and Claude's replies stay, and the work between them (tool calls, notes) is one row
    // until clicked open, so scrolling up reads like the conversation. A seat pushes reports between
    // your messages (a peer's ping starts no turn), so with replies "folded" only the turn's last
    // one would stay, and a report he must read hid in the row.
    turns(all, visible) {
        const keepReplies = chatLook().replies !== 'folded';
        const turns = [];
        for (const entry of all) {
            if (entry[0].kind === 'user' || !turns.length) turns.push([]);
            turns.at(-1).push(entry);
        }
        return turns.flatMap((turn, n) => {
            if (n === turns.length - 1) return turn.filter(visible);
            const from = turn[0][0].kind === 'user' ? 1 : 0;
            let to = turn.findLastIndex(([x]) => x.kind === 'claude');
            // No reply (interrupted): all of it is work.
            if (to < from) to = turn.length;
            const work = turn.slice(from, to);
            const folded = keepReplies
                ? work.filter(([x]) => x.kind !== 'claude' && !isRelay(x))
                : work;
            if (!folded.length) return turn.filter(visible);
            const key = `${this.address}:${turn[0][1]}`;
            const open = this.unfolded.has(key);
            const shown = open
                ? work
                : work.filter(
                      ([x]) =>
                          keepReplies && (x.kind === 'claude' || isRelay(x)),
                  );
            return [
                ...turn.slice(0, from),
                { key, open, work: folded },
                ...shown.filter(visible),
                ...turn.slice(to).filter(visible),
            ];
        });
    }

    // The row standing for a turn's work, like a tool row: "▸ 12 tools · 3 messages".
    turnRow(t, { work, key, open }, found) {
        const count = (kind, one, many) => {
            const n = work.filter(([x]) => x.kind === kind).length;
            return n ? `${n} ${n === 1 ? one : many}` : null;
        };
        // Search hits folded away in it.
        const hits =
            !open && found.size
                ? work.filter(([, id]) => found.has(id)).length
                : 0;
        const about =
            [
                count('tool', 'tool', 'tools'),
                count('claude', 'message', 'messages'),
            ]
                .filter(Boolean)
                .join(' · ') || `${work.length} more`;
        return v_flex()
            .w_full()
            .pl(16)
            .child(
                h_flex()
                    .id(`turn-${key}`)
                    .gap(8)
                    .items_center()
                    .py(2)
                    .px(6)
                    .rounded(6)
                    .cursor_pointer()
                    .text_size(px(12))
                    .text_color(t.dim)
                    .hover((s) => s.bg(t.hover).text_color(t.foreground))
                    .child(
                        h_flex()
                            .w(12)
                            .flex_none()
                            .justify_center()
                            .text_size(px(10))
                            .child(open ? '▾' : '▸'),
                    )
                    .child(
                        div()
                            .flex_1()
                            .min_w(0)
                            .truncate()
                            .child(open ? `Fold ${about}` : about),
                    )
                    .when(hits > 0, (el) =>
                        el.child(
                            div()
                                .flex_none()
                                .text_color(t.accent)
                                .child(
                                    hits === 1 ? '1 match' : `${hits} matches`,
                                ),
                        ),
                    ),
            );
    }

    // The bar over an opened sub-agent's conversation: back to the chat (or the sub-agent that started it).
    subBar(t, sub) {
        return h_flex()
            .h(30)
            .flex_none()
            .text_size(12)
            .px(12)
            .gap(8)
            .items_center()
            .border_b(1)
            .border_color(t.border)
            .bg(t.surface)
            .child(
                div()
                    .id('sub-back')
                    .flex_none()
                    .px(6)
                    .py(2)
                    .rounded(5)
                    .cursor_pointer()
                    .text_color(t.foreground)
                    .hover((s) => s.bg(t.hover))
                    .on_click((_e, cx) => {
                        this.trail.pop();
                        this.follow = true;
                        this.stick = true;
                        cx.notify();
                    })
                    .child(this.trail.length > 1 ? '‹ Back' : '‹ Main chat'),
            )
            .child(
                div()
                    .flex_none()
                    .font_semibold()
                    .text_color(t.foreground)
                    .child(sub.type ?? 'Agent'),
            )
            .child(
                div()
                    .flex_1()
                    .min_w(0)
                    .truncate()
                    .text_color(t.dim)
                    .child(sub.about ?? ''),
            )
            .when(Boolean(sub.model), (el) =>
                el.child(
                    div()
                        .flex_none()
                        .text_size(11)
                        .text_color(t.dim)
                        .child(sub.model),
                ),
            )
            .child(
                div()
                    .flex_none()
                    .text_size(11)
                    .text_color(sub.finished ? t.done : t.working)
                    .child(sub.finished ? 'done' : 'working'),
            );
    }

    // The shown agent's sub-agents at work, over the box; click one to open it.
    subChips(t) {
        const list = [...this.subs].filter(([id, s]) =>
            subRunning(s, this.tools.get(id)),
        );
        if (!list.length) return null;
        const open = this.trail[this.trail.length - 1];
        return h_flex()
            .gap(6)
            .items_center()
            .flex_wrap()
            .px(4)
            .text_size(px(11.5))
            .child(
                div()
                    .flex_none()
                    .text_color(t.muted)
                    .child(
                        list.length === 1
                            ? '1 sub-agent working'
                            : `${list.length} sub-agents working`,
                    ),
            )
            .children(
                list.map(([id, s]) =>
                    h_flex()
                        .id(`chip-${s.name}`)
                        .gap(6)
                        .items_center()
                        .max_w(300)
                        .px(8)
                        .py(2)
                        .rounded(6)
                        .cursor_pointer()
                        .bg(id === open ? t.selected : t.raised)
                        .text_color(t.foreground)
                        .hover((x) => x.opacity(0.85))
                        .on_click((_e, cx) => {
                            this.trail = [id];
                            this.follow = true;
                            this.stick = true;
                            cx.notify();
                        })
                        .child(
                            svg('mods/workspace-chrome/spinner.svg')
                                .size(10)
                                .flex_none()
                                .text_color(t.working)
                                .spin(900),
                        )
                        .child(
                            div()
                                .min_w(0)
                                .truncate()
                                .child(
                                    `${s.type ?? 'Agent'} · ${s.about ?? ''}`,
                                ),
                        ),
                ),
            );
    }

    tool(t, item, i) {
        const open = this.open.has(item.id);
        const pending = item.result === undefined;
        // From render (agents() per row was a host call for each row).
        const working = pending && this.agentWorking;
        const diff = diffOf(item);
        const mark = pending
            ? working
                ? svg('mods/workspace-chrome/spinner.svg')
                      .size(11)
                      .text_color(t.working)
                      .spin(900)
                : div().size(7).rounded(4).bg(t.dim)
            : div()
                  .size(7)
                  .rounded(4)
                  .bg(item.error ? t.blocked : t.done);
        return v_flex()
            .w_full()
            .pl(16)
            .child(
                h_flex()
                    .id(`tool-${i}`)
                    .gap(8)
                    .items_center()
                    .py(2)
                    .px(6)
                    .rounded(6)
                    .cursor_pointer()
                    .hover((s) => s.bg(t.hover))
                    .child(
                        h_flex().w(12).flex_none().justify_center().child(mark),
                    )
                    .child(
                        div()
                            .flex_none()
                            .font_semibold()
                            .text_size(px(12))
                            .text_color(t.muted)
                            .child(item.name),
                    )
                    .child(
                        div()
                            .flex_1()
                            .min_w(0)
                            .truncate()
                            .text_size(px(12))
                            .text_color(t.dim)
                            .child(toolLine(item.name, item.input)),
                    )
                    .when(Boolean(diff), (el) =>
                        el
                            .when(diff.add > 0, (el) =>
                                el.child(
                                    div()
                                        .flex_none()
                                        .text_size(px(11))
                                        .text_color(t.ansi2)
                                        .child(`+${diff.add}`),
                                ),
                            )
                            .when(diff.del > 0, (el) =>
                                el.child(
                                    div()
                                        .flex_none()
                                        .text_size(px(11))
                                        .text_color(t.ansi1)
                                        .child(`−${diff.del}`),
                                ),
                            ),
                    )
                    .child(
                        div()
                            .flex_none()
                            .text_size(px(10))
                            .text_color(t.dim)
                            .child(open ? '▾' : '▸'),
                    ),
            );
    }

    // A tool's opened detail: its diff, or its input and output.
    toolBody(t, item) {
        const pending = item.result === undefined;
        const diff = diffOf(item);
        return v_flex()
            .w_full()
            .pl(16)
            .when(Boolean(diff), (el) => el.child(this.diffView(t, item, diff)))
            .when(!diff, (el) =>
                el.child(
                    v_flex()
                        .ml(26)
                        .mt(2)
                        .mb(4)
                        .p(8)
                        .gap(6)
                        .rounded(6)
                        .bg(t.surface)
                        .border(1)
                        .border_color(t.border)
                        .font_family(this.mono())
                        .text_size(px(11))
                        .child(
                            div()
                                .text_color(t.muted)
                                .child(clip(toolDetail(item.input))),
                        )
                        .when(!pending, (el) =>
                            el.child(
                                div()
                                    .pt(6)
                                    .border_t(1)
                                    .border_color(t.border)
                                    .text_color(
                                        item.error ? t.blocked : t.foreground,
                                    )
                                    .child(item.result || '(no output)'),
                            ),
                        ),
                ),
            );
    }

    // An Edit's / Write's change: the file, then one row per line, a gutter of new-file line
    // numbers (old ones on removed lines), red for removed, green for added, ⋯ between hunks.
    diffView(t, item, diff) {
        const wide = Math.max(
            2,
            ...diff.rows.map((r) => String(r.num ?? '').length),
        );
        const tint = { '+': fade(t.ansi2, '38'), '-': fade(t.ansi1, '38') };
        const ink = { ' ': t.dim, '+': t.ansi2, '-': t.ansi1 };
        const row = (r) =>
            r.kind === 'gap'
                ? div().px(8).text_color(t.dim).child('⋯')
                : h_flex()
                      .items_start()
                      .when(r.kind !== ' ', (el) => el.bg(tint[r.kind]))
                      .child(
                          div()
                              .flex_none()
                              .w(wide * px(7) + 10)
                              .pr(6)
                              .text_right()
                              .text_color(t.dim)
                              .child(r.num === undefined ? '' : String(r.num)),
                      )
                      .child(
                          div()
                              .flex_none()
                              .w(14)
                              .text_color(ink[r.kind])
                              .child(r.kind === ' ' ? '' : r.kind),
                      )
                      .child(
                          div()
                              .flex_1()
                              .min_w(0)
                              .pr(8)
                              .text_color(t.foreground)
                              .child(r.text || ' '),
                      );
        return v_flex()
            .ml(26)
            .mt(2)
            .mb(4)
            .rounded(6)
            .overflow_hidden()
            .bg(t.surface)
            .border(1)
            .border_color(t.border)
            .font_family(this.mono())
            .text_size(px(11))
            .child(
                div()
                    .px(8)
                    .py(4)
                    .border_b(1)
                    .border_color(t.border)
                    .text_color(t.muted)
                    .truncate()
                    .child(diff.path ?? item.name),
            )
            .child(v_flex().py(4).children(diff.rows.map(row)))
            .when(diff.more > 0, (el) =>
                el.child(
                    div()
                        .px(8)
                        .pb(4)
                        .text_color(t.dim)
                        .child(`… ${diff.more} more lines`),
                ),
            )
            .when(item.error, (el) =>
                el.child(
                    div()
                        .p(8)
                        .border_t(1)
                        .border_color(t.border)
                        .text_color(t.blocked)
                        .child(item.result || '(failed)'),
                ),
            );
    }

    mono() {
        return settings().font_family ?? settings().font ?? 'JetBrains Mono';
    }

    status(t, agent) {
        if (agent.status === 'blocked') {
            // An AskUserQuestion: its own card. Anything else (a permission prompt): the screen.
            const asking = ask.card(this, t, px);
            if (asking) return asking;
            return v_flex()
                .gap(8)
                .p(10)
                .rounded(8)
                .bg(t.surface)
                .border(1)
                .border_color(t.blocked)
                .child(
                    h_flex()
                        .gap(8)
                        .items_center()
                        .child(
                            div()
                                .size(8)
                                .rounded(4)
                                .bg(t.blocked)
                                .loop('opacity', {
                                    from: 0.35,
                                    period: 1200,
                                    to: 1,
                                }),
                        )
                        .child(
                            div()
                                .font_semibold()
                                .text_color(t.foreground)
                                .child('Claude is asking'),
                        ),
                )
                .when(Boolean(this.screen), (el) =>
                    el.child(
                        div()
                            .p(8)
                            .rounded(6)
                            .bg(t.background)
                            .text_size(px(11))
                            .font_family(this.mono())
                            .text_color(t.foreground)
                            .child(this.screen),
                    ),
                )
                .child(
                    h_flex()
                        .gap(6)
                        .flex_wrap()
                        .children(
                            ['1', '2', '3'].map((k) =>
                                button(
                                    t,
                                    px,
                                    `key-${k}`,
                                    k,
                                    this.keys(k),
                                    k === '1',
                                ),
                            ),
                        )
                        .child(
                            button(
                                t,
                                px,
                                'key-enter',
                                'Enter',
                                this.keys('enter'),
                            ),
                        )
                        .child(
                            button(t, px, 'key-esc', 'Esc', this.keys('esc')),
                        )
                        .child(div().flex_1())
                        .child(
                            button(t, px, 'to-terminal', 'Open terminal', () =>
                                this.toTerminal(agent.address),
                            ),
                        ),
                );
        }
        if (agent.status !== 'working') return null;
        const report = terminals().find(
            (x) => x.address === agent.address,
        )?.report;
        const msg = typeof report === 'object' ? report?.msg : null;
        return h_flex()
            .gap(8)
            .items_center()
            .px(4)
            .text_size(px(12))
            .text_color(t.muted)
            .child(
                svg('mods/workspace-chrome/spinner.svg')
                    .size(12)
                    .flex_none()
                    .text_color(t.working)
                    .spin(900),
            )
            .child(
                div()
                    .flex_1()
                    .min_w(0)
                    .truncate()
                    .child(
                        this.stuck
                            ? "Still working: Esc only stops Claude's own turn, not a background task (like /code-review). Stop that in the terminal."
                            : msg || 'Working…',
                    ),
            )
            .when(!this.stuck, (el) =>
                el.child(
                    button(t, px, 'stop', 'Stop', (_e, cx) => this.stop(cx)),
                ),
            );
    }

    // The Stop button, and Esc in the chat while Claude works (bound in init; the find bar and the
    // / menu take their own Esc first). Esc, not `hc interrupt`: that presses Ctrl+C for Claude,
    // and a second one quits it.
    stop(cx) {
        const address = this.address;
        cx.spawn(async () => {
            await hc(['keys', address, 'esc']);
        });
        cx.timer.after(3000, (cx) => {
            const still =
                agents().find((a) => a.address === address)?.status ===
                'working';
            if (!still || this.address !== address) return;
            this.stuck = true;
            cx.notify();
            cx.timer.after(8000, (cx) => {
                this.stuck = false;
                cx.notify();
            });
        });
    }

    // The ⚙ popup: the chat's look (see LOOK). Every chat follows it at once.
    settingsMenu(t) {
        const look = chatLook();
        const seg = (key, value, label) =>
            div()
                .id(`look-${key}-${value}`)
                .px(8)
                .h(22)
                .flex()
                .items_center()
                .rounded(5)
                .text_size(12)
                .cursor_pointer()
                .when(look[key] === value, (el) =>
                    el.bg(t.selected).text_color(t.foreground),
                )
                .when(look[key] !== value, (el) =>
                    el
                        .text_color(t.dim)
                        .hover((s) => s.text_color(t.foreground)),
                )
                .on_click(() => setLook({ [key]: value }))
                .child(label);
        const pills = (...segs) =>
            h_flex()
                .flex_none()
                .p(2)
                .gap(2)
                .rounded(7)
                .bg(t.surface)
                .border(1)
                .border_color(t.border)
                .children(segs);
        const row = (label, control) =>
            h_flex()
                .h(34)
                .px(8)
                .gap(8)
                .items_center()
                .child(div().flex_1().text_color(t.foreground).child(label))
                .child(control);
        const step = (id, label, by) =>
            div()
                .id(id)
                .size(24)
                .flex()
                .items_center()
                .justify_center()
                .rounded(5)
                .cursor_pointer()
                .text_color(t.foreground)
                .hover((s) => s.bg(t.hover))
                .on_click(() =>
                    setLook({
                        size: Math.max(10, Math.min(22, look.size + by)),
                    }),
                )
                .child(label);
        // Swatches (a ring on the chosen one) and a hex box for any other color.
        const colors = (key, choices) =>
            h_flex()
                .flex_none()
                .gap(6)
                .items_center()
                .children(
                    [...choices].map(([value, name]) =>
                        div()
                            .id(`look-${key}-${value}`)
                            .size(18)
                            .rounded(9)
                            .cursor_pointer()
                            .bg(value === 'theme' ? theme().foreground : value)
                            .border(2)
                            .border_color(
                                String(look[key]).toLowerCase() === value
                                    ? t.accent
                                    : t.border,
                            )
                            .tooltip(name)
                            .on_click(() => {
                                setLook({ [key]: value });
                                this.hex[key].set_value(
                                    HEX.test(value) ? value : '',
                                );
                            }),
                    ),
                )
                .child(
                    div()
                        .w(76)
                        .h(24)
                        .px(6)
                        .flex()
                        .items_center()
                        .rounded(5)
                        .border(1)
                        .border_color(t.border)
                        .bg(t.surface)
                        .text_size(12)
                        .text_color(t.foreground)
                        .child(Input.new(this.hex[key])),
                );
        return v_flex()
            .w_full()
            .p(5)
            .bg(t.popover)
            .text_size(12.8)
            .child(
                h_flex()
                    .px(8)
                    .pt(4)
                    .pb(4)
                    .items_center()
                    .justify_between()
                    .child(div().text_size(11).text_color(t.dim).child('Chat'))
                    .child(
                        div()
                            .id('look-reset')
                            .text_size(11)
                            .text_color(t.dim)
                            .cursor_pointer()
                            .hover((s) => s.text_color(t.foreground))
                            .on_click(() => {
                                setShared(LOOK, null);
                                for (const s of Object.values(this.hex))
                                    s.set_value('');
                            })
                            .child('Reset'),
                    ),
            )
            .child(
                row(
                    'Text size',
                    pills(
                        step('look-smaller', 'A−', -1),
                        div()
                            .w(28)
                            .text_center()
                            .text_color(t.foreground)
                            .child(String(look.size)),
                        step('look-bigger', 'A+', 1),
                    ),
                ),
            )
            .child(
                row(
                    'Font',
                    pills(
                        seg('font', 'ui', 'Sans'),
                        seg('font', 'mono', 'Mono'),
                    ),
                ),
            )
            .child(
                row(
                    'Width',
                    pills(
                        seg('width', 'full', 'Full'),
                        seg('width', 'narrow', 'Narrow'),
                    ),
                ),
            )
            .child(
                row(
                    'Tool calls',
                    pills(
                        seg('tools', 'show', 'Show'),
                        seg('tools', 'hide', 'Hide'),
                    ),
                ),
            )
            .child(
                row(
                    'System lines',
                    pills(
                        ...SYSTEM_MODES.map(([value, label]) =>
                            seg('system', value, label),
                        ),
                    ),
                ),
            )
            .child(
                row(
                    'Earlier replies',
                    pills(
                        seg('replies', 'open', 'Open'),
                        seg('replies', 'folded', 'Folded'),
                    ),
                ),
            )
            .child(
                row(
                    'Accent',
                    h_flex()
                        .flex_none()
                        .gap(6)
                        .children(
                            [...ACCENTS].map(([key, color]) =>
                                div()
                                    .id(`look-accent-${key}`)
                                    .size(18)
                                    .rounded(9)
                                    .cursor_pointer()
                                    .bg(color ?? t.accent)
                                    .border(2)
                                    .border_color(
                                        look.accent === key
                                            ? t.foreground
                                            : '#00000000',
                                    )
                                    .tooltip(
                                        key === 'theme'
                                            ? "Theme's accent"
                                            : key[0].toUpperCase() +
                                                  key.slice(1),
                                    )
                                    .on_click(() => setLook({ accent: key })),
                            ),
                        ),
                ),
            )
            .child(
                row(
                    'Your messages',
                    pills(
                        seg('mine', 'bubble', 'Bubbles'),
                        seg('mine', 'box', 'Box'),
                        seg('mine', 'tint', 'Tint'),
                        seg('mine', 'bar', 'Bar'),
                    ),
                ),
            )
            .child(
                row(
                    'Background',
                    pills(
                        seg('bg', 'background', 'Terminal'),
                        seg('bg', 'chrome', 'Panel'),
                        seg('bg', 'canvas', 'Canvas'),
                    ),
                ),
            )
            .child(row('', colors('bg', BGS)))
            .child(
                row(
                    'Text (all of Herdr)',
                    colors('fg', new Map([['theme', "Theme's"], ...FGS])),
                ),
            )
            .child(
                row(
                    'Spacing',
                    pills(
                        seg('space', 'tight', 'Tight'),
                        seg('space', 'normal', 'Normal'),
                        seg('space', 'roomy', 'Roomy'),
                    ),
                ),
            )
            .child(
                div()
                    .px(8)
                    .pt(10)
                    .pb(4)
                    .text_size(11)
                    .text_color(t.dim)
                    .child('+ menu'),
            )
            .child(
                row(
                    'Claude (dev container)',
                    this.dev === 'error'
                        ? div()
                              .text_size(11)
                              .text_color(t.dim)
                              .child("programs.json isn't valid JSON")
                        : pills(
                              ...[
                                  [false, 'Off'],
                                  [true, 'On'],
                              ].map(([on, label]) =>
                                  div()
                                      .id(`dev-${label}`)
                                      .px(8)
                                      .h(22)
                                      .flex()
                                      .items_center()
                                      .rounded(5)
                                      .text_size(12)
                                      .cursor_pointer()
                                      .when(this.dev === on, (el) =>
                                          el
                                              .bg(t.selected)
                                              .text_color(t.foreground),
                                      )
                                      .when(this.dev !== on, (el) =>
                                          el
                                              .text_color(t.dim)
                                              .hover((s) =>
                                                  s.text_color(t.foreground),
                                              ),
                                      )
                                      .on_click((_e, cx) => {
                                          if (
                                              this.dev === on ||
                                              this.dev === null
                                          )
                                              return;
                                          this.dev = on;
                                          setShared(DEV_CHOICE, on);
                                          cx.spawn(async (cx) => {
                                              try {
                                                  await setDevContainer(on);
                                              } catch {
                                                  this.dev = 'error';
                                              }
                                              cx.notify();
                                          });
                                      })
                                      .child(label),
                              ),
                          ),
                ),
            );
    }

    // The conversation in herdr's lazy list: only the rows on screen are drawn, each at the height the measurer found
    // out of sight, and the list scrolls natively; a wheel step redraws nothing unless following the newest flips.
    log(t, agent, rows, sub) {
        const key = sub ? `${agent.address}-${sub.name}` : agent.address;
        const z = Number(settings().zoom) || 1;
        const { gap, pad } = this.rowSpace();
        const keys = rows.map((r) => r.key);
        const shapes = rows.map((r) => this.shapeOf(r));
        const sizes = rowSizes(
            shapes,
            this.rowH,
            (i) => guessHeight(rows[i]) + gap,
        );
        /** @type {number} */
        const total = sizes.reduce((a, b) => a + b, 0);
        if (
            this.follow &&
            (total !== this.total || rows.length !== this.shownCount)
        )
            this.stick = true;
        /** @type {number} */
        this.total = total;
        this.shownCount = rows.length;
        if (this.seek !== null) {
            const at = rows.findIndex((r) => r.id === this.seek && !r.part);
            const first =
                at >= 0 ? at : rows.findIndex((r) => r.id === this.seek);
            this.seek = null;
            if (first >= 0) {
                this.follow = false;
                this.anchor = {
                    how: 'center',
                    key: keys[first],
                    until: Date.now() + 1500,
                };
                this.reanchor = true;
            }
        }
        if (this.reanchor && this.anchor) {
            const { uuid } = this.anchor;
            const at = uuid
                ? rows.findIndex((r) => uuidOf(r) === uuid)
                : keys.indexOf(this.anchor.key);
            if (at >= 0) {
                this.reanchor = false;
                this.anchor.key = keys[at];
                this.scroll.scroll_to_item(at, this.anchor.how);
            } else if (Date.now() > this.anchor.until) {
                // his row never came (a /clear, a trimmed transcript): the newest, never another seat's offset
                this.reanchor = false;
                this.anchor = null;
                this.follow = true;
                this.stick = true;
            }
        }
        if (this.anchor && !this.reanchor && Date.now() > this.anchor.until)
            this.anchor = null;
        if (this.stick) {
            this.stick = false;
            if (this.follow) this.scroll.scroll_to_bottom();
        }
        const gen = this.measureGen;
        const listId = `chat-rows-${key}`;
        const list = v_virtual_list(
            listId,
            rows.length,
            sizes,
            (i) => keys[i],
            (range) => {
                this.range = range;
                this.firstKey = keys[range.start] ?? null;
                this.firstUuid = uuidOf(rows[range.start]);
                const out = [];
                for (let i = range.start; i < range.end; i++)
                    out.push(
                        this.rowView(t, rows[i], `v${gen}-`, gap, pad)
                            .h(sizes[i])
                            .overflow_hidden(),
                    );
                return out;
            },
        )
            .track_scroll(this.scroll)
            .size_full()
            .on_item_click((k, cx) => this.clickRow(k, cx))
            .on_item_secondary_click((k, e) => {
                const row = this.flat.find((r) => r.key === k);
                if (row?.item?.text) this.ctxHit(e, row.item);
            });
        const prev = this.follow
            ? -1
            : prevMineIndex(rows, this.range?.start ?? rows.length);
        // the newest row when he left the bottom: what came after it is new to him, counted on the pill
        if (this.follow) this.leftUuid = undefined;
        else if (this.leftUuid === undefined)
            this.leftUuid = uuidOf(rows[rows.length - 1]);
        const left = this.leftUuid
            ? rows.findIndex((r) => uuidOf(r) === this.leftUuid)
            : -1;
        const fresh =
            left < 0
                ? 0
                : rows
                      .slice(left + 1)
                      .filter(
                          (r) =>
                              (r.kind === 'item' &&
                                  ['user', 'claude'].includes(r.item.kind)) ||
                              (r.kind === 'part' && r.isFirst),
                      ).length;
        return (
            div()
                .id(`log-${key}`)
                .relative()
                .flex_1()
                .min_h(0)
                .overflow_hidden()
                .on_size_change((s, cx) => {
                    const w = s.width / z;
                    const h = s.height / z;
                    if (w === this.viewW && h === this.viewH) return;
                    /** @type {number} */
                    this.viewW = w;
                    this.viewH = h;
                    if (this.follow) this.stick = true;
                    cx.notify();
                })
                // where a press landed across the row (rows take no handlers): the fork's column (clickRow)
                .on_mouse_down('left', (e) => {
                    this.pressX = (e.local_position?.x ?? -1) / z;
                    const y = (e.local_position?.y ?? -1) / z;
                    // ↑ Previous message and ↓ Newest float 10 px in from the top and bottom, centered; the menu covers
                    // what it is over: a press there is theirs, not the row's under it
                    const isFloat =
                        !this.follow &&
                        Math.abs(this.pressX - (this.viewW ?? 0) / 2) < 90 &&
                        ((prev >= 0 && y < 40) || y > (this.viewH ?? 0) - 40);
                    this.pressFloat = isFloat || Boolean(this.ctx);
                })
                .on_scroll_wheel((e, cx) => {
                    this.wheelAt = Date.now();
                    const isAtEnd = (this.range?.end ?? 0) >= rows.length;
                    const follow = followAfterWheel(
                        this.follow,
                        e.delta?.y ?? 0,
                        isAtEnd,
                    );
                    const now = Date.now();
                    if (!follow && now - (this.keptAt ?? 0) > 500) {
                        this.keptAt = now;
                        keepScroll(this.address, this.place());
                    }
                    // his own scroll ends any hold on a row, with no render for it
                    this.anchor = null;
                    this.reanchor = false;
                    if (follow === this.follow && !this.ctx) return;
                    this.follow = follow;
                    this.ctx = null;
                    keepScroll(this.address, this.place());
                    cx.notify();
                })
                .on_mouse_down('right', (e, cx) => this.openCtx(e, cx))
                .when(
                    Boolean(this.problem) && !this.items.length && !sub,
                    (el) =>
                        el.child(
                            div().p(16).text_color(t.dim).child(this.problem),
                        ),
                )
                .child(
                    v_flex()
                        .absolute()
                        .inset_0()
                        .pt(12)
                        .child(list)
                        .child(Scrollbar.vertical(listId).absolute().inset_0()),
                )
                .child(this.measurer(t, rows, keys, shapes, gap, pad))
                .when(Boolean(this.ctx), (el) => el.child(this.ctxMenu(t)))
                .when(!this.follow, (el) =>
                    el
                        .when(prev >= 0, (el) =>
                            el.child(
                                h_flex()
                                    .absolute()
                                    .top(10)
                                    .left(0)
                                    .right(0)
                                    .justify_center()
                                    .child(
                                        button(
                                            t,
                                            px,
                                            'prev-mine',
                                            '↑ Previous message',
                                            (_e, cx) => {
                                                const at = prevMineIndex(
                                                    rows,
                                                    this.range?.start ??
                                                        rows.length,
                                                );
                                                if (at < 0) return;
                                                this.anchor = {
                                                    how: 'top',
                                                    key: keys[at],
                                                    until: Date.now() + 1500,
                                                };
                                                this.reanchor = true;
                                                cx.notify();
                                            },
                                        ),
                                    ),
                            ),
                        )
                        .child(
                            h_flex()
                                .absolute()
                                .bottom(10)
                                .left(0)
                                .right(0)
                                .justify_center()
                                .child(
                                    button(
                                        t,
                                        px,
                                        'newest',
                                        fresh > 0
                                            ? `↓ ${fresh} new ${fresh === 1 ? 'message' : 'messages'}`
                                            : '↓ Newest',
                                        (_e, cx) => {
                                            this.follow = true;
                                            this.stick = true;
                                            this.anchor = null;
                                            keepScroll(
                                                this.address,
                                                this.place(),
                                            );
                                            cx.notify();
                                        },
                                        true,
                                    ),
                                ),
                        ),
                )
        );
    }

    // A file the reply links: its name with a folder glyph, the whole path on hover; a press opens it the way Finder
    // would (a png in Preview, a dir in Finder)
    /** @param {any} t @param {Row} row */
    fileRow(t, row) {
        return h_flex()
            .id(`file-${row.key}`)
            .gap(6)
            .items_center()
            .px(8)
            .py(3)
            .rounded(6)
            .border(1)
            .border_color(t.border)
            .cursor_pointer()
            .text_size(px(12))
            .text_color(t.muted)
            .hover((s) => s.bg(t.hover).text_color(t.foreground))
            .tooltip(row.path)
            .child('📂')
            .child(div().truncate().child(row.label));
    }

    // where he reads, as the store keeps it: the row's key for a tab switch, its item's uuid for a reload
    /** @returns {Place} */
    place() {
        return this.follow
            ? { anchor: null, follow: true, uuid: null }
            : { anchor: this.firstKey, follow: false, uuid: this.firstUuid };
    }

    // A message between threads, folded to one line: «sender → receiver · first words · time»; a press opens its
    // whole text in the row below
    /** @param {any} t @param {any} item */
    relayRow(t, item) {
        const open = this.open.has(item.id);
        const self =
            /** @type {Record<string, string>} */ (
                shared('x-herdr-agents.names') ?? {}
            )[this.address] ?? 'this thread';
        const isIn = item.kind === 'relay';
        const line = relayLine({
            at: item.at,
            from: isIn ? item.from : self,
            text: isIn ? item.text : String(item.input?.message ?? ''),
            to: isIn ? self : String(item.input?.to ?? 'another thread'),
        });
        return h_flex()
            .id(`relay-${item.id}`)
            .w_full()
            .gap(8)
            .items_center()
            .py(3)
            .px(8)
            .rounded(6)
            .cursor_pointer()
            .text_size(px(12))
            .text_color(t.muted)
            .bg(fade(t.accent, isIn ? '14' : '0a'))
            .hover((s) => s.bg(t.hover).text_color(t.foreground))
            .tooltip(open ? 'fold it' : 'show the whole message')
            .child(
                div()
                    .flex_none()
                    .text_size(px(10))
                    .text_color(t.dim)
                    .child(open ? '▾' : '▸'),
            )
            .child(div().flex_1().min_w(0).truncate().child(line));
    }

    // A message between threads, opened: its whole text, selectable
    /** @param {any} t @param {any} item */
    relayBody(t, item) {
        const text =
            item.kind === 'relay'
                ? item.text
                : String(item.input?.message ?? '');
        return div()
            .w_full()
            .pl(18)
            .child(
                div()
                    .w_full()
                    .px(10)
                    .py(8)
                    .rounded(6)
                    .bg(t.surface)
                    .border(1)
                    .border_color(t.border)
                    .child(
                        TextView.markdown(
                            `${this.pre}relay-${item.id}`,
                            text,
                        ).selectable(true),
                    ),
            );
    }

    // one render for a pass's heights, never one per row, and none while he scrolls: it waits out the fling
    /** @param {any} cx */
    measuredSoon(cx) {
        if (this.measureDue) return;
        this.measureDue = true;
        const quiet = WHEEL_QUIET_MS - (Date.now() - (this.wheelAt ?? 0));
        cx.timer.after(Math.max(MEASURE_BATCH_MS, quiet), (cx) => {
            this.measureDue = false;
            cx.notify();
        });
    }

    // what a row's height depends on: its key, and what can change inside it under the same key (a fold opened, a
    // tool's output arriving, a streaming reply growing, a search hit's outline), so a change is measured again
    /** @param {Row} row */
    shapeOf(row) {
        const text = row.b?.text ?? row.item?.text ?? '';
        const open = row.item && this.open.has(row.item.id) ? 1 : 0;
        const hit = row.id !== undefined && this.hits.found.has(row.id) ? 1 : 0;
        const result =
            row.kind === 'detail' ? (row.item?.result?.length ?? -1) : 0;
        return `${row.key}|${text.length}|${open}|${hit}|${result}`;
    }

    // the room around a row: the gap below it, and the side padding (a readable column when narrow)
    rowSpace() {
        const look = chatLook();
        const pad =
            look.width === 'narrow'
                ? Math.max(16, ((this.viewW ?? 0) - NARROW) / 2)
                : 16;
        return { gap: GAPS[look.space] ?? 10, pad };
    }

    // The rows the list shows, each with the key the list and its press report: a turn's fold, a message, a tool and
    // its opened detail, and a reply cut into blocks when it holds code or a prompt card.
    /** @param {any[]} listed @param {any} sub @returns {Row[]} */
    rowsOf(listed, sub) {
        /** @type {Row[]} */
        const rows = [];
        if (!sub && this.head > 0)
            rows.push({ key: 'earlier', kind: 'earlier' });
        for (const x of listed) {
            if (x.work) {
                rows.push({ key: x.key, kind: 'turn', x });
                continue;
            }
            const [item, id] = x;
            const key = String(id);
            const files = () => {
                if (item.kind !== 'claude') return;
                if (item.filesOf !== item.text) {
                    item.files = fileLinks(item.text);
                    item.filesOf = item.text;
                }
                rows.push(
                    ...item.files.map(
                        (
                            /** @type {{ label: string, path: string }} */ f,
                            /** @type {number} */ k,
                        ) => ({
                            id,
                            item,
                            key: `${key}:f${k}`,
                            kind: /** @type {'file'} */ ('file'),
                            ...f,
                        }),
                    ),
                );
            };
            if (item.kind === 'claude' && !this.markIn(id)) {
                const blocks = this.blocksOf(item);
                if (blocks.length > 1 || blocks[0]?.kind !== 'text') {
                    blocks.forEach((b, k) => {
                        const at = {
                            b,
                            id,
                            isFirst: k === 0,
                            item,
                            kind: /** @type {'part'} */ ('part'),
                        };
                        if (b.kind === 'code') {
                            rows.push({
                                ...at,
                                key: `${key}:${k}h`,
                                part: 'codehead',
                            });
                            rows.push({
                                ...at,
                                isFirst: false,
                                key: `${key}:${k}`,
                                part: 'code',
                            });
                        } else
                            rows.push({
                                ...at,
                                key: `${key}:${k}`,
                                part: b.kind === 'text' ? 'text' : 'prompt',
                            });
                    });
                    files();
                    continue;
                }
            }
            rows.push({
                id,
                item,
                key,
                kind: 'item',
                mine: item.kind === 'user',
            });
            files();
            if (
                (isRelay(item) ||
                    (item.kind === 'tool' &&
                        !AGENT_TOOLS.has(item.name) &&
                        item.name !== 'AskUserQuestion')) &&
                this.open.has(item.id)
            )
                rows.push({ id, item, key: `${key}:detail`, kind: 'detail' });
        }
        this.flat = rows;
        return rows;
    }

    // One row as the list and the measurer draw it, with no handlers (a list row may hold none): `pre` keeps the two
    // copies' text views apart, so a reply keeps the wrap it was laid out at in each.
    rowView(t, row, pre, gap, pad) {
        this.pre = pre;
        const { current, found } = this.hits;
        const hit =
            row.id !== undefined &&
            !row.part &&
            row.kind !== 'file' &&
            found.has(row.id);
        const body =
            row.kind === 'earlier'
                ? h_flex()
                      .w_full()
                      .justify_center()
                      .child(button(t, px, 'earlier', 'Show earlier'))
                : row.kind === 'file'
                  ? this.claudeLook(t, this.fileRow(t, row), false)
                  : row.kind === 'turn'
                    ? this.turnRow(t, row.x, found)
                    : row.kind === 'part'
                      ? this.replyPart(t, row)
                      : row.kind === 'detail'
                        ? isRelay(row.item)
                            ? this.relayBody(t, row.item)
                            : this.toolBody(t, row.item)
                        : this.bubble(t, row.item, row.id);
        return div()
            .w_full()
            .px(pad)
            .pb(row.part === 'codehead' ? 0 : gap)
            .child(
                div()
                    .w_full()
                    // Search hits tinted, the current one outlined (the same padding on all, so moving between
                    // them doesn't shift the rows).
                    .when(hit, (el) =>
                        el
                            .p(3)
                            .rounded(8)
                            .border(1)
                            .bg(
                                fade(
                                    t.accent,
                                    row.id === current ? '1f' : '0d',
                                ),
                            )
                            .border_color(
                                row.id === current
                                    ? t.accent
                                    : fade(t.accent, '33'),
                            ),
                    )
                    .child(body),
            );
    }

    // Rows not measured yet, drawn once out of sight at the list's width; their heights go to the list, which then
    // places every row exactly. Those near what is shown go first (after shepherdr's chat, MIT).
    measurer(t, rows, keys, shapes, gap, pad) {
        const now = Date.now();
        const anchored =
            this.anchor && now < this.anchor.until
                ? keys.indexOf(this.anchor.key)
                : -1;
        const near =
            anchored >= 0
                ? anchored
                : this.range
                  ? this.range.start
                  : rows.length - 1;
        const order = measureOrder(shapes, this.rowH, this.measuredAt, near);
        // a measured row counts a pass; two passes with no change in its height and it is settled (a size observer
        // reports only a change, so a steady height never calls back)
        let settledNow = false;
        for (const i of order)
            if (this.rowH.has(shapes[i])) {
                const reads = (this.measuredAt.get(shapes[i]) ?? 0) + 1;
                this.measuredAt.set(shapes[i], reads);
                if (reads >= SETTLED_READS) settledNow = true;
            }
        // another pass only while the last one moved something: a row that never reports a size, or a height that
        // flips between two values, would otherwise redraw the chat 30 times a second for good
        const moved =
            this.rowH.size !== this.heightsSeen ||
            this.heightChanges !== this.changesSeen;
        this.heightsSeen = this.rowH.size;
        this.changesSeen = this.heightChanges;
        // 1: a row that settles in this pass leaves the measurer at the next render, never at some later one
        if (
            (moved && order.some((i) => this.rowH.has(shapes[i]))) ||
            settledNow
        )
            this.measuredSoon(this.renderCx);
        // rows left unmeasured are measured ahead while he isn't scrolling, so a fling never reaches one
        if (moved && shapes.some((k) => !this.rowH.has(k)))
            this.measuredSoon(this.renderCx);
        const gen = this.measureGen;
        return div()
            .absolute()
            .top(0)
            .left(0)
            .w(this.viewW ?? 0)
            .h(0)
            .overflow_hidden()
            .opacity(0)
            .child(
                v_flex()
                    .w_full()
                    .children(
                        order.map((i) =>
                            div()
                                .id(`m${gen}-${keys[i]}`)
                                .flex_none()
                                .w_full()
                                .on_size_change((s, cx) => {
                                    if (gen !== this.measureGen) return;
                                    const k = shapes[i];
                                    const h =
                                        s.height /
                                        (Number(settings().zoom) || 1);
                                    if (this.rowH.get(k) === h) return;
                                    const flips = (this.flips.get(k) ?? 0) + 1;
                                    this.flips.set(k, flips);
                                    if (flips > FLIP_LIMIT) {
                                        this.rowH.set(
                                            k,
                                            Math.max(this.rowH.get(k) ?? 0, h),
                                        );
                                        this.measuredAt.set(k, SETTLED_READS);
                                        return;
                                    }
                                    this.heightChanges =
                                        (this.heightChanges ?? 0) + 1;
                                    this.measuredAt.set(k, 0);
                                    this.rowH.set(k, h);
                                    const isWheeling =
                                        Date.now() - (this.wheelAt ?? 0) <
                                        WHEEL_QUIET_MS;
                                    if (this.follow) this.stick = true;
                                    else if (
                                        !isWheeling &&
                                        !this.anchor &&
                                        this.firstKey &&
                                        i < (this.range?.start ?? 0)
                                    ) {
                                        this.anchor = {
                                            how: 'top',
                                            key: this.firstKey,
                                            until: Date.now() + 300,
                                            uuid: null,
                                        };
                                        this.reanchor = true;
                                    }
                                    if (
                                        this.anchor &&
                                        Date.now() < this.anchor.until
                                    )
                                        this.reanchor = true;
                                    this.measuredSoon(cx);
                                })
                                .child(
                                    this.rowView(
                                        t,
                                        rows[i],
                                        `m${gen}-`,
                                        gap,
                                        pad,
                                    ),
                                ),
                        ),
                    ),
            );
    }

    // A press on a row, by its key (rows take no handlers): what it does by the row's kind, and for his message, where
    // across the row it landed.
    clickRow(key, cx) {
        const row = this.flat?.find((r) => r.key === key);
        if (!row || this.pressFloat) return;
        const item = row.item;
        if (row.kind === 'earlier') {
            const anchor =
                this.firstKey === 'earlier'
                    ? (this.flat[1]?.key ?? null)
                    : this.firstKey;
            cx.spawn(async (/** @type {any} */ cx) => {
                await this.loadEarlier();
                if (anchor) {
                    this.follow = false;
                    this.anchor = {
                        how: 'top',
                        key: anchor,
                        until: Date.now() + 1500,
                    };
                    this.reanchor = true;
                }
                cx.notify();
            });
            return;
        }
        if (row.kind === 'file') {
            exec('open', [row.path]).catch(() => {});
            return;
        }
        if (row.kind === 'turn') {
            // the row stays where it is and the work opens below it
            this.unfolded.has(key)
                ? this.unfolded.delete(key)
                : this.unfolded.add(key);
            this.follow = false;
        } else if (row.part === 'codehead') {
            if (!row.b.isClosed) return;
            cx.write_to_clipboard(row.b.text);
            this.copied = { at: Date.now(), key };
            cx.timer.after(1600, (cx) => cx.notify());
        } else if (row.part === 'prompt') {
            this.box.set_value(withPrompt(this.box.value(), row.b.text));
            this.box.focus();
        } else if (row.kind === 'detail' || row.kind === 'part') return;
        else if (item.kind === 'user') {
            const { pad } = this.rowSpace();
            const inset =
                (chatLook().mine === 'bubble' ? 0 : 12) +
                (this.hits.found.has(row.id) ? 4 : 0);
            const edge = (this.viewW ?? 0) - pad - inset;
            const agent = this.agentNow;
            if (
                !item.before ||
                !agent ||
                (this.pressX ?? -1) < edge - FORK_W ||
                (this.pressX ?? -1) > edge
            )
                return;
            cx.spawn(async (/** @type {any} */ cx) => {
                await this.fork(agent, item.before, cx);
            });
            return;
        } else if (item.kind === 'system' || isRelay(item))
            this.open.has(item.id)
                ? this.open.delete(item.id)
                : this.open.add(item.id);
        else if (AGENT_TOOLS.has(item.name)) {
            if (!this.subs.get(item.id)) return;
            this.trail.push(item.id);
            this.follow = true;
            this.stick = true;
        } else if (item.kind === 'tool' && item.name !== 'AskUserQuestion')
            this.open.has(item.id)
                ? this.open.delete(item.id)
                : this.open.add(item.id);
        else return;
        cx.notify();
    }

    // A reply as one row: whole, or with a search's marks, which span its blocks. A reply with code or a prompt card is
    // cut into rows instead (rowsOf), so the copy and the card take a press of their own.
    replyBody(_t, item, i) {
        const text = this.markIn(i)
            ? markMarkdown(item.text, this.marks.re, this.markIn(i))
            : item.text;
        return TextView.markdown(`${this.pre}md-${i}`, text).selectable(true);
    }

    /** @param {{ text: string, blocks?: any[], blocksOf?: string }} item @returns {import('./blocks.js').Block[]} */
    blocksOf(item) {
        if (item.blocksOf !== item.text) {
            item.blocks = splitBlocks(item.text);
            item.blocksOf = item.text;
        }
        return item.blocks;
    }

    // One block of a reply cut into rows: prose, a code block's head (the language and the copy) or body, a prompt card.
    replyPart(t, row) {
        const { b, part } = row;
        if (part === 'text')
            return this.claudeLook(
                t,
                TextView.markdown(
                    `${this.pre}md-${row.key}`,
                    b.text,
                ).selectable(true),
                row.isFirst,
            );
        if (part === 'prompt')
            return this.claudeLook(
                t,
                this.promptCard(t, b, row.key),
                row.isFirst,
            );
        const isCopied =
            this.copied?.key === row.key && Date.now() - this.copied.at < 1500;
        const box =
            part === 'codehead'
                ? h_flex()
                      .w_full()
                      .px(10)
                      .pt(6)
                      .pb(2)
                      .items_center()
                      .rounded_t(8)
                      .border_t(1)
                      .border_x(1)
                      .border_color(t.border)
                      .bg(t.raised)
                      .text_size(px(11))
                      .text_color(t.muted)
                      .child(b.lang || 'code')
                      .child(div().flex_1())
                      // the copy button shows once the fence is closed, never mid-stream
                      .when(b.isClosed, (el) =>
                          el.child(
                              div()
                                  .id(`copy-${row.key}`)
                                  .px(6)
                                  .py(2)
                                  .rounded(5)
                                  .cursor_pointer()
                                  .text_color(isCopied ? t.accent : t.muted)
                                  .hover((s) =>
                                      s.bg(t.hover).text_color(t.foreground),
                                  )
                                  .child(isCopied ? '✓ copied' : '⧉ copy'),
                          ),
                      )
                : div()
                      .w_full()
                      .px(10)
                      .pb(8)
                      .pt(2)
                      .rounded_b(8)
                      .border_b(1)
                      .border_x(1)
                      .border_color(t.border)
                      .bg(t.raised)
                      .font_family(this.mono())
                      .text_size(px(13))
                      .child(
                          TextView.markdown(
                              `${this.pre}code-${row.key}`,
                              `\`\`\`\n${b.text}\n\`\`\``,
                          ).selectable(true),
                      );
        return this.claudeLook(t, box, false);
    }

    /** @param {Theme} t @param {{ to: string, text: string }} b @param {string} key */
    promptCard(t, b, key) {
        return v_flex()
            .id(`prompt-${key}`)
            .w_full()
            .gap(4)
            .p(10)
            .rounded(10)
            .border(1)
            .border_color(t.accent)
            .cursor_pointer()
            .hover((s) => s.bg(t.hover))
            .child(
                h_flex()
                    .text_size(px(11))
                    .text_color(t.accent)
                    .child(`📋 prompt → ${b.to}`)
                    .child(div().flex_1())
                    .child('click to put it in your box'),
            )
            .child(div().text_size(px(13)).child(b.text));
    }

    // ---- the right-click menu

    // A right-click on a message: the menu is about this message. The log's handler (openCtx) runs
    // too, in either order: whichever comes second completes the other's half.
    ctxHit(e, item) {
        if (
            this.ctx &&
            this.ctx.at.x === e.position.x &&
            this.ctx.at.y === e.position.y
        )
            this.ctx.text = item.text;
        else this.ctxItem = { at: e.position, text: item.text };
    }

    // A right-click anywhere in the log opens the menu there. The selected text can't be had: a
    // TextView has no selection API, and running Herdr's copy from here (terminal.copy, the
    // shell_root::Copy and input::Copy actions Ctrl+C goes through) left the clipboard untouched
    // (tried 2026-11-06), so the menu works on whole messages.
    openCtx(e, cx) {
        const hit = this.ctxItem;
        // The position comes in window pixels; lengths are laid out at the zoom (as x-herdr-tabs does).
        const z = settings().zoom || 1;
        const local = e.local_position ?? { x: 0, y: 0 };
        const text =
            hit && hit.at.x === e.position.x && hit.at.y === e.position.y
                ? hit.text
                : null;
        this.ctxItem = null;
        this.ctx = { at: e.position, text, x: local.x / z, y: local.y / z };
        cx.notify();
    }

    // Copy message = the whole message as written (markdown); Quote in chat = it goes into the box
    // as a "> " quote. A press anywhere else closes the menu.
    ctxMenu(t) {
        const W = 200,
            H = 2 * 27 + 8;
        const x = Math.max(0, Math.min(this.ctx.x, (this.viewW ?? W) - W));
        const y =
            this.ctx.y + H > (this.viewH ?? 0)
                ? Math.max(0, this.ctx.y - H)
                : this.ctx.y;
        const close = (cx) => {
            this.ctx = null;
            cx.notify();
        };
        const text = this.ctx.text;
        const row = (id, label, onClick) =>
            h_flex()
                .id(`ctx-${id}`)
                .h(26)
                .px(8)
                .gap(8)
                .items_center()
                .rounded(5)
                .text_size(px(12.5))
                .text_color(text ? t.foreground : t.dim)
                .when(Boolean(text), (el) =>
                    el
                        .cursor_pointer()
                        .hover((s) => s.bg(t.hover))
                        .on_click((_e, cx) => {
                            onClick(cx);
                            close(cx);
                        }),
                )
                .child(label);
        return v_flex()
            .id('ctx-menu')
            .absolute()
            .left(x)
            .top(y)
            .w(W)
            .p(4)
            .gap(1)
            .rounded(8)
            .bg(t.popover)
            .border(1)
            .border_color(t.border)
            .shadow_md()
            .on_mouse_down_out((_e, cx) => close(cx))
            .child(
                row('copy-msg', 'Copy message', (cx) =>
                    cx.write_to_clipboard(text),
                ),
            )
            .child(
                row('quote', 'Quote message in chat', () => this.quote(text)),
            );
    }

    // The seat's band where he types: what it waits on, its weekly usage and its context, from the facts the deck's
    // mod publishes (`band.js`). Three rows of one height always, so nothing under or above it moves when a fact
    // changes; a seat the deck has stopped reading draws dimmed, never as a live number.
    // whether his layout shows the deck's block now; a layout without it reads as shown, so 🚦 offers a hide
    deckShown() {
        /** @param {any} node @returns {any} */
        const walk = (node) => {
            if (node?.id === DECK_BLOCK) return node;
            for (const child of node?.children ?? []) {
                const found = walk(child);
                if (found) return found;
            }
            return null;
        };
        return !walk(layout())?.hidden;
    }

    // one chip of the row: filled when on, greyed with its reason when its press is not proven; a live one is a click,
    // never a key (a keyed command is any shell's)
    /** @param {any} t @param {import('./band.js').BandButton} btn */
    bandButton(t, btn) {
        return (
            Button.new(`band-${btn.key}`)
                .size(px(24))
                .flex_none()
                .justify_center()
                .flex()
                .items_center()
                .rounded(11)
                .border_1()
                // his shape (22:30: «i liked previous shape … remove dimming»): on is filled, off is plain, and
                // nothing fades but 🎛️, which does nothing yet; an override on is loud, it lifts every guard
                .border_color(
                    btn.isOn
                        ? btn.key === 'override'
                            ? t.blocked
                            : t.solid
                        : t.border,
                )
                .bg(
                    btn.isOn
                        ? btn.key === 'override'
                            ? t.blocked
                            : t.solid
                        : t.background,
                )
                .text_size(px(12))
                .text_color(btn.isOn ? t.solid_foreground : t.foreground)
                .tooltip(btn.tip)
                .when(btn.key === 'settings', (el) => el.opacity(0.5))
                .when(!btn.isLive, (el) => el.cursor_not_allowed())
                .when(btn.isLive, (el) =>
                    el
                        .cursor_pointer()
                        .hover((s) => s.opacity(0.85))
                        .on_click((_e, cx) => {
                            if (btn.key === 'board')
                                run('layout.toggle', { id: DECK_BLOCK });
                            else this.press(cx, btn);
                            cx.notify();
                        }),
                )
                .child(btn.emoji)
        );
    }

    // a press of wind, hot, waker or AFK: the state it asks for shows at once, the stash's own write settles it
    /** @param {import('gpui-kit').Context} cx @param {import('./band.js').BandButton} btn */
    press(cx, btn) {
        const key = /** @type {import('./band.js').PressKey} */ (btn.key);
        if (!['wind', 'hot', 'waker', 'afk'].includes(key)) return;
        const on = !btn.isOn;
        const at = Date.now();
        /** @type {import('./band.js').Pending} */
        const pressed = {
            .../** @type {import('./band.js').Pending} */ (this.pressed),
            [key]: { at, on },
        };
        this.pressed = pressed;
        const line = pressLine(key, on, this.states?.thread?.sid ?? null, at);
        cx.spawn(async (/** @type {import('gpui-kit').Context} */ cx) => {
            try {
                await appendPress(line);
            } catch (err) {
                /** @type {import('./band.js').Pending} */
                const rest = {
                    .../** @type {import('./band.js').Pending} */ (
                        this.pressed
                    ),
                };
                delete rest[key];
                this.pressed = rest;
                notify({
                    body: String(err),
                    level: 'error',
                    title: `${btn.word}: the press was not written`,
                });
            }
            cx.notify();
        });
    }

    // the thread's own state and the fleet's, as x-mod-stash wrote them for the band's four buttons, and the presses
    // in the press file it has not answered yet
    /** @param {import('gpui-kit').Context} cx */
    readStates(cx) {
        if (this.statesBusy) return;
        this.statesBusy = true;
        const pid = this.where?.container ? null : this.where?.pid;
        cx.spawn(async (/** @type {import('gpui-kit').Context} */ cx) => {
            try {
                const next = await bandStates(pid);
                if (JSON.stringify(next) !== JSON.stringify(this.states)) {
                    this.states = next;
                    cx.notify();
                }
                if (this.settlePresses()) cx.notify();
            } finally {
                this.statesBusy = false;
            }
        });
    }

    // what waits on the stash: this band's own presses and the press file's, the newest per button, minus each the
    // state already reads, so the deck's press and the band's draw the same
    pendingNow() {
        /** @type {import('./band.js').Pending} */
        const merged = { ...(this.states?.presses ?? {}) };
        for (const [key, p] of Object.entries(this.pressed ?? {})) {
            const k = /** @type {import('./band.js').PressKey} */ (key);
            if (!merged[k] || p.at > merged[k].at) merged[k] = p;
        }
        const base = bandButtons({
            fleet: this.states?.fleet,
            isDeckShown: true,
            override: { isOn: false },
            thread: this.states?.thread,
        });
        /** @type {import('./band.js').Pending} */
        const left = {};
        for (const [key, p] of Object.entries(merged))
            if (base.find((b) => b.key === key)?.isOn !== p.on)
                left[/** @type {import('./band.js').PressKey} */ (key)] = p;
        return left;
    }

    // a press is settled once the stash's state reads what it asked, or after PENDING_MS without an answer
    settlePresses() {
        /** @type {import('./band.js').Pending} */
        const pressed = this.pressed ?? {};
        const now = Date.now();
        const base = bandButtons({
            fleet: this.states?.fleet,
            isDeckShown: true,
            override: { isOn: false },
            thread: this.states?.thread,
        });
        /** @type {import('./band.js').Pending} */
        const left = {};
        for (const [key, p] of Object.entries(pressed)) {
            const b = base.find((x) => x.key === key);
            if (b && b.isOn !== p.on && now - p.at < PENDING_MS)
                left[/** @type {import('./band.js').PressKey} */ (key)] = p;
        }
        const isChanged =
            Object.keys(left).length !== Object.keys(pressed).length;
        this.pressed = left;
        return isChanged;
    }

    band(t) {
        const pid = this.where?.container ? null : this.where?.pid;
        const b = bandOf(shared(SEATS_KEY), pid, Date.now());
        const ink = b.isStale ? t.dim : t.muted;
        const row = (id) =>
            h_flex().id(id).h(px(18)).gap(8).items_center().min_w(0);
        const label = (text) =>
            div()
                .w(px(52))
                .flex_none()
                .text_size(px(12))
                .text_color(t.dim)
                .child(text);
        const meter = (id, name, tip, pct, warnAt) => {
            const warn = pct != null && pct >= warnAt && !b.isStale;
            return row(id)
                .tooltip(
                    pct == null
                        ? `${tip}: not read yet`
                        : `${tip}: ${Math.round(pct)}%`,
                )
                .child(label(name))
                .child(
                    div()
                        .flex_1()
                        .h(4)
                        .rounded(2)
                        .bg(t.border)
                        .child(
                            div()
                                .w(
                                    `${Math.max(0, Math.min(100, Math.round(pct ?? 0)))}%`,
                                )
                                .h(4)
                                .rounded(2)
                                .bg(
                                    b.isStale
                                        ? t.dim
                                        : warn
                                          ? t.blocked
                                          : t.accent,
                                ),
                        ),
                )
                .child(
                    div()
                        .w(px(36))
                        .flex_none()
                        .flex()
                        .justify_end()
                        .text_size(px(12))
                        .text_color(warn ? t.blocked : ink)
                        .child(pct == null ? '—' : `${Math.round(pct)}%`),
                );
        };
        return (
            v_flex()
                .id('seat-band')
                .flex_none()
                .px(10)
                .py(4)
                .rounded(8)
                .bg(t.raised)
                .when(b.isStale, (el) =>
                    el.tooltip(
                        'the deck has not read this seat for over 2 minutes',
                    ),
                )
                .child(
                    row('band-wait')
                        .h(px(26))
                        .child(label('🔭 wait'))
                        .child(
                            div()
                                .id('band-wait-text')
                                .flex_1()
                                .min_w(0)
                                .truncate()
                                .text_size(px(12))
                                .text_color(ink)
                                .when(Boolean(b.wait), (el) =>
                                    el.tooltip(b.wait),
                                )
                                .child(b.wait ?? ''),
                        )
                        .child(
                            h_flex()
                                .flex_none()
                                .gap(4)
                                .children(
                                    bandButtons({
                                        fleet: this.states?.fleet,
                                        isDeckShown: this.deckShown(),
                                        override: this.override ?? {
                                            isOn: false,
                                        },
                                        pending: this.pendingNow(),
                                        thread: this.states?.thread,
                                    }).map((btn) => this.bandButton(t, btn)),
                                ),
                        ),
                )
                // ctx above week (dima, 21:00: «move ctx meter over the week»)
                .child(
                    meter(
                        'band-ctx',
                        '🧠 ctx',
                        'how full its context is',
                        b.context,
                        60,
                    ),
                )
                .child(
                    meter(
                        'band-week',
                        '🗓 week',
                        'the weekly usage spent',
                        b.week,
                        80,
                    ),
                )
        );
    }

    // Puts text into the box as a markdown quote, after what's there, and gives the box the keyboard.
    quote(text) {
        const quoted = text
            .trim()
            .split(/\r?\n/)
            .map((l) => `> ${l}`)
            .join('\n');
        const had = this.box.value();
        this.box.set_value(
            had.trim()
                ? `${had.replace(/\s+$/, '')}\n\n${quoted}\n\n`
                : `${quoted}\n\n`,
        );
        this.typed = this.box.value();
        keepDraft(this.address, this.typed);
        this.box.focus();
    }

    // ---- search

    openFind(cx) {
        this.findOpen = true;
        // What was searched last is kept, selected, so typing replaces it.
        this.findQ = this.findBox.value().trim();
        this.findBox.set_selected_range({
            end: this.findBox.value().length,
            start: 0,
        });
        cx.timer.after(30, () => this.findBox.focus());
        cx.notify();
    }

    closeFind(cx) {
        this.findOpen = false;
        this.findQ = '';
        this.findList = [];
        this.findAt = null;
        this.findKey = null;
        this.findWhat = null;
        this.seek = null;
        this.box.focus();
        cx.notify();
    }

    // -1: the older hit, 1: the newer (both wrap round). A query still settling is taken first.
    findStep(dir, cx) {
        const q = this.findBox.value().trim();
        if (q !== this.findQ) {
            this.findQ = q;
            return cx.notify();
        }
        const n = this.findList.length;
        if (!n) return;
        this.findAt = ((this.findAt ?? n - 1) + dir + n) % n;
        this.seekTo(this.findList[this.findAt]);
        cx.notify();
    }

    // Scrolls to a hit (log centers it). A hit in a tool's input or output, not its one-line
    // summary, opens the row.
    seekTo({ item, id }) {
        this.seek = id;
        this.seekShown = false;
        if (
            item.kind === 'tool' &&
            !AGENT_TOOLS.has(item.name) &&
            item.name !== 'AskUserQuestion' &&
            !findRe(this.findQ).test(
                `${item.name} ${toolLine(item.name, item.input)}`,
            )
        )
            this.open.add(item.id);
    }

    // The hits among what can be shown ([item, row id] pairs), as a set of row ids. Searched again
    // only when the query or the conversation changed; a new query (or agent) goes to the newest
    // hit, new lines keep the current one.
    findings(entries, sub) {
        if (!this.findOpen || !this.findQ) {
            this.findList = [];
            this.findAt = null;
            this.findKey = null;
            this.findWhat = null;
            return new Set();
        }
        const what = JSON.stringify([
            this.findQ,
            this.address,
            sub?.name ?? null,
        ]);
        const key = `${what}|${entries.length}|${this.version}`;
        if (key !== this.findKey) {
            const re = findRe(this.findQ);
            const was = this.findList[this.findAt]?.id;
            this.findList = entries
                .filter(([item]) => re.test(searchText(item)))
                .map(([item, id]) => ({ id, item }));
            const k =
                what === this.findWhat
                    ? this.findList.findIndex((m) => m.id === was)
                    : -1;
            this.findAt =
                k >= 0
                    ? k
                    : this.findList.length
                      ? this.findList.length - 1
                      : null;
            if (what !== this.findWhat && this.findAt !== null)
                this.seekTo(this.findList[this.findAt]);
            this.findWhat = what;
            this.findKey = key;
        }
        return new Set(this.findList.map((m) => m.id));
    }

    // The mark color for the hits in row `id`'s text (brighter in the current one), or null.
    markIn(id) {
        const m = this.marks;
        return m?.found.has(id)
            ? id === m.current
                ? MARK.current
                : MARK.hit
            : null;
    }

    findBar(t) {
        const n = this.findList.length;
        const count = !this.findQ
            ? ''
            : n
              ? `${this.findAt + 1} of ${n}`
              : 'No matches';
        const icon = (id, label, tip, onClick) =>
            div()
                .id(id)
                .flex_none()
                .size(24)
                .flex()
                .items_center()
                .justify_center()
                .rounded(5)
                .cursor_pointer()
                .text_color(n ? t.foreground : t.dim)
                .hover((s) => s.bg(t.hover))
                .tooltip(tip)
                .on_click(onClick)
                .child(label);
        return (
            h_flex()
                .id('find-bar')
                .track_focus(this.findKeys)
                .h(38)
                .flex_none()
                .px(12)
                .gap(8)
                .items_center()
                .border_b(1)
                .border_color(t.border)
                .bg(t.chrome)
                .text_size(12)
                // Keys pass through here on their way up from the search box.
                .on_key_down((e, cx) => {
                    if (e.key === 'escape') this.closeFind(cx);
                    else if (e.key === 'up') this.findStep(-1, cx);
                    else if (e.key === 'down') this.findStep(1, cx);
                    else return;
                    cx.stop_propagation();
                })
                .child(
                    svg('mods/workspace-chrome/search.svg')
                        .size(13)
                        .flex_none()
                        .text_color(t.dim),
                )
                .child(
                    div()
                        .flex_1()
                        .min_w(0)
                        .h(26)
                        .px(6)
                        .flex()
                        .items_center()
                        .rounded(6)
                        .bg(t.background)
                        .border(1)
                        .border_color(t.input)
                        .text_color(t.foreground)
                        .child(Input.new(this.findBox)),
                )
                .child(
                    div()
                        .flex_none()
                        .text_color(n || !this.findQ ? t.dim : t.blocked)
                        .child(count),
                )
                .child(
                    icon('find-prev', '↑', 'Older match (Enter, ↑)', (_e, cx) =>
                        this.findStep(-1, cx),
                    ),
                )
                .child(
                    icon(
                        'find-next',
                        '↓',
                        'Newer match (Shift+Enter, ↓)',
                        (_e, cx) => this.findStep(1, cx),
                    ),
                )
                .child(
                    div()
                        .id('find-close')
                        .flex_none()
                        .size(24)
                        .flex()
                        .items_center()
                        .justify_center()
                        .rounded(5)
                        .cursor_pointer()
                        .text_color(t.dim)
                        .hover((s) => s.bg(t.hover).text_color(t.foreground))
                        .tooltip('Close (Esc)')
                        .on_click((_e, cx) => this.closeFind(cx))
                        .child('×'),
                )
        );
    }

    render(cx) {
        this.renderCx = cx;
        return inRender(() => this.renderView(cx));
    }

    /** @param {any} cx */
    renderView(cx) {
        if (props()?.settings) return this.settingsMenu(theme());
        const t = chatTheme();
        const agent = this.target();
        // Another agent: the switch runs at once in a task, never here: reset() sets the box's caret, which herdr refuses
        // during render, and a refused render left the box on the new seat's draft under the old seat's address.
        if ((agent?.address ?? null) !== this.address)
            cx.timer.after(0, (cx) => this.tick(cx));
        // Clicking a character or a tab gives the keyboard to that (hidden) terminal: take it back
        // whenever the chat comes on screen or changes agent, so typing lands in the box.
        const seen = this.showing() ? (agent?.address ?? '') : null;
        if (seen && seen !== this.seen)
            cx.timer.after(50, () => this.box.focus());
        this.seen = seen;
        const look = chatLook();
        const root = v_flex()
            .size_full()
            .min_h(0)
            .bg(t.background)
            .text_size(px(13));
        // The chosen font goes to the messages and the box, not the header.
        const font = (el) =>
            el.font_family(look.font === 'mono' ? this.mono() : SANS);
        if (!agent) {
            // A tab with no Claude goes to the Terminal now rather than on the next 2 s tick.
            if (props()?.stack) cx.timer.after(0, () => this.autoView(null));
            const text = starting(focused()?.tab)
                ? 'Starting Claude…'
                : 'No Claude agent in this tab.';
            return root
                .items_center()
                .justify_center()
                .gap(10)
                .text_color(t.dim)
                .child(text)
                .when(Boolean(props()?.stack), (el) =>
                    el.child(
                        button(t, px, 'show-terminal', 'Show terminal', () =>
                            this.toTerminal(),
                        ),
                    ),
                );
        }
        // An opened sub-agent shows its conversation instead (gone after /clear: back to the chat).
        const sub = this.subs.get(this.trail[this.trail.length - 1]) ?? null;
        if (!sub) this.trail = [];
        this.agentNow = sub ? null : agent;
        // Each item with its index, which its row ids use; tool calls left out if hidden (not sub-agents).
        const visible = ([item]) =>
            look.tools === 'show' ||
            ['user', 'claude', 'note'].includes(item.kind) ||
            AGENT_TOOLS.has(item.name) ||
            item.name === 'AskUserQuestion' ||
            isRelay(item);
        // Questions a hook sent back are left out: Claude asks again at once.
        const all = (sub ? sub.items : this.items)
            .map((item, i) => [item, sub ? `${sub.name}-${i}` : i - this.base])
            .filter(
                ([item]) =>
                    !ask.rejected(item) &&
                    !(item.kind === 'system' && chatLook().system === 'hide'),
            );
        const found = this.findings(all.filter(visible), sub);
        const current = this.findList[this.findAt]?.id;
        this.marks = found.size
            ? { current, found, re: findRe(this.findQ, 'gi') }
            : null;
        let listed = sub ? all.filter(visible) : this.turns(all, visible);
        // The hit being sought: inside a folded turn, the turn opens; above the loaded rows, more load.
        if (this.seek !== null && !this.seekShown) {
            this.seekShown = true;
            const fold = listed.find(
                (x) =>
                    x.work &&
                    !x.open &&
                    x.work.some(([, id]) => id === this.seek),
            );
            if (fold) {
                this.unfolded.add(fold.key);
                listed = this.turns(all, visible);
            }
        }
        this.agentWorking = agent.status === 'working';
        this.settleQueued(agent.status, cx);
        const queued = this.queued.get(this.address) ?? [];
        const isLeftShown =
            Boolean(this.leftInBox) && agent.status !== 'working';
        // A row's height holds only at the width and look it was measured at.
        /** @type {string} */
        const fit = `${Math.round(this.viewW ?? 0)}|${look.size}|${look.space}|${look.width}|${look.tools}|${look.replies}|${look.mine}|${look.font}|${look.system}`;
        if (fit !== this.rowFit) {
            this.rowFit = fit;
            this.rowH = new Map();
            this.measuredAt = new Map();
            this.flips = new Map();
            this.measureGen++;
        }
        const { pad } = this.rowSpace();
        this.bubbleW = Math.max(
            240,
            Math.floor(((this.viewW ?? 0) - 2 * pad - FORK_W) * 0.8),
        );
        this.hits = { current, found };
        const rows = this.rowsOf(listed, sub);
        // Built once each: they're shown only when there is one.
        const chips = this.subChips(t);
        const status = this.status(t, agent);
        const images = this.imageCount(agent.address);
        const menu = this.menu(t);
        this.settlePick();

        // Ctrl+F from anywhere in the chat (the box, the search box) opens the search, or goes back to it.
        return root
            .id('chat-root')
            .track_focus(this.rootKeys)
            .on_key_down((e, cx) => {
                if (
                    e.keystroke === 'escape' &&
                    agent.status === 'working' &&
                    !this.stuck &&
                    !menu
                ) {
                    cx.stop_propagation();
                    this.stop(cx);
                    return;
                }
                if (!['ctrl-f', 'cmd-f'].includes(e.keystroke)) return;
                cx.stop_propagation();
                this.openFind(cx);
            })
            .child(
                h_flex()
                    .h(34)
                    .flex_none()
                    .text_size(13)
                    .px(12)
                    .gap(8)
                    .items_center()
                    .border_b(1)
                    .border_color(t.border)
                    .bg(t.chrome)
                    .child(
                        div()
                            .size(8)
                            .flex_none()
                            .rounded(4)
                            .bg(t[agent.status] ?? t.dim),
                    )
                    .child(
                        div()
                            .flex_1()
                            .min_w(0)
                            .truncate()
                            .font_semibold()
                            .text_color(t.foreground)
                            .child(agent.title || 'Claude'),
                    )
                    .child(
                        div()
                            .flex_none()
                            .text_size(11)
                            .text_color(t.dim)
                            .child(`${agent.space_name} · ${agent.address}`),
                    )
                    .when(Boolean(this.forkNote), (el) =>
                        el.child(
                            div()
                                .flex_none()
                                .text_size(11)
                                .text_color(t.accent)
                                .child(this.forkNote),
                        ),
                    )
                    .child(
                        div()
                            .id('chat-find')
                            .flex_none()
                            .p(4)
                            .rounded(6)
                            .cursor_pointer()
                            .text_color(this.findOpen ? t.foreground : t.dim)
                            .when(this.findOpen, (el) => el.bg(t.selected))
                            .hover((s) =>
                                s.bg(t.hover).text_color(t.foreground),
                            )
                            .tooltip('Search this chat (Ctrl+F)')
                            .on_click((_e, cx) =>
                                this.findOpen
                                    ? this.closeFind(cx)
                                    : this.openFind(cx),
                            )
                            .child(
                                svg('mods/workspace-chrome/search.svg').size(
                                    14,
                                ),
                            ),
                    )
                    .when(Boolean(this.session?.sessionId) && !sub, (el) =>
                        el.child(
                            div()
                                .id('chat-fork')
                                .flex_none()
                                .p(4)
                                .rounded(6)
                                .text_color(t.dim)
                                .cursor_pointer()
                                .hover((s) =>
                                    s.bg(t.hover).text_color(t.foreground),
                                )
                                .tooltip(
                                    'Fork: a copy of this conversation in a new tab',
                                )
                                .on_click((_e, cx) =>
                                    cx.spawn(async (cx) => {
                                        await this.fork(agent, undefined, cx);
                                    }),
                                )
                                .child(
                                    svg(
                                        'mods/workspace-chrome/git-branch.svg',
                                    ).size(14),
                                ),
                        ),
                    )
                    .child(
                        div()
                            .id('chat-settings')
                            .flex_none()
                            .p(4)
                            .rounded(6)
                            .text_color(t.dim)
                            .cursor_pointer()
                            .hover((s) =>
                                s.bg(t.hover).text_color(t.foreground),
                            )
                            .tooltip('Chat settings')
                            .on_click(() =>
                                openOverlay({
                                    height: 556,
                                    kind: 'popup',
                                    mod: 'x-herdr-chatter',
                                    props: { settings: true },
                                    width: 360,
                                }),
                            )
                            .child(
                                svg('mods/workspace-chrome/settings.svg').size(
                                    14,
                                ),
                            ),
                    )
                    .child(
                        props()?.stack
                            ? viewSwitch(t, 'chat', () =>
                                  this.toTerminal(agent.address),
                              )
                            : button(t, px, 'terminal', 'Terminal', () =>
                                  this.toTerminal(agent.address),
                              ),
                    ),
            )
            .when(Boolean(sub), (el) => el.child(this.subBar(t, sub)))
            .when(this.findOpen, (el) => el.child(this.findBar(t)))
            .child(font(this.log(t, agent, rows, sub)))
            .child(
                font(v_flex())
                    .flex_none()
                    .p(10)
                    .gap(8)
                    .border_t(1)
                    .border_color(t.border)
                    .bg(t.chrome)
                    .relative()
                    // over the log's bottom edge, so the transcript never moves when it comes or goes
                    .when(queued.length > 0 && !isLeftShown, (el) =>
                        el.child(
                            h_flex()
                                .absolute()
                                .left(10)
                                .right(10)
                                .top(-34)
                                .h(28)
                                .px(10)
                                .gap(8)
                                .items_center()
                                .rounded(8)
                                .bg(t.raised)
                                .border(1)
                                .border_color(t.border)
                                .text_size(px(12))
                                .text_color(t.muted)
                                .child(
                                    div()
                                        .flex_none()
                                        .child('Queued, joins this turn:'),
                                )
                                .child(
                                    div()
                                        .flex_1()
                                        .min_w(0)
                                        .truncate()
                                        .text_color(t.foreground)
                                        .child(
                                            queued[0].text.replace(/\s+/g, ' '),
                                        ),
                                )
                                .when(queued.length > 1, (el) =>
                                    el.child(
                                        div()
                                            .flex_none()
                                            .child(
                                                `+${queued.length - 1} more`,
                                            ),
                                    ),
                                ),
                        ),
                    )
                    .when(isLeftShown, (el) =>
                        el.child(
                            h_flex()
                                .absolute()
                                .left(10)
                                .right(10)
                                .top(-34)
                                .h(28)
                                .px(10)
                                .gap(8)
                                .items_center()
                                .rounded(8)
                                .bg(t.raised)
                                .border(1)
                                .border_color(t.border)
                                .text_size(px(12))
                                .text_color(t.muted)
                                .child(
                                    div()
                                        .flex_none()
                                        .child("Still in Claude's box:"),
                                )
                                .child(
                                    div()
                                        .flex_1()
                                        .min_w(0)
                                        .truncate()
                                        .text_color(t.foreground)
                                        .child(this.leftInBox),
                                )
                                .when(
                                    !/\[Image #\d+\]/.test(this.leftInBox),
                                    (el) =>
                                        el.child(
                                            button(
                                                t,
                                                px,
                                                'left-take',
                                                'Take it',
                                                (_e, cx) => this.takeLeft(cx),
                                            ),
                                        ),
                                )
                                .child(
                                    button(
                                        t,
                                        px,
                                        'left-send',
                                        'Send as is',
                                        (_e, cx) => this.sendLeft(cx),
                                    ),
                                ),
                        ),
                    )
                    .when(Boolean(chips), (el) => el.child(chips))
                    .when(Boolean(status), (el) => el.child(status))
                    .when(Boolean(this.pasteNote), (el) =>
                        el.child(
                            div()
                                .px(4)
                                .text_size(px(TEXT.sm))
                                .text_color(t.muted)
                                .child(this.pasteNote),
                        ),
                    )
                    .when(Boolean(this.pickNote), (el) =>
                        el.child(
                            div()
                                .px(4)
                                .text_size(px(TEXT.sm))
                                .text_color(t.accent)
                                .child(this.pickNote),
                        ),
                    )
                    .when(images > 0, (el) =>
                        el.child(
                            h_flex()
                                .gap(8)
                                .items_center()
                                .px(4)
                                .text_size(px(TEXT.sm))
                                .text_color(t.muted)
                                .child(
                                    div()
                                        .px(8)
                                        .py(2)
                                        .rounded(RADIUS.control)
                                        .bg(t.raised)
                                        .text_color(t.foreground)
                                        .child(
                                            images === 1
                                                ? '🖼 1 image'
                                                : `🖼 ${images} images`,
                                        ),
                                )
                                .child(
                                    div()
                                        .flex_1()
                                        .min_w(0)
                                        .truncate()
                                        .child(
                                            this.where?.container
                                                ? 'copied into the container, sent with your message'
                                                : "in Claude's prompt, sent with your message",
                                        ),
                                )
                                .when(
                                    Boolean(this.where?.container) ||
                                        agent.status !== 'working',
                                    (el) =>
                                        el.child(
                                            button(
                                                t,
                                                px,
                                                'drop-images',
                                                'Remove',
                                                (_e, cx) => this.dropImages(cx),
                                            ),
                                        ),
                                ),
                        ),
                    )
                    .when(Boolean(menu), (el) => el.child(menu))
                    .child(this.band(t))
                    // While the menu is open, ↑ ↓ Tab Esc are its keys (bound in init); ← → Home End close
                    // it (the caret would leave the word with no change event), and the next press moves.
                    .child(
                        h_flex()
                            .id('composer')
                            .track_focus(this.keyboard)
                            .when(Boolean(menu), (el) =>
                                el.key_context('ChatSlash'),
                            )
                            .when(
                                !menu &&
                                    agent.status === 'working' &&
                                    !this.stuck,
                                (el) => el.key_context('ChatStop'),
                            )
                            .on_action('x_herdr_chatter_stop', (_e, cx) =>
                                this.stop(cx),
                            )
                            .on_action('x_herdr_chatter_menu_down', (_e, cx) =>
                                this.menuKey('down', cx),
                            )
                            .on_action('x_herdr_chatter_menu_up', (_e, cx) =>
                                this.menuKey('up', cx),
                            )
                            .on_action('x_herdr_chatter_menu_fill', (_e, cx) =>
                                this.menuKey('fill', cx),
                            )
                            .on_action('x_herdr_chatter_menu_close', (_e, cx) =>
                                this.menuKey('close', cx),
                            )
                            .on_action('x_herdr_chatter_menu_leave', (_e, cx) =>
                                this.menuKey('leave', cx),
                            )
                            .items_end()
                            // a stacked card (dima, 14:33 and 15:02 shots): the rounder text card in front casts a
                            // soft shadow onto a narrower card tucked under it, which holds the pickers and send.
                            // column-reverse paints the front card last, so its shadow lands on the back one
                            .child(
                                v_flex()
                                    .flex_1()
                                    .min_w(0)
                                    .flex_col_reverse()
                                    .child(
                                        h_flex()
                                            .mx(14)
                                            .pt(16)
                                            .pb(6)
                                            .px(8)
                                            .items_center()
                                            .rounded_b(RADIUS.bubble)
                                            .border_l(1)
                                            .border_r(1)
                                            .border_b(1)
                                            .border_color(t.border)
                                            .bg(t.raised)
                                            .gap(6)
                                            .child(
                                                this.dropdown(
                                                    t,
                                                    agent,
                                                    'model',
                                                ),
                                            )
                                            .child(
                                                this.dropdown(
                                                    t,
                                                    agent,
                                                    'effort',
                                                ),
                                            ),
                                    )
                                    .child(
                                        div()
                                            .w_full()
                                            .mb(-10)
                                            .px(14)
                                            .py(12)
                                            .rounded(16)
                                            .bg(t.background)
                                            .border(1)
                                            .border_color(t.border)
                                            .shadow_md()
                                            .relative()
                                            // send sits in the text card's bottom-right corner; the text takes the
                                            // full width and keeps clear of it by one button-high bottom padding
                                            // (Textarea has no per-line inset to wrap around it)
                                            .pb(40)
                                            .child(
                                                Textarea.new(this.box).token(
                                                    (tok) =>
                                                        div()
                                                            .px(4)
                                                            .rounded(4)
                                                            .bg(t.raised)
                                                            .font_family(
                                                                this.mono(),
                                                            )
                                                            .text_color(
                                                                t.foreground,
                                                            )
                                                            .child(
                                                                tok.token
                                                                    .label ??
                                                                    tok.token
                                                                        .text,
                                                            ),
                                                ),
                                            )
                                            .child(
                                                div()
                                                    .id('send')
                                                    .absolute()
                                                    .right(8)
                                                    .bottom(8)
                                                    .size(28)
                                                    .flex()
                                                    .items_center()
                                                    .justify_center()
                                                    .rounded_full()
                                                    .bg(
                                                        this.typed?.trim()
                                                            ? t.accent
                                                            : t.raised,
                                                    )
                                                    .text_color(
                                                        this.typed?.trim()
                                                            ? t.background
                                                            : t.dim,
                                                    )
                                                    .text_size(px(TEXT.lg))
                                                    .font_weight(700)
                                                    // a surface shift, never opacity: an opacity hover keeps the view's spinners rebuilding it
                                                    .when(
                                                        Boolean(
                                                            this.typed?.trim(),
                                                        ),
                                                        (el) =>
                                                            el
                                                                .cursor_pointer()
                                                                .hover((s) =>
                                                                    s
                                                                        .bg(
                                                                            t.solid,
                                                                        )
                                                                        .text_color(
                                                                            t.solid_foreground,
                                                                        ),
                                                                ),
                                                    )
                                                    .tooltip('Send (Enter)')
                                                    .on_click((_e, cx) =>
                                                        this.send(cx),
                                                    )
                                                    .child(
                                                        this.sendingTo ===
                                                            this.address
                                                            ? svg(
                                                                  'mods/workspace-chrome/spinner.svg',
                                                              )
                                                                  .size(px(14))
                                                                  .text_color(
                                                                      t.dim,
                                                                  )
                                                                  .spin(900)
                                                            : '↑',
                                                    ),
                                            ),
                                    ),
                            ),
                    ),
            );
    }
}
