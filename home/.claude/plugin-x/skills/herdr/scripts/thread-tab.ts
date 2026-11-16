import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// a `hc run --no-parent` thread starts paneless, and herdr's agents list skips it until it has a tab. the window learns
// of a new terminal ~0.2 s after hc run returns, and the tab keep makes stays unknown to a rename for a moment more
// (probe 2026-11-10: keep ok on its 2nd try, a rename right after it «no tab»), so both steps retry for up to 4 s
// the keep selects the new tab; dima's focus goes back to the tab he was on
export function keepThreadInTab(terminal: string, name: string) {
    const was = focusedTab();
    const tab = retry(['terminal.keep', { place: 'tab', terminal }])?.tab;
    if (tab) retry(['tab.rename', { id: tab, name }]);
    if (tab && was && was !== tab) retry(['tab.select', { id: was }]);
    return tab ?? null;
}

export function parseThreadTabArgs(argv: string[]) {
    const [terminal, name, ...rest] = argv;
    if (!terminal || !name || rest.length > 0) return null;
    return { name, terminal };
}

function focusedTab(): string | null {
    const done = spawnSync('herdr-app', ['status'], { encoding: 'utf8' });
    return done.status === 0 ? (JSON.parse(done.stdout).tab ?? null) : null;
}

function retry([command, args]: [string, Record<string, string>]) {
    for (let tries = 20; tries > 0; tries--) {
        const done = spawnSync(
            'herdr-app',
            ['do', command, JSON.stringify(args)],
            { encoding: 'utf8' },
        );
        if (done.status === 0) return JSON.parse(done.stdout);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
    }
    return null;
}

if (
    process.argv[1] &&
    pathToFileURL(process.argv[1]).href === import.meta.url
) {
    const args = parseThreadTabArgs(process.argv.slice(2));
    if (!args) {
        console.error("usage: node thread-tab.ts <terminal> '<name>'");
        process.exit(2);
    }
    const tab = keepThreadInTab(args.terminal, args.name);
    if (!tab) {
        console.error(`no tab came back for terminal ${args.terminal}`);
        process.exit(1);
    }
    console.log(tab);
}
