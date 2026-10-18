// pm2 app for the x-cc-otel tap, on trial (docs/test-drive/pm2.md); the launchd plist beside it is the fallback, disabled while the trial runs
const home = '/Users/dima';

module.exports = {
    apps: [
        {
            autorestart: true,
            cwd: `${home}/frame/schedule/jobs/x-cc-otel`,
            error_file: `${home}/.local/share/x-cc-otel/daemon.err.log`,
            exp_backoff_restart_delay: 100,
            // fnm's default alias, never a version dir: fnm repoints it on every bump
            interpreter: `${home}/.local/share/fnm/aliases/default/bin/node`,
            kill_timeout: 3000,
            max_restarts: 16,
            min_uptime: '10s',
            name: 'x-cc-otel',
            out_file: `${home}/.local/share/x-cc-otel/daemon.log`,
            script: `${home}/frame/schedule/jobs/x-cc-otel/server.ts`,
            time: true,
            watch: false,
        },
    ],
};
