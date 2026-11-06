// Collect commit / mods-edit / red-proof Bash calls (with result text) from the last 7 days into slow-data.json.
// Pairing follows collect.mjs; adds result text, background output file, queue-operation enqueue time, tool_use timeline, first user message.
import { execSync } from 'node:child_process';
import {
    createReadStream,
    existsSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { createInterface } from 'node:readline';

const root = join(homedir(), '.claude/projects');
const files = execSync(
    `find ${root} -mindepth 2 -maxdepth 2 -name '*.jsonl' -mtime -7`,
    { maxBuffer: 1 << 26 },
)
    .toString()
    .trim()
    .split('\n');
const out = join(process.env.GATE_SPEED_DIR, 'slow-data.json');
const cutoff = Date.now() - 7 * 86400000;

const textOf = (c) =>
    typeof c === 'string'
        ? c
        : Array.isArray(c)
          ? c.map((x) => x.text ?? '').join('')
          : '';
const cap = (s) =>
    s.length > 20000 ? `${s.slice(0, 4000)}\n…CUT…\n${s.slice(-16000)}` : s;
const strip = (cmd) =>
    cmd.replace(
        /(<<-?\s*['"]?(\w+)['"]?[^\n]*)\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g,
        '$1',
    );
const segs = (cmd) =>
    strip(cmd)
        .split(/&&|\|\||;|\n|\|/)
        .map((s) =>
            s
                .trim()
                .replace(/^(\w+=\S*\s+)+/, '')
                .replace(/^(time|exec|\()\s*/, '')
                .replace(/^\{\s*/, '')
                .replace(/^timeout \d+\s+/, ''),
        );
const CLS = {
    commit: (s) =>
        /^(x lane commit|git (-C \S+ )?commit)\b/.test(s) &&
        !/--dry|--help/.test(s),
    'mods-edit': (s) => /^x mods edit\b/.test(s),
    'red-proof': (s) => /^(red-proof|x red-proof)\b/.test(s),
};
const classOf = (cmd) => {
    const ss = segs(cmd);
    for (const k of ['commit', 'red-proof', 'mods-edit'])
        if (ss.some(CLS[k])) return k;
    return null;
};

const sessions = [];
for (const f of files) {
    const dir = basename(dirname(f));
    const session = basename(f, '.jsonl');
    const uses = new Map();
    const byTask = new Map();
    const stamps = [];
    const toolTimes = [];
    const calls = [];
    const readers = new Map();
    let cwd = null;
    let firstUser = null;
    const rl = createInterface({
        crlfDelay: Infinity,
        input: createReadStream(f),
    });
    const notify = (s, t, enqT) => {
        for (const blk of s.split('<task-notification>').slice(1)) {
            const tid = blk.match(/<task-id>(\w+)<\/task-id>/)?.[1];
            const uid = blk.match(/<tool-use-id>([\w-]+)<\/tool-use-id>/)?.[1];
            const call = (uid && uses.get(uid)) || (tid && byTask.get(tid));
            if (call?.bg && call.notified == null) {
                call.notified = enqT ?? t;
                call.summary =
                    blk.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? null;
                call.status = blk.match(/<status>(\w+)<\/status>/)?.[1] ?? null;
            }
        }
    };
    for await (const line of rl) {
        if (!line) continue;
        let o;
        try {
            o = JSON.parse(line);
        } catch {
            continue;
        }
        if (
            o.type === 'queue-operation' &&
            o.operation === 'enqueue' &&
            typeof o.content === 'string' &&
            o.content.includes('<task-notification>')
        ) {
            notify(o.content, Date.parse(o.timestamp), Date.parse(o.timestamp));
            continue;
        }
        if (o.type !== 'user' && o.type !== 'assistant') continue;
        if (o.isSidechain) continue;
        const t = Date.parse(o.timestamp);
        if (!Number.isFinite(t)) continue;
        stamps.push(t);
        cwd ??= o.cwd;
        const c = o.message?.content;
        if (typeof c === 'string') {
            if (c.includes('<task-notification>')) notify(c, t);
            else if (
                o.type === 'user' &&
                firstUser == null &&
                !o.isMeta &&
                !c.startsWith('<')
            )
                firstUser = c;
            continue;
        }
        if (!Array.isArray(c)) continue;
        for (const b of c) {
            if (b.type === 'tool_use') {
                toolTimes.push(t);
                if (b.input && byTask.size && !uses.has(b.id)) {
                    const j = JSON.stringify(b.input);
                    for (const [tid, bc] of byTask)
                        if (j.includes(tid)) {
                            readers.set(b.id, bc);
                            break;
                        }
                }
                if (b.name === 'Bash' && b.input?.command && !uses.has(b.id)) {
                    const k = classOf(b.input.command);
                    const call = {
                        bg: !!b.input.run_in_background,
                        cls: k,
                        cmd: b.input.command,
                        cwd: o.cwd,
                        end: null,
                        id: b.id,
                        kind: null,
                        t0: t,
                    };
                    uses.set(b.id, call);
                    if (k) calls.push(call);
                }
            } else if (b.type === 'tool_result') {
                const rd = readers.get(b.tool_use_id);
                if (rd) {
                    rd.reads ??= [];
                    rd.reads.push({ t, text: cap(textOf(b.content)) });
                }
                const call = uses.get(b.tool_use_id);
                if (!call || call.end != null || call.ack != null) continue;
                const txt = textOf(b.content);
                const m = txt.match(
                    /(?:Command running in background with ID: |Command was moved to the background \(ID: )(\w+)\)?[\s\S]*?Output is being written to: (\S+?)\.? /,
                );
                if (m) {
                    call.bg = true;
                    call.taskId = m[1];
                    call.outFile = m[2];
                    byTask.set(m[1], call);
                    call.ack = t;
                    call.moved = txt.startsWith('Command was moved');
                    call.ackText = txt.slice(0, 300);
                } else {
                    call.end = t;
                    call.kind = 'fg';
                    call.text = cap(txt);
                    call.isError = !!b.is_error;
                }
            } else if (b.type === 'text') {
                if (b.text?.includes('<task-notification>')) notify(b.text, t);
                else if (
                    o.type === 'user' &&
                    firstUser == null &&
                    !o.isMeta &&
                    !b.text.startsWith('<')
                )
                    firstUser = b.text;
            }
        }
    }
    const keep = calls.filter((c) => c.t0 >= cutoff);
    for (const c of keep) {
        if (c.bg) {
            if (c.notified != null) {
                c.end = c.notified;
                c.kind = 'bg';
            }
            const r = (c.reads ?? []).find(
                (x) => x.t >= (c.end ?? Infinity) - 1000,
            );
            if (r) {
                c.readBack = r.text;
                c.readT = r.t;
            }
            c.interimReads = (c.reads ?? []).filter((x) => x !== r).length;
            delete c.reads;
            if (c.outFile && existsSync(c.outFile)) {
                try {
                    c.text = cap(readFileSync(c.outFile, 'utf8'));
                } catch {}
            }
        }
    }
    stamps.sort((a, b) => a - b);
    if (keep.some((c) => c.cls === 'commit')) {
        sessions.push({
            allStamps: stamps,
            calls: keep,
            cwd,
            dir,
            firstUser: (firstUser ?? '').replace(/\s+/g, ' ').slice(0, 200),
            session,
            stamps: [stamps[0], stamps.at(-1)],
            toolTimes,
        });
    }
}
writeFileSync(out, JSON.stringify(sessions));
console.log(
    files.length,
    'files',
    sessions.length,
    'sessions with commits',
    sessions.reduce(
        (n, s) => n + s.calls.filter((c) => c.cls === 'commit').length,
        0,
    ),
    'commit calls',
);
