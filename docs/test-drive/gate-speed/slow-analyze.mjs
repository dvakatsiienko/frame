// Analyse slow-data.json (from slow-collect.mjs). usage: node slow-analyze.mjs [explore]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.GATE_SPEED_DIR;
const S = JSON.parse(readFileSync(join(dir, 'slow-data.json'), 'utf8'));
const QUEUE_BIRTH = new Date('2026-11-06T18:16:00').getTime();
const GAP = 30 * 60000;

const strip = (cmd) =>
    cmd.replace(
        /(<<-?\s*['"]?(\w+)['"]?[^\n]*)\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g,
        '$1',
    );
const isCommit = (s) =>
    /^(x lane commit|git (-C \S+ )?commit)\b/.test(s) &&
    !/--dry|--help/.test(s);

function vars(cmd) {
    const v = {};
    for (const m of strip(cmd).matchAll(
        /(?:^|[\s;&(])(?:export\s+)?([A-Za-z_]\w*)=("[^"]*"|'[^']*'|[^\s;&|)]+)/g,
    ))
        v[m[1]] = m[2].replace(/^["']|["']$/g, '');
    return v;
}
function expand(s, v) {
    for (let i = 0; i < 4; i++)
        s = s.replace(/\$\{(\w+)\}|\$(\w+)/g, (m, a, b) => v[a || b] ?? m);
    return s;
}
// paths the commit names: x lane commit <msg> [--] paths; git commit: paths after "--" or git add segments in the same call
function commitPaths(cmd) {
    const v = vars(cmd);
    const out = [];
    let known = false;
    for (const raw of strip(cmd).split(/&&|\|\||;|\n/)) {
        const s = raw
            .trim()
            .replace(/^(\w+=\S*\s+)+/, '')
            .replace(/^timeout \d+\s+/, '');
        if (isCommit(s)) {
            let tok = s.split(/\s+/);
            const stop = tok.findIndex((x) =>
                /^(\||\d*>|>>|<|\d*>&\d)/.test(x),
            );
            if (stop >= 0) tok = tok.slice(0, stop);
            const ci = tok.indexOf('commit');
            tok = tok.slice(ci + 1);
            const dd = tok.indexOf('--');
            let ps;
            if (/^git/.test(s)) ps = dd >= 0 ? tok.slice(dd + 1) : [];
            else
                ps =
                    dd >= 0
                        ? tok.slice(dd + 1)
                        : tok.filter((x) => !x.startsWith('-')).slice(1);
            if (ps.length || !/^git/.test(s)) known = true;
            out.push(...ps);
        } else if (/^git (-C \S+ )?add\b/.test(s)) {
            known = true;
            out.push(
                ...s
                    .split(/\s+/)
                    .slice(2)
                    .filter((x) => !x.startsWith('-')),
            );
        }
    }
    return {
        known,
        paths: out.map((p) => expand(p.replace(/^["']|["']$/g, ''), v)),
    };
}
const isModsPath = (p) =>
    /plugin-x\/mods\//.test(p) || /(^|\/)x-mod-[\w-]+\//.test(p);

function flags(c) {
    const t = c.text ?? c.readBack ?? '';
    const gates = [
        ...t.matchAll(/(?:✔️?|✓|✔)\s*([\w:./-]+)\s+\(([\d.]+) seconds?\)/g),
    ].map((m) => [m[1], Number(m[2])]);
    return {
        gates,
        green: /already green on these bytes/.test(t),
        lock: /index\.lock/.test(t),
        queue: Number(
            t.match(/gate-queue: took the turn after (\d+)s/)?.[1] ?? NaN,
        ),
        queueText: /gate-queue:/.test(t),
        redMsg:
            t.match(/"verb":"lane commit"[^\n]*?"error":"([^"]{0,110})/)?.[1] ??
            (/commit failed/.test(t) ? 'commit failed' : null),
        shaOnly:
            /"verb":"lane commit"/.test(t) &&
            !gates.length &&
            t.length < 1200 &&
            !/gate-queue|skipped|already green/.test(t),
        skipTested: /skipped on tested bytes/.test(t),
        tmo: /timed-out files ran again|retried a timeout-only red/.test(t),
    };
}
export const hasHeavy = (cmd) => {
    const t = strip(cmd);
    const lead = String.raw`(?:^|[;&|({\n]|\bdo\b|\bthen\b)\s*(?:\w+=\S*\s+)*(?:timeout \d+\s+)?`;
    const re = new RegExp(
        lead +
            String.raw`(x mods edit (\w+)|x lane push|git (?:-C \S+ )?push|(?:x )?red-proof|pnpm (?:--silent |-C \S+ )*(?:vitest|mods:typecheck|test)|vitest|bun test|x mods (?:test|typecheck)|sleep \d+)`,
        'gm',
    );
    const h = [];
    for (const m of t.matchAll(re)) {
        const w = m[1];
        h.push(
            m[2]
                ? `mods-edit:${m[2]}`
                : /push/.test(w)
                  ? 'push'
                  : /red-proof/.test(w)
                    ? 'red-proof'
                    : /^sleep/.test(w)
                      ? 'sleep'
                      : 'test',
        );
    }
    return [...new Set(h)];
};

const pct = (a, p) => {
    if (!a.length) return NaN;
    const s = [...a].sort((x, y) => x - y);
    return s[
        Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))
    ];
};
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const sum = (a) => a.reduce((x, y) => x + y, 0);
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : 'n/a');
const loc = (t) => new Date(t).toLocaleString('sv').slice(5, 16); // MM-DD HH:MM

// enrich
const sessions = S.map((s) => {
    const st = s.allStamps;
    let active = 0;
    const stretches = []; // [start,end]
    let a = st[0];
    for (let i = 1; i < st.length; i++) {
        const g = st[i] - st[i - 1];
        if (g <= GAP) active += g;
        else {
            stretches.push([a, st[i - 1]]);
            a = st[i];
        }
    }
    stretches.push([a, st.at(-1)]);
    const calls = s.calls
        .filter(
            (c) =>
                !/^PreToolUse:\w+ hook error|^The user doesn.t want to proceed|^User rejected/.test(
                    c.text ?? '',
                ),
        )
        .map((c) => {
            const f = flags(c);
            const cp =
                c.cls === 'commit'
                    ? commitPaths(c.cmd)
                    : { known: false, paths: [] };
            const mp = cp.paths.filter(isModsPath);
            return {
                ...c,
                dir: s.dir,
                dur: (c.end - c.t0) / 1000,
                f,
                heavy: hasHeavy(c.cmd),
                mods: mp.length > 0,
                paths: cp.paths,
                pathsKnown: cp.known,
                sess: s.session.slice(0, 8),
                sessionFull: s.session,
            };
        });
    const stretchOf = (t) => stretches.findIndex(([x, y]) => t >= x && t <= y);
    for (const c of calls) c.stretch = stretchOf(c.t0);
    return { ...s, active, activeH: active / 3600000, calls, stretches };
});

const commitsOf = (s) =>
    s.calls.filter((c) => c.cls === 'commit').sort((x, y) => x.t0 - y.t0);
const big = sessions.filter((s) => commitsOf(s).length >= 20);

if (process.argv[2] === 'explore') {
    for (const s of big) {
        const cs = commitsOf(s);
        console.log(
            s.session.slice(0, 8),
            cs.length,
            'modsShare',
            f1((cs.filter((c) => c.mods).length / cs.length) * 100),
            'unknownPaths',
            cs.filter((c) => !c.pathsKnown).length,
        );
    }
    const all = big.flatMap(commitsOf);
    const kinds = {};
    for (const c of all) {
        const k = JSON.stringify([
            c.f.gates.length > 0,
            c.f.skipTested,
            c.f.green,
            c.f.queueText,
            c.f.lock,
            c.f.tmo,
            c.f.redMsg != null,
            c.f.shaOnly,
        ]);
        kinds[k] = (kinds[k] || 0) + 1;
    }
    console.log('gates,skip,green,queue,lock,tmo,red,shaOnly', kinds);
    process.exit(0);
}

export {
    GAP,
    QUEUE_BIRTH,
    big,
    commitsOf,
    f1,
    flags,
    loc,
    mean,
    pct,
    sessions,
    sum,
};
