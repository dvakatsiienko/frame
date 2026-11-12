// Claude Code status line command (run with node, not loaded by Herdr): saves the plan usage from
// the payload Claude Code passes on stdin (`rate_limits`: the 5-hour and weekly windows) to
// ~/.config/herdr-app/data/x-herdr-status/usage.json, which the status bar's usage item reads. Then it
// runs the next status line command, if one is given, with the same input and prints its output
// (Claude Code takes only one status line command, and Orca's was already there).
//
// ~/.claude/settings.json:
//   "statusLine": { "type": "command",
//     "command": "node \"C:/Users/<you>/.config/herdr-app/mods/x-herdr-status/statusline.cjs\" \"<next command>\"" }
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const home =
    process.env.HERDR_APP_HOME ||
    path.join(os.homedir(), '.config', 'herdr-app');
const dir = path.join(home, 'data', 'x-herdr-status');

// Several Claudes can write at once: write a temp file, then rename it over the old one.
function save(name, data) {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `${name}.${process.pid}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(data));
    // On Windows the rename fails while a reader (Herdr) has the file open: then just write it.
    try {
        fs.renameSync(tmp, path.join(dir, name));
    } catch {
        try {
            fs.writeFileSync(path.join(dir, name), JSON.stringify(data));
        } catch {}
        try {
            fs.unlinkSync(tmp);
        } catch {}
    }
}

const chunks = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
    const input = Buffer.concat(chunks);
    try {
        const p = JSON.parse(input.toString('utf8'));
        if (p.rate_limits)
            save('usage.json', {
                at: Date.now(),
                model: p.model?.display_name ?? null,
                rate_limits: p.rate_limits,
                version: p.version ?? null,
            });
    } catch {} // never break the status line
    const next = process.argv[2];
    if (next) {
        const r = spawnSync(next, {
            encoding: 'utf8',
            input,
            shell: true,
            timeout: 8000,
            windowsHide: true,
        });
        if (r.stdout) process.stdout.write(r.stdout);
    }
});
