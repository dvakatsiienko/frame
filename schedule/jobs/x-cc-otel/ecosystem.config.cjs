// pm2 app for the x-cc-otel tap, on trial (docs/test-drive/pm2.md); the launchd plist beside it is the fallback, disabled while the trial runs
const home = '/Users/dima';

module.exports = {
    apps: [
        {
            name: 'x-cc-otel',
            script: `${home}/frame/schedule/jobs/x-cc-otel/server.ts`,
            // fnm's default alias, never a version dir: fnm repoints it on every bump
            interpreter: `${home}/.local/share/fnm/aliases/default/bin/node`,
            cwd: `${home}/frame/schedule/jobs/x-cc-otel`,
            autorestart: true,
            exp_backoff_restart_delay: 100,
            min_uptime: '10s',
            max_restarts: 16,
            kill_timeout: 3000,
            watch: false,
            time: true,
            out_file: `${home}/.local/share/x-cc-otel/daemon.log`,
            error_file: `${home}/.local/share/x-cc-otel/daemon.err.log`,
        },
    ],
};
