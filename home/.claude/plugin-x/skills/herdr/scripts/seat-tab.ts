import { spawnSync } from 'node:child_process';

// a `hc run --no-parent` seat starts paneless, and herdr's agents list skips it until it has a tab. the window learns
// of a new terminal ~0.2 s after hc run returns, and the tab keep makes stays unknown to a rename for a moment more
// (probe 2026-11-10: keep ok on its 2nd try, a rename right after it «no tab»), so both steps retry for up to 4 s
export function keepSeatInTab(terminal: string, name: string) {
    const tab = retry(['terminal.keep', { place: 'tab', terminal }])?.tab;
    if (tab) retry(['tab.rename', { id: tab, name }]);
    return tab ?? null;
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
