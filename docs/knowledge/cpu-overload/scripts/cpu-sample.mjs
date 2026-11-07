// one row per tick: load, top's user/sys/idle, %cpu per process family
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const [out, seconds, tick] = [
    process.argv[2],
    Number(process.argv[3]),
    Number(process.argv[4]),
];
const families = [
    ['plugin-test', /plugin test/],
    ['fseventsd', /fseventsd/],
    ['syspolicyd', /syspolicyd/],
    [
        'os-daemons',
        /opendirectoryd|cfprefsd|notifyd|\/sbin\/launchd|logd|distnoted/,
    ],
    ['chrome', /Google Chrome/],
    ['index-run', /index-run/],
    ['go-test-binary', /\.test( |$)|\/x\.test|go-build.*\.test/],
    [
        'go-toolchain',
        /\/go\/pkg\/tool\/|\bgo (test|build|vet|run)\b|\/compile |\/link |\bvet\b|gopls|staticcheck/,
    ],
    ['x-binary', /\/x\/bin\/x|\/bin\/x |x-commit/],
    ['vitest', /vitest/],
    ['tsc', /\btsc\b|tsgo|typescript/],
    ['biome', /biome/],
    ['mods-test', /mods\/test\.ts|mods:test/],
    ['lefthook', /lefthook/],
    ['git', /(^|\/)git( |$)|git-remote|git-crypt/],
    ['claude-cli', /claude(-code)?( |$)|\/claude\/versions|cli\.js/],
    ['claude-desktop', /Claude\.app|Claude Helper/],
    ['node-other', /(^|\/)node( |$)/],
    ['shell', /(^|\/)(bash|sh|zsh)( |$)/],
    ['kernel_task', /kernel_task/],
    ['WindowServer', /WindowServer/],
    ['spotlight', /mds|mdworker|mdbulkimport/],
    [
        'defender-ish',
        /syspolicyd|trustd|XprotectService|amfid|endpointsecurity/,
    ],
];
const classify = (a) => families.find(([, r]) => r.test(a))?.[0] ?? 'other';

const end = Date.now() + seconds * 1000;
while (Date.now() < end) {
    const ps = execFileSync('ps', ['-Ao', 'pcpu=,args='], {
        encoding: 'utf8',
        maxBuffer: 1 << 26,
    });
    const by = {};
    const count = {};
    for (const line of ps.split('\n')) {
        const m = line.match(/^\s*([\d.]+)\s+(.*)$/);
        if (!m) continue;
        const f = classify(m[2]);
        by[f] = (by[f] ?? 0) + Number(m[1]);
        count[f] = (count[f] ?? 0) + 1;
    }
    const top = execFileSync('top', ['-l', '1', '-n', '0', '-s', '0'], {
        encoding: 'utf8',
    });
    const u = top.match(
        /CPU usage: ([\d.]+)% user, ([\d.]+)% sys, ([\d.]+)% idle/,
    );
    const load = execFileSync('sysctl', ['-n', 'vm.loadavg'], {
        encoding: 'utf8',
    })
        .trim()
        .split(/\s+/)[1];
    const procs = top.match(/Processes: (\d+) total/)?.[1];
    const row = {
        by,
        count,
        idle: Number(u?.[3]),
        load: Number(load),
        procs: Number(procs),
        sys: Number(u?.[2]),
        t: new Date().toISOString(),
        user: Number(u?.[1]),
    };
    appendFileSync(out, `${JSON.stringify(row)}\n`);
    await new Promise((r) => setTimeout(r, tick * 1000));
}
