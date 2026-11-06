// Collect Bash gate calls from the last 7 days of transcripts into calls.json.
// usage: node collect.mjs
import { execSync } from 'node:child_process';
import { createReadStream, writeFileSync } from 'node:fs';
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

const out = join(process.env.GATE_SPEED_DIR, 'calls.json');
const sessions = [];
const calls = [];

const textOf = (c) =>
    typeof c === 'string'
        ? c
        : Array.isArray(c)
          ? c.map((x) => x.text ?? '').join('')
          : '';

for (const f of files) {
    const dir = basename(dirname(f));
    const session = basename(f, '.jsonl');
    const uses = new Map(); // tool_use id -> call
    const byTask = new Map(); // bg task id -> call
    const stamps = [];
    const rl = createInterface({
        crlfDelay: Infinity,
        input: createReadStream(f),
    });
    for await (const line of rl) {
        if (!line) continue;
        let o;
        try {
            o = JSON.parse(line);
        } catch {
            continue;
        }
        if (o.type !== 'user' && o.type !== 'assistant') continue;
        const t = Date.parse(o.timestamp);
        if (!Number.isFinite(t)) continue;
        stamps.push(t);
        const c = o.message?.content;
        if (typeof c === 'string') {
            if (c.includes('<task-notification>')) notify(c, t);
            continue;
        }
        if (!Array.isArray(c)) continue;
        for (const b of c) {
            if (
                b.type === 'tool_use' &&
                b.name === 'Bash' &&
                b.input?.command
            ) {
                const call = {
                    bg: !!b.input.run_in_background,
                    cmd: b.input.command,
                    cwd: o.cwd,
                    dir,
                    end: null,
                    id: b.id,
                    kind: null,
                    session,
                    t0: t,
                    wait: null,
                };
                uses.set(b.id, call);
                calls.push(call);
            } else if (b.type === 'tool_result') {
                const call = uses.get(b.tool_use_id);
                if (!call) continue;
                const txt = textOf(b.content);
                const m = txt.match(
                    /Command running in background with ID: (\w+)/,
                );
                if (m) {
                    call.bg = true;
                    call.taskId = m[1];
                    byTask.set(m[1], call);
                    call.ack = t;
                } else {
                    call.end = t;
                    call.kind = 'fg';
                }
                const w = txt.match(/gate-queue: took the turn after (\d+)s/);
                if (w) call.wait = Number(w[1]);
                if (/gate-queue:/.test(txt)) call.queueText = true;
            } else if (
                b.type === 'text' &&
                b.text?.includes('<task-notification>')
            )
                notify(b.text, t);
        }
    }
    function notify(s, t) {
        for (const blk of s.split('<task-notification>').slice(1)) {
            const tid = blk.match(/<task-id>(\w+)<\/task-id>/)?.[1];
            const uid = blk.match(/<tool-use-id>([\w-]+)<\/tool-use-id>/)?.[1];
            const call = (uid && uses.get(uid)) || (tid && byTask.get(tid));
            if (call?.bg && call.end == null) {
                call.end = t;
                call.kind = 'bg';
            }
        }
    }
    stamps.sort((a, b) => a - b);
    sessions.push({
        dir,
        gaps: stamps
            .slice(1)
            .map((s, i) => s - stamps[i])
            .filter((g) => g > 1800000),
        session,
        stamps: [stamps[0], stamps.at(-1)],
    });
}
writeFileSync(out, JSON.stringify({ calls, sessions }));
console.log(files.length, 'files', calls.length, 'bash calls');
