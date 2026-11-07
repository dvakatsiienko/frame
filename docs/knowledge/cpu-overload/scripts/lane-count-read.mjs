// one row per lane count: cores used, load, kernel share, spotlight, git start, go suite wall; marks: <iso local>\t<lanes>\t<what>
import { readFileSync } from 'node:fs';

const [sampleFile, marksFile, gitFile, queueFile] = process.argv.slice(2);
const lines = (file) => readFileSync(file, 'utf8').trim().split('\n');
const pct = (values, p) =>
    values.length
        ? [...values].sort((a, b) => a - b)[Math.floor(values.length * p)]
        : Number.NaN;
const mean = (values) =>
    values.reduce((sum, v) => sum + v, 0) / (values.length || 1);
const at = (text) => new Date(text).getTime();

const samples = lines(sampleFile).map((l) => JSON.parse(l));
const marks = lines(marksFile).map((l) => {
    const [time, lanes, what] = l.split('\t');
    return { lanes, start: at(time), what };
});
const gitRows = lines(gitFile).map((l) => {
    const [time, seconds] = l.split('\t');
    return { ms: Number(seconds) * 20, t: at(time) };
});
const goRows = lines(queueFile)
    .map((l) => l.split('\t'))
    .filter((r) => /go(\s+-C \S+)?\s+test|x-go:gate/.test(r.at(-1) ?? ''))
    // a chain's run time holds its other commands too
    .filter((r) => !/pnpm (typecheck|test)/.test(r.at(-1) ?? ''))
    .filter((r) => /^\d+$/.test(r[4]))
    .map((r) => ({ run: Number(r[4]), t: at(r[0]), wait: Number(r[3]) }));

const round = (v, digits = 0) => v.toFixed(digits);
for (const [index, mark] of marks.entries()) {
    const end = marks[index + 1]?.start ?? Date.now();
    const inWindow = (t) => t >= mark.start && t < end;
    const rows = samples.filter((r) => inWindow(at(r.t)));
    if (!rows.length) continue;
    const busy = rows.map((r) => r.user + r.sys);
    const git = gitRows.filter((r) => inWindow(r.t)).map((r) => r.ms);
    const go = goRows.filter((r) => inWindow(r.t));
    console.log(
        [
            `${mark.lanes} lanes, ${mark.what}, ${round((end - mark.start) / 60000)} min, n=${rows.length}`,
            `cores ${round((mean(busy) * 14) / 100, 1)}`,
            `load p50 ${round(
                pct(
                    rows.map((r) => r.load),
                    0.5,
                ),
            )} p90 ${round(
                pct(
                    rows.map((r) => r.load),
                    0.9,
                ),
            )}`,
            `kernel ${round((100 * mean(rows.map((r) => r.sys))) / mean(busy))} %`,
            `at 95 %+ ${round((100 * busy.filter((b) => b >= 95).length) / rows.length)} % of samples`,
            `spotlight ${round(mean(rows.map((r) => r.by?.spotlight ?? 0)) / 100, 1)} cores`,
            `git start ${round(pct(git, 0.5), 1)} ms (n=${git.length})`,
            `go suite ${
                go.length
                    ? `run p50 ${pct(
                          go.map((r) => r.run),
                          0.5,
                      )} s, wait p50 ${pct(
                          go.map((r) => r.wait),
                          0.5,
                      )} s (n=${go.length})`
                    : 'none'
            }`,
        ].join('; '),
    );
}
