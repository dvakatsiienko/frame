import { readFileSync } from 'node:fs';

const rows = readFileSync(
    `${process.env.HOME}/.local/state/x/gate-queue.log`,
    'utf8',
)
    .trim()
    .split('\n')
    .map((line) => line.split('\t'))
    .filter((row) => row.length >= 7)
    // rows from before the session column hold 7 fields
    .map(([start, load, slot, wait, run, exit, ...rest]) => ({
        cmd: rest.at(-1),
        exit,
        hour: start.slice(11, 13),
        load: Number(load),
        run: run === '-' ? null : Number(run),
        session: rest.length > 1 ? rest[0] : '-',
        slot,
        start,
        wait: Number(wait),
    }));
const pct = (xs, p) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : '-';
};
const line = (name, set) => {
    const w = set.map((r) => r.wait);
    const u = set.filter((r) => r.run != null).map((r) => r.run);
    console.log(
        `${name}: n=${set.length} wait p50 ${pct(w, 0.5)} p90 ${pct(w, 0.9)} max ${Math.max(0, ...w)}, sum ${Math.round(w.reduce((a, b) => a + b, 0) / 60)} min; run p50 ${pct(u, 0.5)} p90 ${pct(u, 0.9)} max ${Math.max(0, ...u)}, sum ${Math.round(u.reduce((a, b) => a + b, 0) / 60)} min; exit75 ${set.filter((r) => r.exit === '75').length}`,
    );
};
console.log(
    `rows ${rows.length}, from ${rows[0].start} to ${rows.at(-1).start}`,
);
const kind = (r) =>
    /lane commit/.test(r.cmd)
        ? 'commit'
        : /lane push/.test(r.cmd)
          ? 'push'
          : /mods edit|mods:test/.test(r.cmd)
            ? 'mods'
            : /mut|red-proof|round/i.test(r.cmd)
              ? 'round'
              : /land|\.sh/.test(r.cmd)
                ? 'script'
                : 'other';
for (const slot of ['gate', 'long'])
    line(
        `slot ${slot}`,
        rows.filter((r) => r.slot === slot),
    );
// a tree older than the gate turn's pr runs its own x, which takes no turn under main's script
line(
    "slot none, an older tree's lane commit or push",
    rows.filter((r) => r.slot === 'none' && /lane (commit|push)/.test(r.cmd)),
);
for (const k of ['commit', 'push', 'mods', 'round', 'script', 'other'])
    line(
        `gate slot, ${k}`,
        rows.filter((r) => r.slot === 'gate' && kind(r) === k),
    );
for (const h of [...new Set(rows.map((r) => r.hour))])
    line(
        `hour ${h}`,
        rows.filter((r) => r.slot === 'gate' && r.hour === h),
    );
console.log("-- the gate slot's 12 longest holds");
rows.filter((r) => r.slot === 'gate' && r.run != null)
    .sort((a, b) => b.run - a.run)
    .slice(0, 12)
    .forEach((r) => {
        console.log(
            `${r.start.slice(11, 16)} run ${r.run} wait ${r.wait} load ${r.load} exit ${r.exit} ${r.cmd.replace(/\/private\/tmp\/claude-501\/|\/Users\/dima\/\.claude\/jobs\//g, '').slice(0, 70)}`,
        );
    });
const gate = rows.filter((r) => r.slot === 'gate' && r.run != null);
const total = gate.reduce((a, r) => a + r.run, 0);
const long = gate.filter((r) => r.run > 300).reduce((a, r) => a + r.run, 0);
const small = gate.filter((r) => r.run <= 60);
console.log(
    `gate slot busy ${Math.round(total / 60)} min; holds over 300 s are ${Math.round(long / 60)} min, ${Math.round((100 * long) / total)} %; holds under 60 s: n=${small.length} of ${gate.length}`,
);
console.log(
    `gate slot idle share since first row: ${Math.round(100 - (100 * total) / ((Date.parse(rows.at(-1).start.replace(/([+-]\d\d)(\d\d)$/, '$1:$2')) - Date.parse(rows[0].start.replace(/([+-]\d\d)(\d\d)$/, '$1:$2'))) / 1000))} %`,
);
